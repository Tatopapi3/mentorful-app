// Randomized pairing round. Pure: no Supabase, no network, so it is tested on its own. The goal is exposure across silos, not chemistry, so the cost of
// a pair is how much it *fails* to mix the faculty:
//
//   same department  +4
//   same grade level +2
//   paired before    +3
//   excluded         never allowed
//
// Most-constrained teachers are placed first (fewest valid partners), each
// takes their cheapest remaining partner (ties broken by a seeded shuffle,
// so a round is random but reproducible), then a swap pass trades partners
// between pairs whenever that lowers the total cost.

export type PoolTeacher = {
  id: string;
  department: string | null;
  gradeLevel: string | null;
};

export type RandomizeInput = {
  teachers: PoolTeacher[];
  exclusions: [string, string][];
  pastPairs: [string, string][];
  random: () => number;
};

export type UnpairedReason = "odd_count" | "no_valid_partner";

export type RandomizeResult = {
  pairs: [PoolTeacher, PoolTeacher][];
  unpaired: { teacher: PoolTeacher; reason: UnpairedReason }[];
};

const COST_SAME_DEPARTMENT = 4;
const COST_SAME_GRADE = 2;
const COST_REPEAT = 3;

function key(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// Mulberry32: tiny, seedable PRNG so a round can be reproduced in tests.
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function randomizePairs(input: RandomizeInput): RandomizeResult {
  const excluded = new Set(input.exclusions.map(([a, b]) => key(a, b)));
  const past = new Set(input.pastPairs.map(([a, b]) => key(a, b)));

  const allowed = (a: PoolTeacher, b: PoolTeacher) =>
    a.id !== b.id && !excluded.has(key(a.id, b.id));

  const cost = (a: PoolTeacher, b: PoolTeacher) => {
    let c = 0;
    if (a.department && a.department === b.department) c += COST_SAME_DEPARTMENT;
    if (a.gradeLevel && a.gradeLevel === b.gradeLevel) c += COST_SAME_GRADE;
    if (past.has(key(a.id, b.id))) c += COST_REPEAT;
    return c;
  };

  const pool = shuffle(input.teachers, input.random);
  const validCount = new Map(
    pool.map((t) => [t.id, pool.filter((o) => allowed(t, o)).length]),
  );
  // Stable sort keeps the shuffled order among equally constrained teachers.
  const order = [...pool].sort((x, y) => validCount.get(x.id)! - validCount.get(y.id)!);

  const taken = new Set<string>();
  const pairs: [PoolTeacher, PoolTeacher][] = [];
  const noPartner: PoolTeacher[] = [];

  for (const t of order) {
    if (taken.has(t.id)) continue;
    let best: PoolTeacher | null = null;
    let bestCost = Infinity;
    for (const o of pool) {
      if (taken.has(o.id) || !allowed(t, o)) continue;
      const c = cost(t, o);
      if (c < bestCost) {
        best = o;
        bestCost = c;
      }
    }
    if (best) {
      pairs.push([t, best]);
      taken.add(t.id);
      taken.add(best.id);
    } else {
      noPartner.push(t);
      taken.add(t.id);
    }
  }

  // Swap pass: for pairs (a,b) and (c,d), try (a,c)+(b,d) and (a,d)+(b,c).
  let improved = true;
  for (let pass = 0; improved && pass < 20; pass++) {
    improved = false;
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const [a, b] = pairs[i];
        const [c, d] = pairs[j];
        const current = cost(a, b) + cost(c, d);
        const options: [[PoolTeacher, PoolTeacher], [PoolTeacher, PoolTeacher]][] = [
          [[a, c], [b, d]],
          [[a, d], [b, c]],
        ];
        for (const [p, q] of options) {
          if (!allowed(p[0], p[1]) || !allowed(q[0], q[1])) continue;
          if (cost(p[0], p[1]) + cost(q[0], q[1]) < current) {
            pairs[i] = p;
            pairs[j] = q;
            improved = true;
            break;
          }
        }
      }
    }
  }

  const unpaired: RandomizeResult["unpaired"] = noPartner.map((teacher) => ({
    teacher,
    // Exactly one teacher left with nobody remaining is the odd one out,
    // not an exclusion problem.
    reason:
      noPartner.length === 1 && input.teachers.length % 2 === 1 && validCount.get(teacher.id)! > 0
        ? "odd_count"
        : "no_valid_partner",
  }));

  return { pairs, unpaired };
}

// Mentorful's pairings are directional: the host is observed and the visitor observes. A symmetric pair
// from the round above becomes a host and a visitor here. Whoever has hosted less so far hosts this
// time, so across rounds nobody is always the one being watched; a tie is settled by the seeded
// shuffle. Pure and reproducible.
export type DirectedPair = { host: PoolTeacher; visitor: PoolTeacher };

export function orientPairs(
  pairs: [PoolTeacher, PoolTeacher][],
  hostedBefore: ReadonlyMap<string, number>,
  random: () => number,
): DirectedPair[] {
  return pairs.map(([a, b]) => {
    const ha = hostedBefore.get(a.id) ?? 0;
    const hb = hostedBefore.get(b.id) ?? 0;
    const aHosts = ha === hb ? random() < 0.5 : ha < hb;
    return aHosts ? { host: a, visitor: b } : { host: b, visitor: a };
  });
}
