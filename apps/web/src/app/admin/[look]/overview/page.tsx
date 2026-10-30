import Link from "next/link";
import { demoCount, respondentLabel } from "@/lib/report/gates";
import { lookBase, lookOf } from "@/lib/admin/look";
import { CycleSwitcher } from "@/components/admin/kit";
import { loadOverviewDetail } from "@/lib/admin/detail";
import { FEWER_THAN_5, floorCell, floorCrossing, floorDepartments, floorRows, floorShare, type Cell } from "@/lib/admin/overview-floor";
import { requireAdmin } from "@/lib/admin/require";
import { CONCERN_DOMAINS, DOMAIN_LABEL, TEACHING_STYLE, TEACHING_STYLES, type TeachingStyle } from "@/lib/domains";

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

// A row whose count is null is under the floor of 5: it is named, but its number and bar are withheld.
function Bars({ rows, suffix }: { rows: [string, Cell][]; suffix?: string }) {
  const max = Math.max(1, ...rows.map(([, n]) => n ?? 0));
  return (
    <div>
      {rows.map(([label, n]) => (
        <div key={label} style={{ margin: "12px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span>{label}</span>
            <strong style={{ fontWeight: 600 }}>{n === null ? FEWER_THAN_5 : `${n}${suffix ? ` ${suffix}` : ""}`}</strong>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: "var(--ev-soft)", marginTop: 6 }}>
            <div style={{ width: `${n === null ? 0 : Math.round((n / max) * 100)}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#5eead4,#818cf8)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// The leadership overview in the Aurora look, from the same reads as Nick's: the numbers, what pairs work on,
// strengths, departments, teaching styles and
// and how pairs cross departments. Nothing is shown for a group under 5, and no teacher is named.
export default async function AuroraOverviewPage({ params: routeParams, searchParams }: { params: Promise<{ look: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const look = await lookOf(routeParams);
  const base = lookBase(look);
  const admin = (await requireAdmin())!;
  const cycleParam = (await searchParams).cycle;
  const d = await loadOverviewDetail(admin, { cycleId: typeof cycleParam === "string" ? cycleParam : null });
  const domainsLogged = Object.values(d.domainCounts).filter((n) => n > 0).length;
  const departments = floorDepartments(d.deptCounts);
  const crossing = floorCrossing(d.pairs.map((p) => ({ host: d.byId.get(p.host_id)?.department ?? null, visitor: d.byId.get(p.visitor_id)?.department ?? null })));

  return (
    <main className="ev-main ev-wide">
      <p className="ev-eyebrow">Overview · Leadership dashboard</p>
      <h1>{d.school.name}</h1>
      <p className="ev-lead">
        {d.cycle ? `${d.cycle.name} · ${d.cycle.status}` : "No cycle found"}
        {d.school.priority ? ` · ${d.school.priority}` : ""}
      </p>

      <CycleSwitcher skin={look} cycles={d.cycles} selectedId={d.cycle?.id ?? null} path={`${base}/overview`} />

      <section aria-label="Summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, margin: "22px 0" }}>
        <Stat label="Logged conversations" value={String(d.conversationCount)} note="content stays private" />
        <Stat label="Active pairs" value={String(d.pairs.length)} note="approved this cycle" />
        <Stat label="Visits" value={String(d.pairs.length)} note="one per pair" />
        <Stat label="Domains logged" value={`${domainsLogged}/${CONCERN_DOMAINS.length}`} note={`of the ${CONCERN_DOMAINS.length} domains`} />
        <Stat label="CTE score" value={d.cte ? d.cte.value.toFixed(2) : "n/a"} note={d.cte ? `efficacy · ${respondentLabel(d.cte.n, demoCount({ n: d.cte.n, includesSynthetic: d.cte.synthetic, demoN: d.cte.demoN }))}` : "no scan data"} />
      </section>

      <section className="ev-panel">
        <p className="ev-eyebrow">Faculty network</p>
        <h2>The faculty as groups, never as individuals</h2>
        <p className="ev-muted">
          {d.faculty.length} teachers and {d.pairs.length} approved pairs this cycle. To protect people, this page doesn&apos;t list teachers or show who is paired with whom, and no group under 5 is shown anywhere on it.
          <br />
          The <Link href={`${base}/constellation`}>Constellation</Link> shows the same network by department.
        </p>
      </section>

      <div className="ev-lead-grid" style={{ marginTop: 22, alignItems: "start", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <section className="ev-panel">
          <p className="ev-eyebrow">What we&apos;re working on · {d.cycle?.name ?? "No cycle"}</p>
          <h2>Domains this cycle</h2>
          <Bars rows={floorRows(CONCERN_DOMAINS.map((k) => [DOMAIN_LABEL[k], d.domainCounts[k]] as [string, number]))} suffix="pairs" />
          <p className="ev-small">Each pair chose one domain to work in.</p>
        </section>
        <section className="ev-panel">
          <p className="ev-eyebrow">Strength domains · set membership</p>
          <h2>Where teachers are strong</h2>
          <Bars rows={floorRows(CONCERN_DOMAINS.map((k) => [DOMAIN_LABEL[k], d.strengthCounts[k]] as [string, number]))} suffix="teachers" />
          <p className="ev-small">Most teachers are strong in more than one domain, so these add up to more than {d.faculty.length}. Membership only, with no ranking behind it.</p>
        </section>
        <section className="ev-panel">
          <p className="ev-eyebrow">By department · {d.faculty.length} teachers</p>
          <h2>Departments</h2>
          <Bars rows={[...departments.rows, ...(departments.combined ? ([[`${departments.combined.departments} smaller departments, combined`, departments.combined.teachers]] as [string, number][]) : [])]} />
          <p className="ev-small">
            Departments with fewer than 5 teachers aren&apos;t listed{departments.notShown ? `, so ${FEWER_THAN_5} teachers are left out of this chart` : departments.combined ? "; the ones that are small are shown together" : ""}.
          </p>
        </section>
        <section className="ev-panel">
          <p className="ev-eyebrow">Teaching archetypes · {d.faculty.length} teachers</p>
          <h2>How teachers teach</h2>
          <p className="ev-small" style={{ marginTop: 0 }}>
            Each teacher has one teaching style on their profile, from onboarding: <strong>Nurturer</strong> (care first, then challenge), <strong>Activator</strong> (spark curiosity, ignite action) or <strong>Architect</strong> (design clarity, build mastery). It names the approach a teacher leans toward. It is not a score or an evaluation, and no style is better than another. This panel only counts how many teachers lean each way, so you can see the mix on your faculty. Groups under 5 are hidden.
          </p>
          {TEACHING_STYLES.map((s) => {
            const meta = TEACHING_STYLE[s as TeachingStyle];
            const n = floorCell(d.styleCounts[s]);
            const pct = n === null ? null : floorShare(n, d.faculty.length) ?? 0;
            return (
              <div key={s} style={{ margin: "14px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <strong style={{ fontWeight: 600 }}>{meta.label}</strong>
                  <span>{n === null ? FEWER_THAN_5 : `${n} · ${pct}%`}</span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: "var(--ev-soft)", marginTop: 6 }}>
                  <div style={{ width: `${pct ?? 0}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#5eead4,#818cf8)" }} />
                </div>
                <small>{meta.tagline}</small>
              </div>
            );
          })}
        </section>
      </div>

      <section className="ev-panel" style={{ marginTop: 22 }}>
        <p className="ev-eyebrow">Co-mentor pairs · {d.pairs.length} pairs</p>
        <h2>How pairs <em>cross the school.</em></h2>
        <p className="ev-lead" style={{ fontSize: 15 }}>Shared-focus peer coaching: each pair works a domain both are already strong in, bringing different instincts to it.</p>
        {crossing ? (
          <Bars rows={[["Pairs across two departments", crossing.across], ["Pairs within one department", crossing.within]]} suffix="pairs" />
        ) : (
          <p className="ev-muted">Whether pairs cross departments isn&apos;t shown yet: one of the two groups has fewer than 5 pairs, and showing the other would give it away.</p>
        )}
        <p className="ev-small">Who is paired with whom stays with the people managing pairings, not on this overview.</p>
      </section>

      <p className="ev-small" style={{ marginTop: 24 }}>
        Faculty shown here is demo data. Conversation logs stay private to the pair: leadership sees how many happened and in which domains, never what was said.
      </p>
    </main>
  );
}
