import { EarlyWarningBody } from "@/components/admin/early-warning-panel";
import RoundSimulator from "@/components/admin/round-simulator";
import { ThemesBody } from "@/components/admin/themes-panel";
import CopyButton from "@/components/admin/copy-button";
import { LabNotice, StudySwitch, first } from "@/components/lab/shell";
import { warningFor } from "@/lib/admin/early-warning";
import { loadLab } from "@/lib/admin/lab-data";
import { narrativeText } from "@/lib/admin/narrative";
import { coverage, gaps } from "@/lib/admin/network";
import { requireAdmin } from "@/lib/admin/require";
import { readThemes, themeSentences } from "@/lib/admin/themes";

export const dynamic = "force-dynamic";

// Study 2, Briefing: a page to read, not a screen to watch. The story of the cycle leads, then the few things that
// need you, numbered, each opening in place so the working tool appears exactly where the decision is.
export default async function BriefingStudy({ searchParams: sp }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await sp;
  const admin = (await requireAdmin())!;
  const cycle = first(searchParams.cycle);
  const d = await loadLab(admin, cycle);
  const { snap, facts, cooling } = d;
  const cycleId = snap.cycle?.id ?? "";
  const cov = coverage(d.matrix);
  const missing = gaps(d.matrix).length;
  const warning = cooling ? warningFor(cooling) : null;
  const themeLine = themeSentences(readThemes(snap.people, snap.pairs, snap.school.priority))[0];
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  // The first section's heading is the page headline again, so it reads "Where it stands" here.
  const [first_, ...rest] = d.narrative.sections;
  const lead = { ...first_, heading: "Where it stands" };

  return (
    <div className="ev lab-brief" data-theme="light">
      <div className="brief">
        <div className="mast">
          <span>{snap.school.name} · {snap.cycle?.name ?? "No cycle"}</span>
          <span>{today}</span>
          <StudySwitch current="briefing" cycle={cycle} />
        </div>

        <h1>{d.headline.lead} <em>{d.headline.em}</em></h1>
        <p className="lede">{d.sentence}</p>
        <LabNotice searchParams={searchParams} />

        <p className="kicker">The story so far</p>
        <div className="story">
          {[lead, ...rest.filter((s) => !["Recommended next steps", "What needs attention"].includes(s.heading))].filter(Boolean).slice(0, 6).map((s) => (
            <section key={s.heading}>
              <h3>{s.heading}</h3>
              {s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </section>
          ))}
        </div>
        <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <CopyButton skin="aurora" text={narrativeText(d.narrative)} label="Copy the whole briefing as text" />
          <a className="ev-btn sm" href={`/admin/export/narrative.txt${cycle ? `?cycle=${cycle}` : ""}`}>Download as a text file</a>
        </p>

        <p className="kicker">Needs you</p>
        <details className="decision" open>
          <summary>
            <span className="num">1</span>
            <span className="dtitle">{warning ? warning.title : "Pairs that are drifting quiet"}</span>
            <span className="chev" />
            <span className="dsub">{warning ? warning.detail.split(". ")[0] + "." : "Needs the participation function."}</span>
          </summary>
          <div className="dbody"><EarlyWarningBody skin="aurora" cooling={cooling} cycleId={cycleId} back="/lab/briefing" /></div>
        </details>
        <details className="decision">
          <summary>
            <span className="num">2</span>
            <span className="dtitle">Plan the next round of pairs</span>
            <span className="chev" />
            <span className="dsub">{facts.unpaired} {facts.unpaired === 1 ? "teacher has" : "teachers have"} no partner, and {missing} of {cov.possible} department connections don&apos;t exist yet. Try a round and watch the numbers move before you commit.</span>
          </summary>
          <div className="dbody"><RoundSimulator skin="aurora" people={snap.people} pairs={snap.pairs} requests={snap.requests} cycleId={cycleId} back="/lab/briefing" /></div>
        </details>
        <details className="decision">
          <summary>
            <span className="num">3</span>
            <span className="dtitle">What pairs are working on</span>
            <span className="chev" />
            <span className="dsub">{themeLine}</span>
          </summary>
          <div className="dbody"><ThemesBody skin="aurora" snap={snap} raw={d.raw} base="/admin/blend" /></div>
        </details>

        <p className="foot">Counts and averages only. Groups under five are left out, survey answers are anonymous, and nothing here shows what teachers said to each other.</p>
      </div>
    </div>
  );
}
