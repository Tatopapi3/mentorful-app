/**
 * How the four-dimension network is drawn. Mentorful's rules, kept in one place so the slide, the
 * findings and the exports can't drift apart. Pure: no React, no DB.
 */

/** A partial correlation weaker than this is not a direct tie. It is drawn dashed and faint. */
export const NEGLIGIBLE_PARTIAL = 0.1;

export const isNegligible = (partial: number) => Math.abs(partial) < NEGLIGIBLE_PARTIAL;

const R_MIN = 46;
const R_MAX = 66;
const SCALE_MIN = 1;
const SCALE_MAX = 6;

/** Node radius follows the dimension's mean on the 1 to 6 scale, so a stronger dimension is a bigger node. */
export function nodeRadius(mean: number): number {
  const t = Math.min(1, Math.max(0, (mean - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)));
  return R_MIN + t * (R_MAX - R_MIN);
}

/**
 * Rough sampling error on a partial correlation: about 1 / sqrt(n). It is roughly 0.14 at 50 respondents
 * and wider with fewer, which is why the network always carries a caveat.
 */
export function samplingHalfWidth(n: number): number {
  return n > 0 ? 1 / Math.sqrt(n) : 1;
}

export function samplingCaveat(n: number): string {
  return `With ${n} respondents, each tie is accurate to about ±${samplingHalfWidth(n).toFixed(2)}. Weaker ties may be noise.`;
}
