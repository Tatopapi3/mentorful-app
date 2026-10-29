import { MIN_CELL } from "./participation";

/**
 * The Overview page's privacy floor (Nick, Oct 29): "listing every teacher and department is the same re-identification
 * risk", so nothing on the page may single out a group under 5. Pure, so it is tested directly
 * (tests/admin-overview-floor.test.ts) and both looks of the page share it.
 *
 *  - A count under 5 is withheld (null), including 0: a zero tells a reader the group is empty, and a 1 to 4 points at people.
 *  - Departments under 5 teachers are not listed. If two or more of them together reach 5 they appear once, as a
 *    combined row; otherwise they are left out and only counted as "not shown".
 *  - Whether pairs cross departments is a split of the same total, so if either side is under 5 neither is shown
 *    (showing one would give away the other).
 */

export type Cell = number | null;

export const floorCell = (n: number): Cell => (n >= MIN_CELL ? n : null);

/** [label, count] rows with every count under the floor withheld. Order is kept. */
export const floorRows = (rows: [string, number][]): [string, Cell][] => rows.map(([label, n]) => [label, floorCell(n)]);

/** A share of a total, as a whole percent; null when the count itself is withheld or there is no total. */
export const floorShare = (n: number, total: number): number | null => (n >= MIN_CELL && total > 0 ? Math.round((n / total) * 100) : null);

export type Departments = {
  rows: [string, number][];
  /** Departments under 5 teachers that together reach 5, shown once. */
  combined: { departments: number; teachers: number } | null;
  /** Teachers in departments left out entirely. */
  notShown: number;
};

export function floorDepartments(counts: Record<string, number>): Departments {
  const entries = Object.entries(counts);
  const rows = entries.filter(([, n]) => n >= MIN_CELL).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const small = entries.filter(([, n]) => n < MIN_CELL);
  const teachers = small.reduce((a, [, n]) => a + n, 0);
  if (small.length >= 2 && teachers >= MIN_CELL) return { rows, combined: { departments: small.length, teachers }, notShown: 0 };
  return { rows, combined: null, notShown: teachers };
}

export type Crossing = { across: number; within: number } | null;

/** How many pairs join two different departments. Withheld unless both sides are 5 or more. */
export function floorCrossing(pairs: { host: string | null; visitor: string | null }[]): Crossing {
  const across = pairs.filter((p) => (p.host ?? "Unassigned") !== (p.visitor ?? "Unassigned")).length;
  const within = pairs.length - across;
  return across >= MIN_CELL && within >= MIN_CELL ? { across, within } : null;
}

export const FEWER_THAN_5 = "fewer than 5";
export const cellText = (n: Cell, suffix = "") => (n === null ? FEWER_THAN_5 : suffix ? `${n} ${suffix}` : String(n));
