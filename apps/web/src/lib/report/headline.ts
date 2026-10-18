import type { ReportStats } from "./stats.ts";

/**
 * Mentorful's headline number is the CTE score: the Efficacy dimension mean, on the 1 to 6 scale. It is
 * not an average of the four dimensions. The 95% half-width travels with it, because the number is only
 * as good as the sample behind it.
 */
export type CteScore = { score: number; ciHalfWidth: number; n: number };

export function cteScore(stats: ReportStats): CteScore {
  const e = stats.dimensions.efficacy;
  return { score: e.mean, ciHalfWidth: e.ciHalfWidth, n: stats.n };
}
