import { CycleSwitcher } from "@/components/admin/kit";
import ParticipationPanel from "@/components/admin/participation-panel";
import ThemesPanel from "@/components/admin/themes-panel";
import { TrendsSections, loadTrendsData } from "@/components/admin/trends-view";
import Link from "next/link";
import { CultureBubbles } from "@/components/admin/diagrams";
import NickDimensionBars from "@/components/nick/dimension-bars";
import { Bar, NickDenied, NickPage } from "@/components/nick/page";
import { buildActions, PLC_FOR_DOMAIN } from "@/lib/admin/actions";
import { buildFacts, departmentConnections } from "@/lib/admin/facts";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";
import { DOMAIN_LABEL } from "@/lib/domains";
import { buildFindings } from "@/lib/report/findings";

export const dynamic = "force-dynamic";

// Until the report gates land (Track 1), say plainly when fewer than 60% of faculty have responded.
const REPRESENTATIVE_SHARE = 0.6;
const SEVERITY = { do: "Do this", watch: "Keep an eye on", good: "Going well" } as const;

// Insights in Nick's look: what the Culture Scan and the pairs show, school-wide, and where to head. Survey answers
// carry no department, so nothing here is broken down by group.
export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin();
  if (!admin) return <NickDenied />;
  const params = await searchParams;
  const cycleParam = typeof params.cycle === "string" ? params.cycle : undefined;
  const snap = await loadAdminSnapshot(admin, { cycleId: cycleParam });
  const facts = buildFacts(snap);
  const actions = buildActions(facts, "/admin").filter((a) => a.severity !== "good").slice(0, 4);
  const conn = departmentConnections(snap);
  const findings = snap.stats ? buildFindings(snap.stats) : null;
  const scan = snap.scan;
  const early = scan ? scan.n < REPRESENTATIVE_SHARE * facts.faculty : false;
  const domains = Object.entries(facts.domainCounts).sort((a, b) => b[1] - a[1]);
  const maxDomain = Math.max(1, ...domains.map(([, n]) => n));
  const maxLink = Math.max(1, ...conn.links.map((l) => l.count));
  const trends = await loadTrendsData(admin, snap);

  return (
    <NickPage eyebrow={`Insights · ${snap.cycle?.name ?? "No cycle"}`} title="What it shows, and where to head" sub="School-wide patterns from the Culture Scan and from who is paired. Groups are never shown, and no individual’s answers can be traced.">
      <CycleSwitcher skin="nick" cycles={snap.cycles} selectedId={snap.cycle?.id ?? null} path="/admin/insights" />
      {!scan && (
        <section className="adm-card">
          <h2>No Culture Scan results yet</h2>
          <p className="adm-foot">Results appear once enough teachers respond. Nothing is guessed before then.</p>
        </section>
      )}

      {scan && facts.scan && (
        <>
          {early && (
            <p className="adm-note" style={{ marginTop: 0, color: "var(--amber)" }}>
              <b>Early look, not yet representative.</b> {scan.n} of {facts.faculty} teachers ({facts.scan.completionPct}%) have responded. Read the averages as a first impression.
            </p>
          )}
          <section className="adm-card">
            <div className="adm-card-head">
              <h2>Culture Scan · {facts.scan.cte.toFixed(1)} CTE score</h2>
              <span className="mono adm-count">{scan.n} respondents{scan.includesSynthetic ? " · demo" : ""}</span>
            </div>
            <p className="nk-lead">Collective teacher efficacy: the Efficacy average, ±{facts.scan.cteCi.toFixed(1)} (95%), out of 6.</p>
            <NickDimensionBars means={scan.means} ci={scan.ci} />
          </section>

          {findings && snap.stats && (
            <section className="adm-card">
              <div className="adm-card-head">
                <h2>How the four dimensions connect</h2>
                <span className="mono adm-count">the structure underneath</span>
              </div>
              <div style={{ border: "1px solid var(--line)", borderRadius: 4, background: "var(--card)", padding: "18px 18px 14px" }}>
                <CultureBubbles stats={snap.stats} synthetic={scan.includesSynthetic} />
                <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: 15 }}>{findings.network.finding.sentence}</p>
              </div>
              <h3 style={{ fontFamily: "var(--font-serif), Georgia, serif", margin: "20px 0 4px" }}>{findings.gap.finding.title}</h3>
              <p className="nk-lead">{findings.gap.finding.sentence}</p>
              <h3 style={{ fontFamily: "var(--font-serif), Georgia, serif", margin: "16px 0 4px" }}>{findings.weakest.finding.title}</h3>
              <p className="nk-lead">{findings.weakest.finding.sentence}</p>
              <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Link href="/report" className="nk-btn">Open the six-slide report</Link><Link href="/admin/export/results.csv" className="nk-btn">Download results (CSV)</Link><Link href="/admin/summary" className="nk-btn">Board summary</Link></span>
            </section>
          )}
        </>
      )}

      <ParticipationPanel skin="nick" snap={snap} />
      <ThemesPanel skin="nick" snap={snap} raw={trends.raw} base="/admin" />

      <div id="trends" style={{ scrollMarginTop: 24 }}>
        <TrendsSections skin="nick" snap={snap} data={trends} withHeading />
      </div>

      <div className="nk-two">
        <section className="adm-card">
          <div className="adm-card-head">
            <h2>What pairs work on</h2>
            <span className="mono adm-count">{facts.conversations} conversations</span>
          </div>
          {domains.length === 0 && <p className="adm-foot">No pairs have chosen a domain yet.</p>}
          <ul className="adm-bars">
            {domains.map(([d, n]) => (
              <Bar key={d} label={`${DOMAIN_LABEL[d] ?? d}${PLC_FOR_DOMAIN[d] ? ` → ${PLC_FOR_DOMAIN[d]}` : ""}`} value={n} max={maxDomain} suffix="pairs" />
            ))}
          </ul>
          <p className="adm-foot">Conversation domains route to PLC types. Leadership sees counts, never what was said.</p>
        </section>

        <section className="adm-card">
          <div className="adm-card-head">
            <h2>Pairs between departments</h2>
            <span className="mono adm-count">{facts.crossPct !== null ? `${facts.crossPct}% cross` : "no pairs"}</span>
          </div>
          {conn.links.length === 0 && <p className="adm-foot">No pairs connect two departments yet.</p>}
          <ul className="adm-bars">
            {conn.links.slice(0, 8).map((l) => (
              <Bar key={`${l.a}|${l.b}`} label={`${l.a} ↔ ${l.b}`} value={l.count} max={maxLink} />
            ))}
          </ul>
          <p className="adm-foot">
            {conn.within > 0 ? `${conn.within} pairs stay inside one department. ` : ""}
            {conn.omitted.length > 0 ? `Left out because they have under 5 teachers: ${conn.omitted.join(", ")}.` : ""}
          </p>
        </section>
      </div>

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>Where to head</h2>
          <span className="mono adm-count">the next moves, and why</span>
        </div>
        {actions.length === 0 && <p className="adm-foot">Nothing needs attention right now.</p>}
        {actions.map((a) => (
          <div key={a.id} className="nk-row">
            <div>
              <span className={`nk-chip${a.severity === "do" ? " nk-do" : ""}`}>{SEVERITY[a.severity]}</span>
              <b>{a.title}</b>
              <span className="adm-why">{a.detail}</span>
            </div>
            {a.href !== "/admin/insights" && <Link href={a.href} className="nk-btn">{a.cta}</Link>}
          </div>
        ))}
        <p style={{ marginTop: 14 }}><Link href="/admin/pulse" className="nk-btn">See everything on Pulse</Link></p>
      </section>
    </NickPage>
  );
}
