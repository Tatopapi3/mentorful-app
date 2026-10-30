import type { ReactNode } from "react";
import FacultyMapClient from "@/app/admin/map/FacultyMapClient";
import { AdminFrame, Muted, Panel, Row, StatGrid, basePath, type Skin } from "@/components/admin/kit";
import { loadOverviewDetail } from "@/lib/admin/detail";
import { buildFacts } from "@/lib/admin/facts";
import { coverage, departmentMatrix } from "@/lib/admin/network";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";

const btnClass = (skin: Skin, primary?: boolean) => (skin === "nick" ? `nk-btn${primary ? " nk-primary" : ""}` : `ev-btn sm${primary ? " primary" : ""}`);

// Plain anchors: these are files and print pages, so the browser should fetch them directly.
function Get({ skin, href, primary, children }: { skin: Skin; href: string; primary?: boolean; children: ReactNode }) {
  return (
    <a href={href} className={btnClass(skin, primary)}>
      {children}
    </a>
  );
}

/**
 * Every report an admin can take away, in one place, so it is always one click from the navigation: the leadership
 * deck (PowerPoint to edit, PDF to share), the six-slide Culture Scan report, the one-page board summary, and the
 * results as a spreadsheet. All of them are counts and averages, never names, answers or conversations.
 *
 * Above them sits the faculty map: the live, named view for the school lead, with the same figures that go into the
 * deck's "Faculty connection" slide and the faculty-connection spreadsheet, so the page and the downloads tell one
 * story. The map itself is never part of a download.
 */
export default async function ReportsView({ skin, searchParams }: { skin: Skin; searchParams: Record<string, string | string[] | undefined> }) {
  const admin = await requireAdmin();
  if (!admin) return null;
  const cycleParam = typeof searchParams.cycle === "string" ? searchParams.cycle : undefined;
  const snap = await loadAdminSnapshot(admin, { cycleId: cycleParam });
  const detail = await loadOverviewDetail(admin, { cycleId: cycleParam ?? null });
  const facts = buildFacts(snap);
  const cov = coverage(departmentMatrix(snap));
  const q = cycleParam ? `?cycle=${encodeURIComponent(cycleParam)}` : "";
  const base = basePath(skin);

  return (
    <AdminFrame skin={skin} eyebrow={`Reports · ${snap.cycle?.name ?? "No cycle"}`} title="Reports you can always take with you" sub="Slides for a staff meeting or the board, a one-page summary, and the numbers as a spreadsheet. Each one is built from the same counts as the dashboard.">
      <Panel skin={skin} title="Faculty map" eyebrow="Live view, for you only" count={`${detail.mapUsers.length} people · ${detail.mapEdges.length} pairs`}>
        <StatGrid
          skin={skin}
          items={[
            { label: "Teachers with a partner", value: facts.pairedPct === null ? "n/a" : `${facts.pairedPct}%`, note: `${facts.paired} of ${facts.faculty} teachers` },
            { label: "Pairs that cross departments", value: facts.crossPct === null ? "n/a" : `${facts.crossPct}%`, note: `${facts.crossPairs} of ${facts.pairCount} pairs` },
            { label: "Department connections", value: `${cov.connected} of ${cov.possible}`, note: "departments of 5 or more teachers" },
          ]}
        />
        <div style={{ height: 520, marginTop: 14, borderRadius: 16, overflow: "hidden", border: "1px solid var(--ev-line, #d9d3c5)", background: "#fff" }}>
          <FacultyMapClient users={detail.mapUsers} edges={detail.mapEdges} />
        </div>
        <Muted skin={skin}>
          Switch the map between a grid, pairings, departments and strengths, and click anyone to see who they are paired with. It is a live view and is never part of a download. The same picture, as department totals with groups under 5 left out, is the “Faculty connection” slide in the leadership deck and the spreadsheet below.
        </Muted>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <Get skin={skin} href={`/admin/export/connection.csv${q}`} primary>Download faculty connection (CSV)</Get>
          <Get skin={skin} href={`${base}/map${q}`}>Open the map full size</Get>
        </div>
      </Panel>

      <Panel skin={skin} title="Leadership deck" eyebrow="Slides" count="7 slides">
        <Row
          skin={skin}
          title="Where the program stands, how far the pairs reach, and what to do next"
          detail="Pairing, department connections, participation and next steps in seven 16:9 slides. Download it as a PowerPoint file to edit, or open it and save it as a PDF to share."
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Get skin={skin} href={`/admin/export/slides.pptx${q}`} primary>Download PowerPoint</Get>
            <Get skin={skin} href={`/admin/export/slides${q}`}>Open as slides, save as PDF</Get>
          </div>
        </Row>
      </Panel>

      <Panel skin={skin} title="Culture Scan report" eyebrow="Slides" count="6 slides">
        <Row
          skin={skin}
          title="The four dimensions, how they connect, and where to start"
          detail="The six-slide report built from the Culture Scan. Download the whole deck as a PDF or PowerPoint, or save single slides as images."
        >
          <Get skin={skin} href="/report" primary>Open the report</Get>
        </Row>
      </Panel>

      <Panel skin={skin} title="Board summary" eyebrow="One page">
        <Row skin={skin} title="Where things stand, the numbers and the next moves, on one page" detail="Made for a staff meeting handout. Press Print and choose Save as PDF to keep it.">
          <Get skin={skin} href={`${base}/summary${q}`}>Open the board summary</Get>
        </Row>
      </Panel>

      <Panel skin={skin} title="Results" eyebrow="Spreadsheet">
        <Row skin={skin} title="Culture Scan results as a CSV" detail="School-wide averages and counts, for your own charts.">
          {snap.scan ? <Get skin={skin} href={`/admin/export/results.csv${q}`}>Download results (CSV)</Get> : <Muted skin={skin}>Available once the Culture Scan has results.</Muted>}
        </Row>
      </Panel>

      <Muted skin={skin}>Everything you download contains counts and averages only. Groups under five are left out, survey answers are anonymous, and nothing shows what teachers said to each other. The faculty map is a live view for you and is not part of any download.</Muted>
    </AdminFrame>
  );
}
