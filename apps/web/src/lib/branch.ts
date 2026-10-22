/**
 * Which branch this copy of the app was built from, when it was built by the live-viewing project (branches named
 * view/*). It is how each viewing page is titled after its branch. Empty everywhere else, so nothing changes in the
 * real app or on a laptop.
 */
const NAMES: Record<string, string> = {
  "view/juan": "Juan",
  "view/admin": "Juan-Admin",
  "view/demo1": "Juan-Demo1",
  "view/demo2": "Juan-Demo2",
};

export function branchLabel(): string | null {
  const ref = process.env.VERCEL_GIT_COMMIT_REF ?? "";
  if (NAMES[ref]) return NAMES[ref];
  return ref.startsWith("view/") ? ref.slice("view/".length) : null;
}
