import { CycleSwitcher } from "@/components/admin/kit";
import { Constellation } from "@/components/aurora/constellation";
import { Metric, NickDenied, NickPage } from "@/components/nick/page";
import { buildFacts } from "@/lib/admin/facts";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";

export const dynamic = "force-dynamic";

// The faculty as a sky, drawn in Nick's palette: every teacher a star, every pair an arc, brighter where a
// pair crosses departments.
export default async function ConstellationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin();
  if (!admin) return <NickDenied />;
  const params = await searchParams;
  const cycleParam = typeof params.cycle === "string" ? params.cycle : undefined;
  const snap = await loadAdminSnapshot(admin, { cycleId: cycleParam });
  const facts = buildFacts(snap);
  return (
    <NickPage eyebrow="Constellation" title="Your faculty, connected" sub="Every star is a teacher. Every arc is a pair. The bright ones cross departments. Dashed arcs are pairs teachers have asked for.">
      <CycleSwitcher skin="nick" cycles={snap.cycles} selectedId={snap.cycle?.id ?? null} path="/admin/constellation" />
      <section className="adm-metrics" aria-label="Summary" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Metric label="Faculty" value={String(facts.faculty)} note="teachers" />
        <Metric label="Pairs" value={String(facts.pairCount)} note={facts.crossPct !== null ? `${facts.crossPct}% cross departments` : "approved this cycle"} />
        <Metric label="Awaiting" value={String(facts.unpaired)} note="teachers without a partner" />
      </section>
      <section className="adm-card">
        <Constellation skin="nick" base="/admin" people={snap.people.map((p) => ({ id: p.id, name: p.name, dept: p.dept, grade: null }))} pairs={snap.pairs.map((p) => ({ a: p.a, b: p.b }))} requests={snap.requests.map((p) => ({ a: p.a, b: p.b }))} drafts={[]} />
      </section>
      <p className="adm-note">Position is a navigation aid only. Distance and brightness do not measure influence, performance, or relationship quality.</p>
    </NickPage>
  );
}
