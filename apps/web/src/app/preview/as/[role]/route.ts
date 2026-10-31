import { NextResponse } from "next/server";
import { previewEnabled } from "@/lib/preview";

/** Local preview only: choose whether the pages treat you as the admin or as a teacher. */
export async function GET(request: Request, ctx: { params: Promise<{ role: string }> }) {
  if (!previewEnabled()) return new NextResponse("Not found", { status: 404 });
  const { role } = await ctx.params;
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/preview";
  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/preview", url.origin));
  res.cookies.set("preview_as", role === "teacher" ? "teacher" : "admin", { path: "/" });
  // Demo Day: the same teacher screen, as the second teacher of the scene (see lib/preview/stageTables.ts).
  res.cookies.set("preview_who", url.searchParams.get("who") === "second" ? "second" : "", { path: "/", maxAge: url.searchParams.get("who") === "second" ? undefined : 0 });
  return res;
}
