import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminMapPage from "./map/page";

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  // Admin surface reads faculty data from Neon. Gate it like /dashboard and
  // /report. TODO: this is authentication only — any signed-in user reaches the
  // admin map. Add a leadership/admin role check once roles are modelled.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Demo-first: keep KPIs calm and minimal.
  // We can wire these to real counts next (either from the map data or a tiny /api/admin/summary route).
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-6">
          <div className="text-2xl font-semibold text-neutral-900">Admin Dashboard</div>
          <div className="mt-1 text-sm text-neutral-500">
            Demo mode. Map is admin-only. No rankings. No performance framing.
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Faculty" value="50" />
          <Card label="Cycles" value="3" />
          <Card label="Pairings" value="32" />
          <Card label="Visits Logged" value="32" />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-lg font-medium text-neutral-900">Faculty Map</div>
            <div className="text-sm text-neutral-500">Admin only</div>
          </div>
          <div className="h-[75vh] w-full">
            <AdminMapPage />
          </div>
        </div>
      </div>
    </div>
  );
}
