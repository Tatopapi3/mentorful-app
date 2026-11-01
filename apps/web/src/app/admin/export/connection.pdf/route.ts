import { connectionPdf, pdfResponse } from "@/lib/admin/pdf";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";

export const dynamic = "force-dynamic";

/** The faculty connection by department as a PDF file: a department map and totals, no names. Same data as the CSV. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });
  const snap = await loadAdminSnapshot(admin, { cycleId: new URL(request.url).searchParams.get("cycle") });
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return pdfResponse(connectionPdf(snap, date), "faculty-connection.pdf");
}
