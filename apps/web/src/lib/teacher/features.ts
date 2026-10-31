/**
 * What is switched on for the first release. Nick's call on Oct 29: the pedagogy games "compete with the core flows"
 * and embedded video is "after" Demo Day. The CTLE hours tracker is a later add-on too (Juan, Oct 30). All three are
 * built but off. Nothing is deleted: set the variable to "1" at build time (NEXT_PUBLIC_FEATURE_GAMES=1,
 * NEXT_PUBLIC_FEATURE_VIDEO=1, NEXT_PUBLIC_FEATURE_CTLE=1, NEXT_PUBLIC_FEATURE_SCAN_NOTES=1) to bring one back, and every screen, route and menu entry
 * that mentions it comes back with it.
 *
 * NEXT_PUBLIC_ so the browser components see the same answer as the server; Next inlines it when the app is built.
 */
export const FEATURES = {
  games: process.env.NEXT_PUBLIC_FEATURE_GAMES === "1",
  videoCalls: process.env.NEXT_PUBLIC_FEATURE_VIDEO === "1",
  ctle: process.env.NEXT_PUBLIC_FEATURE_CTLE === "1",
  /** Photograph handwritten notes and turn them into a private note (Journal, third tab). Demo-ready now; real recognition after Nov 4. */
  scanNotes: process.env.NEXT_PUBLIC_FEATURE_SCAN_NOTES === "1",
} as const;
