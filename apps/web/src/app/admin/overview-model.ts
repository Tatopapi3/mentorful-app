/**
 * View model for the leadership overview.
 *
 * Plain data only — the client renders this and never sees survey rows,
 * conversation text, or a per-teacher score. Department culture cells stay
 * empty on purpose: responses are anonymous and are not tied to a department,
 * so a shaded guess would be an invented number.
 *
 * There is one wave. Deltas are omitted until a second wave exists.
 */

import { DOMAIN_LABEL } from "@/lib/domains";
import { fmtR, fmtScale, weakestDimension } from "@/lib/report/findings";
import {
  DIMENSIONS,
  DIMENSION_LABEL,
  type Dimension,
  type ReportStats,
} from "@/lib/report/stats";

/** Same floor as concern_domain_counts: a smaller cell identifies the group. */
export const GROUP_FLOOR = 5;

const TOPIC_ORDER = [
  "CLASSROOM",
  "PLANNING",
  "ASSESSMENT",
  "COMMUNICATION",
  "CELEBRATIONS",
] as const;

const TOPIC_LABEL: Record<(typeof TOPIC_ORDER)[number], string> = {
  CLASSROOM: "Classroom",
  PLANNING: "Planning",
  ASSESSMENT: "Assessment",
  COMMUNICATION: "Communication",
  CELEBRATIONS: "Celebrations",
};

/** A partial below this is drawn as a faint dashed link. */
const NEGLIGIBLE_EDGE = 0.15;

const POSITION: Record<Dimension, "top" | "left" | "right" | "bottom"> = {
  structural: "top",
  relational: "left",
  cognitive: "right",
  efficacy: "bottom",
};

/** Quadratic paths between the four fixed node positions. */
const EDGE_PATH: Record<string, string> = {
  "bottom-left": "M115 165 Q206 244 300 280",
  "bottom-right": "M485 165 Q390 244 300 280",
  "bottom-top": "M300 50 Q212 164 300 280",
  "left-right": "M115 165 Q300 48 485 165",
  "left-top": "M300 50 Q206 100 115 165",
  "right-top": "M300 50 Q394 100 485 165",
};

export type OverviewDepartment = {
  name: string;
  size: number;
  locked: boolean;
};

export type OverviewDimension = {
  name: string;
  value: string;
  position: "top" | "left" | "right" | "bottom";
  focus: boolean;
  strongest: boolean;
};

export type OverviewEdge = {
  key: string;
  d: string;
  width: number;
  dashed: boolean;
};

export type OverviewTopic = {
  name: string;
  /** Null when the count is above zero and below the group floor. */
  count: number | null;
};

export type PairStatus = "Active" | "Pending" | "Declined";

export type OverviewPair = {
  id: string;
  teachers: string;
  departments: string;
  focus: string;
  crossDepartment: boolean;
  status: PairStatus;
};

export type OverviewModel = {
  schoolName: string;
  waveLabel: string;
  synthetic: boolean;
  departmentOptions: string[];
  focus: {
    lead: string;
    detail: string;
    why: string;
  } | null;
  completion: { value: string; note: string };
  efficacy: { value: string; note: string };
  conversations: { value: string; note: string };
  departments: OverviewDepartment[];
  dimensions: OverviewDimension[];
  edges: OverviewEdge[];
  networkCaption: string;
  topics: OverviewTopic[];
  topicsUnavailable: boolean;
  topicsCaption: string;
  pairing: {
    total: number;
    cross: number;
    same: number;
    crossPct: string;
    active: number;
    pending: number;
    declined: number;
    caption: string;
    rows: OverviewPair[];
  };
};

export type OverviewFaculty = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
};

export type OverviewPairInput = {
  id: string;
  host_id: string;
  visitor_id: string;
  domain: string | null;
  status: string;
};

export type OverviewTopicInput = {
  domain: string;
  n: number | null;
};

