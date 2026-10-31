import { NextResponse, type NextRequest } from "next/server";

/**
 * The deployed demo only (PREVIEW_DEPLOY=1): a page that is closed to anyone without the access key. Open the link with
 * ?key=... once and a cookie keeps the browser in. If the key is not set the demo stays closed. Everywhere else this
 * does nothing, so the local preview and the real app are unaffected.
 */
export function proxy(req: NextRequest) {
  if (process.env.PREVIEW_DEPLOY !== "1") return NextResponse.next();
  const key = process.env.PREVIEW_KEY;
  const text = (body: string, status: number) => new NextResponse(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  if (!key) return text("This demo is not open.", 503);
  const given = req.nextUrl.searchParams.get("key");
  if (given === key) {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete("key");
    const res = NextResponse.redirect(clean);
    res.cookies.set("demo_key", key, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
    return res;
  }
  if (req.cookies.get("demo_key")?.value === key) return NextResponse.next();
  return text("This demo is private. Open the link you were given.", 401);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"] };
