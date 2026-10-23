/**
 * The teacher-pairing algorithm, as pure functions over data the server has
 * already fetched. Nothing here touches a database, so every invariant in
 * prompts/teacher-pairing-agent.md is enforced (and tested) in one place:
 *
 * - Exposure over perfection: a partner from another department scores
 *   higher, and so does one whose strength domains differ from yours.
 * - Conflict safeguards: an excluded pair is never formed, whatever the
 *   variant, and an admin override that names one is rejected.
 * - No repeats: a pair from the last `exclude_previous_cycles_count`
 *   cycles is treated like a conflict.
 * - Privacy: inputs carry no survey answers or conversation text, and the
 *   admin summary is counts only.
 */

export type Variant = "RANDOMIZED" | "ADMIN_ASSIGNED" | "TEACHER_REQUESTED";

export type Teacher = {
  id: string;
  name: string;
  department: string | null;
  /** Concern domains resolved from strength tags. */
  domains: string[];
};

export type ExclusionRule = { teacher_a: string; teacher_b: string };

/** A past pairing. `cycles_ago` is 0 for the most recent cycle. */
export type HistoryPair = { host_id: string; visitor_id: string; cycles_ago: number };

export type PairingRequest = {
  school_id: string;
  variant: Variant;
  requested_pairs?: { requester_id: string; target_id: string }[];
  admin_overrides?: { host_id: string; visitor_id: string }[];
  exclude_previous_cycles_count?: number;
  /** Fixes the random choices so a run can be reproduced. */
  seed?: number;
};

export type PairSource = "admin_override" | "mutual_request" | "single_request" | "randomized";

export type Pair = {
  host_id: string;
  visitor_id: string;
  source: PairSource;
  cross_department: boolean;
  /** Domains both teachers are strong in: what they can peer-coach on. */
  shared_domains: string[];
};

export type RejectReason =
  | "not_in_roster"
  | "same_teacher"
  | "conflict"
  | "repeat_pair"
  | "already_assigned";

export type Rejection = {
  kind: "admin_override" | "request";
  a: string;
  b: string;
  reason: RejectReason;
};

export type PairingResult = {
  school_id: string;
  variant: Variant;
  seed: number;
  pairs: Pair[];
  unassigned: { teacher_id: string; reason: "odd_count" | "no_eligible_partner" | "not_assigned_by_admin" }[];
  rejected: Rejection[];
  /** Safe for admin views: counts, rates and domain tallies only. */
  admin_summary: {
    teachers: number;
    pairs: number;
    unassigned: number;
    participation_rate: number;
    cross_department_pairs: number;
    cross_department_rate: number;
    pairs_by_source: Record<PairSource, number>;
    rejected_by_reason: Record<RejectReason, number>;
    /** How many pairs share each domain, i.e. could peer-coach on it. */
    shared_domain_tally: Record<string, number>;
  };
};

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** mulberry32: small, seedable, good enough for shuffling a roster. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Higher is better. Exposure first: other department, then other strengths. */
export function exposureScore(a: Teacher, b: Teacher): number {
  let score = 0;
  if (!a.department || !b.department || a.department !== b.department) score += 2;
  const same = a.domains.length === b.domains.length && a.domains.every((d) => b.domains.includes(d));
  if (!same) score += 1;
  return score;
}