function shortName(person: OverviewFaculty) {
  const first = person.first_name?.trim() || "Unnamed";
  const initial = person.last_name?.trim()?.[0];
  return initial ? `${first} ${initial}.` : first;
}

function pairStatus(status: string): PairStatus {
  if (status === "approved") return "Active";
  if (status === "pending") return "Pending";
  return "Declined";
}

function edgeWidth(abs: number) {
  if (abs < NEGLIGIBLE_EDGE) return 2;
  return Math.min(9, Math.round((2 + abs * 12) * 10) / 10);
}

function buildNetwork(stats: ReportStats) {
  const weak = weakestDimension(stats);
  let strongest: Dimension = DIMENSIONS[0];
  for (const d of DIMENSIONS) {
    if (stats.dimensions[d].mean > stats.dimensions[strongest].mean) strongest = d;
  }

  const dimensions: OverviewDimension[] = DIMENSIONS.map((d) => ({
    name: DIMENSION_LABEL[d],
    value: fmtScale(stats.dimensions[d].mean),
    position: POSITION[d],
    focus: d === weak.dimension,
    strongest: d === strongest,
  }));

  let best = { i: 0, j: 1, v: -1 };
  const edges: OverviewEdge[] = [];
  for (let i = 0; i < DIMENSIONS.length; i++) {
    for (let j = i + 1; j < DIMENSIONS.length; j++) {
      const partial = stats.partial[i][j];
      const abs = Math.abs(partial);
      if (abs > best.v) best = { i, j, v: abs };
      const positions = [POSITION[DIMENSIONS[i]], POSITION[DIMENSIONS[j]]].sort();
      const key = positions.join("-");
      edges.push({
        key,
        d: EDGE_PATH[key],
        width: edgeWidth(abs),
        dashed: abs < NEGLIGIBLE_EDGE,
      });
    }
  }

  const from = DIMENSION_LABEL[DIMENSIONS[best.i]];
  const to = DIMENSION_LABEL[DIMENSIONS[best.j]];
  const why =
    `${from}–${to} is the strongest direct connection at ${fmtR(stats.partial[best.i][best.j])}. ` +
    "This describes a school-wide pattern, not individual teachers.";

  const focus = {
    lead: `${DIMENSION_LABEL[weak.dimension]} culture is your biggest opportunity.`,
    detail:
      `It averages ${fmtScale(weak.mean)} of 6, ${fmtScale(weak.gapToTop)} below ` +
      `${DIMENSION_LABEL[weak.topDimension]}.`,
    why,
  };

  const networkCaption = `${DIMENSION_LABEL[strongest]} is the strongest average. Lines show which areas move together.`;

  return { dimensions, edges, focus, networkCaption };
}

