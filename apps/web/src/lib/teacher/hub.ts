import type { Entry, Model } from "./model";

/**
 * The pure side of the teacher hub: the games catalogue and each module's status, suggestions drawn from the teacher's
 * own conversations, time on the platform, and notes to a future self. Nothing here touches the database, so all of it
 * is tested directly (tests/teacher-hub.test.ts).
 */

/* ------------------------------------------------------------------ games */

export type Module = { slug: string; name: string; focus: string; minutes: number; icon: "shield" | "grid" | "compass" | "eye" | "trophy" | "swap" };

/** The six modules from Bertrand's games hub (his data/games.json), as a catalogue. Progress comes from sessions, not from a stored percentage. */
export const MODULES: Module[] = [
  { slug: "trust", name: "Trust Calibration Matrix", focus: "Build norms and safety", minutes: 15, icon: "shield" },
  { slug: "dominoes", name: "Domain Mapping Dominoes", focus: "Link strengths to domains", minutes: 20, icon: "grid" },
  { slug: "plc", name: "PLC Navigator", focus: "Run a focused PLC cycle", minutes: 25, icon: "compass" },
  { slug: "fishbowl", name: "Fishbowl Protocol", focus: "Observe and debrief", minutes: 30, icon: "eye" },
  { slug: "efficacy", name: "Efficacy Quest", focus: "Track teaching wins", minutes: 10, icon: "trophy" },
  { slug: "relay", name: "Feedback Reframing Relay", focus: "Turn critique into next steps", minutes: 15, icon: "swap" },
];

/** Which module suits a conversation's area, so a suggestion has somewhere to go. A suggestion, never an assignment. */
const MODULE_FOR_DOMAIN: Record<string, string> = {
  CLASSROOM: "Fishbowl Protocol",
  PLANNING: "PLC Navigator",
  COMMUNICATION: "Trust Calibration Matrix",
  ASSESSMENT: "Feedback Reframing Relay",
  CELEBRATIONS: "Efficacy Quest",
};

export type GameSession = { id: string; pairing_id: string; module: string; logged_by: string; minutes: number | null; completed: boolean; note: string | null; created_at: string };

export type ModuleStatus = { module: Module; state: "new" | "started" | "done"; sessions: number; minutes: number; lastAt: string | null };

export function moduleStatuses(sessions: GameSession[], pairingId: string): ModuleStatus[] {
  const mine = sessions.filter((s) => s.pairing_id === pairingId);
  return MODULES.map((module) => {
    const rows = mine.filter((s) => s.module === module.name).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return {
      module,
      state: rows.some((r) => r.completed) ? "done" : rows.length ? "started" : "new",
      sessions: rows.length,
      minutes: rows.reduce((n, r) => n + (r.minutes ?? 0), 0),
      lastAt: rows[0]?.created_at ?? null,
    };
  });
}

/* ------------------------------------------------------------ suggestions */

export type Suggestion = { id: string; focus: string; why: string; prompt: string; module: string };

/** The first sentence, trimmed to a readable length. */
export function clip(text: string, max = 110): string {
  const t = text.trim().replace(/\s+/g, " ");
  const first = t.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? t;
  const s = first.length > max ? `${first.slice(0, max - 1).replace(/[\s,;:.-]+$/, "")}…` : first;
  return s.replace(/[.]$/, "");
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * A short list of things worth trying next, drawn only from the teacher's own submitted conversations (so it can only
 * quote words the teacher was already party to). No model is involved: every suggestion points at the entry it came
 * from, which is also why each one carries a "why".
 */
