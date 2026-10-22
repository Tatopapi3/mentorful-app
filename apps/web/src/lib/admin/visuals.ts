/**
 * The numbers behind three diagrams, kept free of drawing so they can be tested: the four culture dimensions as
 * bubbles joined by lines, the arcs between departments, and the split of pairs into active and needing a nudge.
 * Everything is an aggregate. Nothing here can point at a person or a pair.
 */
import { DIMENSIONS, type Dimension, type ReportStats } from "@/lib/report/stats";
import type { DeptMatrix } from "./network";
import { crossCount } from "./network";

/** A partial correlation under this is drawn faint and dashed: the tie is not distinguishable from nothing. */
export const NEGLIGIBLE = 0.15;

export type Bubble = { dimension: Dimension; x: number; y: number; r: number; mean: number; focus: boolean };
export type Tie = { a: Dimension; b: Dimension; value: number; weak: boolean; width: number };

const SPOTS: Record<Dimension, { x: number; y: number }> = {
  structural: { x: 320, y: 62 },
  relational: { x: 112, y: 168 },
  cognitive: { x: 528, y: 168 },
  efficacy: { x: 320, y: 274 },
};

/** Bubble size follows the average (1 to 6), the focus mark goes on the lowest one, and line width follows how strongly two dimensions move together. */
export function cultureBubbles(stats: Pick<ReportStats, "dimensions" | "partial">): { bubbles: Bubble[]; ties: Tie[]; focus: Dimension } {
  const lowest = [...DIMENSIONS].sort((a, b) => stats.dimensions[a].mean - stats.dimensions[b].mean)[0];
  const bubbles = DIMENSIONS.map((d) => {
    const mean = stats.dimensions[d].mean;
    return { dimension: d, ...SPOTS[d], r: Math.round(28 + ((Math.min(6, Math.max(1, mean)) - 1) / 5) * 26), mean, focus: d === lowest };
  });
  const ties: Tie[] = [];
  for (let i = 0; i < DIMENSIONS.length; i++)
    for (let j = i + 1; j < DIMENSIONS.length; j++) {
      const value = stats.partial[i]?.[j] ?? 0;
      const weak = Math.abs(value) < NEGLIGIBLE;
      ties.push({ a: DIMENSIONS[i], b: DIMENSIONS[j], value, weak, width: weak ? 1.2 : Math.round((1.5 + Math.abs(value) * 14) * 10) / 10 });
    }
  return { bubbles, ties, focus: lowest };
}

export type Arc = { a: string; b: string; count: number; width: number; d: string };

/** Departments along a line and one arc for every pair of departments that has a pair between them, thicker for more pairs. */
export function flowArcs(m: DeptMatrix, width = 720, baseline = 190): { dots: { dept: string; x: number; within: number }[]; arcs: Arc[]; max: number } {
  const n = m.depts.length;
  const pad = 60;
  const step = n > 1 ? (width - pad * 2) / (n - 1) : 0;
  const dots = m.depts.map((dept, i) => ({ dept, x: Math.round(pad + i * step), within: m.within[dept] ?? 0 }));
  const arcs: Arc[] = [];
  let max = 1;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const count = crossCount(m, m.depts[i], m.depts[j]);
      if (count === 0) continue;
      max = Math.max(max, count);
      const x1 = dots[i].x;
      const x2 = dots[j].x;
      const h = Math.min(baseline - 20, (x2 - x1) * 0.42 + 14);
      arcs.push({ a: m.depts[i], b: m.depts[j], count, width: 0, d: `M${x1},${baseline} C${x1},${baseline - h} ${x2},${baseline - h} ${x2},${baseline}` });
    }
  for (const a of arcs) a.width = Math.round((2 + (a.count / max) * 6) * 10) / 10;
  // thin arcs are drawn last so they are not buried under thick ones
  arcs.sort((x, y) => y.count - x.count);
  return { dots, arcs, max };
}

export type PairingSplit = { active: number; nudge: number | null; crossing: number; inside: number };

/** How many pairs are on track, how many have not logged in a while (a count, never which pairs), and the department mix. */
export function pairingSplit(pairs: number, quiet: number | null, crossing: number): PairingSplit {
  return { active: quiet === null ? pairs : Math.max(0, pairs - quiet), nudge: quiet, crossing, inside: Math.max(0, pairs - crossing) };
}
