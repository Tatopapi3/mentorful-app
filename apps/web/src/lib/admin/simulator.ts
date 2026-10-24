/**
 * The pairing simulator: what a round of pairs would do to the faculty network before anyone is paired. Pure: no
 * database, no React, so it runs in the browser as the admin changes a draft and is tested on its own. It reads
 * the same department matrix as Constellation, so departments under 5 teachers stay out of every number here too.
 */
import { MIN_DEPARTMENT_SIZE, type AdminPair, type AdminPerson } from "./facts";
import { coverage, crossCount, departmentMatrix, reach } from "./network";
import { randomizePairs, seededRandom } from "@/lib/pairing/randomize";

export type PairIds = [string, string];

export type RoundMetrics = {
  pairs: number;
  /** Teachers with a partner, as a share of all teachers. */
  partneredPct: number;
  unpaired: number;
  /** Pairs that cross departments, as a share of all pairs. Null when there are no pairs. */
  crossPct: number | null;
  /** Department-to-department connections that exist, out of those possible. */
  connected: number;
  possible: number;
  /** The least connected department and how many of the others it reaches. Null when fewer than two departments are drawn. */
  leastReached: { dept: string; connected: number; possible: number } | null;
};

const toPairs = (pairs: PairIds[]): AdminPair[] => pairs.map(([a, b], i) => ({ id: String(i), a, b, domain: null, tag: null }));

export function metricsOf(people: AdminPerson[], pairs: PairIds[]): RoundMetrics {
  const dept = new Map(people.map((p) => [p.id, p.dept]));
  const m = departmentMatrix({ people, pairs: toPairs(pairs) });
  const cov = coverage(m);
  const paired = new Set(pairs.flat());
  const crossing = pairs.filter(([a, b]) => dept.get(a) !== dept.get(b)).length;
  const least = reach(m)[0];
  return {
    pairs: pairs.length,
    partneredPct: people.length ? Math.round((paired.size / people.length) * 100) : 0,
    unpaired: people.filter((p) => !paired.has(p.id)).length,
    crossPct: pairs.length ? Math.round((crossing / pairs.length) * 100) : null,
    connected: cov.connected,
    possible: cov.possible,
    leastReached: least ? { dept: least.dept, connected: least.connected, possible: least.possible } : null,
  };
}

export type CellState = "kept" | "new" | "missing";
export type Impact = {
  before: RoundMetrics;
  after: RoundMetrics;
  /** Every pair of drawn departments, with whether a pair already connected them, the round adds the first, or none does. */
  grid: { a: string; b: string; state: CellState }[];
  depts: string[];
  omitted: string[];
};

/**
 * `now` is the pairs that stand as the baseline; `added` is the proposal on top of them. `kept` are the pairs that
 * stay in the "after" picture: normally the same as `now`, but empty when planning a whole new cycle from scratch.
 */
export function impactOf(people: AdminPerson[], now: PairIds[], added: PairIds[], kept: PairIds[] = now): Impact {
  const after = [...kept, ...added];
  const mNow = departmentMatrix({ people, pairs: toPairs(now) });
  const mAfter = departmentMatrix({ people, pairs: toPairs(after) });
  const grid: Impact["grid"] = [];
  for (let i = 0; i < mAfter.depts.length; i++)
    for (let j = i + 1; j < mAfter.depts.length; j++) {
      const a = mAfter.depts[i];
      const b = mAfter.depts[j];
      const had = crossCount(mNow, a, b) > 0;
      const has = crossCount(mAfter, a, b) > 0;
      grid.push({ a, b, state: has ? (had ? "kept" : "new") : "missing" });
    }
  return { before: metricsOf(people, now), after: metricsOf(people, after), grid, depts: mAfter.depts, omitted: mAfter.omitted };
}

/** Which department links the pair at `index` creates that no other pair in the proposal (or the baseline) already makes. */
export function linksOpenedBy(people: AdminPerson[], baseline: PairIds[], proposal: PairIds[], index: number): [string, string][] {
  const dept = new Map(people.map((p) => [p.id, p.dept]));
  const size: Record<string, number> = {};
  for (const p of people) size[p.dept] = (size[p.dept] ?? 0) + 1;
  const drawn = (d: string | undefined): d is string => !!d && (size[d] ?? 0) >= MIN_DEPARTMENT_SIZE;
  const key = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);
  const have = new Set<string>();
  for (const [a, b] of [...baseline, ...proposal.filter((_, i) => i !== index)]) {
    const da = dept.get(a);
    const db = dept.get(b);
    if (drawn(da) && drawn(db) && da !== db) have.add(key(da, db).join("|"));
  }
  const [a, b] = proposal[index] ?? [];
  const da = dept.get(a);
  const db = dept.get(b);
  if (!drawn(da) || !drawn(db) || da === db) return [];
  const k = key(da, db);
  return have.has(k.join("|")) ? [] : [k];
}

