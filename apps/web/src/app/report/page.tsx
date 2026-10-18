import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { loadReportStats } from "@/lib/report/data";
import { createClient } from "@/lib/supabase/server";
import ReportBody from "./ReportBody";

/**
 * Culture Scan report for the signed-in school leader's own school.
 *
 * Authentication and authorization both happen here: a signed-in admin with a school, nobody else. The
 * school comes from the reader's own profile, never from the URL or an environment variable, and the
 * report engine only reads that school's responses. Demo data is never included. The public sample
 * lives at /sample-report.
 */

// Reads the DB on every request; never prerender at build time.
export const dynamic = "force-dynamic";

export const metadata = { title: "Culture Scan report" };

const frame: React.CSSProperties = { maxWidth: 1120, margin: "40px auto", padding: 24 };

export default async function ReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("school_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me || me.role !== "admin" || !me.school_id) {
    return (
      <>
        <SiteHeader />
        <main style={frame}>
          <h1>Culture Scan report</h1>
          <p>This report is for school leadership. Your account doesn’t have admin access to a school.</p>
        </main>
      </>
    );
  }

  // Faculty headcount: teachers at this school who are real people, not generated demo identities.
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("school_id", me.school_id)
    .eq("role", "teacher")
    .eq("is_demo", false);

  const load = await loadReportStats({ schoolId: me.school_id, faculty: count ?? 0 });
  return <ReportBody load={load} />;
}
