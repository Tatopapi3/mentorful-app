export type ScanLevel = "low" | "watch" | "ok";

/**
 * How worried to be about a Culture Scan average (1 to 6). The scale's middle is 3.5, so below it the staff leans toward
 * disagreeing and the average is "low"; from there to 4.5 is "watch"; at 4.5 and above it is on track. These cutoffs are
 * a first reading for a school lead, not a verdict, and are the numbers to confirm with Nick (docs/HANDOFF.md).
 */
export const LOW_BELOW = 3.5;
export const WATCH_BELOW = 4.5;

export function scanLevel(mean: number): ScanLevel {
  return mean < LOW_BELOW ? "low" : mean < WATCH_BELOW ? "watch" : "ok";
}

export const LEVEL_WORD: Record<ScanLevel, string> = { low: "Low", watch: "Watch", ok: "On track" };
