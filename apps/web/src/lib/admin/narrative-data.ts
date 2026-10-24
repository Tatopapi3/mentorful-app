import type { AdminSnapshot } from "./facts";
import { buildFacts } from "./facts";
import { loadCooling } from "./early-warning-data";
import { buildNarrative, type Narrative } from "./narrative";
import { departmentMatrix, progress } from "./network";
import type { AdminContext } from "./require";
import { loadPreviousSnapshot } from "./snapshot";
import { momentum, readThemes } from "./themes";
import { loadActivity } from "./trend-data";
import { buildWeekly } from "./trends";

/** Gathers what the narrative is written from, the same way the Pulse, Pairing and Insights pages gather it. */
export async function loadNarrative(admin: AdminContext, snap: AdminSnapshot): Promise<Narrative> {
  const [previous, cooling, raw] = await Promise.all([loadPreviousSnapshot(admin, snap), loadCooling(admin, snap.cycle?.id ?? null, snap.pairs.length), loadActivity(admin, snap.cycle?.id ?? null)]);
  const weekly = raw ? buildWeekly(raw) : null;
  return buildNarrative({
    snap,
    facts: buildFacts(snap),
    matrix: departmentMatrix(snap),
    progress: progress(snap, previous),
    previousName: previous?.cycle?.name ?? null,
    cooling,
    themes: readThemes(snap.people, snap.pairs, snap.school.priority),
    momentum: weekly ? momentum(weekly.totals) : null,
  });
}
