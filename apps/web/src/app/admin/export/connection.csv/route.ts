import { connectionCsv } from "@/lib/admin/csv";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";

export const dynamic = "force-dynamic";

/** The faculty connection by department as a CSV, for the signed-in admin's own school. Totals only, no names. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });
  const cycle = new URL(request.url).searchParams.get("cycle");
  const snap = await loadAdminSnapshot(admin, { cycleId: cycle });
  return new Response(connectionCsv(snap, null), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="faculty-connection.csv"', "Cache-Control": "no-store" },
  });
}
