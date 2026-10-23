import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowlist";

/**
 * Refreshes the Supabase session on every matched request.
 *
 * Server Components can't write cookies (see the catch in server.ts), so
 * without this an expired access token is never replaced and the user is
 * silently signed out. Runs from src/proxy.ts.
 *
 * Does not gate any route: /report and /survey are public by design, and the
 * pages that need a user already redirect to /login themselves.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // See client.ts: publishable key first, legacy anon key as the fallback.
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
          // no-store headers, so a CDN never serves one user's session cookie to another.
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    }
  );

  // Nothing may run between createServerClient and this call. getClaims()
  // verifies the JWT and triggers the refresh; getSession() would trust the
  // cookie without checking it.
  const { data } = await supabase.auth.getClaims();

  // A session for an address off AUTH_ALLOWED_EMAILS (say, one made before the
  // list was set) is ended here, on every route, rather than trusted.
  const email = data?.claims?.email as string | undefined;
  if (data?.claims && !isAllowedEmail(email)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=not_allowed";
    const out = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => out.cookies.set(c));
    return out;
  }

  return response;
}
