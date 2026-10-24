import { loadCooling } from "./early-warning-data";
import type { Cooling } from "./early-warning";
import { buildFacts, headlineSentence, type AdminSnapshot, type Facts } from "./facts";
import { narrativeFrom } from "./narrative-data";
import type { Narrative } from "./narrative";
import { departmentMatrix, headlineTitle, progress, type DeptMatrix } from "./network";
import type { AdminContext } from "./require";
import { loadAdminSnapshot, loadPreviousSnapshot } from "./snapshot";
import { loadActivity } from "./trend-data";
import type { RawActivity } from "./trends";

export type LabData = {
  snap: AdminSnapshot;
  prev: AdminSnapshot | null;
  facts: Facts;
  matrix: DeptMatrix;
  cooling: Cooling | null;
  raw: RawActivity | null;
  narrative: Narrative;
  headline: { lead: string; em: string };
  sentence: string;
};

/**
 * Everything the three design studies show, loaded once. The studies differ in layout and in how they ask you to
 * work, not in what they know: each one is built from this same data.
 */
export async function loadLab(admin: AdminContext, cycleId?: string): Promise<LabData> {
  const snap = await loadAdminSnapshot(admin, { cycleId });
  const [prev, cooling, raw] = await Promise.all([loadPreviousSnapshot(admin, snap), loadCooling(admin, snap.cycle?.id ?? null, snap.pairs.length), loadActivity(admin, snap.cycle?.id ?? null)]);
  const facts = buildFacts(snap);
  return {
    snap,
    prev,
    facts,
    matrix: departmentMatrix(snap),
    cooling,
    raw,
    narrative: narrativeFrom(snap, prev, cooling, raw),
    headline: headlineTitle(progress(snap, prev)),
    sentence: headlineSentence(facts),
  };
}
