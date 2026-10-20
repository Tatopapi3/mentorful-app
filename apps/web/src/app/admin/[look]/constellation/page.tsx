import { ConstellationGuide } from "@/components/admin/constellation-guide";
import { lookBase, lookOf } from "@/lib/admin/look";
import { CycleSwitcher } from "@/components/admin/kit";
import { Constellation } from "@/components/aurora/constellation";
import { requireAdmin } from "@/lib/admin/require";
import { departmentMatrix, suggestions } from "@/lib/admin/network";
import { loadAdminSnapshot, loadPreviousSnapshot } from "@/lib/admin/snapshot";
import { buildFacts } from "@/lib/admin/facts";

export const dynamic = "force-dynamic";

// The faculty as a sky: every teacher a star, every pair an arc, bright where a pair crosses departments.
export default async function ConstellationPage({ params: routeParams, searchParams }: { params: Promise<{ look: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const look = await lookOf(routeParams);
  const base = lookBase(look);
  const admin = (await requireAdmin())!;
  const params = await searchParams;
  const cycleParam = typeof params.cycle === "string" ? params.cycle : undefined;
  const snap = await loadAdminSnapshot(admin, { cycleId: cycleParam });
  const facts = buildFacts(snap);
  const prev = await loadPreviousSnapshot(admin, snap);
  const drafts = suggestions(snap, departmentMatrix(snap)).map((s) => ({ a: s.host.id, b: s.visitor.id }));

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
          <p className="ev-lead">Read the sky for gaps. Below, what it shows is turned into the next steps worth taking: who needs a partner, which departments are not yet connected, and which pairs would connect them.</p>
        </div>
        <div className="ev-numbers" style={{ margin: 0 }}>
          <div><strong>{facts.faculty}</strong><span>faculty</span></div>
          <div><strong>{facts.pairCount}</strong><span>pairs</span></div>
          <div><strong>{facts.unpaired}</strong><span>awaiting</span></div>
        </div>
      </div>

      <CycleSwitcher skin={look} cycles={snap.cycles} selectedId={snap.cycle?.id ?? null} path={`${base}/constellation`} />
      <ConstellationGuide skin={look} snap={snap} prev={prev} part="top" />
      <div style={{ marginTop: 22 }}>
        <Constellation base={base} people={people} pairs={pairs} requests={requests} drafts={drafts} draftLabel="Suggested" />
      </div>
      <ConstellationGuide skin={look} snap={snap} prev={prev} part="bottom" />
      <p className="ev-small" style={{ marginTop: 18 }}>
        Position is a navigation aid only. Distance and brightness do not measure influence, performance, or relationship quality.
      </p>
    </main>
  );
}
