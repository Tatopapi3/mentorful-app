import { NextResponse } from "next/server";
import { previewEnabled } from "@/lib/preview";
import { JOURNAL_COOKIE } from "@/lib/preview/journal";

/** Demo only: forget this visitor's changes and go back to the starting data. */
export async function GET(request: Request) {
  if (!previewEnabled()) return new NextResponse("Not found", { status: 404 });
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/preview";
  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/preview", url.origin));
  res.cookies.set(JOURNAL_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
