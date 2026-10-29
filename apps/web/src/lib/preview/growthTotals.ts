/**
 * Preview only. Gives the rest of the demo school some growth-tool activity, and a JavaScript twin of
 * growth_activity() from scripts/019_growth_activity.sql so the admin panel has something to show. The SQL is the real
 * thing (and is tested on its own); this mirrors it for the offline preview, nothing more.
 *
 * About a third of the other teachers have opted in. Another third are heavy users who have NOT opted in, so the demo
 * shows they are left out entirely.
 */
import type { Row, Tables } from "./mockQuery";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(Date.parse(`${s}T00:00:00Z`) + n * 86_400_000));
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export function addGrowthSeeds(t: Tables, meId: string): void {
  const teachers = t.profiles.filter((p) => p.role === "teacher");
  const today = iso(new Date());
  const sharing: Row[] = [];
  const pt = (t.platform_time ??= []);
  const ge = (t.growth_entries ??= []);
  const gg = (t.growth_goals ??= []);
  const gs = (t.pair_game_sessions ??= []);
  const shares = new Set<string>();
  teachers.forEach((p, i) => {
    if (p.id === meId) {
      sharing.push({ profile_id: p.id, school_id: p.school_id, share: false, updated_at: ago(3) }); // the signed-in teacher starts opted out, to show the choice
      return;
    }
    const heavy = i % 3 === 2;
    const opted = i % 3 === 1;
    if (opted) shares.add(p.id);
    if (opted || heavy) sharing.push({ profile_id: p.id, school_id: p.school_id, share: opted, updated_at: ago(10 + (i % 9)) });
    if (!(opted || heavy)) return;
    // Each teacher has their own level of use, from almost none to most days, so the totals look like a real school.
    const level = (i * 5) % 9;
    for (let d = 0; d < 56; d++) {
      if ((i * 7 + d * 3) % 12 < level) {
        pt.push({ id: `pt-x-${i}-${d}`, profile_id: p.id, day: addDays(today, -d), seconds: heavy ? 3000 + ((i * 131 + d * 57) % 5000) : 420 + ((i * 131 + d * 57) % 2400), updated_at: ago(d) });
      }
    }
    if (i % 2 === 0 || heavy) for (let k = 0; k < 2 + (i % 3); k++) ge.push({ id: `ge-x-${i}-${k}`, profile_id: p.id, goal_id: null, kind: "practice", minutes: 10 + k * 5, body: "x", created_at: ago(2 + k * 5 + (i % 4)) });
    if (i % 4 === 1 || heavy) gg.push({ id: `gg-x-${i}`, profile_id: p.id, title: "x", area: null, why: null, target_date: null, status: i % 8 === 1 ? "done" : "active", created_at: ago(20), updated_at: ago(5) });
  });
  const latest = [...t.cycles].sort((a, b) => String(b.ends_at).localeCompare(String(a.ends_at)))[0];
  let k = 0;
  for (const p of t.pairings.filter((x) => x.status === "approved" && x.cycle_id === latest?.id)) {
    if (!(shares.has(p.host_id) || shares.has(p.visitor_id)) || p.host_id === meId || p.visitor_id === meId) continue;
    k++;
    if (k % 3 === 0) continue;
    for (let j = 0; j < 1 + (k % 2); j++) gs.push({ id: `gs-x-${k}-${j}`, pairing_id: p.id, module: ["PLC Navigator", "Fishbowl Protocol", "Efficacy Quest", "Trust Calibration Matrix"][(k + j) % 4], logged_by: p.host_id, minutes: 20, completed: (k + j) % 3 === 0, note: null, created_at: ago(2 + k + j * 6) });
  }
  t.growth_sharing = sharing;
}

const pct5 = (x: number, n: number) => 5 * Math.round(100 * x / n / 5);

export function growthActivity(t: Tables, daysIn: number): Record<string, unknown> {
  const days = Math.min(90, Math.max(7, daysIn || 30));
  const today = iso(new Date());
  const from = addDays(today, -(days - 1));
  const week = addDays(today, -6);
  const teachers = t.profiles.filter((p) => p.role === "teacher");
  const ids = new Set((t.growth_sharing ?? []).filter((s) => s.share && teachers.some((p) => p.id === s.profile_id)).map((s) => s.profile_id));
  const n = ids.size;
  if (n < 5) return { teachers: teachers.length, window_days: days, enough: false };

  const per = [...ids].map((id) => {
    const rows = (t.platform_time ?? []).filter((r) => r.profile_id === id);
    return {
      activeDays: rows.filter((r) => r.day >= from && r.seconds >= 60).length,
      weekSeconds: rows.filter((r) => r.day >= week).reduce((a, r) => a + r.seconds, 0),
      activeWeek: rows.some((r) => r.day >= week && r.seconds >= 60),
      entries: (t.growth_entries ?? []).filter((r) => r.profile_id === id && r.created_at >= from).length,
    };
  });
  const goals = (t.growth_goals ?? []).filter((g) => ids.has(g.profile_id));
  const pairs = new Map(t.pairings.map((p) => [p.id, p]));
  const games = (t.pair_game_sessions ?? []).filter((s) => {
    const p = pairs.get(s.pairing_id);
    return p && s.created_at >= from && (ids.has(p.host_id) || ids.has(p.visitor_id));
  });
  const done = new Set(games.filter((g) => g.completed).map((g) => `${g.pairing_id}|${g.module}`));
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const h = (s.length - 1) / 2;
    return (s[Math.floor(h)] + s[Math.ceil(h)]) / 2;
  };
  const entriesTotal = per.reduce((a, r) => a + r.entries, 0);
  const goalFolks = new Set(goals.map((g) => g.profile_id)).size;
  const monday = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return iso(d);
  })();
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const w = addDays(monday, -49 + i * 7);
    const active = [...ids].filter((id) => (t.platform_time ?? []).some((r) => r.profile_id === id && r.day >= w && r.day < addDays(w, 7) && r.seconds >= 60)).length;
    return { week: w, pct: pct5(active, n) };
  });
  const bucket = (label: string, test: (d: number) => boolean) => ({ label, pct: pct5(per.filter((r) => test(r.activeDays)).length, n) });
  return {
    teachers: teachers.length,
    window_days: days,
    enough: true,
    contributors: 5 * Math.round(n / 5),
    share_pct: Math.min(100, pct5(n, teachers.length)),
    active_week_pct: pct5(per.filter((r) => r.activeWeek).length, n),
    typical_week_minutes: n >= 10 ? 5 * Math.round(median(per.map((r) => r.weekSeconds)) / 60 / 5) : null,
    days_buckets: n >= 10 ? [bucket("Not at all", (d) => d === 0), bucket("1 to 3 days", (d) => d >= 1 && d <= 3), bucket("4 to 9 days", (d) => d >= 4 && d <= 9), bucket("10 or more", (d) => d >= 10)] : null,
    has_goal_pct: pct5(goalFolks, n),
    goals_done_pct: goals.length >= 5 ? pct5(goals.filter((g) => g.status === "done").length, goals.length) : null,
    practiced_pct: pct5(per.filter((r) => r.entries > 0).length, n),
    practice_entries: entriesTotal >= 5 ? entriesTotal : null,
    game_sessions: games.length >= 5 ? games.length : null,
    game_modules_done: done.size >= 5 ? done.size : null,
    pairs_playing: new Set(games.map((g) => g.pairing_id)).size >= 5 ? new Set(games.map((g) => g.pairing_id)).size : null,
    weekly,
  };
}
