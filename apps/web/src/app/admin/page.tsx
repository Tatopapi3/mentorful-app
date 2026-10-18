import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import FacultyMapClient from "./map/FacultyMapClient";
import { loadReportStats } from "@/lib/report/data";
import {
  CONCERN_DOMAINS,
  STRENGTH_DOMAINS,
  DOMAIN_LABEL,
  ARCHETYPE_LABEL,
  TEACHING_STYLE,
  TEACHING_STYLES,
  domainsForTags,
  type ConcernDomain,
  type TeachingStyle,
} from "@/lib/domains";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin" };

/**
 * Leadership dashboard.
 *
 * Every faculty read runs on the caller's SESSION client (anon key + cookies),
 * so 009/011's policies scope the page to the reader's own school. The one
 * exception is the CTE score, which comes from the report engine's service-key
 * path — `survey_responses` has no SELECT policy by design, and that module is
 * the established boundary: it returns dimension-level aggregates only, never
 * rows. Do not widen that pattern to anything else on this page.
 *
 * Panels deliberately absent:
 *  - "Absent today" — no attendance data exists anywhere in the schema.
 *  - Previous-cycle comparison — there is one cycle. `surveys.wave` exists for
 *    a future delta, but nothing has been re-measured yet.
 */

type Row = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  teaching_style: string | null;
  archetype_id: string | null;
  strength_tags: unknown;
};

type Pair = {
  id: string;
  host_id: string;
  visitor_id: string;
  domain: string | null;
  strategic_tag: string | null;
};

function fullName(p: { first_name: string | null; last_name: string | null }) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Unnamed";
}

