/**
 * How things change over time, worked out from counts only. Two sources: the pairings of every cycle (who is paired
 * with whom, read the way the rest of the dashboard reads them) and a count of submitted conversations by month,
 * which comes from a database function because conversations are pair-private. Pure: no database, no React.
 */
import type { AdminPair, AdminPerson } from "./facts";
import { coverage, departmentMatrix } from "./network";

/** A number under this is never shown. The same floor the rest of the app uses for small groups. */
export const MIN_CELL = 5;

export type CycleMetrics = { cycleId: string; name: string; pairs: number; partneredPct: number; crossPct: number; connections: number; possible: number };

/** One row per cycle, oldest first, so a line reads left to right. */
export function cycleTrend(people: AdminPerson[], cycles: { id: string; name: string }[], pairsByCycle: Record<string, AdminPair[]>): CycleMetrics[] {
  const dept = new Map(people.map((p) => [p.id, p.dept]));
  return cycles.map((c) => {
    const pairs = pairsByCycle[c.id] ?? [];
    const paired = new Set(pairs.flatMap((p) => [p.a, p.b]));
    const cov = coverage(departmentMatrix({ people, pairs }));
    return {
      cycleId: c.id,
      name: c.name,
      pairs: pairs.length,
      partneredPct: people.length ? Math.round((paired.size / people.length) * 100) : 0,
      crossPct: pairs.length ? Math.round((pairs.filter((p) => dept.get(p.a) !== dept.get(p.b)).length / pairs.length) * 100) : 0,
      connections: cov.connected,
      possible: cov.possible,
    };
  });
}

export type Metric = "pairs" | "partneredPct" | "crossPct" | "connections";

/** The plain sentence above the charts: what moved most between the first cycle and the latest. */
export function trendSentence(rows: CycleMetrics[]): string {
  if (rows.length < 2) return "There is one cycle so far. Once a second cycle has pairs, each number below becomes a line.";
  const a = rows[0];
  const b = rows[rows.length - 1];
  const parts: string[] = [];
  if (b.partneredPct !== a.partneredPct) parts.push(`teachers with a partner went from ${a.partneredPct}% to ${b.partneredPct}%`);
  if (b.connections !== a.connections) parts.push(`connected department pairs went from ${a.connections} to ${b.connections} of ${b.possible}`);
  if (b.crossPct !== a.crossPct) parts.push(`pairs across departments went from ${a.crossPct}% to ${b.crossPct}%`);
  if (parts.length === 0) return `Nothing has moved between ${a.name} and ${b.name}.`;
  return `Between ${a.name} and ${b.name}, ${parts.join(", ")}.`;
}

/** What the database function returns: counts only, with anything under the floor already null. */
export type RawActivity = {
  months: { month: string; n: number | null }[];
  heat: { department: string; month: string; n: number | null }[];
};

export type Activity = {
  months: string[];
  totals: { month: string; n: number | null }[];
  departments: string[];
  /** Count for a department in a month, or null when it is under the floor (or absent). */
  cell: (department: string, month: string) => number | null;
  max: number;
};

const floor = (n: number | null | undefined) => (typeof n === "number" && n >= MIN_CELL ? n : null);

/** The floor is applied again here, so a function that forgot it still can't show a small number. */
export function buildActivity(raw: RawActivity): Activity {
  const months = [...new Set([...raw.months.map((m) => m.month), ...raw.heat.map((h) => h.month)])].sort();
  const departments = [...new Set(raw.heat.map((h) => h.department))].sort();
  const key = (d: string, m: string) => `${d}|${m}`;
  const cells = new Map(raw.heat.map((h) => [key(h.department, h.month), floor(h.n)]));
  const totals = months.map((month) => ({ month, n: floor(raw.months.find((m) => m.month === month)?.n) }));
  return {
    months,
    totals,
    departments,
    cell: (d, m) => cells.get(key(d, m)) ?? null,
    max: Math.max(1, ...totals.map((t) => t.n ?? 0), ...[...cells.values()].map((v) => v ?? 0)),
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-10" becomes "Oct 2025". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const name = MONTHS[Number(m) - 1];
  return name ? `${name} ${y}` : month;
}

/** The sentence under the monthly chart, or null when no month is above the floor. */
export function activitySentence(a: Activity): string | null {
  const shown = a.totals.filter((t) => t.n !== null) as { month: string; n: number }[];
  if (shown.length === 0) return null;
  const top = shown.reduce((x, y) => (y.n > x.n ? y : x));
  const total = shown.reduce((s, t) => s + t.n, 0);
  return `${total} conversations are counted in the months shown. ${monthLabel(top.month)} was the busiest, with ${top.n}.`;
}
