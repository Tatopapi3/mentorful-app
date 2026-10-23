import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { homePath, isAllowedEmail } from "@/lib/auth/allowlist";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = homePath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (!isAllowedEmail(data.user?.email)) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=not_allowed`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Most often the link was opened in a different browser from the one that
    // requested it, so the PKCE code verifier cookie isn't here.
    return NextResponse.redirect(
      `${origin}/login?error=auth&reason=${encodeURIComponent(error.message)}`
    );
  }

  const reason = searchParams.get("error_description");
  if (reason) {
    return NextResponse.redirect(`${origin}/login?error=auth&reason=${encodeURIComponent(reason)}`);
  }

  // No code and no query error: the answer is in the URL fragment, which only
  // the browser can read. The redirect carries the fragment along.
  return NextResponse.redirect(`${origin}/auth/complete?next=${encodeURIComponent(next)}`);
}