export function suggestionsFrom(entries: Entry[], limit = 6): Suggestion[] {
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const add = (s: Suggestion) => {
    const key = s.focus.toLowerCase();
    if (seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push(s);
  };
  for (const e of entries) {
    if (e.status !== "submitted") continue;
    const when = shortDate(e.at);
    const mod = MODULE_FOR_DOMAIN[e.domain] ?? "PLC Navigator";
    const aboutMe = e.direction === "visitsMe" && !e.mine; // a colleague wrote this about my classroom
    const byMe = e.direction === "iVisit" && e.mine; // I wrote this about theirs
    if (aboutMe && e.more?.trim()) {
      add({ id: `${e.id}:more`, focus: clip(e.more), why: `${e.partnerFirst} suggested more of this after visiting your classroom on ${when}.`, prompt: `Pick one lesson this week to try it, then tell ${e.partnerFirst} what you noticed.`, module: mod });
    }
    if (aboutMe && e.less?.trim()) {
      add({ id: `${e.id}:less`, focus: `Less of: ${clip(e.less)}`, why: `${e.partnerFirst} named this as the thing to do less of, on ${when}.`, prompt: `Choose one moment this week to do it differently, and tell ${e.partnerFirst} how it went.`, module: mod });
    }
    if (byMe && e.strength?.trim()) {
      add({ id: `${e.id}:borrow`, focus: `Borrow from ${e.partnerFirst}: ${clip(e.strength)}`, why: `You saw this when you visited ${e.partnerFirst}'s classroom on ${when}.`, prompt: "Try one piece of it in your own room this week, and report back.", module: mod });
    }
    if (e.resources?.trim()) {
      add({ id: `${e.id}:swap`, focus: `Follow through: ${clip(e.resources)}`, why: `You and ${e.partnerFirst} agreed this on ${when}.`, prompt: "Send it, or ask for it, and log that it landed.", module: mod });
    }
  }
  return out;
}

/* --------------------------------------------------------------- time */

export type PlatformDay = { day: string; seconds: number };

/** "2h 05m", "45m", "under a minute". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return s === 0 ? "0m" : "under a minute";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export const addDays = (day: string, n: number): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Dec 19" from "2026-12-19", with no time zone involved: a calendar day is the same day everywhere. */
export const dayLabel = (day: string): string => {
  const [, m, d] = day.split("-").map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : day;
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The last seven days ending today (local day, supplied by the caller), oldest first. Counts, never targets. */
export function weekBars(rows: PlatformDay[], today: string): { day: string; label: string; seconds: number; today: boolean }[] {
  const by = new Map(rows.map((r) => [r.day, r.seconds]));
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    return { day, label: WEEKDAY[new Date(`${day}T00:00:00Z`).getUTCDay()], seconds: by.get(day) ?? 0, today: day === today };
  });
}

export function timeTotals(rows: PlatformDay[], today: string) {
  const since = (n: number) => addDays(today, -(n - 1));
  const sum = (from: string) => rows.filter((r) => r.day >= from && r.day <= today).reduce((n, r) => n + r.seconds, 0);
  return { today: sum(today), week: sum(since(7)), month: sum(since(30)), daysActive: rows.filter((r) => r.day >= since(30) && r.day <= today && r.seconds >= 60).length };
}

/* -------------------------------------------------- notes to future self */

export type FutureNote = { id: string; body: string | null; open_on: string | null; opened_at: string | null; created_at: string };

export type NoteState = "sealed" | "arrived" | "opened" | "kept";

/** sealed: waiting for its date. arrived: its date has come and it hasn't been read. opened: read. kept: no date, just saved. */
export function noteState(n: Pick<FutureNote, "open_on" | "opened_at">, today: string): NoteState {
  if (n.opened_at) return "opened";
  if (!n.open_on) return "kept";
  return n.open_on > today ? "sealed" : "arrived";
}

export type DeliveryOption = { key: "week" | "month" | "cycle" | "keep"; label: string; date: string | null };

export function deliveryOptions(today: string, cycleEnds: string | null): DeliveryOption[] {
  const opts: DeliveryOption[] = [
    { key: "week", label: "In a week", date: addDays(today, 7) },
    { key: "month", label: "In a month", date: addDays(today, 30) },
  ];
  const end = cycleEnds?.slice(0, 10);
  if (end && end > addDays(today, 7)) opts.push({ key: "cycle", label: "End of the cycle", date: end });
  opts.push({ key: "keep", label: "No date, just keep it", date: null });
  return opts;
}

/** What the page is allowed to hold: a note whose date hasn't come keeps its words on the server until the teacher chooses to open it. */
export function withheld<T extends { body: string | null }>(n: T, state: NoteState): T {
  return state === "sealed" ? { ...n, body: null } : n;
}

/* ---------------------------------------------------------- growth goals */

export type Goal = { id: string; title: string; area: string | null; why: string | null; target_date: string | null; status: "active" | "done" | "dropped"; created_at: string };
export type GrowthKind = "practice" | "learning" | "reflection" | "observation";
export type GrowthEntry = { id: string; goal_id: string | null; kind: GrowthKind; minutes: number | null; body: string; created_at: string };

export const KIND_LABEL: Record<GrowthKind, string> = { practice: "Tried it", learning: "Learned", reflection: "Reflected", observation: "Observed" };

export function practiceTotals(entries: GrowthEntry[], now: Date) {
  const since = now.getTime() - 30 * 86_400_000;
  const recent = entries.filter((e) => Date.parse(e.created_at) >= since);
  return { entries: recent.length, minutes: recent.reduce((n, e) => n + (e.minutes ?? 0), 0) };
}

/** Suggested chips for the area of a goal: the same four areas as everywhere else, so a goal can line up with a conversation. */
export const GOAL_AREAS = ["Classroom Culture", "Lesson Planning", "Communication", "Assessment & Feedback"] as const;

/** For "Use in a log": the text a suggestion drops into the composer. */
export const prefillFor = (s: Pick<Suggestion, "focus" | "prompt">) => `${s.focus}. ${s.prompt}`;

export type { Model };
