import { cycleTrend, type CycleMetrics, type RawActivity } from "./trends";
import type { AdminContext } from "./require";
import type { AdminPair } from "./facts";

type Row = { id: string; cycle_id: string; host_id: string; visitor_id: string; domain: string | null; strategic_tag: string | null };

/**
 * Pairings of every cycle, read the way the snapshot reads them (on the admin's session, so row-level security scopes
 * them to their school), then one row of numbers per cycle, oldest first.
 */
export async function loadCycleTrend({ supabase, schoolId }: AdminContext): Promise<CycleMetrics[]> {
  const [{ data: cycles }, { data: teachers }, { data: approved }] = await Promise.all([
    supabase.from("cycles").select("id, name, ends_at").eq("school_id", schoolId).order("ends_at", { ascending: true }),
    supabase.from("profiles").select("id, first_name, last_name, department").eq("school_id", schoolId).eq("role", "teacher"),
    supabase.from("pairings").select("id, cycle_id, host_id, visitor_id, domain, strategic_tag").eq("school_id", schoolId).eq("status", "approved"),
  ]);
  const people = (teachers ?? []).map((t) => ({ id: t.id, name: [t.first_name, t.last_name].filter(Boolean).join(" ") || "Teacher", dept: t.department ?? "No department" }));
  const byCycle: Record<string, AdminPair[]> = {};
  for (const r of (approved ?? []) as Row[]) (byCycle[r.cycle_id] ??= []).push({ id: r.id, a: r.host_id, b: r.visitor_id, domain: r.domain, tag: r.strategic_tag });
  return cycleTrend(people, (cycles ?? []).map((c) => ({ id: c.id, name: c.name })), byCycle);
}

/**
 * Conversations by month and by department, from the database function in script 016. If it isn't applied yet the
 * call errors, and this returns null so the page can say so instead of failing.
 */
export async function loadActivity({ supabase }: AdminContext, cycleId: string | null): Promise<RawActivity | null> {
  if (!cycleId) return null;
  const { data, error } = await supabase.rpc("conversation_activity", { p_cycle: cycleId });
  if (error || !data) return null;
  return data as unknown as RawActivity;
}
