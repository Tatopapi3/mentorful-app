import { requireAdmin } from "@/lib/admin/require";

// Three design studies of the leadership dashboard, each a different layout over the same data. Same admin rule as
// every other leadership page.
export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) {
    return (
      <main style={{ maxWidth: 640, margin: "64px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Leadership views</h1>
        <p>These pages are for school leadership. Your account doesn’t have admin access to a school.</p>
      </main>
    );
  }
  return <>{children}</>;
}
