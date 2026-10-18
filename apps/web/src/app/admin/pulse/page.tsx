import { CycleSwitcher } from "@/components/admin/kit";
import Link from "next/link";
import NickDimensionBars from "@/components/nick/dimension-bars";
import { Metric, NickDenied, NickPage } from "@/components/nick/page";
import { buildActions } from "@/lib/admin/actions";
import { buildFacts, headlineSentence } from "@/lib/admin/facts";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";

export const dynamic = "force-dynamic";

const SEVERITY = { do: "Do this", watch: "Keep an eye on", good: "Going well" } as const;

// Pulse in Nick's look: where the program stands in one sentence, the numbers, the decisions waiting, and what
// to do next. Every suggestion names the number behind it.
export default async function PulsePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin();
  if (!admin) return <NickDenied />;
  const params = await searchParams;
  const cycleParam = typeof params.cycle === "string" ? params.cycle : undefined;
  const snap = await loadAdminSnapshot(admin, { cycleId: cycleParam });
  const facts = buildFacts(snap);
  const actions = buildActions(facts, "/admin").slice(0, 6);
  const nameOf = new Map(snap.people.map((p) => [p.id, p.name]));
  const scan = snap.scan;
  const pctText = (n: number | null) => (n === null ? "n/a" : `${n}%`);

  const waiting = [
    ...snap.requests.map((r) => ({ key: r.id, title: `${nameOf.get(r.a) ?? "A teacher"} → ${nameOf.get(r.b) ?? "a colleague"}`, line: "Pairing request. It stays pending until you decide." })),
    ...(facts.unpaired > 0 ? [{ key: "unpaired", title: `${facts.unpaired} ${facts.unpaired === 1 ? "teacher needs" : "teachers need"} a partner`, line: "Pairs that cross departments connect people who rarely talk." }] : []),
  ];

  return (
    <NickPage
      eyebrow={`Pulse · ${snap.cycle ? `${snap.cycle.name} · ${snap.cycle.status}` : "No cycle"}`}
      title={(facts.pairedPct ?? 0) >= 60 ? "Connection is growing" : "Where connection stands"}
      sub={<>{headlineSentence(facts)}{snap.school.priority ? ` · ${snap.school.priority}` : ""}</>}
    >
      <CycleSwitcher skin="nick" cycles={snap.cycles} selectedId={snap.cycle?.id ?? null} path="/admin/pulse" />
      <section className="adm-metrics" aria-label="Summary">
        <Metric label="Took the scan" value={pctText(facts.scan?.completionPct ?? null)} note={scan ? `${scan.n} of ${facts.faculty} teachers` : "no results yet"} />
        <Metric label="Have a partner" value={pctText(facts.pairedPct)} note={`${facts.pairCount} pairs`} />
        <Metric label="Cross departments" value={pctText(facts.crossPct)} note="of all pairs" />
        <Metric label="Conversations" value={String(facts.conversations)} note={facts.conversationsPerPair !== null ? `${facts.conversationsPerPair} per pair` : "none yet"} />
        <Metric label="CTE score" value={facts.scan ? facts.scan.cte.toFixed(2) : "n/a"} note={facts.scan ? `efficacy · n=${facts.scan.n}${facts.scan.includesSynthetic ? " · demo" : ""}` : "no scan data"} />
      </section>

      <div className="nk-two">
        <section className="adm-card">
          <div className="adm-card-head">
            <h2>Culture Scan</h2>
            <span className="mono adm-count">school-wide averages only</span>
          </div>
          {scan ? <NickDimensionBars means={scan.means} ci={scan.ci} /> : <p className="adm-foot">Results appear once enough teachers respond. Nothing is guessed before then.</p>}
          <p style={{ marginTop: 14 }}><Link href="/admin/insights" className="nk-btn">Open Insights</Link></p>
        </section>

        <section className="adm-card">
          <div className="adm-card-head">
            <h2>Waiting for you</h2>
            <span className="mono adm-count">{waiting.length} {waiting.length === 1 ? "item" : "items"}</span>
          </div>
          {waiting.length === 0 && <p className="adm-foot">Nothing needs your decision. Every teacher has a partner and no requests are waiting.</p>}
          {waiting.map((w) => (
            <div key={w.key} className="nk-row">
              <div>
                <b>{w.title}</b>
                <span className="adm-why">{w.line}</span>
              </div>
              <Link href="/admin/pairings" className="nk-btn">Review</Link>
            </div>
          ))}
        </section>
      </div>

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>What to do next</h2>
          <span className="mono adm-count">each names its number</span>
        </div>
        {actions.length === 0 && <p className="adm-foot">Nothing needs attention right now.</p>}
        {actions.map((a) => (
          <div key={a.id} className="nk-row">
            <div>
              <span className={`nk-chip${a.severity === "do" ? " nk-do" : ""}`}>{SEVERITY[a.severity]}</span>
              <b>{a.title}</b>
              <span className="adm-why">{a.detail}</span>
            </div>
            <Link href={a.href} className="nk-btn">{a.cta}</Link>
          </div>
        ))}
      </section>

      <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="/admin/summary" className="nk-btn">Board summary</Link>
        <Link href="/admin/privacy" className="nk-btn">What leadership can and can’t see</Link>
        {snap.scan && <Link href="/admin/export/results.csv" className="nk-btn">Download results (CSV)</Link>}
      </p>

      <p className="adm-note">Leadership sees that conversations happened and how many, never what was said. Survey answers are anonymous and shown only as school-wide averages.</p>
    </NickPage>
  );
}
