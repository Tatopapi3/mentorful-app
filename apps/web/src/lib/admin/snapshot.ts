import { loadReportStats } from "@/lib/report/data";
import { FEATURES } from "@/lib/teacher/features";
import { loadCtleProgress, loadGrowthActivity } from "./growth";
import { DIMENSIONS, type Dimension } from "@/lib/report/stats";
import { loadParticipation } from "./participation";
import type { AdminContext } from "./require";
import type { AdminPair, AdminSnapshot, ScanSummary } from "./facts";

type Row = { id: string; host_id: string; visitor_id: string; domain: string | null; strategic_tag: string | null };

const toPair = (p: Row): AdminPair => ({ id: p.id, a: p.host_id, b: p.visitor_id, domain: p.domain, tag: p.strategic_tag });

/**
 * Everything the Aurora leadership views need, read the way the existing leadership dashboard reads it:
 * on the signed-in admin's session, so row-level security scopes it to their school. Conversations are
 * pair-private, so leadership gets a count from the database function, never the rows. The scan comes from
 * the report engine as aggregates only.
 */
export async function loadAdminSnapshot({ supabase, schoolId }: AdminContext, opts: { cycleId?: string | null } = {}): Promise<AdminSnapshot> {
  const { data: allCycles } = await supabase.from("cycles").select("id, name, status, ends_at").eq("school_id", schoolId).order("ends_at", { ascending: false });
  const cycles = (allCycles ?? []).map((c) => ({ id: c.id, name: c.name, status: c.status }));
  // The cycle asked for, if it is one of this school's; otherwise the latest.
  const chosen = (allCycles ?? []).find((c) => c.id === opts.cycleId) ?? (allCycles ?? [])[0] ?? null;
  const [{ data: school }, { data: teachers }] = await Promise.all([
    supabase.from("schools").select("name, strategic_priority").eq("id", schoolId).maybeSingle(),
    supabase.from("profiles").select("id, first_name, last_name, department").eq("school_id", schoolId).eq("role", "teacher").order("last_name"),
  ]);

  const cycle = chosen;
  const approved = cycle
    ? await supabase.from("pairings").select("id, host_id, visitor_id, domain, strategic_tag").eq("school_id", schoolId).eq("cycle_id", cycle.id).eq("status", "approved")
    : { data: [] as Row[] };
  const pending = cycle
    ? await supabase.from("pairings").select("id, host_id, visitor_id, domain, strategic_tag").eq("school_id", schoolId).eq("cycle_id", cycle.id).eq("status", "pending")
    : { data: [] as Row[] };

  const { data: count } = await supabase.rpc("conversation_log_count", { p_cycle: cycle?.id ?? null });

  const { participation, quietPairs } = await loadParticipation({ supabase, schoolId } as AdminContext, cycle?.id ?? null);
  const [growth, ctle] = await Promise.all([loadGrowthActivity({ supabase, schoolId } as AdminContext), FEATURES.ctle ? loadCtleProgress({ supabase, schoolId } as AdminContext) : null]);
  const report = await loadReportStats(supabase);
  let scan: ScanSummary | null = null;
  if (report.status === "ok") {
    const means = {} as Record<Dimension, number>;
    const ci = {} as Record<Dimension, number>;
    for (const d of DIMENSIONS) {
      means[d] = report.stats.dimensions[d].mean;
      ci[d] = report.stats.dimensions[d].ciHalfWidth;
    }
    scan = { n: report.stats.n, means, ci, includesSynthetic: report.includesSynthetic, demoN: report.demoN };
  }

  return {
    school: { name: school?.name ?? "Your school", priority: school?.strategic_priority ?? null },
    cycle: cycle ? { id: cycle.id, name: cycle.name, status: cycle.status } : null,
    cycles,
    people: (teachers ?? []).map((t) => ({
      id: t.id,
      name: [t.first_name, t.last_name].filter(Boolean).join(" ") || "Teacher",
      dept: t.department ?? "No department",
    })),
    pairs: ((approved.data ?? []) as Row[]).map(toPair),
    requests: ((pending.data ?? []) as Row[]).map(toPair),
    conversations: typeof count === "number" ? count : 0,
    scan,
    scanHold: report.status === "ok" ? null : report.status,
    stats: report.status === "ok" ? report.stats : null,
    participation,
    quietPairs,
    growth,
    ctle,
  };
}

/** The cycle before the one shown (cycles come newest first), for "this cycle against last". Null when there is none. */
export async function loadPreviousSnapshot(admin: AdminContext, snap: AdminSnapshot): Promise<AdminSnapshot | null> {
  const i = snap.cycles.findIndex((c) => c.id === snap.cycle?.id);
  const prev = i >= 0 ? snap.cycles[i + 1] : undefined;
  return prev ? loadAdminSnapshot(admin, { cycleId: prev.id }) : null;
}
