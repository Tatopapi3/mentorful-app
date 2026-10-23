import { buildDeck } from "@/lib/admin/deck";
import { deckToHtml } from "@/lib/admin/deck-html";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot, loadPreviousSnapshot } from "@/lib/admin/snapshot";

export const dynamic = "force-dynamic";

/** The leadership deck as a print-ready page: open it and choose Save as PDF. Aggregates only, for the signed-in admin's school. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });
  const cycle = new URL(request.url).searchParams.get("cycle");
  const snap = await loadAdminSnapshot(admin, { cycleId: cycle });
  const deck = buildDeck(snap, await loadPreviousSnapshot(admin, snap), new Date());
  const q = cycle ? `?cycle=${encodeURIComponent(cycle)}` : "";
  return new Response(deckToHtml(deck, { pptx: `/admin/export/slides.pptx${q}`, back: "/admin/reports" }), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
