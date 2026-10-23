import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next 16 renamed middleware.ts to proxy.ts.
export async function proxy(request: NextRequest) {
  // A magic link that fell back to the Site URL ("/?code=…") instead of the
  // callback: send the code where it can be exchanged.
  const { pathname, searchParams } = request.nextUrl;
  if (searchParams.has("code") && !pathname.startsWith("/auth/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets, the favicon and the artifact page files.
    "/((?!_next/static|_next/image|favicon.ico|icon.png|dashboard-v2/|mentortrdash/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)",
  ],
};