function buildTopics(rows: OverviewTopicInput[] | null, unavailable: boolean) {
  if (unavailable || rows === null) {
    return {
      topics: [] as OverviewTopic[],
      topicsUnavailable: true,
      topicsCaption: "Topic counts appear once logged conversations can be totaled. Content is never shown.",
    };
  }

  const byDomain = new Map(rows.map((row) => [row.domain, row.n]));
  const topics: OverviewTopic[] = TOPIC_ORDER.map((domain) => ({
    name: TOPIC_LABEL[domain],
    count: byDomain.has(domain) ? (byDomain.get(domain) ?? null) : 0,
  }));

  const visible = topics
    .filter((topic) => topic.count !== null && topic.count > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  let topicsCaption = "Topic counts appear once conversations are logged. Content is never shown.";
  if (visible.length >= 2) {
    topicsCaption = `${visible[0].name} and ${visible[1].name.toLowerCase()} are the most common areas in logged conversations.`;
  } else if (visible.length === 1) {
    topicsCaption = `${visible[0].name} is the only area with enough logged conversations to show.`;
  } else if (topics.some((topic) => topic.count === null)) {
    topicsCaption = "Some topic counts are hidden because fewer than 5 conversations used that area.";
  }

  return { topics, topicsUnavailable: false, topicsCaption };
}

export function buildOverviewModel(input: {
  schoolName: string;
  cycleName: string | null;
  synthetic: boolean;
  faculty: OverviewFaculty[];
  pairs: OverviewPairInput[];
  conversationCount: number;
  report: ReportStats | null;
  respondentCount: number | null;
  topics: OverviewTopicInput[] | null;
  topicsUnavailable: boolean;
}): OverviewModel {
  const facultyCount = input.faculty.length;
  const respondents = input.respondentCount;
  const completion =
    respondents === null || facultyCount === 0
      ? {
          value: "—",
          note: respondents === null ? "Scan results aren’t available" : "No teachers on the roster",
        }
      : {
          value: `${Math.round((respondents / facultyCount) * 100)}%`,
          note: `${respondents} of ${facultyCount} teachers · ${
            respondents / facultyCount >= 0.6 ? "above" : "below"
          } the 60% needed to show results${input.synthetic ? " · demo scan" : ""}`,
        };

  const efficacy = input.report
    ? {
        value: fmtScale(input.report.dimensions.efficacy.mean),
        note: `Average of Efficacy items · 1–6 scale${input.synthetic ? " · demo scan" : ""}`,
      }
    : { value: "—", note: "No scan data" };

  const deptCounts = new Map<string, number>();
  for (const person of input.faculty) {
    const name = person.department?.trim() || "Unassigned";
    deptCounts.set(name, (deptCounts.get(name) ?? 0) + 1);
  }
  const departments: OverviewDepartment[] = [...deptCounts.entries()]
    .map(([name, size]) => ({ name, size, locked: size < GROUP_FLOOR }))
    .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));

  const byId = new Map(input.faculty.map((person) => [person.id, person]));
  const rows: OverviewPair[] = [];
  for (const pair of input.pairs) {
    const host = byId.get(pair.host_id);
    const visitor = byId.get(pair.visitor_id);
    if (!host || !visitor) continue;
    const hostDept = host.department?.trim() || "Unassigned";
    const visitorDept = visitor.department?.trim() || "Unassigned";
    rows.push({
      id: pair.id,
      teachers: `${shortName(host)} & ${shortName(visitor)}`,
      departments: `${hostDept} + ${visitorDept}`,
      focus: pair.domain ? (DOMAIN_LABEL[pair.domain] ?? pair.domain) : "—",
      crossDepartment: hostDept !== visitorDept,
      status: pairStatus(pair.status),
    });
  }
  rows.sort((a, b) => a.teachers.localeCompare(b.teachers));

  const cross = rows.filter((row) => row.crossDepartment).length;
  const active = rows.filter((row) => row.status === "Active").length;
  const pending = rows.filter((row) => row.status === "Pending").length;
  const declined = rows.filter((row) => row.status === "Declined").length;
  const crossPct = rows.length === 0 ? "—" : `${Math.round((cross / rows.length) * 100)}%`;

  const network = input.report ? buildNetwork(input.report) : null;
  const topicModel = buildTopics(input.topics, input.topicsUnavailable);

  return {
    schoolName: input.schoolName,
    waveLabel: input.cycleName ?? "Wave 1",
    synthetic: input.synthetic,
    departmentOptions: departments.map((department) => department.name),
    focus: network?.focus ?? null,
    completion,
    efficacy,
    conversations: {
      value: String(input.conversationCount),
      note: "Logged this cycle · content stays with the pair",
    },
    departments,
    dimensions: network?.dimensions ?? [],
    edges: network?.edges ?? [],
    networkCaption:
      network?.networkCaption ?? "Culture Scan aggregates aren’t available for this school yet.",
    ...topicModel,
    pairing: {
      total: rows.length,
      cross,
      same: rows.length - cross,
      crossPct,
      active,
      pending,
      declined,
      caption:
        rows.length === 0
          ? "No pairs in this cycle yet."
          : `${crossPct} of mentoring pairs connect teachers across departments.`,
      rows,
    },
  };
}
