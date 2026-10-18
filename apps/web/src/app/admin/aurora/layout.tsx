import { AuroraChrome } from "@/components/aurora/chrome";
import { SwitchLook } from "@/components/aurora/switch-look";
import { requireAdmin } from "@/lib/admin/require";

const NAV = [
  { href: "/admin/aurora", label: "Overview", exact: true },
  { href: "/admin/aurora/pulse", label: "Pulse" },
  { href: "/admin/aurora/constellation", label: "Constellation" },
  { href: "/admin/aurora/insights", label: "Insights" },
  { href: "/admin/aurora/map", label: "Faculty map" },
];

const ACTIONS = [
  { href: "/admin/aurora", label: "Open the overview", hint: "Overview" },
  { href: "/admin/aurora/pulse", label: "See where the program stands", hint: "Pulse" },
  { href: "/admin/aurora/constellation", label: "See the faculty as a constellation", hint: "Constellation" },
  { href: "/admin/aurora/insights", label: "Read the insights", hint: "Insights" },
  { href: "/admin/aurora/map", label: "Open the faculty map", hint: "Faculty map" },
  { href: "/admin", label: "Switch to Nick’s look", hint: "Look" },
];

// The whole leadership area in the Aurora look. Overview and Faculty map show everything the existing
// leadership dashboard and faculty map show; Pulse, Constellation and Insights add to them. Every tab here uses
// this one shell, so the look never changes between tabs. Nick's own look is under /admin.
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
    <AuroraChrome schoolName={school?.name ?? "Your school"} displayName={admin.displayName} roleLabel="School administrator" nav={NAV} actions={ACTIONS} tools={<SwitchLook current="aurora" />}>
      {children}
    </AuroraChrome>
  );
}
