/**
 * Optional sign-in allowlist and post-login landing page, both from env.
 *
 *   AUTH_ALLOWED_EMAILS=a@school.org,b@school.org   only these may sign in
 *   AUTH_HOME_PATH=/dashboard/v2                     where the magic link lands
 *
 * Unset (as on Vercel today) means no allowlist and /dashboard, so deployments
 * behave exactly as before. Server-only: neither is NEXT_PUBLIC_, and the
 * allowlist is enforced in the callback and in src/proxy.ts, not the browser.
 */

function allowed(): Set<string> | null {
  const raw = process.env.AUTH_ALLOWED_EMAILS?.trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function allowlistActive(): boolean {
  return allowed() !== null;
}

/** True when there is no allowlist, or the address is on it. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  const set = allowed();
  if (!set) return true;
  return !!email && set.has(email.trim().toLowerCase());
}

/** A same-origin path only, so ?next= can't send someone off-site. */
export function homePath(next?: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return process.env.AUTH_HOME_PATH || "/dashboard";
}
