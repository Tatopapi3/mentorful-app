import { connectionRows } from "@/lib/admin/csv";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";
import { workbook, xlsxResponse } from "@/lib/admin/xlsx";

export const dynamic = "force-dynamic";

/** The faculty connection by department as an Excel file: a Departments sheet and an About sheet. Totals only, no names. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });
  const cycle = new URL(request.url).searchParams.get("cycle");
  const snap = await loadAdminSnapshot(admin, { cycleId: cycle });
  const { table, notes } = connectionRows(snap, null);
  const file = await workbook(
    [
      { name: "Departments", rows: table },
      { name: "About", rows: notes, header: false },
    ],
    `${snap.school.name} · Faculty connection`,
  );
  return xlsxResponse(file, "faculty-connection.xlsx");
}
