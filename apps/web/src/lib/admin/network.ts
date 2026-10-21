/**
 * What the faculty network says, worked out from who is paired with whom: which departments are connected,
 * which are not, who could close a gap, and how far things have come since the last cycle. Pure: no database,
 * no React. Departments with fewer than MIN_DEPARTMENT_SIZE teachers are left out, so no one is identifiable.
 */
import { MIN_DEPARTMENT_SIZE, type AdminSnapshot } from "./facts";

export type DeptMatrix = {
  depts: string[];
  /** Pairs between two different departments, keyed "A|B" with A sorted before B. */
  cross: Record<string, number>;
  /** Pairs inside one department. */
  within: Record<string, number>;
  size: Record<string, number>;
  omitted: string[];
};

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function departmentMatrix(s: Pick<AdminSnapshot, "people" | "pairs">): DeptMatrix {
  const size: Record<string, number> = {};
  for (const p of s.people) size[p.dept] = (size[p.dept] ?? 0) + 1;
  const depts = Object.keys(size).filter((d) => size[d] >= MIN_DEPARTMENT_SIZE).sort();
  const omitted = Object.keys(size).filter((d) => size[d] < MIN_DEPARTMENT_SIZE).sort();
  const dept = new Map(s.people.map((p) => [p.id, p.dept]));
  const shown = new Set(depts);
  const cross: Record<string, number> = {};
  const within: Record<string, number> = {};
  for (const p of s.pairs) {
    const a = dept.get(p.a);
    const b = dept.get(p.b);
    if (!a || !b || !shown.has(a) || !shown.has(b)) continue;
    if (a === b) within[a] = (within[a] ?? 0) + 1;
    else cross[key(a, b)] = (cross[key(a, b)] ?? 0) + 1;
  }
  return { depts, cross, within, size, omitted };
}

export const crossCount = (m: DeptMatrix, a: string, b: string) => m.cross[key(a, b)] ?? 0;

/** Department pairs with no pair between them yet, the biggest gaps first. */
export function gaps(m: DeptMatrix): { a: string; b: string }[] {
  const out: { a: string; b: string; weight: number }[] = [];
  for (let i = 0; i < m.depts.length; i++)
    for (let j = i + 1; j < m.depts.length; j++) {
      const a = m.depts[i];
      const b = m.depts[j];
      if (crossCount(m, a, b) === 0) out.push({ a, b, weight: m.size[a] + m.size[b] });
    }
  return out.sort((x, y) => y.weight - x.weight || x.a.localeCompare(y.a)).map(({ a, b }) => ({ a, b }));
}

/** For each department: how many of the other departments it has at least one pair with. */
export function reach(m: DeptMatrix): { dept: string; connected: number; possible: number }[] {
  return m.depts
    .map((d) => ({ dept: d, connected: m.depts.filter((o) => o !== d && crossCount(m, d, o) > 0).length, possible: m.depts.length - 1 }))
    .sort((x, y) => x.connected - y.connected || x.dept.localeCompare(y.dept));
}

/** How many of the possible department-to-department connections exist. */
export function coverage(m: DeptMatrix): { connected: number; possible: number } {
  const possible = (m.depts.length * (m.depts.length - 1)) / 2;
  const connected = Object.keys(m.cross).length;
  return { connected, possible };
}

export type Suggestion = { host: { id: string; name: string; dept: string }; visitor: { id: string; name: string; dept: string }; closes: [string, string] };

/**
 * Pairs among the people who have no partner that would connect two departments with no pair between them yet.
 * Each person appears once, and the biggest gaps are closed first. These are suggestions for the admin to
 * approve, never decisions.
 */
export function suggestions(s: AdminSnapshot, m: DeptMatrix, limit = 4): Suggestion[] {
  const paired = new Set(s.pairs.flatMap((p) => [p.a, p.b]));
  const requested = new Set(s.requests.flatMap((p) => [p.a, p.b]));
  const pool = s.people.filter((p) => !paired.has(p.id) && !requested.has(p.id) && m.depts.includes(p.dept));
  const used = new Set<string>();
  const out: Suggestion[] = [];
  for (const g of gaps(m)) {
    if (out.length >= limit) break;
    const a = pool.find((p) => p.dept === g.a && !used.has(p.id));
    const b = pool.find((p) => p.dept === g.b && !used.has(p.id));
    if (!a || !b) continue;
    used.add(a.id);
    used.add(b.id);
    out.push({ host: a, visitor: b, closes: [g.a, g.b] });
  }
  return out;
}

export type Progress = { label: string; now: string; before: string; delta: "up" | "down" | "same"; good: boolean };

