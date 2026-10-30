/**
 * Continuing Teacher and Leader Education (CTLE): the pure side. New York asks certified teachers for 100 hours in
 * each 5-year registration period, at least 15% of them language acquisition, from an approved sponsor. Nothing here
 * touches the database, so all of it is tested directly (tests/teacher-ctle.test.ts).
 *
 * The numbers are settings, not constants: a Level III teaching assistant needs 75 hours, another state asks something
 * else. DEFAULTS are New York's for a Professional certificate.
 *
 * This is a teacher's own record. Mentorful is not NYSED's system of record, and only hours from an approved sponsor
 * count. An hour logged as "personal record" is kept and shown, but never added to the total.
 *
 * ctle_progress() in 021_ctle_hours.sql applies the same pace rule in SQL. Change one, change the other.
 */

export const DEFAULTS = { periodYears: 5, requiredHours: 100, languagePct: 15 } as const;

export type CtleSettings = { period_start: string; period_years: number; required_hours: number; language_pct: number };

export type CtleEntry = {
  id: string;
  taken_on: string;
  hours: number;
  title: string;
  sponsor: string | null;
  language: boolean;
  /** From an approved CTLE sponsor. Only these count toward the requirement. */
  approved: boolean;
  /** The teacher has the sponsor's certificate. */
  certificate: boolean;
  voided_at: string | null;
};

export type Pace = "complete" | "on-pace" | "behind";

export type CtleProgress = {
  periodStart: string;
  periodEnd: string;
  required: number;
  languageRequired: number;
  counted: number;
  language: number;
  /** Logged but not from an approved sponsor, so not in `counted`. */
  personal: number;
  remaining: number;
  languageRemaining: number;
  daysLeft: number;
  /** 0..1, how much of the registration period has gone. */
  elapsed: number;
  /** Hours that should be done by now at an even pace. */
  expected: number;
  pace: Pace;
  /** What an even pace asks of the rest of the period; null once complete or when the period is over. */
  perMonth: number | null;
};

const DAY = 86_400_000;
const utc = (d: string) => Date.parse(`${d}T00:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(utc(s)) && iso(utc(s)) === s;

/** The first day after the period: a 5-year period starting 2024-09-01 runs through 2029-08-31. */
export function periodEnd(start: string, years: number): string {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 1, 2024" from "2024-09-01". A period spans years, so unlike the hub's dayLabel this keeps the year. */
export const dateLabel = (day: string): string => {
  const [y, m, d] = day.split("-").map(Number);
  return y && m && d ? `${MONTHS[m - 1]} ${d}, ${y}` : day;
};

/** Quarter-hours are the unit people take; round away float dust and keep them readable. */
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** "12", "12.5", "0.25". */
export const hoursLabel = (n: number) => String(round2(n));

export function ctleProgress(entries: CtleEntry[], s: CtleSettings, today: string): CtleProgress {
  const start = utc(s.period_start);
  const end = utc(periodEnd(s.period_start, s.period_years));
  const now = utc(today);
  const live = entries.filter((e) => !e.voided_at && utc(e.taken_on) >= start && utc(e.taken_on) < end);
  const sum = (rows: CtleEntry[]) => round2(rows.reduce((n, e) => n + e.hours, 0));
  const counted = sum(live.filter((e) => e.approved));
  const language = sum(live.filter((e) => e.approved && e.language));
  const personal = sum(live.filter((e) => !e.approved));

  const required = s.required_hours;
  const languageRequired = round2((required * s.language_pct) / 100);
  const elapsed = Math.min(1, Math.max(0, (now - start) / (end - start)));
  const expected = round2(required * elapsed);
  const languageExpected = languageRequired * elapsed;
  const done = counted >= required && language >= languageRequired;
  const pace: Pace = done ? "complete" : counted >= expected && language >= languageExpected ? "on-pace" : "behind";

  const daysLeft = Math.max(0, Math.ceil((end - now) / DAY));
  const monthsLeft = daysLeft / 30.44;
  const remaining = round2(Math.max(0, required - counted));
  return {
    periodStart: s.period_start,
    periodEnd: iso(end - DAY),
    required,
    languageRequired,
    counted,
    language,
    personal,
    remaining,
    languageRemaining: round2(Math.max(0, languageRequired - language)),
    daysLeft,
    elapsed,
    expected,
    pace,
    perMonth: done || monthsLeft < 0.5 ? null : round2(remaining / monthsLeft),
  };
}

/** Plain words for where the teacher stands. Never a grade; a registration period is long and people catch up. */
export function paceSentence(p: CtleProgress): string {
  if (p.pace === "complete") return "You have everything this period asks for. Keep your certificates; you may be asked for them.";
  if (p.daysLeft === 0) return `The period has ended and ${hoursLabel(p.remaining)} hours are still missing${p.languageRemaining ? `, ${hoursLabel(p.languageRemaining)} of them language acquisition` : ""}. Check with your district about your options.`;
  const left = p.daysLeft >= 60 ? `${Math.round(p.daysLeft / 30.44)} months` : `${p.daysLeft} days`;
  const base = `${hoursLabel(p.remaining)} ${p.remaining === 1 ? "hour" : "hours"} to go with ${left} left`;
  const lang = p.languageRemaining ? `, including ${hoursLabel(p.languageRemaining)} ${p.languageRemaining === 1 ? "hour" : "hours"} of language acquisition` : "";
  const rate = p.perMonth ? `. About ${Math.round(p.perMonth * 10) / 10} hours a month gets you there` : "";
  return `${base}${lang}${rate}.`;
}

export const PACE_LABEL: Record<Pace, string> = { complete: "Hours reached", "on-pace": "On pace", behind: "Behind pace" };

/** Why an entry was refused, in words a teacher can act on; null when it is fine. */
export function entryProblem(e: { taken_on: string; hours: number; title: string }, today: string): string | null {
  if (!e.title.trim()) return "Say what the course or session was.";
  if (!isDay(e.taken_on)) return "Choose the date you took it.";
  if (e.taken_on > today) return "That date hasn't happened yet.";
  if (!Number.isFinite(e.hours) || e.hours < 0.25) return "Hours must be at least a quarter hour.";
  if (e.hours > 100) return "That is more than 100 hours in one entry. Split it by date if it ran over several.";
  if (Math.round(e.hours * 100) % 25 !== 0) return "Use quarter hours: 0.25, 0.5, 0.75, 1.";
  return null;
}

export function settingsProblem(s: CtleSettings, today: string): string | null {
  if (!isDay(s.period_start)) return "Choose the day your registration period started.";
  if (s.period_start > today && utc(s.period_start) - utc(today) > 366 * DAY) return "That start date is more than a year away.";
  if (!Number.isInteger(s.period_years) || s.period_years < 1 || s.period_years > 5) return "A registration period is 1 to 5 years.";
  if (!Number.isInteger(s.required_hours) || s.required_hours < 1 || s.required_hours > 300) return "Required hours must be between 1 and 300.";
  if (!Number.isInteger(s.language_pct) || s.language_pct < 0 || s.language_pct > 100) return "Language acquisition is a percentage from 0 to 100.";
  return null;
}
