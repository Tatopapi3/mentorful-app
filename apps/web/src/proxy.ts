import { NextResponse, type NextRequest } from "next/server";
import { gatePage } from "@/lib/gate-page";

/**
 * The deployed demo only (PREVIEW_DEPLOY=1): a page that is closed to anyone without the access key. Open the link with
 * ?key=... once and a cookie keeps the browser in. If the key is not set the demo stays closed. Everywhere else this
 * does nothing, so the local preview and the real app are unaffected.
 */
// Walkthrough build (NEXT_PUBLIC_WALKTHROUGH=1): the same stage data for a recorded walkthrough, without the Demo Day pages.
// The script, the slides and the screen launcher answer "not found", and the home page opens straight on the principal's Pulse.
const WALKTHROUGH = process.env.NEXT_PUBLIC_WALKTHROUGH === "1";

/**
 * The script and the share links are for the team only (TEAM_KEY is set): /demo/script and /demo/links answer "not found" until the browser has opened it once
 * with ?team=<key>, which leaves a cookie. Without TEAM_KEY (local development) it is open.
 */
export function teamKeyOk(req: NextRequest): boolean {
  const key = process.env.TEAM_KEY;
  return !key || req.cookies.get("team_key")?.value === key;
}

function open(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const closed = () => NextResponse.rewrite(new URL("/closed-for-walkthrough", req.url));
  if (WALKTHROUGH && (path === "/demo" || path.startsWith("/demo/") || path === "/preview")) return closed();
  if (path === "/demo/script" || path.startsWith("/demo/script/") || path === "/demo/links") {
    const key = process.env.TEAM_KEY;
    if (key && req.nextUrl.searchParams.get("team") === key) {
      const clean = req.nextUrl.clone();
      clean.searchParams.delete("team");
      const res = NextResponse.redirect(clean);
      res.cookies.set("team_key", key, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
      return res;
    }
    if (!teamKeyOk(req)) return closed();
  }
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
  // Closed: ask for the access code instead of a dead end (a plain link copied from the address bar has no key in it).
  return new NextResponse(gatePage(req.nextUrl.pathname, req.nextUrl.searchParams, "demo"), { status: 401, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"] };