export function generatePairings(
  req: PairingRequest,
  roster: Teacher[],
  exclusions: ExclusionRule[],
  history: HistoryPair[]
): PairingResult {
  const seed = req.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rand = rng(seed);
  const lookback = Math.max(0, req.exclude_previous_cycles_count ?? 2);

  const byId = new Map(roster.map((t) => [t.id, t]));
  const conflicts = new Set(exclusions.map((e) => key(e.teacher_a, e.teacher_b)));
  const recent = new Set(history.filter((h) => h.cycles_ago < lookback).map((h) => key(h.host_id, h.visitor_id)));

  const assigned = new Set<string>();
  const pairs: Pair[] = [];
  const rejected: Rejection[] = [];

  /** Why a and b can't be paired right now, or null if they can. */
  function blocker(a: string, b: string): RejectReason | null {
    if (!byId.has(a) || !byId.has(b)) return "not_in_roster";
    if (a === b) return "same_teacher";
    if (conflicts.has(key(a, b))) return "conflict";
    if (recent.has(key(a, b))) return "repeat_pair";
    if (assigned.has(a) || assigned.has(b)) return "already_assigned";
    return null;
  }

  function add(host: string, visitor: string, source: PairSource) {
    const h = byId.get(host)!;
    const v = byId.get(visitor)!;
    pairs.push({
      host_id: host,
      visitor_id: visitor,
      source,
      cross_department: !h.department || !v.department || h.department !== v.department,
      shared_domains: h.domains.filter((d) => v.domains.includes(d)),
    });
    assigned.add(host);
    assigned.add(visitor);
  }

  // 1. Admin overrides are pinned first in every variant, but still checked.
  for (const o of req.admin_overrides ?? []) {
    const why = blocker(o.host_id, o.visitor_id);
    if (why) rejected.push({ kind: "admin_override", a: o.host_id, b: o.visitor_id, reason: why });
    else add(o.host_id, o.visitor_id, "admin_override");
  }

  // 2. Teacher requests: mutual ones first, then single-sided, in the order given.
  //    The requester is the visitor: they asked to see the other's classroom.
  if (req.variant === "TEACHER_REQUESTED") {
    const reqs = req.requested_pairs ?? [];
    const asked = new Set(reqs.map((r) => `${r.requester_id}>${r.target_id}`));
    const isMutual = (r: { requester_id: string; target_id: string }) => asked.has(`${r.target_id}>${r.requester_id}`);
    const seen = new Set<string>();
    const ordered = [...reqs.filter(isMutual), ...reqs.filter((r) => !isMutual(r))];
    for (const r of ordered) {
      const k = key(r.requester_id, r.target_id);
      if (isMutual(r) && seen.has(k)) continue; // the other half of a mutual pair
      seen.add(k);
      const why = blocker(r.requester_id, r.target_id);
      if (why) {
        rejected.push({ kind: "request", a: r.requester_id, b: r.target_id, reason: why });
        continue;
      }
      add(r.target_id, r.requester_id, isMutual(r) ? "mutual_request" : "single_request");
    }
  }

  // 3. Everyone left, cross-department first. ADMIN_ASSIGNED only validates.
  const unassigned: PairingResult["unassigned"] = [];
  if (req.variant !== "ADMIN_ASSIGNED") {
    const pool = roster.map((t) => t.id).filter((id) => !assigned.has(id));
    // Shuffle, then place the hardest-to-place teachers first.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const eligible = (id: string) => pool.filter((o) => o !== id && !assigned.has(o) && blocker(id, o) === null);
    // How many teachers of a department are still unpaired. Drawing from the
    // biggest departments first is what keeps the last few teachers from being
    // left with only same-department partners.
    const left = (dept: string | null) => pool.filter((o) => !assigned.has(o) && byId.get(o)!.department === dept).length;
    while (true) {
      const open = pool.filter((id) => !assigned.has(id));
      if (open.length < 2) break;
      // Hardest to place first; then the biggest department.
      open.sort((a, b) => eligible(a).length - eligible(b).length || left(byId.get(b)!.department) - left(byId.get(a)!.department));
      const me = open.find((id) => eligible(id).length > 0);
      if (!me) break;
      const options = eligible(me);
      const score = (o: string) => exposureScore(byId.get(me)!, byId.get(o)!);
      const best = Math.max(...options.map(score));
      const top = options.filter((o) => score(o) === best);
      const biggest = Math.max(...top.map((o) => left(byId.get(o)!.department)));
      const pick = top.filter((o) => left(byId.get(o)!.department) === biggest);
      const partner = pick[Math.floor(rand() * pick.length)];
      const [host, visitor] = rand() < 0.5 ? [me, partner] : [partner, me];
      add(host, visitor, "randomized");
    }
    const rest = pool.filter((id) => !assigned.has(id));
    for (const id of rest) {
      unassigned.push({ teacher_id: id, reason: rest.length === 1 ? "odd_count" : "no_eligible_partner" });
    }
  } else {
    for (const t of roster) if (!assigned.has(t.id)) unassigned.push({ teacher_id: t.id, reason: "not_assigned_by_admin" });
  }

  const sources: PairSource[] = ["admin_override", "mutual_request", "single_request", "randomized"];
  const reasons: RejectReason[] = ["not_in_roster", "same_teacher", "conflict", "repeat_pair", "already_assigned"];
  const tally: Record<string, number> = {};
  for (const p of pairs) for (const d of p.shared_domains) tally[d] = (tally[d] ?? 0) + 1;
  const cross = pairs.filter((p) => p.cross_department).length;

  return {
    school_id: req.school_id,
    variant: req.variant,
    seed,
    pairs,
    unassigned,
    rejected,
    admin_summary: {
      teachers: roster.length,
      pairs: pairs.length,
      unassigned: unassigned.length,
      participation_rate: roster.length ? (pairs.length * 2) / roster.length : 0,
      cross_department_pairs: cross,
      cross_department_rate: pairs.length ? cross / pairs.length : 0,
      pairs_by_source: Object.fromEntries(sources.map((s) => [s, pairs.filter((p) => p.source === s).length])) as Record<PairSource, number>,
      rejected_by_reason: Object.fromEntries(reasons.map((r) => [r, rejected.filter((x) => x.reason === r).length])) as Record<RejectReason, number>,
      shared_domain_tally: tally,
    },
  };
}
