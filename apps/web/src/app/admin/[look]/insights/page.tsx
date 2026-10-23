import { lookBase, lookOf } from "@/lib/admin/look";
import { CycleSwitcher } from "@/components/admin/kit";
import ParticipationPanel from "@/components/admin/participation-panel";
import { TrendsSections, loadTrendsData } from "@/components/admin/trends-view";
import Link from "next/link";
import { CultureBubbles } from "@/components/admin/diagrams";
import { DimensionBars } from "@/components/aurora/dimension-bars";
import { SeverityTag } from "@/components/aurora/severity";
import { buildActions, PLC_FOR_DOMAIN } from "@/lib/admin/actions";
import { buildFacts, departmentConnections } from "@/lib/admin/facts";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";
import { DOMAIN_LABEL } from "@/lib/domains";
import { buildFindings } from "@/lib/report/findings";

export const dynamic = "force-dynamic";

// Until the report gates land (Track 1), say plainly when fewer than 60% of faculty have responded.
const REPRESENTATIVE_SHARE = 0.6;

// Insights: what the Culture Scan and the pairs show, school-wide, and what direction that points in. Survey
// answers are anonymous and carry no department, so nothing here is broken down by group.
export default async function InsightsPage({ params: routeParams, searchParams }: { params: Promise<{ look: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const look = await lookOf(routeParams);
  const base = lookBase(look);
  const admin = (await requireAdmin())!;
  const params = await searchParams;
  const cycleParam = typeof params.cycle === "string" ? params.cycle : undefined;
  const snap = await loadAdminSnapshot(admin, { cycleId: cycleParam });
  const facts = buildFacts(snap);
  const actions = buildActions(facts, base).filter((a) => a.severity !== "good").slice(0, 4);
  const conn = departmentConnections(snap);
  const findings = snap.stats ? buildFindings(snap.stats) : null;
  const trends = await loadTrendsData(admin, snap);
  const scan = snap.scan;
  const early = scan ? scan.n < REPRESENTATIVE_SHARE * facts.faculty : false;

  const domains = Object.entries(facts.domainCounts).sort((a, b) => b[1] - a[1]);
  const maxDomain = Math.max(1, ...domains.map(([, n]) => n));
  const maxLink = Math.max(1, ...conn.links.map((l) => l.count));

  return (
    <main className="ev-main ev-wide">
      <p className="ev-eyebrow">Insights · {snap.cycle?.name ?? "No cycle yet"}</p>
      <h1>
        What it shows, and <em>where to head.</em>
      </h1>
      <p className="ev-lead">School-wide patterns from the Culture Scan and from who is paired. Groups are never shown, and no individual&apos;s answers can be traced.</p>

      <CycleSwitcher skin={look} cycles={snap.cycles} selectedId={snap.cycle?.id ?? null} path={`${base}/insights`} />
      {!scan && (
        <div className="ev-empty" style={{ marginTop: 20 }}>
          <strong>No Culture Scan results yet.</strong>
          <p className="ev-muted" style={{ margin: 0 }}>Results appear once enough teachers respond. Nothing is guessed before then.</p>
        </div>
      )}

      {scan && (
        <>
          {early && (
            <div className="ev-hold" style={{ marginTop: 18 }}>
              <strong>Early look, not yet representative.</strong> {scan.n} of {facts.faculty} teachers ({facts.scan?.completionPct}%) have responded. Read the averages as a first impression.
            </div>
          )}

          <section className="ev-panel" style={{ marginTop: 22 }}>
            <p className="ev-eyebrow">Culture Scan{scan.includesSynthetic ? " · demo data" : ""}</p>
            <h2>
              {facts.scan!.cte.toFixed(1)} <span style={{ opacity: 0.6, fontSize: "0.6em" }}>CTE score, out of 6</span>
            </h2>
            <p className="ev-small">Collective teacher efficacy: the Efficacy average, ±{facts.scan!.cteCi.toFixed(1)} (95%), from {scan.n} respondents.</p>
            <div style={{ maxWidth: 640, margin: "16px 0 4px" }}>
              <DimensionBars means={scan.means} ci={scan.ci} />
            </div>
          </section>

          {findings && snap.stats && (
            <section className="ev-panel" style={{ marginTop: 22 }}>
              <p className="ev-eyebrow">The structure underneath</p>
              <h2>
                How the four dimensions <em>connect.</em>
              </h2>
              <div style={{ border: "1px solid var(--ev-line)", borderRadius: 14, background: "var(--ev-panel-solid)", marginTop: 12, padding: "18px 18px 14px" }}>
                <CultureBubbles stats={snap.stats} synthetic={scan.includesSynthetic} />
                <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: 15 }}>{findings.network.finding.sentence}</p>
              </div>
              <h3 style={{ marginTop: 22 }}>{findings.gap.finding.title}</h3>
              <p className="ev-muted" style={{ maxWidth: 760 }}>{findings.gap.finding.sentence}</p>
              <h3>{findings.weakest.finding.title}</h3>
              <p className="ev-muted" style={{ maxWidth: 760 }}>{findings.weakest.finding.sentence}</p>
              <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Link href="/report" className="ev-btn sm">Open the six-slide report</Link><a href="/admin/export/results.csv" className="ev-btn sm">Download results (CSV)</a><Link href={`${base}/summary`} className="ev-btn sm">Board summary</Link></span>
            </section>
          )}
        </>
      )}

      <ParticipationPanel skin={look} snap={snap} />

      <div id="trends" style={{ scrollMarginTop: 96 }}>
        <TrendsSections skin={look} snap={snap} data={trends} withHeading />
      </div>

      <div className="ev-lead-grid" style={{ marginTop: 22, alignItems: "start" }}>
        <section className="ev-panel">
          <p className="ev-eyebrow">What pairs work on</p>
          <h2>Domains this cycle</h2>
          {domains.length === 0 && <p className="ev-muted">No pairs have chosen a domain yet.</p>}
          {domains.map(([d, n]) => (
            <div key={d} style={{ margin: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <strong style={{ fontWeight: 600 }}>{DOMAIN_LABEL[d] ?? d}</strong>
                <span>{n} {n === 1 ? "pair" : "pairs"}</span>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: "var(--ev-soft)", marginTop: 6 }}>
                <div style={{ width: `${(n / maxDomain) * 100}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#5eead4,#818cf8)" }} />
              </div>
              {PLC_FOR_DOMAIN[d] && <small>Routes to a {PLC_FOR_DOMAIN[d]}</small>}
            </div>
          ))}
          <p className="ev-small">{facts.conversations} conversations logged{facts.conversationsPerPair !== null ? `, ${facts.conversationsPerPair} per pair` : ""}. Leadership sees counts, never what was said.</p>
        </section>

        <section className="ev-panel">
          <p className="ev-eyebrow">How departments connect</p>
          <h2>Pairs between departments</h2>
          {conn.links.length === 0 && <p className="ev-muted">No pairs connect two departments yet.</p>}
          {conn.links.slice(0, 8).map((l) => (
            <div key={`${l.a}|${l.b}`} style={{ margin: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <strong style={{ fontWeight: 600 }}>{l.a} ↔ {l.b}</strong>
                <span>{l.count}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "var(--ev-soft)", marginTop: 6 }}>
                <div style={{ width: `${(l.count / maxLink) * 100}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#14b8a6,#6366f1)" }} />
              </div>
            </div>
          ))}
          <p className="ev-small">
            {facts.crossPct !== null ? `${facts.crossPct}% of pairs cross departments. ` : ""}
            {conn.within > 0 ? `${conn.within} stay inside one department. ` : ""}
            {conn.omitted.length > 0 ? `Left out because they have under 5 teachers: ${conn.omitted.join(", ")}.` : ""}
          </p>
          <Link href={`${base}/constellation`} className="ev-btn sm">Open the constellation</Link>
        </section>
      </div>

      <section style={{ marginTop: 34 }}>
        <p className="ev-eyebrow">Where to head</p>
        <h2>The next moves, <em>and why.</em></h2>
        {actions.length === 0 && <p className="ev-muted">Nothing needs attention right now.</p>}
        {actions.map((a) => (
          <div key={a.id} className="ev-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ maxWidth: 720 }}>
              <SeverityTag severity={a.severity} />
              <strong style={{ display: "block", fontWeight: 600, margin: "8px 0 2px" }}>{a.title}</strong>
              <small>{a.detail}</small>
            </div>
            {a.href !== "/admin/insights" && <Link href={a.href} className="ev-btn sm">{a.cta}</Link>}
          </div>
        ))}
        <p style={{ marginTop: 14 }}><Link href={`${base}/pulse`}>See everything on Pulse →</Link></p>
      </section>
    </main>
  );
}
