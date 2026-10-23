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
  return res;
}
