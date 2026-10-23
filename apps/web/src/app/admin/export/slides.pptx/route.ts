import { buildDeck } from "@/lib/admin/deck";
import { deckToPptx } from "@/lib/admin/deck-pptx";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot, loadPreviousSnapshot } from "@/lib/admin/snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The leadership deck as an editable PowerPoint file. Aggregates only, for the signed-in admin's school. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });
  const cycle = new URL(request.url).searchParams.get("cycle");
  const snap = await loadAdminSnapshot(admin, { cycleId: cycle });
  const deck = buildDeck(snap, await loadPreviousSnapshot(admin, snap), new Date());
  const file = await deckToPptx(deck);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": 'attachment; filename="mentorful-leadership-deck.pptx"',
      "Cache-Control": "no-store",
    },
  });
}
