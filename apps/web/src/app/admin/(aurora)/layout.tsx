import { AuroraChrome } from "@/components/aurora/chrome";
import { requireAdmin } from "@/lib/admin/require";

const NAV = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/pulse", label: "Pulse" },
  { href: "/admin/constellation", label: "Constellation" },
  { href: "/admin/insights", label: "Insights" },
  { href: "/admin/map", label: "Faculty map" },
];

const ACTIONS = [
  { href: "/admin", label: "Open the overview", hint: "Overview" },
  { href: "/admin/pulse", label: "See where the program stands", hint: "Pulse" },
  { href: "/admin/constellation", label: "See the faculty as a constellation", hint: "Constellation" },
  { href: "/admin/insights", label: "Read the insights", hint: "Insights" },
  { href: "/admin/map", label: "Open the faculty map", hint: "Faculty map" },
];

// The Aurora look for the leadership views. Everything the existing leadership dashboard and faculty map show
// is still there, one click away under Overview and Faculty map; these pages add to them.
export default async function AuroraAdminLayout({ children }: { children: React.ReactNode }) {
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
    <AuroraChrome schoolName={school?.name ?? "Your school"} displayName={admin.displayName} roleLabel="School administrator" nav={NAV} actions={ACTIONS}>
      {children}
    </AuroraChrome>
  );
}
