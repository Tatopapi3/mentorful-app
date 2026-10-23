/**
 * The numbers behind the teacher's orbit: one dot for every entry in their own journal, coloured by kind, and a twelve
 * week rhythm grid. Everything here is built from the logs the signed-in teacher is already allowed to read (a pair's
 * journal is private to the pair), and nothing leaves the page. Pure: no database, no React.
 */
export type OrbitLog = { id: string; kind: "conversation" | "visit"; reflection: boolean; when: string; heading: string; text: string; domain: string };
export type PlacedLog = OrbitLog & { x: number; y: number };

type RawLog = {
  id: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  is_visit_debrief?: boolean | null;
  vision: string | null;
  strength_noted: string | null;
  more_frequently: string | null;
  less_frequently: string | null;
  domain: string;
  host_id: string | null;
  visitor_id: string | null;
};

const filled = (s: string | null | undefined) => !!s && s.trim().length > 0;
const clip = (s: string, n = 230) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The submitted entries of a journal as orbit dots, oldest first. A draft is not in the orbit until it is submitted. */
export function orbitLogs(logs: RawLog[], meId: string, nameOf: (id: string | null) => string, domainLabel: (d: string) => string): OrbitLog[] {
  return logs
    .filter((l) => l.status === "submitted")
    .map((l) => {
      const other = nameOf(l.host_id === meId ? l.visitor_id : l.host_id);
      const visit = !!l.is_visit_debrief;
      const text = [l.strength_noted, l.more_frequently, l.vision, l.less_frequently].find(filled) ?? "";
      return {
        id: l.id,
        kind: visit ? ("visit" as const) : ("conversation" as const),
        reflection: filled(l.strength_noted) || filled(l.more_frequently) || filled(l.less_frequently),
        when: l.submitted_at ?? l.created_at,
        heading: `${visit ? "Visit" : "Conversation"} with ${other}`,
        text: clip(text ?? ""),
        domain: domainLabel(l.domain),
      };
    })
    .sort((a, b) => a.when.localeCompare(b.when));
}

/** Evenly spread the dots around two rings, the same way every time. */
export function placeDots(logs: OrbitLog[], cx = 360, cy = 150, rx = 330, ry = 112): PlacedLog[] {
  const golden = 2.39996323;
  return logs.map((l, i) => {
    const outer = i % 2 === 0;
    const k = outer ? 1 : 0.72;
    const a = 0.6 + i * golden;
    return { ...l, x: Math.round(cx + Math.cos(a) * rx * k), y: Math.round(cy + Math.sin(a) * ry * k) };
  });
}

export type RhythmGrid = { weeks: { date: string; count: number }[][]; active: number; from: string; to: string; max: number };

const day = (iso: string) => iso.slice(0, 10);
const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const monday = (d: string) => addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));

/** Twelve weeks by seven days, ending with the week of the most recent entry, so a long quiet spell does not empty the grid. */
export function rhythmGrid(logs: OrbitLog[], weeks = 12): RhythmGrid | null {
  if (logs.length === 0) return null;
  const last = monday(day(logs[logs.length - 1].when));
  const first = addDays(last, -7 * (weeks - 1));
  const counts = new Map<string, number>();
  for (const l of logs) counts.set(day(l.when), (counts.get(day(l.when)) ?? 0) + 1);
  const grid = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => { const date = addDays(first, w * 7 + d); return { date, count: counts.get(date) ?? 0 }; }));
  return { weeks: grid, active: grid.filter((w) => w.some((c) => c.count > 0)).length, from: first, to: addDays(last, 6), max: Math.max(1, ...[...counts.values()]) };
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
