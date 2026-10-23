/**
 * The numbers behind the faculty orbit on Constellation: every department with five or more teachers is a planet, and a
 * lens decides what "closer to the centre" means (how many departments it reaches, how many of its pairs cross, how many
 * of its teachers have talked, or how much it has grown). Everything is an aggregate over departments: no names, no
 * answers, no conversation content. A department under 5 teachers has no planet.
 */
import type { AdminSnapshot } from "./facts";
import { crossCount, departmentMatrix, reach, type DeptMatrix } from "./network";
import type { Participation } from "./participation";

export type Lens = "connections" | "mix" | "participation" | "growth";
export const LENS_LABEL: Record<Lens, string> = { connections: "Connections", mix: "Department mix", participation: "Participation", growth: "Growth" };
export const LENS_NOTE: Record<Lens, string> = {
  connections: "Closer to the centre means the department reaches more of the others.",
  mix: "Closer to the centre means more of its pairs cross into another department.",
  participation: "Closer to the centre means more of its teachers are in a pair that has talked.",
  growth: "Closer to the centre means it gained more connections since the last cycle.",
};

export type Planet = {
  dept: string;
  teachers: number;
  pairs: number;
  within: number;
  across: number;
  reach: number;
  possible: number;
  notConnected: string[];
  activePct: number | null;
  /** Change in the number of departments it reaches since the last cycle, or null with no earlier cycle. */
  growth: number | null;
  /** 0 to 1 for each lens (1 is closest to the centre), or null when the lens cannot be worked out. */
  values: Record<Lens, number | null>;
  /** The words under the planet for each lens. */
  notes: Record<Lens, string>;
};

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function planets(snap: Pick<AdminSnapshot, "people" | "pairs">, m: DeptMatrix, participation: Participation | null, prevMatrix: DeptMatrix | null): Planet[] {
  const dept = new Map(snap.people.map((p) => [p.id, p.dept]));
  const rows = new Map(reach(m).map((r) => [r.dept, r]));
  const prevRows = prevMatrix ? new Map(reach(prevMatrix).map((r) => [r.dept, r])) : null;
  return m.depts.map((d) => {
    let within = 0;
    let across = 0;
    for (const p of snap.pairs) {
      const a = dept.get(p.a);
      const b = dept.get(p.b);
      if (a === d && b === d) within++;
      else if (a === d || b === d) across++;
    }
    const r = rows.get(d)!;
    const pairs = within + across;
    const part = participation?.by_department.find((x) => x.department === d);
    const activePct = part && part.teachers > 0 ? Math.round((part.active / part.teachers) * 100) : null;
    const before = prevRows?.get(d);
    const growth = before ? r.connected - before.connected : null;
    const mix = pairs > 0 ? across / pairs : null;
    return {
      dept: d,
      teachers: m.size[d],
      pairs,
      within,
      across,
      reach: r.connected,
      possible: r.possible,
      notConnected: m.depts.filter((o) => o !== d && crossCount(m, d, o) === 0),
      activePct,
      growth,
      values: {
        connections: r.possible > 0 ? r.connected / r.possible : null,
        mix,
        participation: activePct === null ? null : activePct / 100,
        growth: growth === null || r.possible === 0 ? null : clamp(0.5 + growth / (2 * r.possible)),
      },
      notes: {
        connections: `${r.connected} of ${r.possible}`,
        mix: mix === null ? "no pairs yet" : `${Math.round(mix * 100)}% cross`,
        participation: activePct === null ? "n/a" : `${activePct}% talked`,
        growth: growth === null ? "n/a" : growth === 0 ? "no change" : `${growth > 0 ? "+" : ""}${growth}`,
      },
    };
  });
}

/** How far from the centre, from 0 (closest) to 1 (the edge). An unknown value sits on the edge. */
export const farness = (value: number | null) => (value === null ? 1 : 1 - value);

export const hasLens = (ps: Planet[], lens: Lens) => ps.some((p) => p.values[lens] !== null);

export type Direction = { title: string; detail: string };

const join = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);

/** Up to three plain sentences about where to head, for one lens. The same planets always give the same words. */
export function orbitDirections(ps: Planet[], lens: Lens): Direction[] {
  const known = ps.filter((p) => p.values[lens] !== null);
  if (known.length === 0) return [];
  const byValue = [...known].sort((a, b) => (a.values[lens] as number) - (b.values[lens] as number) || a.dept.localeCompare(b.dept));
  const low = byValue[0];
  const high = byValue[byValue.length - 1];
  const out: Direction[] = [];
  if (lens === "connections") {
    if (low.reach < low.possible) out.push({ title: `Bring ${low.dept} closer`, detail: `It reaches ${low.reach} of ${low.possible} other departments. A pair with ${join(low.notConnected.slice(0, 2))} would add a connection it does not have.` });
    if (high.reach === high.possible && known.length >= 3) out.push({ title: `Learn from ${high.dept}`, detail: `It connects to every other department, so what it learns can reach all of them. Ask its teachers to share what works.` });
  } else if (lens === "mix") {
    const stay = byValue.find((p) => p.pairs > 0 && p.within > p.across);
    if (stay) out.push({ title: `Mix ${stay.dept} with others`, detail: `${stay.within} of its ${stay.pairs} pairs stay inside the department. People inside a department already talk, so a pair across adds more.` });
    if (high.values.mix === 1 && high.pairs > 0) out.push({ title: `${high.dept} already crosses`, detail: `Every one of its ${high.pairs} pairs reaches another department. It is a model for the others.` });
  } else if (lens === "participation") {
    const lo = low.values.participation as number;
    const hi = high.values.participation as number;
    if (lo === 1) out.push({ title: "Every department has talked", detail: "All teachers are in a pair that has talked. To widen who talks to whom, look at Connections and Department mix." });
    else {
      out.push({ title: `Check in with ${low.dept}`, detail: `${low.activePct}% of its teachers are in a pair that has talked. A gentle reminder to everyone works better than singling anyone out.` });
      if (hi >= 0.9 && hi > lo) out.push({ title: `${high.dept} is leading`, detail: `${high.activePct}% of its teachers have talked. Ask what is helping.` });
    }
  } else {
    const drop = byValue[0];
    if ((drop.growth ?? 0) < 0) out.push({ title: `${drop.dept} lost ground`, detail: `It reaches ${Math.abs(drop.growth ?? 0)} fewer department${Math.abs(drop.growth ?? 0) === 1 ? "" : "s"} than last cycle. Find out what changed.` });
    const gain = byValue[byValue.length - 1];
    if ((gain.growth ?? 0) > 0) out.push({ title: `${gain.dept} grew the most`, detail: `It reaches ${gain.growth} more department${gain.growth === 1 ? "" : "s"} than last cycle. Keep what is working.` });
  }
  const edge = known.filter((p) => (p.values[lens] as number) < 0.34).length;
  if (out.length < 3 && edge > 1) out.push({ title: `${edge} departments sit near the edge`, detail: `Most of the work here is bringing them in. Start with the one furthest out.` });
  return out.slice(0, 3);
}

/** The planets for a snapshot and its previous one, ready to draw. */
export function facultyOrbit(snap: AdminSnapshot, participation: Participation | null, prev: AdminSnapshot | null) {
  const m = departmentMatrix(snap);
  const ps = planets(snap, m, participation, prev ? departmentMatrix(prev) : null);
  const lenses = (Object.keys(LENS_LABEL) as Lens[]).filter((l) => hasLens(ps, l));
  return { planets: ps, lenses, directions: Object.fromEntries(lenses.map((l) => [l, orbitDirections(ps, l)])) as Record<Lens, Direction[]> };
}
