/**
 * Which looks of the leadership views are on offer. This branch ships only the blend look: when NEXT_PUBLIC_LOOKS is
 * unset it means "blend". Set NEXT_PUBLIC_LOOKS to a comma list (for example "nick,aurora,blend") to bring the others back. The switch in the top bar then only offers
 * what is enabled, and disappears when there is nothing to switch between.
 */
export type LookName = "nick" | "aurora" | "blend";
const ALL: LookName[] = ["nick", "aurora", "blend"];

const asked = (process.env.NEXT_PUBLIC_LOOKS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s): s is LookName => (ALL as string[]).includes(s));

const DEFAULT: LookName[] = ["blend"];
export const ENABLED_LOOKS: LookName[] = asked.length ? asked : DEFAULT;
export const lookEnabled = (look: LookName) => ENABLED_LOOKS.includes(look);
