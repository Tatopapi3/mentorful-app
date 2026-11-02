import { NextResponse, type NextRequest } from "next/server";

/**
 * A private test site (SITE_ACCESS_KEY is set): closed to anyone who does not have the key. Open the link with ?key=...
 * once and a cookie keeps that browser in for two weeks. With no key set (the normal case, and production) this does
 * nothing at all, so the real app is unaffected.
 *
 * The sign-in link in the email lands on /auth/callback. It only exchanges a one-time code for a session and then sends the
 * person on, so it is left open: a link opened in a different browser than the one that has the key still signs in.
 */
export function proxy(req: NextRequest) {
  const key = process.env.SITE_ACCESS_KEY;
  if (!key) return NextResponse.next();
  if (req.nextUrl.pathname === "/auth/callback") return NextResponse.next();

  const text = (body: string, status: number) => new NextResponse(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  if (req.nextUrl.searchParams.get("key") === key) {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete("key");
    const res = NextResponse.redirect(clean);
    res.cookies.set("site_key", key, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
    return res;
  }
  if (req.cookies.get("site_key")?.value === key) return NextResponse.next();
  return text("This site is private. Open the link you were given, with the key in it.", 401);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"] };
