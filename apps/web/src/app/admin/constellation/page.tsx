import { ConstellationGuide } from "@/components/admin/constellation-guide";
import { CycleSwitcher } from "@/components/admin/kit";
import { Constellation } from "@/components/aurora/constellation";
import { NickDenied, NickPage } from "@/components/nick/page";
import { requireAdmin } from "@/lib/admin/require";
import { departmentMatrix, suggestions } from "@/lib/admin/network";
import { loadAdminSnapshot, loadPreviousSnapshot } from "@/lib/admin/snapshot";

export const dynamic = "force-dynamic";

// The faculty as a sky, drawn in Nick's palette: every teacher a star, every pair an arc, brighter where a
// pair crosses departments.
export default async function ConstellationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin();
  if (!admin) return <NickDenied />;
  const params = await searchParams;
  const cycleParam = typeof params.cycle === "string" ? params.cycle : undefined;
  const snap = await loadAdminSnapshot(admin, { cycleId: cycleParam });
  const prev = await loadPreviousSnapshot(admin, snap);
  const drafts = suggestions(snap, departmentMatrix(snap)).map((s) => ({ a: s.host.id, b: s.visitor.id }));
  return (
    <NickPage eyebrow="Constellation" title="Your faculty, connected" sub="Read the sky for gaps. Below, what it shows is turned into the next steps worth taking: who needs a partner, which departments are not yet connected, and which pairs would connect them.">
      <CycleSwitcher skin="nick" cycles={snap.cycles} selectedId={snap.cycle?.id ?? null} path="/admin/constellation" />
      <ConstellationGuide skin="nick" snap={snap} prev={prev} part="top" />
      <section className="adm-card">
        <Constellation skin="nick" base="/admin" people={snap.people.map((p) => ({ id: p.id, name: p.name, dept: p.dept, grade: null }))} pairs={snap.pairs.map((p) => ({ a: p.a, b: p.b }))} requests={snap.requests.map((p) => ({ a: p.a, b: p.b }))} drafts={drafts} draftLabel="Suggested" />
      </section>
      <ConstellationGuide skin="nick" snap={snap} prev={prev} part="bottom" />
      <p className="adm-note">Position is a navigation aid only. Distance and brightness do not measure influence, performance, or relationship quality.</p>
    </NickPage>
  );
}
