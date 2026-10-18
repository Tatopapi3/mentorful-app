/**
 * What the leadership views say, worked out once from a snapshot of the school. Pure: no database, no React.
 * Every sentence the Pulse and Insights pages print comes from a number computed here, so a suggestion can
 * always name the number behind it.
 */
import { DIMENSIONS, DIMENSION_LABEL, type Dimension, type ReportStats } from "@/lib/report/stats";
import type { Participation } from "./participation";

export type AdminPerson = { id: string; name: string; dept: string };
export type AdminPair = { id: string; a: string; b: string; domain: string | null; tag: string | null };

export type ScanSummary = {
  /** Respondents counted in the aggregates. */
  n: number;
  means: Record<Dimension, number>;
  ci: Record<Dimension, number>;
  includesSynthetic: boolean;
};

export type AdminSnapshot = {
  school: { name: string; priority: string | null };
  cycle: { id: string; name: string; status: string } | null;
  /** Every cycle of the school, newest first, for the cycle switcher. */
  cycles: { id: string; name: string; status: string }[];
  people: AdminPerson[];
  /** Approved pairs this cycle. */
  pairs: AdminPair[];
  /** Pairs proposed by teachers and waiting for a decision. */
  requests: AdminPair[];
  /** Total conversations logged, from the count function (leadership never reads the rows). */
  conversations: number;
  scan: ScanSummary | null;
  /** The full report aggregates (for the network and the findings), when a scan has results. */
  stats?: ReportStats | null;
  /** Participation counts from the database function, or null when it is not available. */
  participation?: Participation | null;
  /** Approved pairs with no conversation in the last 30 days, or null when unknown. */
  quietPairs?: number | null;
};

export type Facts = {
  faculty: number;
  paired: number;
  unpaired: number;
  pairedPct: number | null;
  pairCount: number;
  crossPairs: number;
  crossPct: number | null;
  pendingRequests: number;
  conversations: number;
  conversationsPerPair: number | null;
  domainCounts: Record<string, number>;
  topDomain: { domain: string; count: number } | null;
  quietPairs: number | null;
  conversationRatePct: number | null;
  scan:
    | null
    | {
        n: number;
        completionPct: number | null;
        cte: number;
        cteCi: number;
        strongest: { dimension: Dimension; mean: number };
        weakest: { dimension: Dimension; mean: number };
        /** Efficacy minus Structural, on the 1 to 6 scale. */
        gap: number;
        includesSynthetic: boolean;
      };
};

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null);

export function buildFacts(s: AdminSnapshot): Facts {
  const byId = new Map(s.people.map((p) => [p.id, p]));
  const pairedIds = new Set<string>();
  let cross = 0;
  const domainCounts: Record<string, number> = {};
  for (const p of s.pairs) {
    pairedIds.add(p.a);
    pairedIds.add(p.b);
    const da = byId.get(p.a)?.dept;
    const db = byId.get(p.b)?.dept;
    if (da && db && da !== db) cross++;
    if (p.domain) domainCounts[p.domain] = (domainCounts[p.domain] ?? 0) + 1;
  }
  const paired = [...pairedIds].filter((id) => byId.has(id)).length;
  const top = Object.entries(domainCounts).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0];

  let scan: Facts["scan"] = null;
  if (s.scan) {
    const ranked = [...DIMENSIONS].sort((a, b) => s.scan!.means[b] - s.scan!.means[a]);
    const strongest = ranked[0];
    const weakest = ranked[ranked.length - 1];
    scan = {
      n: s.scan.n,
      completionPct: pct(s.scan.n, s.people.length),
      cte: s.scan.means.efficacy,
      cteCi: s.scan.ci.efficacy,
      strongest: { dimension: strongest, mean: s.scan.means[strongest] },
      weakest: { dimension: weakest, mean: s.scan.means[weakest] },
      gap: s.scan.means.efficacy - s.scan.means.structural,
      includesSynthetic: s.scan.includesSynthetic,
    };
  }

  return {
    faculty: s.people.length,
    paired,
    unpaired: s.people.length - paired,
    pairedPct: pct(paired, s.people.length),
    pairCount: s.pairs.length,
    crossPairs: cross,
    crossPct: pct(cross, s.pairs.length),
    pendingRequests: s.requests.length,
    conversations: s.conversations,
    conversationsPerPair: s.pairs.length > 0 ? Math.round((s.conversations / s.pairs.length) * 10) / 10 : null,
    domainCounts,
    topDomain: top ? { domain: top[0], count: top[1] } : null,
    quietPairs: s.quietPairs ?? null,
    conversationRatePct: s.participation ? pct(s.participation.with_conversation, s.participation.pairs) : null,
    scan,
  };
}

/** One plain sentence about where things stand, for the top of Pulse. */
export function headlineSentence(f: Facts): string {
  const parts: string[] = [];
  parts.push(`${f.pairedPct ?? 0}% of your ${f.faculty} teachers have a partner${f.crossPct !== null ? `, and ${f.crossPct}% of those pairs cross departments` : ""}.`);
  if (f.scan) {
    parts.push(`Teachers rate ${DIMENSION_LABEL[f.scan.strongest.dimension].toLowerCase()} highest and ${DIMENSION_LABEL[f.scan.weakest.dimension].toLowerCase()} lowest.`);
  }
  return parts.join(" ");
}

export const dimensionName = (d: Dimension) => DIMENSION_LABEL[d];

/** The smallest department we draw. Under this a department is left out so no one is identifiable. */
export const MIN_DEPARTMENT_SIZE = 5;

export type DepartmentLink = { a: string; b: string; count: number };

/**
 * How many pairs connect each two departments. Pairs inside one department are counted separately, and
 * departments with fewer than MIN_DEPARTMENT_SIZE teachers are left out of both.
 */
export function departmentConnections(s: AdminSnapshot): { links: DepartmentLink[]; within: number; omitted: string[] } {
  const size = new Map<string, number>();
  for (const p of s.people) size.set(p.dept, (size.get(p.dept) ?? 0) + 1);
  const shown = (d: string) => (size.get(d) ?? 0) >= MIN_DEPARTMENT_SIZE;
  const dept = new Map(s.people.map((p) => [p.id, p.dept]));
  const counts = new Map<string, number>();
  let within = 0;
  for (const p of s.pairs) {
    const da = dept.get(p.a);
    const db = dept.get(p.b);
    if (!da || !db || !shown(da) || !shown(db)) continue;
    if (da === db) {
      within++;
      continue;
    }
    const [x, y] = da < db ? [da, db] : [db, da];
    counts.set(`${x}|${y}`, (counts.get(`${x}|${y}`) ?? 0) + 1);
  }
  const links = [...counts.entries()]
    .map(([k, count]) => ({ a: k.split("|")[0], b: k.split("|")[1], count }))
    .sort((l, r) => r.count - l.count || l.a.localeCompare(r.a));
  return { links, within, omitted: [...size.entries()].filter(([, n]) => n < MIN_DEPARTMENT_SIZE).map(([d]) => d).sort() };
}
