import Link from "next/link";
import { CycleSwitcher } from "@/components/admin/kit";
import FacultyMapClient from "@/app/admin/map/FacultyMapClient";
import { fullName, loadOverviewDetail, ranked } from "@/lib/admin/detail";
import { requireAdmin } from "@/lib/admin/require";
import { ARCHETYPE_LABEL, CONCERN_DOMAINS, DOMAIN_LABEL, TEACHING_STYLE, TEACHING_STYLES, domainsForTags, type TeachingStyle } from "@/lib/domains";

export const dynamic = "force-dynamic";

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="ev-panel" style={{ padding: "18px 20px" }}>
      <small style={{ textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 10.5 }}>{label}</small>
      <strong style={{ display: "block", font: "600 32px var(--ev-display)", letterSpacing: "-0.04em", margin: "4px 0 2px" }}>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function Bars({ rows, suffix }: { rows: [string, number][]; suffix?: string }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <div>
      {rows.map(([label, n]) => (
        <div key={label} style={{ margin: "12px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span>{label}</span>
            <strong style={{ fontWeight: 600 }}>{n}{suffix ? ` ${suffix}` : ""}</strong>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: "var(--ev-soft)", marginTop: 6 }}>
            <div style={{ width: `${Math.round((n / max) * 100)}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#5eead4,#818cf8)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// The leadership overview in the Aurora look. It shows everything the existing overview shows, from the same
// reads: the numbers, the faculty network, what pairs work on, strengths, departments, teaching styles and
// every co-mentor pair.
export default async function AuroraOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = (await requireAdmin())!;
  const cycleParam = (await searchParams).cycle;
  const d = await loadOverviewDetail(admin, { cycleId: typeof cycleParam === "string" ? cycleParam : null });
  const domainsLogged = Object.values(d.domainCounts).filter((n) => n > 0).length;
  const maxStyle = d.faculty.length;

  return (
    <main className="ev-main ev-wide">
      <p className="ev-eyebrow">Overview · Leadership dashboard</p>
      <h1>{d.school.name}</h1>
      <p className="ev-lead">
        {d.cycle ? `${d.cycle.name} · ${d.cycle.status}` : "No cycle found"}
        {d.school.priority ? ` · ${d.school.priority}` : ""}
      </p>

      <CycleSwitcher skin="aurora" cycles={d.cycles} selectedId={d.cycle?.id ?? null} path="/admin/aurora/overview" />

      <section aria-label="Summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, margin: "22px 0" }}>
        <Stat label="Conversations" value={String(d.conversationCount)} note="logged, content stays private" />
        <Stat label="Active pairs" value={String(d.pairs.length)} note="approved this cycle" />
        <Stat label="Visits" value={String(d.pairs.length)} note="one per pair" />
        <Stat label="Domains logged" value={`${domainsLogged}/${CONCERN_DOMAINS.length}`} note={`of the ${CONCERN_DOMAINS.length} domains`} />
        <Stat label="CTE score" value={d.cte ? d.cte.value.toFixed(2) : "n/a"} note={d.cte ? `efficacy · n=${d.cte.n}${d.cte.synthetic ? " · demo" : ""}` : "no scan data"} />
      </section>

      <section className="ev-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>Faculty network</h2>
          <small>{d.mapUsers.length} people · {d.mapEdges.length} pairs</small>
        </div>
        <div style={{ height: 560, marginTop: 14, borderRadius: 16, overflow: "hidden", border: "1px solid var(--ev-line)", background: "#fff" }}>
          <FacultyMapClient users={d.mapUsers} edges={d.mapEdges} />
        </div>
        <p className="ev-small" style={{ marginTop: 10 }}>Want it full size? <Link href="/admin/aurora/map">Open the faculty map</Link>.</p>
      </section>

      <div className="ev-lead-grid" style={{ marginTop: 22, alignItems: "start", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <section className="ev-panel">
          <p className="ev-eyebrow">What we&apos;re working on · {d.cycle?.name ?? "No cycle"}</p>
          <h2>Domains this cycle</h2>
          <Bars rows={CONCERN_DOMAINS.map((k) => [DOMAIN_LABEL[k], d.domainCounts[k]] as [string, number])} suffix="pairs" />
          <p className="ev-small">Each pair chose one domain to work in.</p>
        </section>
        <section className="ev-panel">
          <p className="ev-eyebrow">Strength domains · set membership</p>
          <h2>Where teachers are strong</h2>
          <Bars rows={CONCERN_DOMAINS.map((k) => [DOMAIN_LABEL[k], d.strengthCounts[k]] as [string, number])} suffix="teachers" />
          <p className="ev-small">Most teachers are strong in more than one domain, so these add up to more than {d.faculty.length}. Membership only, with no ranking behind it.</p>
        </section>
        <section className="ev-panel">
          <p className="ev-eyebrow">By department · {d.faculty.length} teachers</p>
          <h2>Departments</h2>
          <Bars rows={ranked(d.deptCounts)} />
        </section>
        <section className="ev-panel">
          <p className="ev-eyebrow">Teaching archetypes · {d.faculty.length} teachers</p>
          <h2>How teachers teach</h2>
          {TEACHING_STYLES.map((s) => {
            const meta = TEACHING_STYLE[s as TeachingStyle];
            const n = d.styleCounts[s];
            const pct = maxStyle ? Math.round((n / maxStyle) * 100) : 0;
            return (
              <div key={s} style={{ margin: "14px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <strong style={{ fontWeight: 600 }}>{meta.label}</strong>
                  <span>{n} · {pct}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: "var(--ev-soft)", marginTop: 6 }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#5eead4,#818cf8)" }} />
                </div>
                <small>{meta.tagline}</small>
              </div>
            );
          })}
        </section>
      </div>

      <section style={{ marginTop: 30 }}>
        <p className="ev-eyebrow">Co-mentor pairs · {d.pairs.length} pairs</p>
        <h2>Who is working with <em>whom.</em></h2>
        <p className="ev-lead" style={{ fontSize: 15 }}>Shared-focus peer coaching: each pair works a domain both are already strong in, bringing different instincts to it.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
          {d.pairs.map((p) => {
            const host = d.byId.get(p.host_id);
            const visitor = d.byId.get(p.visitor_id);
            if (!host || !visitor) return null;
            const shared = domainsForTags(host.strength_tags).filter((x) => domainsForTags(visitor.strength_tags).includes(x));
            const ha = host.archetype_id ? ARCHETYPE_LABEL[host.archetype_id] : null;
            const va = visitor.archetype_id ? ARCHETYPE_LABEL[visitor.archetype_id] : null;
            return (
              <div key={p.id} className="ev-panel" style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 15 }}>
                  <strong style={{ fontWeight: 600 }}>{fullName(host)}</strong> <small>{host.department}</small>
                  <small> with </small>
                  <strong style={{ fontWeight: 600 }}>{fullName(visitor)}</strong> <small>{visitor.department}</small>
                </div>
                <div style={{ marginTop: 10 }}>
                  {p.domain && <span className="ev-tag">{DOMAIN_LABEL[p.domain] ?? p.domain}</span>}
                  {shared.length > 0 && <small>both strong in {shared.map((x) => DOMAIN_LABEL[x]).join(" and ")}</small>}
                </div>
                {ha && va && ha !== va && <small style={{ display: "block", marginTop: 4 }}>{ha} · {va}</small>}
              </div>
            );
          })}
        </div>
      </section>

      <p className="ev-small" style={{ marginTop: 24 }}>
        Faculty shown here is demo data. Conversation logs stay private to the pair: leadership sees how many happened and in which domains, never what was said.
      </p>
    </main>
  );
}
