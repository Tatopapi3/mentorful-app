import { resultsRows } from "@/lib/admin/csv";
import { buildFacts } from "@/lib/admin/facts";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";
import { workbook, xlsxResponse } from "@/lib/admin/xlsx";

export const dynamic = "force-dynamic";

/** The school-wide results as an Excel file, for the signed-in admin's own school. Aggregates only, the same rows as the CSV. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });
  const cycle = new URL(request.url).searchParams.get("cycle");
  const snap = await loadAdminSnapshot(admin, { cycleId: cycle });
  if (!snap.scan) return new Response("There are no Culture Scan results to export yet.", { status: 409 });
  const file = await workbook([{ name: "Results", rows: resultsRows(snap, buildFacts(snap)) }], `${snap.school.name} · Culture Scan results`);
  return xlsxResponse(file, "culture-scan-results.xlsx");
}
