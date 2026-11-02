import { NextResponse, type NextRequest } from "next/server";

/**
 * The deployed demo only (PREVIEW_DEPLOY=1): a page that is closed to anyone without the access key. Open the link with
 * ?key=... once and a cookie keeps the browser in. If the key is not set the demo stays closed. Everywhere else this
 * does nothing, so the local preview and the real app are unaffected.
 */
// Walkthrough build (NEXT_PUBLIC_WALKTHROUGH=1): the same stage data for a recorded walkthrough, without the Demo Day pages.
// The script, the slides and the screen launcher answer "not found", and the home page opens straight on the principal's Pulse.
const WALKTHROUGH = process.env.NEXT_PUBLIC_WALKTHROUGH === "1";
function open(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (WALKTHROUGH && (path === "/demo" || path.startsWith("/demo/") || path === "/preview")) return NextResponse.rewrite(new URL("/closed-for-walkthrough", req.url));
  return NextResponse.next();
}

export function proxy(req: NextRequest) {
  if (process.env.PREVIEW_DEPLOY !== "1") return open(req);
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
  if (req.cookies.get("demo_key")?.value === key) return open(req);
  return text("This demo is private. Open the link you were given.", 401);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"] };
