/**
 * Early warning for pairs that are drifting quiet, worked out from counts only. The database function that already
 * powers "need a nudge" (quiet_pair_count) is asked three times, for 14, 30 and 45 days, and the differences split
 * the pairs into on track, cooling (silent 14 to 30 days) and quiet (30 days or more). Leadership gets how many,
 * never which pairs: the nudge is written here and delivered by the system to the pairs, so the admin never sees
 * who received it. Pure: no database, no React.
 */
import { MIN_CELL } from "./participation";

export type QuietWindows = { pairs: number; quiet14: number; quiet30: number; quiet45: number };

export type Cooling = {
  pairs: number;
  onTrack: number;
  /** Silent for 14 to 30 days: the early warning. */
  cooling: number;
  /** Silent for 30 days or more: the pairs the dashboard already says need a nudge. */
  quiet: number;
  /** Of the quiet pairs, those silent for 45 days or more. */
  longQuiet: number;
};

/** Clamp so a function that returns the windows out of order can't make a count negative. */
export function coolingFrom(w: QuietWindows): Cooling {
  const q30 = Math.min(w.pairs, Math.max(0, w.quiet30));
  const q14 = Math.min(w.pairs, Math.max(q30, w.quiet14));
  const q45 = Math.min(q30, Math.max(0, w.quiet45));
  return { pairs: w.pairs, onTrack: w.pairs - q14, cooling: q14 - q30, quiet: q30, longQuiet: q45 };
}

/** A small count is hidden so a handful of pairs can't be picked out. */
export const countLabel = (n: number) => (n >= MIN_CELL ? String(n) : n === 0 ? "none" : "fewer than 5");

export type Warning = { level: "calm" | "watch" | "act"; title: string; detail: string };

/**
 * The sentence the panel leads with. "If nothing changes" is literal: a pair silent for 14 days reaches 30 days
 * within 16 more days, so the cooling pairs are the ones that join the quiet group in that time.
 */
export function warningFor(c: Cooling): Warning {
  if (c.pairs === 0) return { level: "calm", title: "No pairs to watch yet", detail: "Once pairs are approved, this shows which are slipping before they go quiet." };
  const drifting = c.cooling + c.quiet;
  const share = Math.round((drifting / c.pairs) * 100);
  if (drifting === 0) return { level: "calm", title: "Every pair has talked in the last two weeks", detail: `All ${c.pairs} pairs logged a conversation within 14 days.` };
  const headline = c.cooling > 0 ? `${countLabel(c.cooling)} ${c.cooling === 1 ? "pair is" : "pairs are"} cooling` : `${countLabel(c.quiet)} ${c.quiet === 1 ? "pair has" : "pairs have"} gone quiet`;
  const parts: string[] = [];
  if (c.cooling > 0) parts.push(`${countLabel(c.cooling)} ${c.cooling === 1 ? "pair has" : "pairs have"} been silent for 14 to 30 days`);
  if (c.quiet > 0) parts.push(`${countLabel(c.quiet)} for 30 days or more`);
  const ahead = c.cooling > 0 ? ` If nothing changes, up to ${countLabel(drifting)} of ${c.pairs} pairs (${share}%) will have gone a month without a conversation within about two weeks.` : "";
  return { level: share >= 40 ? "act" : "watch", title: headline, detail: `${parts.join(", ")}.${ahead}` };
}

export type NudgeAudience = "cooling" | "quiet" | "both";

export const AUDIENCE_LABEL: Record<NudgeAudience, string> = {
  cooling: "Pairs silent for 14 to 30 days",
  quiet: "Pairs silent for 30 days or more",
  both: "Both groups",
};

/** How many pairs a nudge to this audience reaches. */
export const audienceSize = (c: Cooling, a: NudgeAudience) => (a === "cooling" ? c.cooling : a === "quiet" ? c.quiet : c.cooling + c.quiet);

/** A starting message the admin can edit. It names no one and blames no one. */
export function defaultNudge(a: NudgeAudience): string {
  if (a === "cooling") return "A quick note from leadership: you and your co-mentor haven't logged a conversation in a couple of weeks. Even ten minutes counts. Log it in under a minute, and tell us if something is getting in the way.";
  if (a === "quiet") return "A quick note from leadership: it's been a while since you and your co-mentor logged a conversation. Is there anything we can do to make it easier to find time? Reply or log a short one when you can.";
  return "A quick note from leadership: we noticed it's been a little while since you and your co-mentor logged a conversation. Even ten minutes counts. If something is in the way, tell us and we'll help.";
}
