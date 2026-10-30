import { LOOK, lookBase } from "@/lib/admin/look";
import { respondentsText } from "@/lib/report/gates";
import { FocusBanner } from "@/components/admin/diagrams";
import { CycleSwitcher } from "@/components/admin/kit";
import Link from "next/link";
import { DimensionBars } from "@/components/aurora/dimension-bars";
import { Ring } from "@/components/aurora/ring";
import { SeverityTag } from "@/components/aurora/severity";
import { buildActions } from "@/lib/admin/actions";
import { buildFacts, headlineSentence } from "@/lib/admin/facts";
import { requireAdmin } from "@/lib/admin/require";
import { headlineTitle, progress } from "@/lib/admin/network";
import { loadAdminSnapshot, loadPreviousSnapshot } from "@/lib/admin/snapshot";

export const dynamic = "force-dynamic";

// Pulse: the whole program in one glance. A sentence that says where things stand, four rings, the decisions
// waiting for you, and what to do next. Every suggestion names the number behind it.
export default async function PulsePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const look = LOOK;
  const base = lookBase(look);
  const admin = (await requireAdmin())!;
  const params = await searchParams;
  const cycleParam = typeof params.cycle === "string" ? params.cycle : undefined;
  const snap = await loadAdminSnapshot(admin, { cycleId: cycleParam });
  const facts = buildFacts(snap);
  const actions = buildActions(facts, base).slice(0, 6);
  const focus = actions.find((a) => a.severity === "do") ?? actions[0];
  const headline = headlineTitle(progress(snap, await loadPreviousSnapshot(admin, snap)));
  const nameOf = new Map(snap.people.map((p) => [p.id, p.name]));
  const scan = snap.scan;

  const waiting = [
    ...snap.requests.slice(0, 2).map((r) => ({
      key: r.id,
      eyebrow: "Pairing request",
      title: `${nameOf.get(r.a) ?? "A teacher"} → ${nameOf.get(r.b) ?? "a colleague"}`,
      line: "Proposed by a teacher. It stays pending until you decide.",
      cta: "Review it",
    })),
    ...(facts.unpaired > 0
      ? [{ key: "unpaired", eyebrow: "Pairing", title: `${facts.unpaired} ${facts.unpaired === 1 ? "teacher needs" : "teachers need"} a partner`, line: "Pairs that cross departments connect people who rarely talk.", cta: "Draft a round" }]
      : []),
  ];

  return (
    <main className="ev-main ev-wide">
      <p className="ev-eyebrow">Pulse · {snap.cycle ? `${snap.cycle.name} · ${snap.cycle.status}` : "No cycle yet"}</p>
      <h1>
        {headline.lead} <em>{headline.em}</em>
      </h1>
      <p className="ev-lead">{headlineSentence(facts)}</p>
      {snap.school.priority && <p className="ev-small">Strategic priority: {snap.school.priority}</p>}

      <CycleSwitcher skin={look} cycles={snap.cycles} selectedId={snap.cycle?.id ?? null} path={`${base}/pulse`} />
      {focus && <FocusBanner lead={focus.title} body={focus.detail} href={focus.href} cta="See why" />}
      <div className="v3-rings" style={{ marginTop: 18 }}>
        <Ring pct={facts.scan?.completionPct ?? null} label="Took the scan" sub={scan ? (scan.n > facts.faculty ? `${scan.n} responses` : `${scan.n} of ${facts.faculty}`) : "no results yet"} />
        <Ring pct={facts.pairedPct} label="Have a partner" sub={`${facts.pairCount} pairs`} />
        <Ring pct={facts.crossPct} label="Cross departments" sub="of all pairs" />
        <Ring pct={null} display={String(facts.conversations)} label="Logged conversations" sub={facts.conversationsPerPair !== null ? `${facts.conversationsPerPair} per pair` : "none yet"} />
      </div>

      <div className="ev-lead-grid" style={{ marginTop: 26 }}>
        <section className="ev-feature">
          <p className="ev-eyebrow">Culture Scan · school-wide averages only</p>
          {scan && facts.scan ? (
            <>
              <h2>
                {facts.scan.cte.toFixed(1)} <span style={{ opacity: 0.6, fontSize: "0.6em" }}>CTE score, out of 6</span>
              </h2>
              <p style={{ fontSize: 13, marginTop: -4 }}>Collective teacher efficacy: the Efficacy dimension average, from {respondentsText(facts.scan)}.</p>
              <div style={{ margin: "18px 0 22px", maxWidth: 560 }}>
                <DimensionBars means={scan.means} ci={scan.ci} dark />
              </div>
            </>
          ) : (
            <>
              <h2>Good evidence starts with an honest boundary.</h2>
              <p>Results appear once enough teachers respond, and nothing is guessed before then.</p>
            </>
          )}
          <Link href={`${base}/insights`} className="ev-btn">Open Insights</Link>
        </section>

        <aside>
          <p className="ev-eyebrow muted">Waiting for you</p>
          {waiting.length === 0 && (
            <div className="ev-empty">
              <strong>Nothing needs your decision.</strong>
              <p className="ev-muted" style={{ margin: 0 }}>Every teacher has a partner and no requests are waiting.</p>
            </div>
          )}
          {waiting.map((d) => (
            <div key={d.key} className="ev-panel" style={{ padding: 20, marginBottom: 12 }}>
              <small>{d.eyebrow}</small>
              <strong style={{ display: "block", font: "600 16px var(--ev-display)", letterSpacing: "-0.02em", margin: "4px 0" }}>{d.title}</strong>
              <p className="ev-small">{d.line}</p>
              <Link href={`${base}/pairings`} className="ev-btn primary sm">{d.cta}</Link>
            </div>
          ))}
        </aside>
      </div>

      <section style={{ marginTop: 38 }}>
        <p className="ev-eyebrow">What to do next</p>
        <h2>Every suggestion names the number <em>behind it.</em></h2>
        {actions.length === 0 && <p className="ev-muted">Nothing needs attention right now.</p>}
        {actions.map((a) => (
          <div key={a.id} className="ev-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ maxWidth: 720 }}>
              <SeverityTag severity={a.severity} />
              <strong style={{ display: "block", fontWeight: 600, margin: "8px 0 2px" }}>{a.title}</strong>
              <small>{a.detail}</small>
            </div>
            <Link href={a.href} className="ev-btn sm">{a.cta}</Link>
          </div>
        ))}
      </section>

      <div className="ev-three">
        <section>
          <h3>What you can see</h3>
          <p>Who is paired, where pairs cross departments, and school-wide scan averages. Never an individual&apos;s answers.</p>
          <Link href={`${base}/constellation`} className="ev-btn sm">Open the constellation</Link>
        </section>
        <section>
          <h3>What stays with teachers</h3>
          <p>What was said in a conversation. Leadership sees that conversations happened and how many, never their content.</p>
          <Link href={`${base}/privacy`} className="ev-btn sm">What you can and can’t see</Link>
        </section>
        <section>
          <h3>What you can present</h3>
          <p>The six-slide Culture Scan report, with its source and sample size intact.</p>
          <Link href={`${base}/summary`} className="ev-btn sm">Open the board summary</Link>
        </section>
      </div>
    </main>
  );
}
