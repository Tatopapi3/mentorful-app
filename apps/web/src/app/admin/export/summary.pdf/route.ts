import { pdfResponse, summaryPdf } from "@/lib/admin/pdf";
import { summaryPdfInput } from "@/lib/admin/pdf-input";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";

export const dynamic = "force-dynamic";

/** The one-page board summary as a PDF file. Aggregates only, for the signed-in admin's school. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });
  const snap = await loadAdminSnapshot(admin, { cycleId: new URL(request.url).searchParams.get("cycle") });
  return pdfResponse(summaryPdf(summaryPdfInput(snap, new Date())), "board-summary.pdf");
}
