import { EarlyWarningBody } from "@/components/admin/early-warning-panel";
import { FacultyOrbit } from "@/components/admin/faculty-orbit";
import { GroupSummaryRoot } from "@/components/admin/group-summary";
import { NarrativeBody } from "@/components/admin/narrative-panel";
import RoundSimulator from "@/components/admin/round-simulator";
import { ThemesBody } from "@/components/admin/themes-panel";
import MapWorkspace, { type Signal } from "@/components/lab/map-workspace";
import { LabNotice, StudySwitch, first } from "@/components/lab/shell";
import { countLabel } from "@/lib/admin/early-warning";
import { facultyOrbit } from "@/lib/admin/faculty-orbit";
import { loadLab } from "@/lib/admin/lab-data";
import { coverage, directions, gaps, progress, reach } from "@/lib/admin/network";
import { requireAdmin } from "@/lib/admin/require";
import { groupSummaries } from "@/lib/admin/summaries";
import { buildActivity } from "@/lib/admin/trends";

export const dynamic = "force-dynamic";

// Study 3, Map: the faculty is the page. You look at the school first, and the tools sit beside it. A signal on the
// left tells you where to look, and opens the tool that acts on it in the drawer on the right.
export default async function MapStudy({ searchParams: sp }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await sp;
  const admin = (await requireAdmin())!;
  const cycle = first(searchParams.cycle);
  const d = await loadLab(admin, cycle);
  const { snap, facts, cooling } = d;
  const cycleId = snap.cycle?.id ?? "";
  const q = cycle ? `?cycle=${cycle}` : "";
  const orbit = facultyOrbit(snap, snap.participation ?? null, d.prev);
  const summaries = groupSummaries(snap, d.matrix, snap.participation ?? null, d.raw ? buildActivity(d.raw) : null);
  const cov = coverage(d.matrix);
  const edge = reach(d.matrix)[0];
  const dirs = directions(snap, d.matrix, progress(snap, d.prev), d.prev?.cycle?.name ?? null);

  const signals: Signal[] = [];
  if (cooling && cooling.cooling + cooling.quiet > 0) signals.push({ id: "cooling", tone: cooling.cooling > 0 ? "warn" : "alert", title: `${countLabel(cooling.cooling + cooling.quiet)} pairs are drifting quiet`, detail: `${countLabel(cooling.cooling)} silent 14 to 30 days, ${countLabel(cooling.quiet)} for a month or more.`, tab: "warning" });
  if (facts.unpaired > 0 || cov.connected < cov.possible) signals.push({ id: "round", tone: "warn", title: `${gaps(d.matrix).length} department connections are missing`, detail: `${facts.unpaired} ${facts.unpaired === 1 ? "teacher has" : "teachers have"} no partner. Try a round to see what closes them.`, tab: "simulator" });
  if (edge && edge.connected < edge.possible) signals.push({ id: "edge", tone: "alert", title: `${edge.dept} is on the edge`, detail: `Its pairs reach ${edge.connected} of ${edge.possible} other departments.`, tab: "simulator" });
  if (dirs.some((x) => x.severity === "good")) signals.push({ id: "good", tone: "good", title: dirs.find((x) => x.severity === "good")!.title, detail: "Going well. The story has the detail.", tab: "story" });
  signals.push({ id: "themes", tone: "good", title: "What pairs are working on", detail: "See the themes and whether volume is rising.", tab: "themes" });

  return (
    <div className="ev lab-map" data-theme="light">
      <header className="map-bar">
        <b>{snap.school.name}</b>
        <span style={{ color: "var(--ev-muted)" }}>{snap.cycle?.name ?? "No cycle"} · {facts.pairedPct ?? 0}% paired · {facts.crossPct ?? 0}% across departments · {cov.connected}/{cov.possible} links</span>
        <span className="sp" />
        <StudySwitch current="map" cycle={cycle} />
      </header>
      <GroupSummaryRoot summaries={summaries}>
        <MapWorkspace
          signals={signals}
          tabs={[
            { id: "simulator", label: "Simulator", content: <RoundSimulator skin="aurora" people={snap.people} pairs={snap.pairs} requests={snap.requests} cycleId={cycleId} back="/lab/map" /> },
            { id: "warning", label: "Early warning", content: <EarlyWarningBody skin="aurora" cooling={cooling} cycleId={cycleId} back="/lab/map" /> },
            { id: "themes", label: "Themes", content: <ThemesBody skin="aurora" snap={snap} raw={d.raw} base="/admin/blend" /> },
            { id: "story", label: "Story", content: <NarrativeBody skin="aurora" narrative={d.narrative} download={`/admin/export/narrative.txt${q}`} /> },
          ]}
        >
          <div className="hero">
            <h1>{d.headline.lead} {d.headline.em}</h1>
            <p>{d.sentence} Click a department to see its summary. Position is a guide to where connection is thin, not a measure of anyone.</p>
          </div>
          <LabNotice searchParams={searchParams} />
          <div className="hero" style={{ padding: 8 }}>
            {orbit.planets.length > 0 ? <FacultyOrbit planets={orbit.planets} lenses={orbit.lenses} directions={orbit.directions} /> : <p style={{ margin: 12 }}>No departments have five or more teachers, so there is no map to draw.</p>}
          </div>
        </MapWorkspace>
      </GroupSummaryRoot>
    </div>
  );
}
