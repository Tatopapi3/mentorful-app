import { NextResponse } from "next/server";
import { landingPath } from "@/lib/auth/landing";
import { claimProfile } from "@/lib/roster/claim";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // A school lead lands on the leadership dashboard, a teacher on theirs; a link that names a page on this site wins.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // First sign-in: link this login to the roster profile that carries their email (script 026), if there is one.
      if (user) await claimProfile(supabase);
      const { data: profile } = user ? await supabase.from("profiles").select("role").eq("auth_user_id", user.id).maybeSingle() : { data: null };
      return NextResponse.redirect(`${origin}${landingPath((profile as { role?: string } | null)?.role, searchParams.get("next"))}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
