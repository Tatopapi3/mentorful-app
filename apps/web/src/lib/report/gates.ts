/**
 * When the Culture Scan may be shown, and how many people it may claim to describe. Nick, Oct 29:
 *   - the report needs 60% of the roster to have responded (the roster is schools.faculty_headcount, script 020);
 *   - the network (partial correlations) needs at least 25 respondents, because the correlations are unstable below that;
 *   - demo rows never count toward "real", and a figure that mixes them says so (never "56 teachers" when 6 are real).
 * Pure, so it is tested directly (tests/report-gates.test.ts).
 */

export const PARTICIPATION_SHARE = 0.6;
export const NETWORK_MIN_RESPONDENTS = 25;

export type Participation =
  | { status: "ok"; required: number }
  /** No headcount on the school record, so there is nothing to measure 60% of. */
  | { status: "no-headcount" }
  | { status: "below"; required: number; short: number };

/** `real` is the number of respondents whose rows are not synthetic. */
export function participation(real: number, headcount: number | null | undefined): Participation {
  if (!headcount || headcount < 1) return { status: "no-headcount" };
  const required = Math.ceil(headcount * PARTICIPATION_SHARE);
  return real >= required ? { status: "ok", required } : { status: "below", required, short: required - real };
}

export const networkAllowed = (respondents: number) => respondents >= NETWORK_MIN_RESPONDENTS;

/** How many of a scan's respondents are demo rows. When it isn't known, a scan that includes demo data is assumed to be all demo. */
export const demoCount = (s: { n: number; includesSynthetic: boolean; demoN?: number }) => Math.min(s.n, s.demoN ?? (s.includesSynthetic ? s.n : 0));

/** "56 respondents (6 real, 50 demo)", "56 respondents · demo", or "6 respondents". */
export const respondentsText = (s: { n: number; includesSynthetic: boolean; demoN?: number }) => {
  const demo = demoCount(s);
  return `${s.n} respondents${demo <= 0 ? "" : demo >= s.n ? " · demo" : ` (${s.n - demo} real, ${demo} demo)`}`;
};

/** "n=56 · demo", "n=6", or "n=56 (6 real, 50 demo)". */
export function respondentLabel(n: number, demo: number): string {
  if (demo <= 0) return `n=${n}`;
  if (demo >= n) return `n=${n} · demo`;
  return `n=${n} (${n - demo} real, ${demo} demo)`;
}
