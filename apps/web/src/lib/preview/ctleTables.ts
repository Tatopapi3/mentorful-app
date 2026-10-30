/**
 * Preview only. Made-up CTLE hours (020_ctle_hours.sql) for the signed-in preview teacher, so the tracker has a lived-in
 * example (a few approved-sponsor sessions, language acquisition, one personal-record hour), and for the teachers who
 * opted in to anonymous totals, plus a JavaScript twin of ctle_progress() so the admin panel has something to show. The
 * SQL is the real thing (tested on its own); this mirrors it, using the same pace rule from lib/teacher/ctle.ts.
 */
import { ctleProgress, type CtleEntry } from "@/lib/teacher/ctle";
import type { Row, Tables } from "./mockQuery";

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(Date.now() - n * DAY);
const hash = (a: number, b: number) => (Math.imul(a ^ 0x9e3779b9, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 40503)) >>> 0;

export function addCtleTables(t: Tables, meId: string): void {
  const settings: Row[] = [];
  const hours: Row[] = [];
  const add = (profile: string, ago: number, h: number, title: string, sponsor: string, o: { language?: boolean; approved?: boolean; certificate?: boolean } = {}) =>
    hours.push({ id: `ctle-${hours.length + 1}`, profile_id: profile, taken_on: daysAgo(ago), hours: h, title, sponsor, language: !!o.language, approved: o.approved !== false, certificate: o.certificate !== false, voided_at: null, created_at: new Date(Date.now() - ago * DAY).toISOString() });

  // The signed-in teacher: 26 months into a 5-year period, 46 approved hours (8 of them language acquisition), so "on pace".
  settings.push({ profile_id: meId, period_start: daysAgo(790), period_years: 5, required_hours: 100, language_pct: 15, updated_at: new Date().toISOString() });
  add(meId, 640, 6, "Culturally responsive teaching, day 1 and 2", "District PD");
  add(meId, 560, 12, "Summer math institute", "BOCES");
  add(meId, 410, 3, "Restorative practices", "District PD");
  add(meId, 300, 8, "Supporting multilingual learners in math", "City college", { language: true });
  add(meId, 190, 6, "Co-teaching workshop", "District PD");
  add(meId, 95, 4, "Data-informed instruction", "BOCES");
  add(meId, 40, 7, "Mentorful: peer visits and debriefs", "District PD");
  add(meId, 12, 2, "Webinar on assessment design", "Publisher webinar", { approved: false, certificate: false });

  // Teachers who opted in to anonymous totals, each at their own pace, so the school-wide reading has a spread.
  const sharing = new Set((t.growth_sharing ?? []).filter((s) => s.share).map((s) => s.profile_id as string));
  t.profiles
    .filter((p) => p.role === "teacher" && p.id !== meId && sharing.has(p.id as string))
    .forEach((p, i) => {
      // Each teacher is at their own point: a few finished, a good share on pace, the rest behind (some only a little).
      const kind = i % 7; // 0 complete, 1-3 on pace, 4-5 a little behind, 6 well behind
      const start = kind === 0 ? 1500 + (hash(i, 1) % 250) : 200 + (hash(i, 1) % 1500);
      const elapsed = Math.min(1, start / 1826);
      settings.push({ profile_id: p.id, period_start: daysAgo(start), period_years: 5, required_hours: 100, language_pct: 15, updated_at: new Date().toISOString() });
      const pace = kind === 0 ? 1 : kind <= 3 ? 1.2 : kind <= 5 ? 0.85 : 0.5;
      const total = kind === 0 ? 104 : Math.round(100 * elapsed * pace) + 1;
      const lang = kind === 0 ? 16 : Math.max(kind <= 3 ? 1 : 0, Math.round(15 * elapsed * (kind <= 3 ? 1.3 : kind <= 5 ? 0.9 : 0.4)));
      if (total > lang) add(p.id as string, Math.max(1, start - 120), total - lang, "Professional development", "District PD");
      if (lang > 0) add(p.id as string, Math.max(1, start - 200), lang, "Language acquisition for ELLs", "BOCES", { language: true });
    });

  t.ctle_settings = settings;
  t.ctle_hours = hours;
}

const pct5 = (x: number, n: number) => 5 * Math.round((100 * x) / n / 5);

/** What ctle_progress() returns for an admin; null for a teacher. */
export function ctleReading(t: Tables): Record<string, unknown> {
  const teachers = t.profiles.filter((p) => p.role === "teacher");
  const ids = new Set((t.growth_sharing ?? []).filter((s) => s.share && teachers.some((p) => p.id === s.profile_id)).map((s) => s.profile_id as string));
  const tracked = (t.ctle_settings ?? []).filter((s) => ids.has(s.profile_id as string));
  const n = tracked.length;
  if (n < 5) return { teachers: teachers.length, enough: false };
  const today = iso(Date.now());
  const states = tracked.map((s) => {
    const entries = (t.ctle_hours ?? []).filter((h) => h.profile_id === s.profile_id) as unknown as CtleEntry[];
    return ctleProgress(entries, { period_start: s.period_start as string, period_years: s.period_years as number, required_hours: s.required_hours as number, language_pct: s.language_pct as number }, today).pace;
  });
  const count = (p: string) => states.filter((x) => x === p).length;
  return {
    teachers: teachers.length,
    enough: true,
    contributors: 5 * Math.round(n / 5),
    tracking_pct: Math.min(100, pct5(n, teachers.length)),
    complete_pct: pct5(count("complete"), n),
    on_pace_pct: pct5(count("on-pace"), n),
    behind_pct: pct5(count("behind"), n),
  };
}
