import { CycleSwitcher } from "@/components/admin/kit";
import { Constellation } from "@/components/aurora/constellation";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";
import { buildFacts } from "@/lib/admin/facts";

export const dynamic = "force-dynamic";

// The faculty as a sky: every teacher a star, every pair an arc, bright where a pair crosses departments.
export default async function ConstellationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = (await requireAdmin())!;
  const params = await searchParams;
  const cycleParam = typeof params.cycle === "string" ? params.cycle : undefined;
  const snap = await loadAdminSnapshot(admin, { cycleId: cycleParam });
  const facts = buildFacts(snap);

  const people = snap.people.map((p) => ({ id: p.id, name: p.name, dept: p.dept, grade: null }));
  const pairs = snap.pairs.map((p) => ({ a: p.a, b: p.b }));
  const requests = snap.requests.map((p) => ({ a: p.a, b: p.b }));

  return (
    <main className="ev-main ev-wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
        <div>
          <p className="ev-eyebrow">Constellation</p>
          <h1>
            Your faculty, <em>connected.</em>
          </h1>
          <p className="ev-lead">Every star is a teacher. Every arc is a pair. The bright ones cross departments. Dashed amber arcs are pairs teachers have asked for.</p>
        </div>
        <div className="ev-numbers" style={{ margin: 0 }}>
          <div><strong>{facts.faculty}</strong><span>faculty</span></div>
          <div><strong>{facts.pairCount}</strong><span>pairs</span></div>
          <div><strong>{facts.unpaired}</strong><span>awaiting</span></div>
        </div>
      </div>

      <CycleSwitcher skin="aurora" cycles={snap.cycles} selectedId={snap.cycle?.id ?? null} path="/admin/aurora/constellation" />
      <div style={{ marginTop: 22 }}>
        <Constellation people={people} pairs={pairs} requests={requests} drafts={[]} />
      </div>
      <p className="ev-small" style={{ marginTop: 18 }}>
        Position is a navigation aid only. Distance and brightness do not measure influence, performance, or relationship quality.
      </p>
    </main>
  );
}
