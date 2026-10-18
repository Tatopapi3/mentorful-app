import { loadReportStats } from "@/lib/report/data";
import ReportBody from "../report/ReportBody";

/**
 * The public sample report: generated demo data, on purpose, so a principal can see what a school gets
 * back without an account. It reads the sandbox school only and always says so. A real school's report
 * is at /report and requires a signed-in admin.
 */

export const dynamic = "force-dynamic";

export const metadata = { title: "Sample Culture Scan report" };

export default async function SampleReportPage() {
  const load = await loadReportStats({
    schoolId: process.env.NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID ?? "",
    faculty: 0,
    includeSynthetic: true,
    sample: true,
  });
  return <ReportBody load={load} />;
}
