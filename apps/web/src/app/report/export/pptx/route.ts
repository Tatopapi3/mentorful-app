import { redirect } from "next/navigation";
import { loadReportStats } from "@/lib/report/data";
import { deckBuffer } from "@/lib/report/pptx";
import { createClient } from "@/lib/supabase/server";

/**
 * The report as an editable PowerPoint, for the signed-in admin's own school. Same gate as the page: a
 * signed-in admin, their school only, no demo data. Returns 403 for anyone else and 409 until the report
 * has data worth exporting.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("school_id, role").eq("auth_user_id", user.id).maybeSingle();
  if (!me || me.role !== "admin" || !me.school_id) return new Response("Forbidden", { status: 403 });

  const [{ data: school }, { count }] = await Promise.all([
    supabase.from("schools").select("name").eq("id", me.school_id).maybeSingle(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("school_id", me.school_id).eq("role", "teacher").eq("is_demo", false),
  ]);

  const load = await loadReportStats({ schoolId: me.school_id, faculty: count ?? 0 });
  if (load.status !== "ok" && load.status !== "early-look") {
    return new Response("There are not enough responses to export a report yet.", { status: 409 });
  }

  const dateLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const body = await deckBuffer(load.stats, {
    schoolName: school?.name ?? "Our school",
    dateLabel,
    gates: load.gates,
    synthetic: load.includesSynthetic,
  });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": 'attachment; filename="culture-scan-report.pptx"',
      "Cache-Control": "no-store",
    },
  });
}
