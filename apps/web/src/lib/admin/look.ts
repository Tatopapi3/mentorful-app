/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * The leadership area has one look: Aurora. (It once came in three, Nick's, Aurora and a blend, so they could be compared;
 * the choice was made and the others were removed.) `LOOK` and `lookBase` stay as the one place the skin name and the
 * base path are written, so the shared components keep taking a `skin`.
 */
export type Look = "aurora";
export const LOOK: Look = "aurora";
export const lookBase = (_look: Look = LOOK) => "/admin" as const;