/** Sorted count map → array, descending, with a stable tiebreak on label. */
function ranked(counts: Record<string, number>) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("id, school_id, role, first_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Authorization, not just authentication. RLS already scopes the DATA to
  // this reader's school; this stops a non-admin from seeing the page frame at
  // all, which is the check the old version was missing.
  if (!me || me.role !== "admin") {
    return (
      <>
        <SiteHeader />
        <main className="wrap adm-denied">
          <h1>Leadership dashboard</h1>
          <p>This page is for school leadership. Your account doesn’t have admin access.</p>
        </main>
      </>
    );
  }
  if (!me.school_id) {
    return (
      <>
        <SiteHeader />
        <main className="wrap adm-denied">
          <h1>Leadership dashboard</h1>
          <p>Your profile isn’t attached to a school yet.</p>
        </main>
      </>
    );
  }

  const schoolId = me.school_id;

  const [{ data: school }, { data: cycle }, { data: people }, { data: logs }] =
    await Promise.all([
      supabase.from("schools").select("name, strategic_priority").eq("id", schoolId).maybeSingle(),
      supabase
        .from("cycles")
        .select("id, name, status, ends_at")
        .eq("school_id", schoolId)
        .order("ends_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, first_name, last_name, department, teaching_style, archetype_id, strength_tags")
        .eq("school_id", schoolId)
        .eq("is_demo", true)
        .order("department")
        .order("last_name"),
      supabase.from("conversation_logs").select("id, domain").eq("school_id", schoolId),
    ]);

  const { data: pairings } = cycle
    ? await supabase
        .from("pairings")
        .select("id, host_id, visitor_id, domain, strategic_tag")
        .eq("school_id", schoolId)
        .eq("cycle_id", cycle.id)
        .eq("status", "approved")
    : { data: [] as Pair[] };

  const faculty = (people ?? []) as Row[];
  const pairs = (pairings ?? []) as Pair[];
  const byId = new Map(faculty.map((p) => [p.id, p]));

  // --- metric strip --------------------------------------------------------
  // conversation_logs is pair-private (011): a direct SELECT returns zero rows
  // for an admin, by design. The count comes from conversation_log_count(),
  // the SECURITY DEFINER aggregate added in 014, which returns a number and
  // never content. Leadership sees that coaching is happening, never what was
  // said. If the function is missing the RPC errors and we fall back to the
  // rows we can actually read, which is the honest floor.
  const { data: logCountRpc } = cycle
    ? await supabase.rpc("conversation_log_count", { p_cycle: cycle.id })
    : await supabase.rpc("conversation_log_count", { p_cycle: null });
  const conversationCount =
    typeof logCountRpc === "number" ? logCountRpc : (logs ?? []).length;

  const domainCounts: Record<string, number> = {};
  for (const d of CONCERN_DOMAINS) domainCounts[d] = 0;
  for (const p of pairs) if (p.domain && p.domain in domainCounts) domainCounts[p.domain]++;
  const domainsLogged = Object.values(domainCounts).filter((n) => n > 0).length;

  // CTE = the Culture Scan's efficacy dimension. Server-only, aggregate-only.
  const report = await loadReportStats();
  const cte =
    report.status === "ok" ? report.stats.dimensions.efficacy.mean : null;
  const cteN = report.status === "ok" ? report.stats.n : null;
  const cteSynthetic = report.status === "ok" ? report.includesSynthetic : false;

  // --- faculty map ---------------------------------------------------------
  const mapUsers = faculty.map((p) => ({
    id: p.id,
    name: fullName(p),
    department: p.department,
    strengthTags: p.strength_tags,
    domains: domainsForTags(p.strength_tags).map((d) => DOMAIN_LABEL[d]),
    archetype: p.archetype_id ? ARCHETYPE_LABEL[p.archetype_id] : null,
    teachingStyle: p.teaching_style
      ? TEACHING_STYLE[p.teaching_style as TeachingStyle]?.label ?? null
      : null,
  }));
  const mapEdges = pairs.map((p) => ({
    id: p.id,
    source: p.host_id,
    target: p.visitor_id,
    label: (p.strategic_tag || p.domain || "").toString(),
  }));

  // --- department / strength-domain / archetype rollups --------------------
  const deptCounts: Record<string, number> = {};
  for (const p of faculty) deptCounts[p.department ?? "Unassigned"] = (deptCounts[p.department ?? "Unassigned"] ?? 0) + 1;

  // Set membership: a teacher strong in two domains is counted in both, so
  // these deliberately sum to more than the headcount.
  const strengthCounts: Record<string, number> = {};
  for (const d of STRENGTH_DOMAINS) strengthCounts[d] = 0;
  for (const p of faculty) for (const d of domainsForTags(p.strength_tags)) strengthCounts[d]++;

  const styleCounts: Record<string, number> = {};
  for (const s of TEACHING_STYLES) styleCounts[s] = 0;
  for (const p of faculty) {
    if (p.teaching_style && p.teaching_style in styleCounts) styleCounts[p.teaching_style]++;
  }

  const maxDomain = Math.max(1, ...CONCERN_DOMAINS.map((d) => domainCounts[d]));
  const maxStrength = Math.max(1, ...STRENGTH_DOMAINS.map((d) => strengthCounts[d]));
  const maxDept = Math.max(1, ...Object.values(deptCounts));

  return (
    <>
      <SiteHeader />
      <main className="wrap adm">
        <header className="adm-head">
          <div>
            <p className="mono adm-eyebrow">Leadership dashboard</p>
            <h1>{school?.name ?? "School"}</h1>
            <p className="adm-sub">
              {cycle ? (
                <>
                  {cycle.name} · <span className="adm-status">{cycle.status}</span>
                </>
              ) : (
                "No cycle found"
              )}
              {school?.strategic_priority ? <> · {school.strategic_priority}</> : null}
            </p>
          </div>
        </header>

        {/* ---------------------------------------------------- metric strip */}
        <section className="adm-metrics" aria-label="Summary">
          <Metric
            label="Conversations"
            value={String(conversationCount)}
            note="logged, content stays private"
          />
          <Metric label="Active pairs" value={String(pairs.length)} note="approved this cycle" />
          <Metric label="Visits" value={String(pairs.length)} note="one per pair" />
          <Metric
            label="Domains logged"
            value={`${domainsLogged}/${CONCERN_DOMAINS.length}`}
            note={`of the ${CONCERN_DOMAINS.length} domains`}
          />
          <Metric
            label="CTE score"
            value={cte === null ? "n/a" : cte.toFixed(2)}
            note={
              cte === null
                ? "no scan data"
                : `efficacy · n=${cteN}${cteSynthetic ? " · demo" : ""}`
            }
          />
        </section>

        {/* -------------------------------------------------- faculty network */}
        <section className="adm-card adm-map-card">
          <div className="adm-card-head">
            <h2>Faculty network</h2>
            <span className="mono adm-count">
              {mapUsers.length} people · {mapEdges.length} pairs
            </span>
          </div>
          <div className="adm-map">
            <FacultyMapClient users={mapUsers} edges={mapEdges} />
          </div>
        </section>

        {/* ------------------------------------------ what we're working on */}
        <div className="adm-grid">
          <section className="adm-card">
            <div className="adm-card-head">
              <h2>What we’re working on</h2>
              <span className="mono adm-count">{cycle?.name ?? "No cycle"}</span>
            </div>
            <ul className="adm-bars">
              {CONCERN_DOMAINS.map((d) => (
                <Bar
                  key={d}
                  label={DOMAIN_LABEL[d]}
                  value={domainCounts[d]}
                  max={maxDomain}
                  suffix="pairs"
                />
              ))}
            </ul>
            <p className="adm-foot">
              Each pair chose one domain to work in. No previous cycle to compare against yet.
            </p>
          </section>

          {/* -------------------------------------------- strength domains */}
          <section className="adm-card">
            <div className="adm-card-head">
              <h2>Strength domains</h2>
              <span className="mono adm-count">set membership</span>
            </div>
            <ul className="adm-bars">
              {STRENGTH_DOMAINS.map((d) => (
                <Bar
                  key={d}
                  label={DOMAIN_LABEL[d]}
                  value={strengthCounts[d]}
                  max={maxStrength}
                  suffix="teachers"
                />
              ))}
            </ul>
            <p className="adm-foot">
              Most teachers are strong in more than one domain, so these add up to more than{" "}
              {faculty.length}. Membership only, with no ranking behind it.
            </p>
          </section>

          {/* ------------------------------------------------ by department */}
          <section className="adm-card">
            <div className="adm-card-head">
              <h2>By department</h2>
              <span className="mono adm-count">{faculty.length} teachers</span>
            </div>
            <ul className="adm-bars">
              {ranked(deptCounts).map(([dept, n]) => (
                <Bar key={dept} label={dept} value={n} max={maxDept} suffix="" />
              ))}
            </ul>
          </section>

          {/* ------------------------------------------ teaching archetypes */}
          <section className="adm-card">
            <div className="adm-card-head">
              <h2>Teaching archetypes</h2>
              <span className="mono adm-count">{faculty.length} teachers</span>
            </div>
            <ul className="adm-styles">
              {TEACHING_STYLES.map((s) => {
                const meta = TEACHING_STYLE[s as TeachingStyle];
                const n = styleCounts[s];
                const pct = faculty.length ? Math.round((n / faculty.length) * 100) : 0;
                return (
                  <li key={s}>
                    <div className="adm-style-top">
                      <b>{meta.label}</b>
                      <span className="mono">
                        {n} · {pct}%
                      </span>
                    </div>
                    <div className="adm-track">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    <span className="adm-tagline">{meta.tagline}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* ------------------------------------------------- co-mentor pairs */}
        <section className="adm-card">
          <div className="adm-card-head">
            <h2>Co-mentor pairs</h2>
            <span className="mono adm-count">{pairs.length} pairs</span>
          </div>
          <p className="adm-lede">
            Shared-focus peer coaching: each pair works a domain both are already strong in,
            bringing different instincts to it.
          </p>
          <ul className="adm-pairs">
            {pairs.map((p) => {
              const host = byId.get(p.host_id);
              const visitor = byId.get(p.visitor_id);
              if (!host || !visitor) return null;
              const shared = domainsForTags(host.strength_tags).filter((d) =>
                domainsForTags(visitor.strength_tags).includes(d)
              );
              const ha = host.archetype_id ? ARCHETYPE_LABEL[host.archetype_id] : null;
              const va = visitor.archetype_id ? ARCHETYPE_LABEL[visitor.archetype_id] : null;
              const contrast = ha && va && ha !== va;
              return (
                <li key={p.id} className="adm-pair">
                  <div className="adm-pair-people">
                    <span>
                      <b>{fullName(host)}</b>
                      <em>{host.department}</em>
                    </span>
                    <span className="adm-pair-amp">with</span>
                    <span>
                      <b>{fullName(visitor)}</b>
                      <em>{visitor.department}</em>
                    </span>
                  </div>
                  <div className="adm-pair-meta">
                    {p.domain ? (
                      <span className="adm-chip">{DOMAIN_LABEL[p.domain] ?? p.domain}</span>
                    ) : null}
                    {shared.length > 0 ? (
                      <span className="adm-why">
                        both strong in {shared.map((d) => DOMAIN_LABEL[d]).join(" and ")}
                      </span>
                    ) : null}
                    {contrast ? (
                      <span className="adm-why adm-why-dim">
                        {ha} · {va}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="adm-note">
          Faculty shown here is demo data. Conversation logs stay private to the pair: leadership
          sees how many happened and in which domains, never what was said.
        </p>
      </main>
    </>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="adm-metric">
      <span className="mono">{label}</span>
      <b>{value}</b>
      <span className="adm-metric-note">{note}</span>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  suffix: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <li className="adm-bar">
      <div className="adm-bar-top">
        <span>{label}</span>
        <span className="mono">
          {value}
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      <div className="adm-track">
        <i style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}