/** This cycle against the one before it. Empty when there is no earlier cycle. */
export function progress(now: AdminSnapshot, before: AdminSnapshot | null): Progress[] {
  if (!before) return [];
  const rate = (s: AdminSnapshot, f: (s: AdminSnapshot) => number) => f(s);
  const pairedPct = (s: AdminSnapshot) => (s.people.length ? Math.round((new Set(s.pairs.flatMap((p) => [p.a, p.b])).size / s.people.length) * 100) : 0);
  const crossPct = (s: AdminSnapshot) => {
    const d = new Map(s.people.map((p) => [p.id, p.dept]));
    return s.pairs.length ? Math.round((s.pairs.filter((p) => d.get(p.a) !== d.get(p.b)).length / s.pairs.length) * 100) : 0;
  };
  const cover = (s: AdminSnapshot) => coverage(departmentMatrix(s)).connected;
  const rows: { label: string; f: (s: AdminSnapshot) => number; unit: string }[] = [
    { label: "Teachers with a partner", f: pairedPct, unit: "%" },
    { label: "Pairs that cross departments", f: crossPct, unit: "%" },
    { label: "Department connections", f: cover, unit: "" },
  ];
  return rows.map((r) => {
    const a = rate(now, r.f);
    const b = rate(before, r.f);
    return { label: r.label, now: `${a}${r.unit}`, before: `${b}${r.unit}`, delta: a > b ? "up" : a < b ? "down" : "same", good: a >= b };
  });
}

/**
 * The words at the top of Pulse. They say "growing" only when something rose since the last cycle and nothing fell,
 * and they say nothing about direction when there is no earlier cycle to compare with.
 */
export function headlineTitle(prog: Progress[]): { lead: string; em: string } {
  if (prog.length === 0) return { lead: "Where connection", em: "stands." };
  const up = prog.some((p) => p.delta === "up");
  const down = prog.some((p) => p.delta === "down");
  if (up && !down) return { lead: "Connection is", em: "growing." };
  if (down && !up) return { lead: "Connection has", em: "slipped." };
  if (up && down) return { lead: "Connection is", em: "shifting." };
  return { lead: "Connection is", em: "holding steady." };
}

export type Direction = { id: string; severity: "do" | "watch" | "good"; title: string; detail: string };

/** The plain-language reading of the sky: where to look first, and why. */
export function directions(s: AdminSnapshot, m: DeptMatrix, prog: Progress[], prevName: string | null): Direction[] {
  const out: Direction[] = [];
  const cov = coverage(m);
  const r = reach(m);
  const g = gaps(m);

  const unpaired = s.people.filter((p) => !new Set(s.pairs.flatMap((x) => [x.a, x.b])).has(p.id));
  if (unpaired.length > 0) {
    const byDept = new Map<string, number>();
    for (const p of unpaired) byDept.set(p.dept, (byDept.get(p.dept) ?? 0) + 1);
    const top = [...byDept.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    out.push({ id: "unpaired", severity: "do", title: `${unpaired.length} ${unpaired.length === 1 ? "teacher has" : "teachers have"} no partner`, detail: `${top[1]} of them ${top[1] === 1 ? "is" : "are"} in ${top[0]}. Pairing them is the quickest way to add connections.` });
  }
  if (m.depts.length >= 2 && cov.connected < cov.possible) {
    out.push({ id: "gaps", severity: "do", title: `${cov.possible - cov.connected} of ${cov.possible} department connections don't exist yet`, detail: `${g.slice(0, 3).map((x) => `${x.a} and ${x.b}`).join("; ")}${g.length > 3 ? "; and more" : ""} have no pair between them. A pair across any of these adds a connection that isn't there today.` });
  }
  if (r.length > 0 && r[0].connected < r[0].possible) {
    out.push({ id: "least", severity: "watch", title: `${r[0].dept} is the least connected department`, detail: `Its pairs reach ${r[0].connected} of ${r[0].possible} other departments. A department on the edge is where ideas stop spreading.` });
  }
  const hub = r[r.length - 1];
  if (hub && hub.connected === hub.possible && m.depts.length >= 3) {
    out.push({ id: "hub", severity: "good", title: `${hub.dept} connects to every other department`, detail: "It can carry what one department learns to all the others. Worth asking its teachers to share." });
  }
  const within = Object.values(m.within).reduce((a, b) => a + b, 0);
  const crossTotal = Object.values(m.cross).reduce((a, b) => a + b, 0);
  if (within > 0 && within >= crossTotal) {
    out.push({ id: "within", severity: "watch", title: `${within} pairs stay inside one department`, detail: "People inside a department already talk. A pair across departments adds more." });
  }
  const cross = prog.find((p) => p.label === "Pairs that cross departments");
  if (cross && prevName) {
    out.push({ id: "progress", severity: cross.good ? "good" : "watch", title: `Pairs that cross departments: ${cross.now}, was ${cross.before} in ${prevName}`, detail: cross.delta === "up" ? "The program is breaking down silos faster than last cycle." : cross.delta === "down" ? "Fewer pairs cross departments than last cycle. Check what changed." : "Level with last cycle." });
  }
  return out;
}