/** Give `visitor` (a person in the proposal) to the pair at `index`; whoever had them gets the person that pair gave up. */
export function swapVisitor(pairs: PairIds[], index: number, newVisitor: string): PairIds[] {
  const out = pairs.map((p) => [...p] as PairIds);
  const old = out[index]?.[1];
  if (old === undefined || old === newVisitor || out[index][0] === newVisitor) return out;
  for (const p of out) {
    if (p[0] === newVisitor) p[0] = old;
    else if (p[1] === newVisitor) p[1] = old;
  }
  out[index][1] = newVisitor;
  return out.filter(([a, b]) => a !== b);
}

export type Proposal = { pairs: PairIds[]; left: string[] };

/** True when `a` beats `b`, comparing the numbers in order and stopping at the first that differs. */
const better = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

/** One random round among `pool`, reproducible from `seed`, using the same cost rules as the published rounds. */
export function draftRound(people: AdminPerson[], pool: string[], past: PairIds[], seed: number): Proposal {
  const dept = new Map(people.map((p) => [p.id, p.dept]));
  const { pairs, unpaired } = randomizePairs({
    teachers: pool.map((id) => ({ id, department: dept.get(id) ?? null, gradeLevel: null })),
    exclusions: [],
    pastPairs: past,
    random: seededRandom(seed),
  });
  return { pairs: pairs.map(([a, b]) => [a.id, b.id] as PairIds), left: unpaired.map((u) => u.teacher.id) };
}

/**
 * The best of `tries` random rounds: most new department connections first, then most pairs that cross
 * departments, then fewest repeats of earlier pairs. It only chooses among legal rounds, never invents a pairing
 * the randomizer wouldn't, and the same inputs always give the same answer.
 */
export function bestRound(people: AdminPerson[], pool: string[], baseline: PairIds[], past: PairIds[], tries = 200, seed = 1): Proposal {
  const dept = new Map(people.map((p) => [p.id, p.dept]));
  const pastKeys = new Set(past.map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`)));
  let best: { p: Proposal; score: number[] } | null = null;
  for (let i = 0; i < tries; i++) {
    const p = draftRound(people, pool, past, seed + i);
    const m = metricsOf(people, [...baseline, ...p.pairs]);
    const crossing = p.pairs.filter(([a, b]) => dept.get(a) !== dept.get(b)).length;
    const repeats = p.pairs.filter(([a, b]) => pastKeys.has(a < b ? `${a}|${b}` : `${b}|${a}`)).length;
    const score = [m.connected, crossing, -repeats, -p.left.length];
    if (!best || better(score, best.score)) best = { p, score };
  }
  return best?.p ?? { pairs: [], left: pool };
}

/** The plain sentence above the numbers. It says "adds" only when something is added, and never promises a result. */
export function impactSentence(impact: Impact): string {
  const { before, after } = impact;
  const added = after.connected - before.connected;
  const parts: string[] = [];
  if (added > 0) parts.push(`adds ${added} department ${added === 1 ? "connection" : "connections"} (${before.connected} to ${after.connected} of ${after.possible})`);
  else if (added < 0) parts.push(`drops ${-added} department ${added === -1 ? "connection" : "connections"} (${before.connected} to ${after.connected} of ${after.possible})`);
  else parts.push(`keeps department connections at ${after.connected} of ${after.possible}`);
  if (before.crossPct !== null && after.crossPct !== null && before.crossPct !== after.crossPct) parts.push(`moves pairs that cross departments from ${before.crossPct}% to ${after.crossPct}%`);
  else if (before.crossPct === null && after.crossPct !== null) parts.push(`puts ${after.crossPct}% of pairs across departments`);
  if (before.leastReached && after.leastReached && after.leastReached.connected > before.leastReached.connected) parts.push(`and lifts ${before.leastReached.dept} off the edge, reaching ${after.leastReached.connected} of ${after.leastReached.possible} departments`);
  return `This round ${parts.join(", ")}.`;
}
