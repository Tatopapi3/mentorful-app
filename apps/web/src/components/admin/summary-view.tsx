import { demoCount, respondentLabel, respondentsText } from "@/lib/report/gates";
import { DimensionBars } from "@/components/aurora/dimension-bars";
import { AdminFrame, Chip, LinkBtn, Muted, Panel, Row, StatGrid, basePath, type Skin } from "@/components/admin/kit";
import { AutoPrint, PrintButton } from "@/components/admin/print-bar";
import { buildActions } from "@/lib/admin/actions";
import { buildFacts, headlineSentence } from "@/lib/admin/facts";
import { participationRates } from "@/lib/admin/participation";
import { scanChange } from "@/lib/admin/scan-change";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";

const LABEL = { do: "Do this", watch: "Keep an eye on", good: "Going well" } as const;

// A one-page summary for a staff meeting or the board: where things stand, the numbers, and the next moves.
// Download it as a PDF file, or print it.
export default async function SummaryView({ skin, searchParams }: { skin: Skin; searchParams: Record<string, string | string[] | undefined> }) {
  const admin = await requireAdmin();
  if (!admin) return null;
  const cycleParam = typeof searchParams.cycle === "string" ? searchParams.cycle : undefined;
  const snap = await loadAdminSnapshot(admin, { cycleId: cycleParam });
  const facts = buildFacts(snap);
  const actions = buildActions(facts, basePath(skin)).filter((a) => a.severity !== "good").slice(0, 3);
  const change = scanChange(snap);
  const sinceLast = change ? ` · ${change.cteNow < change.cteBefore ? "down" : "up"} ${Math.abs(change.cteNow - change.cteBefore).toFixed(1)} since last year` : "";
  const rates = snap.participation ? participationRates(snap.participation) : null;
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const csv = `/admin/export/results.csv${cycleParam ? `?cycle=${cycleParam}` : ""}`;

  return (
    <AdminFrame skin={skin} eyebrow={`Board summary · ${snap.cycle?.name ?? "No cycle"} · ${today}`} title={snap.school.name} sub={headlineSentence(facts)}>
      <div className="ev-noprint" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        <LinkBtn skin={skin} href={`/admin/export/summary.pdf${cycleParam ? `?cycle=${cycleParam}` : ""}`} primary>Download PDF</LinkBtn>
        <PrintButton className="ev-btn sm">Print</PrintButton>
        {snap.scan && <LinkBtn skin={skin} href={csv}>Download the results (CSV)</LinkBtn>}
        <AutoPrint enabled={searchParams.print === "1"} />
      </div>

      <StatGrid
        skin={skin}
        items={[
          { label: "Have a partner", value: facts.pairedPct === null ? "n/a" : `${facts.pairedPct}%`, note: `${facts.paired} of ${facts.faculty} teachers` },
          { label: "Cross departments", value: facts.crossPct === null ? "n/a" : `${facts.crossPct}%`, note: `${facts.crossPairs} of ${facts.pairCount} pairs` },
          { label: "Logged conversations", value: String(facts.conversations), note: facts.conversationsPerPair !== null ? `${facts.conversationsPerPair} per pair` : "none yet" },
          { label: "CTE score", value: facts.scan ? facts.scan.cte.toFixed(1) : "n/a", note: facts.scan ? `out of 6 · ${respondentLabel(facts.scan.n, demoCount(facts.scan))}${sinceLast}` : "no scan results" },
        ]}
      />

      {snap.scan && (
        <Panel skin={skin} title="Culture Scan" eyebrow="School-wide averages" count={respondentsText(snap.scan)}>
          <DimensionBars means={snap.scan.means} ci={snap.scan.ci} before={change?.before} />
        </Panel>
      )}

      {rates && (
        <Panel skin={skin} title="Participation" eyebrow="Pairs in action">
          <Muted skin={skin}>
            {rates.conversationPct}% of pairs have logged a conversation, {rates.debriefPct}% have held a debrief, and {rates.completePct}% have done both. {rates.activePct}% of teachers are in a pair that has talked.
          </Muted>
        </Panel>
      )}

      <Panel skin={skin} title="Next moves" eyebrow="Where to head">
        {actions.length === 0 && <Muted skin={skin}>Nothing needs attention right now.</Muted>}
        {actions.map((a) => (
          <Row key={a.id} skin={skin} chip={<Chip skin={skin} tone={a.severity === "do" ? "amber" : undefined}>{LABEL[a.severity]}</Chip>} title={a.title} detail={a.detail} />
        ))}
      </Panel>

      <Muted skin={skin}>Survey answers are anonymous and shown only as school-wide averages. Leadership sees that conversations happened and how many, never what was said.</Muted>
    </AdminFrame>
  );
}
