/**
 * Where a person goes right after the sign-in link: a school lead to the leadership dashboard, everyone else to the
 * teacher dashboard, unless the link named a place (and it is a path on this site). Pure, so it is tested directly
 * (tests/auth-landing.test.ts).
 */
export function safeNext(next: string | null | undefined): string | null {
  // Only a path on this site: "/x" is fine, "//evil.com", "/\evil.com" and "http://evil.com" are not, and neither is
  // anything that could turn `${origin}${next}` into another host.
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\r\n]/.test(next)) return null;
  return next;
}

export function landingPath(role: string | null | undefined, next: string | null | undefined): string {
  return safeNext(next) ?? (role === "admin" ? "/admin" : "/dashboard");
}
