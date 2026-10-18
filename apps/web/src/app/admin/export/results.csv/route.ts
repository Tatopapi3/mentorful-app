import { buildFacts } from "@/lib/admin/facts";
import { resultsCsv } from "@/lib/admin/csv";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";

export const dynamic = "force-dynamic";

/** The school-wide results as a CSV, for the signed-in admin's own school. Aggregates only. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });
  const cycle = new URL(request.url).searchParams.get("cycle");
  const snap = await loadAdminSnapshot(admin, { cycleId: cycle });
  if (!snap.scan) return new Response("There are no Culture Scan results to export yet.", { status: 409 });
  return new Response(resultsCsv(snap, buildFacts(snap)), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="culture-scan-results.csv"', "Cache-Control": "no-store" },
  });
}
