import { buildDeck } from "@/lib/admin/deck";
import { deckPdf, pdfResponse } from "@/lib/admin/pdf";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot, loadPreviousSnapshot } from "@/lib/admin/snapshot";

export const dynamic = "force-dynamic";

/** The leadership deck as a PDF file. Aggregates only, for the signed-in admin's school. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });
  const snap = await loadAdminSnapshot(admin, { cycleId: new URL(request.url).searchParams.get("cycle") });
  const deck = buildDeck(snap, await loadPreviousSnapshot(admin, snap), new Date());
  return pdfResponse(deckPdf(deck), "leadership-deck.pdf");
}
