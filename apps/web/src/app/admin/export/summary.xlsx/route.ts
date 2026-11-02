import { DIMENSIONS, DIMENSION_LABEL } from "@/lib/report/stats";
import { summaryPdfInput } from "@/lib/admin/pdf-input";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";
import { workbook, xlsxResponse } from "@/lib/admin/xlsx";

export const dynamic = "force-dynamic";

/** The board summary's numbers as an Excel file: the four headline figures, the Culture Scan averages and the next moves. Aggregates only. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });
  const snap = await loadAdminSnapshot(admin, { cycleId: new URL(request.url).searchParams.get("cycle") });
  const s = summaryPdfInput(snap, new Date());
  const sheets = [
    { name: "Summary", rows: [["measure", "value", "note"], ...s.stats.map((x) => [x.label, x.value, x.note]), [], ["school", s.school], ["cycle", s.cycle], ["date", s.date]] },
    ...(s.scan
      ? [{ name: "Culture Scan", rows: [["dimension", "average (out of 6)", "95% half-width"], ...DIMENSIONS.map((d) => [DIMENSION_LABEL[d], s.scan!.means[d].toFixed(2), s.scan!.ci[d].toFixed(2)]), [], ["respondents", s.scan.respondents]] }]
      : []),
    { name: "Next moves", rows: [["priority", "move", "detail"], ...s.actions.map((a) => [a.label, a.title, a.detail])] },
  ];
  return xlsxResponse(await workbook(sheets, `${s.school} · Board summary`), "board-summary.xlsx");
}
