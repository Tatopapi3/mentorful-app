import { ARCHETYPE_LABEL, CONCERN_DOMAINS, DOMAIN_LABEL, TEACHING_STYLE, TEACHING_STYLES, domainsForTags, type TeachingStyle } from "@/lib/domains";
import { loadReportStats } from "@/lib/report/data";
import type { AdminContext } from "./require";

export type FacultyRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  teaching_style: string | null;
  archetype_id: string | null;
  strength_tags: unknown;
};
export type PairRow = { id: string; host_id: string; visitor_id: string; domain: string | null; strategic_tag: string | null };

export const fullName = (p: { first_name: string | null; last_name: string | null }) => [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Unnamed";
export const ranked = (counts: Record<string, number>) => Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/**
 * What the existing leadership overview and faculty map show, computed once so the Aurora look can show the
 * same things. It reads exactly what Nick's /admin page reads, on the same session client, with the same
 * filters (demo faculty only, approved pairs of the latest cycle). Nothing here is new data.
 */
export async function loadOverviewDetail({ supabase, schoolId }: AdminContext, opts: { cycleId?: string | null } = {}) {
  const { data: allCycles } = await supabase.from("cycles").select("id, name, status, ends_at").eq("school_id", schoolId).order("ends_at", { ascending: false });
  const cycle = (allCycles ?? []).find((c) => c.id === opts.cycleId) ?? (allCycles ?? [])[0] ?? null;
  const [{ data: school }, { data: people }] = await Promise.all([
    supabase.from("schools").select("name, strategic_priority").eq("id", schoolId).maybeSingle(),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, department, teaching_style, archetype_id, strength_tags")
      .eq("school_id", schoolId)
      .eq("is_demo", true)
      .order("department")
      .order("last_name"),
  ]);
  const { data: pairings } = cycle
    ? await supabase.from("pairings").select("id, host_id, visitor_id, domain, strategic_tag").eq("school_id", schoolId).eq("cycle_id", cycle.id).eq("status", "approved")
    : { data: [] as PairRow[] };
  const { data: logCount } = await supabase.rpc("conversation_log_count", { p_cycle: cycle?.id ?? null });

  const faculty = (people ?? []) as FacultyRow[];
  const pairs = (pairings ?? []) as PairRow[];

  const report = await loadReportStats();
  const cte = report.status === "ok" ? { value: report.stats.dimensions.efficacy.mean, n: report.stats.n, synthetic: report.includesSynthetic, demoN: report.demoN } : null;

  const domainCounts: Record<string, number> = {};
  const strengthCounts: Record<string, number> = {};
  for (const d of CONCERN_DOMAINS) domainCounts[d] = 0;
  for (const d of CONCERN_DOMAINS) strengthCounts[d] = 0;
  for (const p of pairs) if (p.domain && p.domain in domainCounts) domainCounts[p.domain]++;
  for (const p of faculty) for (const d of domainsForTags(p.strength_tags)) strengthCounts[d]++;
  const deptCounts: Record<string, number> = {};
  for (const p of faculty) deptCounts[p.department ?? "Unassigned"] = (deptCounts[p.department ?? "Unassigned"] ?? 0) + 1;
  const styleCounts: Record<string, number> = {};
  for (const s of TEACHING_STYLES) styleCounts[s] = 0;
  for (const p of faculty) if (p.teaching_style && p.teaching_style in styleCounts) styleCounts[p.teaching_style]++;

  return {
    school: { name: school?.name ?? "School", priority: school?.strategic_priority ?? null },
    cycle: cycle ? { id: cycle.id, name: cycle.name, status: cycle.status } : null,
    cycles: (allCycles ?? []).map((c) => ({ id: c.id, name: c.name, status: c.status })),
    faculty,
    pairs,
    byId: new Map(faculty.map((p) => [p.id, p])),
    conversationCount: typeof logCount === "number" ? logCount : 0,
    cte,
    domainCounts,
    strengthCounts,
    deptCounts,
    styleCounts,
    // The props FacultyMapClient expects, built the way his map page builds them.
    mapUsers: faculty.map((p) => ({
      id: p.id,
      name: fullName(p),
      department: p.department,
      strengthTags: p.strength_tags,
      domains: domainsForTags(p.strength_tags).map((d) => DOMAIN_LABEL[d]),
      archetype: p.archetype_id ? ARCHETYPE_LABEL[p.archetype_id] : null,
      teachingStyle: p.teaching_style ? TEACHING_STYLE[p.teaching_style as TeachingStyle]?.label ?? null : null,
    })),
    mapEdges: pairs.map((p) => ({ id: p.id, source: p.host_id, target: p.visitor_id, label: (p.strategic_tag || p.domain || "").toString() })),
  };
}
