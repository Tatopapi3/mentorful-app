import { AuroraChrome } from "@/components/aurora/chrome";
import { PresentButton } from "@/components/aurora/present-button";
import { lookBase } from "@/lib/admin/look";
import { requireAdmin } from "@/lib/admin/require";

// The whole leadership area in the Aurora layout: Pulse, Pairing, Overview, Constellation, Insights and Reports.
// Every tab uses this one shell, so the chrome never changes between tabs.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const base = lookBase();
  const NAV = [
    { href: `${base}/pulse`, label: "Pulse" },
    { href: `${base}/pairings`, label: "Pairing" },
    { href: `${base}/overview`, label: "Overview" },
    { href: `${base}/constellation`, label: "Constellation" },
    { href: `${base}/insights`, label: "Insights" },
    { href: `${base}/reports`, label: "Reports" },
  ];
  const ACTIONS = [
    { href: `${base}/pulse`, label: "See where the program stands", hint: "Pulse" },
    { href: `${base}/pairings`, label: "Review pairing requests", hint: "Pairing" },
    { href: `${base}/pairings`, label: "Draft a randomized pairing round", hint: "Pairing" },
    { href: `${base}/overview`, label: "Open the overview", hint: "Overview" },
    { href: `${base}/constellation`, label: "See the faculty as a constellation", hint: "Constellation" },
    { href: `${base}/insights`, label: "Read the insights", hint: "Insights" },
    { href: `${base}/insights#trends`, label: "See how things are changing", hint: "Insights" },
    { href: `${base}/reports`, label: "Download slides, PDF and reports", hint: "Reports" },
    { href: `${base}/summary`, label: "Open the board summary", hint: "Present" },
    { href: `${base}/privacy`, label: "What leadership can and can't see", hint: "Trust" },
  ];
  const admin = await requireAdmin();
  if (!admin) {
    return (
      <main style={{ maxWidth: 640, margin: "64px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Leadership views</h1>
        <p>These pages are for school leadership. Your account doesn’t have admin access to a school.</p>
      </main>
    );
  }
  const { data: school } = await admin.supabase.from("schools").select("name").eq("id", admin.schoolId).maybeSingle();
  return (
    <AuroraChrome schoolName={school?.name ?? "Your school"} displayName={admin.displayName} roleLabel="School administrator" nav={NAV} actions={ACTIONS} tools={<PresentButton items={NAV.filter((n) => !n.href.endsWith("/reports"))} />}>
      {children}
    </AuroraChrome>
  );
}
