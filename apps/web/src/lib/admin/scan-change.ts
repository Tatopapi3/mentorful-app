import { DIMENSIONS, DIMENSION_LABEL, type Dimension } from "@/lib/report/stats";
import type { AdminSnapshot } from "./facts";

export type ScanChange = {
  /** Collective efficacy (the CTE score), out of 6, last year and now. */
  cteBefore: number;
  cteNow: number;
  /** The same two, as a share of 6. */
  pctBefore: number;
  pctNow: number;
  /** Each dimension's change since last year (negative is a fall), and the one that moved most. */
  byDimension: Record<Dimension, number>;
  biggest: Dimension;
  /** Last year's averages, for the bars. */
  before: Record<Dimension, number>;
};

/** How this year's Culture Scan compares with last year's, or null when there is no earlier scan. Averages only. */
export function scanChange(snap: Pick<AdminSnapshot, "scan" | "scanBefore">): ScanChange | null {
  const { scan, scanBefore } = snap;
  if (!scan || !scanBefore) return null;
  const byDimension = {} as Record<Dimension, number>;
  for (const d of DIMENSIONS) byDimension[d] = scan.means[d] - scanBefore.means[d];
  const biggest = [...DIMENSIONS].sort((a, b) => Math.abs(byDimension[b]) - Math.abs(byDimension[a]))[0];
  return {
    cteBefore: scanBefore.means.efficacy,
    cteNow: scan.means.efficacy,
    pctBefore: Math.round((scanBefore.means.efficacy / 6) * 100),
    pctNow: Math.round((scan.means.efficacy / 6) * 100),
    byDimension,
    biggest,
    before: { ...scanBefore.means },
  };
}

const oneDecimal = (n: number) => Math.abs(n).toFixed(1);

/** One sentence for a page or a PDF: "Down 0.9 since last year (5.1 to 4.2, 85% to 70%). Structural moved most." */
export function scanChangeSentence(c: ScanChange): string {
  const delta = c.cteNow - c.cteBefore;
  const way = delta < 0 ? "Down" : delta > 0 ? "Up" : "Level";
  const move = way === "Level" ? "Level with last year" : `${way} ${oneDecimal(delta)} since last year (${c.cteBefore.toFixed(1)} to ${c.cteNow.toFixed(1)}, ${c.pctBefore}% to ${c.pctNow}%)`;
  return `${move}. ${DIMENSION_LABEL[c.biggest]} moved most (${c.byDimension[c.biggest] < 0 ? "down" : "up"} ${oneDecimal(c.byDimension[c.biggest])}).`;
}
