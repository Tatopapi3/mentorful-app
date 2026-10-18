import type { AdminContext } from "./require";

/** What the participation function returns: counts only, never rows, and no department under 5 teachers. */
export type Participation = {
  pairs: number;
  with_conversation: number;
  with_debrief: number;
  complete: number;
  teachers: number;
  active_teachers: number;
  by_department: { department: string; teachers: number; active: number }[];
};

/** A number under this is shown as "fewer than 5", the same floor the rest of the app uses for small groups. */
export const MIN_CELL = 5;

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

export function participationRates(p: Participation) {
  return {
    conversationPct: pct(p.with_conversation, p.pairs),
    debriefPct: pct(p.with_debrief, p.pairs),
    completePct: pct(p.complete, p.pairs),
    activePct: pct(p.active_teachers, p.teachers),
    departments: p.by_department.map((d) => ({ department: d.department, teachers: d.teachers, pct: pct(d.active, d.teachers) })).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || a.department.localeCompare(b.department)),
  };
}

/** A small count is hidden, so a handful of pairs can't be picked out. */
export function quietLabel(n: number): string {
  return n >= MIN_CELL ? String(n) : "fewer than 5";
}

/**
 * Reads both functions on the admin's session. If the database doesn't have them yet (script 015 is not applied)
 * the calls error, and this returns nulls so the page can say so instead of failing.
 */
export async function loadParticipation({ supabase }: AdminContext, cycleId: string | null): Promise<{ participation: Participation | null; quietPairs: number | null }> {
  if (!cycleId) return { participation: null, quietPairs: null };
  const [summary, quiet] = await Promise.all([supabase.rpc("participation_summary", { p_cycle: cycleId }), supabase.rpc("quiet_pair_count", { p_cycle: cycleId, p_days: 30 })]);
  return {
    participation: summary.error || !summary.data ? null : (summary.data as unknown as Participation),
    quietPairs: quiet.error || typeof quiet.data !== "number" ? null : quiet.data,
  };
}
