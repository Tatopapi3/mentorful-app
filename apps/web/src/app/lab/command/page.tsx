import Link from "next/link";
import { EarlyWarningBody } from "@/components/admin/early-warning-panel";
import { NarrativeBody } from "@/components/admin/narrative-panel";
import RoundSimulator from "@/components/admin/round-simulator";
import { ThemesBody } from "@/components/admin/themes-panel";
import { LabNotice, first, STUDIES } from "@/components/lab/shell";
import { countLabel } from "@/lib/admin/early-warning";
import { loadLab } from "@/lib/admin/lab-data";
import { coverage } from "@/lib/admin/network";
import { requireAdmin } from "@/lib/admin/require";

export const dynamic = "force-dynamic";

const ICONS: Record<string, string> = {
  command: "M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z",
  briefing: "M5 3h11l3 3v15H5zM8 9h8M8 13h8M8 17h5",
  map: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11a1 1 0 100 2 1 1 0 000-2z",
};

// Study 1, Command: an operations console. Everything is on one screen at once, in tiles you scan left to right, with
// the numbers that matter in a strip along the top. For the person who wants to watch the program, not read it.
export default async function CommandStudy({ searchParams: sp }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await sp;
  const admin = (await requireAdmin())!;
  const cycle = first(searchParams.cycle);
  const d = await loadLab(admin, cycle);
  const { snap, facts, cooling } = d;
  const cov = coverage(d.matrix);
  const cycleId = snap.cycle?.id ?? "";
  const q = cycle ? `?cycle=${cycle}` : "";
  const drifting = cooling ? cooling.cooling + cooling.quiet : null;

  return (
    <div className="ev lab-cmd" data-theme="dark">
      <nav className="rail" aria-label="Design study">
        <span className="mark" aria-hidden>M</span>
        {STUDIES.map((s) => (
          <Link key={s.id} href={`${s.href}${q}`} prefetch={false} aria-current={s.id === "command" ? "page" : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONS[s.id]} /></svg>
            {s.label}
          </Link>
        ))}
      </nav>
      <main className="cmd-main">
        <header className="cmd-head">
          <h1>{snap.school.name} · {snap.cycle?.name ?? "No cycle"}</h1>
          <p>{d.headline.lead} {d.headline.em} · groups under 5 hidden</p>
        </header>
        <LabNotice searchParams={searchParams} />

        <section className="kpis" aria-label="Key numbers">
          <div className="kpi"><small>Teachers paired</small><b>{facts.pairedPct ?? 0}%</b><span>{facts.paired} of {facts.faculty}</span></div>
          <div className="kpi"><small>Across departments</small><b>{facts.crossPct ?? 0}%</b><span>{facts.crossPairs} of {facts.pairCount} pairs</span></div>
          <div className="kpi"><small>Department links</small><b>{cov.connected}/{cov.possible}</b><span>connected</span></div>
          <div className="kpi"><small>Conversations</small><b>{facts.conversations}</b><span>{facts.conversationsPerPair ?? 0} per pair</span></div>
          <div className={`kpi${drifting ? " warn" : ""}`}><small>Pairs drifting</small><b>{drifting === null ? "n/a" : countLabel(drifting)}</b><span>silent 14+ days</span></div>
        </section>

        <div className="tiles">
          <section className="tile t8" aria-label="Round simulator">
            <h2><span>Round simulator</span><span>what-if</span></h2>
            <RoundSimulator skin="aurora" people={snap.people} pairs={snap.pairs} requests={snap.requests} cycleId={cycleId} back="/lab/command" />
          </section>
          <section className="tile t4" aria-label="Early warning">
            <h2><span>Early warning</span><span>{cooling ? `${cooling.pairs} pairs` : ""}</span></h2>
            <EarlyWarningBody skin="aurora" cooling={cooling} cycleId={cycleId} back="/lab/command" />
          </section>
          <section className="tile t6" aria-label="Themes">
            <h2><span>Themes</span><span>{snap.pairs.length} pairs</span></h2>
            <ThemesBody skin="aurora" snap={snap} raw={d.raw} base="/admin/blend" />
          </section>
          <section className="tile t6" aria-label="Board narrative">
            <h2><span>Board narrative</span><span>from the numbers</span></h2>
            <NarrativeBody skin="aurora" narrative={d.narrative} download={`/admin/export/narrative.txt${q}`} />
          </section>
        </div>
      </main>
    </div>
  );
}
