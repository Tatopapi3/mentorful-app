import { narrativeText } from "@/lib/admin/narrative";
import { loadNarrative } from "@/lib/admin/narrative-data";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";

export const dynamic = "force-dynamic";

/** The board narrative as a plain text file. Same admin check as the other exports. */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Leadership only.", { status: 403 });
  const cycle = new URL(req.url).searchParams.get("cycle") ?? undefined;
  const snap = await loadAdminSnapshot(admin, { cycleId: cycle });
  const text = narrativeText(await loadNarrative(admin, snap));
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="board-narrative${snap.cycle ? `-${snap.cycle.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}.txt"` } });
}
