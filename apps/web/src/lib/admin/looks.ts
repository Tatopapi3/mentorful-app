/**
 * Which looks of the leadership views are on offer. Unset means all three. Set NEXT_PUBLIC_LOOKS to a comma list
 * (for example "blend") to show only those, once a look has been chosen. The switch in the top bar then only offers
 * what is enabled, and disappears when there is nothing to switch between.
 */
export type LookName = "nick" | "aurora" | "blend";
const ALL: LookName[] = ["nick", "aurora", "blend"];

const asked = (process.env.NEXT_PUBLIC_LOOKS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s): s is LookName => (ALL as string[]).includes(s));

export const ENABLED_LOOKS: LookName[] = asked.length ? asked : ALL;
export const lookEnabled = (look: LookName) => ENABLED_LOOKS.includes(look);
