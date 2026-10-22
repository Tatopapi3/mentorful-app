/**
 * What a click on a department says: counts only, never a name. Built from the same department matrix, participation
 * rates and activity counts the other panels use, so it cannot show anything they hide. A department with fewer than 5
 * teachers has no summary at all.
 */
import type { AdminSnapshot } from "./facts";
import { crossCount, type DeptMatrix } from "./network";
import type { Participation } from "./participation";
import type { Activity } from "./trends";

export type GroupSummary = {
  dept: string;
  teachers: number;
  pairs: number;
  within: number;
  across: number;
  connected: { dept: string; count: number }[];
  notConnected: string[];
  activePct: number | null;
  months: { month: string; n: number | null }[];
};

export function groupSummaries(snap: Pick<AdminSnapshot, "people" | "pairs">, m: DeptMatrix, participation: Participation | null, activity: Activity | null): Record<string, GroupSummary> {
  const dept = new Map(snap.people.map((p) => [p.id, p.dept]));
  const out: Record<string, GroupSummary> = {};
  for (const d of m.depts) {
    let within = 0;
    let across = 0;
    for (const p of snap.pairs) {
      const a = dept.get(p.a);
      const b = dept.get(p.b);
      if (a === d && b === d) within++;
      else if (a === d || b === d) across++;
    }
    const others = m.depts.filter((o) => o !== d);
    const connected = others.map((o) => ({ dept: o, count: crossCount(m, d, o) })).filter((x) => x.count > 0).sort((x, y) => y.count - x.count || x.dept.localeCompare(y.dept));
    const row = participation?.by_department.find((x) => x.department === d);
    out[d] = {
      dept: d,
      teachers: m.size[d],
      pairs: within + across,
      within,
      across,
      connected,
      notConnected: others.filter((o) => crossCount(m, d, o) === 0),
      activePct: row && row.teachers > 0 ? Math.round((row.active / row.teachers) * 100) : null,
      months: activity ? activity.months.map((month) => ({ month, n: activity.cell(d, month) })) : [],
    };
  }
  return out;
}
