import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { allowlistActive, homePath, isAllowedEmail } from "@/lib/auth/allowlist";

/**
 * LOCAL DEVELOPMENT ONLY: sign in without sending an email.
 *
 * Asks Supabase for a magic link with the service key (generateLink sends no
 * email, so no rate limit), then redeems its token on the session client so
 * the usual auth cookies are set. Refuses unless all of these hold:
 *   - NODE_ENV is development (never in a build, so never on Vercel);
 *   - the request is to localhost / 127.0.0.1;
 *   - AUTH_ALLOWED_EMAILS is set and contains the address.
 *
 * The service key stays in this server route; it never reaches the browser.
 */
export async function POST(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0];
  if (
    process.env.NODE_ENV !== "development" ||
    !["localhost", "127.0.0.1"].includes(host)
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  const back = (error: string, reason?: string) =>
    NextResponse.redirect(
      new URL(
        `/login?error=${error}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`,
        request.url
      ),
      303
    );

  const email = String((await request.formData()).get("email") ?? "").trim().toLowerCase();
  if (!allowlistActive() || !isAllowedEmail(email)) return back("not_allowed");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link.properties?.hashed_token) {
    return back("auth", linkError?.message ?? "No link was generated.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (error) return back("auth", error.message);

  return NextResponse.redirect(new URL(homePath(), request.url), 303);
}
