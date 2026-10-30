import FacultyMapClient from "@/app/admin/map/FacultyMapClient";
import { loadOverviewDetail } from "@/lib/admin/detail";
import { requireAdmin } from "@/lib/admin/require";

export const dynamic = "force-dynamic";

// The interactive faculty map, full size, in the Aurora look. The map itself is Nick's component: the same
// four layouts and the same click-for-details panel.
export default async function AuroraMapPage() {
  const admin = (await requireAdmin())!;
  const d = await loadOverviewDetail(admin);
  return (
    <main className="ev-main ev-wide">
      <p className="ev-eyebrow">Faculty map · {d.school.name}{d.cycle ? ` · ${d.cycle.name}` : ""}</p>
      <h1>
        The whole faculty, <em>on one map.</em>
      </h1>
      <p className="ev-lead">Switch between a grid, pairings, departments and strengths. Click anyone to see who they are paired with.</p>
      <section className="ev-panel" style={{ marginTop: 18 }}>
        <small>Nodes: {d.mapUsers.length} · Edges: {d.mapEdges.length}</small>
        <div style={{ height: "72vh", minHeight: 520, marginTop: 10, borderRadius: 16, overflow: "hidden", border: "1px solid var(--ev-line)", background: "#fff", color: "#14122b" }}>
          <FacultyMapClient users={d.mapUsers} edges={d.mapEdges} />
        </div>
      </section>
    </main>
  );
}
