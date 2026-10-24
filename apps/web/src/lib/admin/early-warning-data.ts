import { coolingFrom, type Cooling } from "./early-warning";
import type { AdminContext } from "./require";

/**
 * Asks the quiet-pair count function (script 015) for 14, 30 and 45 days. It returns counts only, so leadership never
 * learns which pairs. If the function isn't in the database yet the calls error and this returns null, so the page can
 * say so instead of failing.
 */
export async function loadCooling({ supabase }: AdminContext, cycleId: string | null, pairs: number): Promise<Cooling | null> {
  if (!cycleId) return null;
  const [a, b, c] = await Promise.all([14, 30, 45].map((p_days) => supabase.rpc("quiet_pair_count", { p_cycle: cycleId, p_days })));
  if (a.error || b.error || c.error || [a.data, b.data, c.data].some((v) => typeof v !== "number")) return null;
  return coolingFrom({ pairs, quiet14: a.data as number, quiet30: b.data as number, quiet45: c.data as number });
}
