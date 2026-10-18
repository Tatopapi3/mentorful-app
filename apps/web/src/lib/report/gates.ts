/**
 * The three gates on the Culture Scan report, kept separate on purpose.
 *
 * - The whole report needs REPORT_SHARE of the faculty to have responded, so it reflects the staff and
 *   not just the volunteers.
 * - The network needs its own absolute floor. Correlations need a sample, whatever the percentage, so a
 *   small school gets its scores and the efficacy-structure gap but no network.
 * - Any group smaller than CELL_FLOOR is never shown (enforced in the database for conversation counts).
 *
 * Pure functions: no DB, no React.
 */

export const REPORT_SHARE = 0.6;
export const NETWORK_FLOOR = 25;
export const CELL_FLOOR = 5;

export type Gates = {
  respondents: number;
  /** Faculty headcount, or 0 when it is not known. */
  faculty: number;
  /** respondents / faculty as a whole percent, or null when the headcount is unknown. */
  sharePct: number | null;
  /** Responses needed for the report to open, or null when the headcount is unknown. */
  reportNeed: number | null;
  report: boolean;
  network: boolean;
  cellFloor: number;
  /** True while the report is not yet representative. The numbers may be shown, labelled as an early look. */
  early: boolean;
};

export function evaluateGates(respondents: number, faculty: number): Gates {
  const known = faculty > 0;
  const reportNeed = known ? Math.ceil(REPORT_SHARE * faculty) : null;
  const report = reportNeed !== null && respondents >= reportNeed;
  return {
    respondents,
    faculty: known ? faculty : 0,
    sharePct: known ? Math.round((respondents / faculty) * 100) : null,
    reportNeed,
    report,
    network: respondents >= NETWORK_FLOOR,
    cellFloor: CELL_FLOOR,
    early: !report,
  };
}

/** One plain sentence about where the gates stand, for the banner above the report. */
export function gateSentence(g: Gates): string {
  if (g.reportNeed === null) {
    return "The faculty headcount isn't known yet, so the report can't tell whether enough staff have responded.";
  }
  return `${g.respondents} of ${g.faculty} teachers (${g.sharePct}%) have responded. The full report opens at ${g.reportNeed} (${Math.round(REPORT_SHARE * 100)}% of faculty).`;
}
