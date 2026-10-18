/**
 * Templated finding sentences derived from ReportStats.
 *
 * Pure functions — no rendering, no DB, no React. The /report panels and the
 * (later) PDF export both consume these, so the wording stays identical across
 * every surface the school sees.
 *
 * Every sentence branches on the data. Nothing here is written for the current
 * synthetic dataset specifically: flip the numbers and the wording follows.
 */

import { NEGLIGIBLE_PARTIAL } from "./networkStyle.ts";
import {
  DIMENSIONS,
  DIMENSION_LABEL,
  SCALE_MAX,
  dimensionIndex,
  type Dimension,
  type ReportStats,
} from "./stats.ts";

/** Dimensions that represent capability rather than infrastructure. */
const CAPABILITY_DIMENSIONS: Dimension[] = ["relational", "cognitive", "efficacy"];

/** A partial correlation at or below this reads as "no direct connection". */
const NEGLIGIBLE_EDGE = NEGLIGIBLE_PARTIAL;
/** A raw correlation at or above this reads as "looks connected". */
const VISIBLE_RAW = 0.2;

export type Finding = {
  id: "load-bearing" | "weakest" | "gap" | "network";
  title: string;
  sentence: string;
};

// ---------------------------------------------------------------- formatting

/** One decimal, for scale values (means, gaps). */
export function fmtScale(x: number): string {
  return x.toFixed(1);
}

/** Two decimals with a true minus sign, for correlations. */
export function fmtR(x: number): string {
  const s = Math.abs(x).toFixed(2);
  return x < 0 ? `−${s}` : s;
}

function label(d: Dimension): string {
  return DIMENSION_LABEL[d];
}

/** "Relational and Cognitive" / "Relational, Cognitive and Efficacy" */
function joinLabels(ds: Dimension[]): string {
  const names = ds.map(label);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// ---------------------------------------------------------------- findings

export type LoadBearing = {
  dimension: Dimension;
  mean: number;
  strength: number;
  /** Mean absolute partial correlation to the other three dimensions. */
  meanEdge: number;
  finding: Finding;
};

/**
 * The dimension carrying the culture: among the capability dimensions, the one
 * most central in the network. Centrality is strength (sum of |partial| edges);
 * when two are within a hair of each other, the higher mean wins.
 */
export function loadBearingDimension(stats: ReportStats): LoadBearing {
  const ranked = [...CAPABILITY_DIMENSIONS].sort((a, b) => {
    const da = stats.dimensions[a];
    const db = stats.dimensions[b];
    if (Math.abs(db.strength - da.strength) > 0.02) return db.strength - da.strength;
    return db.mean - da.mean;
  });

  const d = ranked[0];
  const stat = stats.dimensions[d];
  const meanEdge = stat.strength / (DIMENSIONS.length - 1);

  return {
    dimension: d,
    mean: stat.mean,
    strength: stat.strength,
    meanEdge,
    finding: {
      id: "load-bearing",
      title: "Load-bearing dimension",
      sentence:
        `${label(d)} is doing the load-bearing work: it scores ${fmtScale(stat.mean)} ` +
        `of ${SCALE_MAX} and holds the strongest ties to the rest of the network ` +
        `(average edge ${fmtR(meanEdge)}). Protect it before anything else.`,
    },
  };
}

export type Weakest = {
  dimension: Dimension;
  mean: number;
  /** Distance from the highest-scoring dimension. */
  gapToTop: number;
  topDimension: Dimension;
  finding: Finding;
};

/** The lowest-scoring dimension — the "start here" callout. */
export function weakestDimension(stats: ReportStats): Weakest {
  const ordered = [...DIMENSIONS].sort((a, b) => stats.dimensions[a].mean - stats.dimensions[b].mean);
  const weakest = ordered[0];
  const top = ordered[ordered.length - 1];
  const gapToTop = stats.dimensions[top].mean - stats.dimensions[weakest].mean;
  const stat = stats.dimensions[weakest];

  return {
    dimension: weakest,
    mean: stat.mean,
    gapToTop,
    topDimension: top,
    finding: {
      id: "weakest",
      title: "Start here",
      sentence:
        `${label(weakest)} is the weakest dimension at ${fmtScale(stat.mean)} of ${SCALE_MAX}, ` +
        `${fmtScale(gapToTop)} points below ${label(top)}. ` +
        `It is the lowest-cost place to intervene.`,
    },
  };
}

/** Below this separation, the two dimensions count as level with each other. */
const IN_STEP = 0.5;

export type GapCase = "belief-ahead" | "structure-ahead" | "in-step";

export type EfficacyStructureGap = {
  gap: number;
  efficacyMean: number;
  structuralMean: number;
  /** Which of the three readings applies, chosen from the numbers. */
  gapCase: GapCase;
  /** Whether this reading is a warning, an encouraging sign, or neutral. */
  tone: "warning" | "encouraging" | "healthy";
  finding: Finding;
};

/**
 * Efficacy minus Structural, in three readings — the direction of the gap
 * changes the advice completely, so a single sentence would be wrong two thirds
 * of the time:
 *
 *  (a) Efficacy ahead  — belief resting on goodwill rather than infrastructure.
 *      The warning case: goodwill is exhaustible and staff turnover spends it.
 *  (b) Structural ahead — the scaffolding is real but confidence hasn't caught
 *      up yet. Encouraging, because efficacy tends to follow structure.
 *  (c) Level — belief and the structures behind it are moving together.
 */
export function efficacyStructureGap(stats: ReportStats): EfficacyStructureGap {
  const efficacyMean = stats.dimensions.efficacy.mean;
  const structuralMean = stats.dimensions.structural.mean;
  const gap = efficacyMean - structuralMean;
  const size = fmtScale(Math.abs(gap));
  const pair = `${DIMENSION_LABEL.efficacy} ${fmtScale(efficacyMean)} vs ${DIMENSION_LABEL.structural} ${fmtScale(structuralMean)}`;

  let gapCase: GapCase;
  let tone: EfficacyStructureGap["tone"];
  let sentence: string;

  if (gap >= IN_STEP) {
    gapCase = "belief-ahead";
    tone = "warning";
    sentence =
      `Efficacy runs ${size} points ahead of Structural (${pair}). Staff believe in what they ` +
      `can do together, but the structures meant to carry that belief are not keeping up. ` +
      `Efficacy is resting on goodwill rather than on infrastructure — and goodwill is spent ` +
      `by every departure, timetable change and difficult year.`;
  } else if (gap <= -IN_STEP) {
    gapCase = "structure-ahead";
    tone = "encouraging";
    sentence =
      `Structural sits ${size} points ahead of Efficacy (${pair}). The scaffolding is real — ` +
      `time, routines and roles are in place — but confidence in what staff can achieve together ` +
      `has not caught up yet. Efficacy tends to follow structure, so this gap usually closes on ` +
      `its own once the structures have been in place long enough to be trusted.`;
  } else {
    gapCase = "in-step";
    tone = "healthy";
    sentence =
      `Efficacy and Structural are level, within ${size} points of each other (${pair}). ` +
      `Belief and the structures meant to carry it are moving together, which is the healthy ` +
      `pattern: confidence here is backed by something more durable than goodwill.`;
  }

  return {
    gap,
    efficacyMean,
    structuralMean,
    gapCase,
    tone,
    finding: { id: "gap", title: "Efficacy–structure gap", sentence },
  };
}

export type NetworkHeadline = {
  kind: "mediated" | "strongest-edge";
  from?: Dimension;
  to?: Dimension;
  raw?: number;
  partial?: number;
  finding: Finding;
};

/**
 * One line about what the network adds over the raw correlations. The
 * interesting case is a pair that looks connected until the others are held
 * constant — evidence the link is routed through a third dimension.
 */
export function networkHeadline(stats: ReportStats): NetworkHeadline {
  let best: { i: number; j: number; drop: number } | null = null;

  for (let i = 0; i < DIMENSIONS.length; i++) {
    for (let j = i + 1; j < DIMENSIONS.length; j++) {
      const raw = stats.correlation[i][j];
      const par = stats.partial[i][j];
      if (raw < VISIBLE_RAW) continue;
      if (Math.abs(par) > NEGLIGIBLE_EDGE) continue;
      const drop = raw - Math.abs(par);
      if (!best || drop > best.drop) best = { i, j, drop };
    }
  }

  if (best) {
    const from = DIMENSIONS[best.i];
    const to = DIMENSIONS[best.j];
    const raw = stats.correlation[best.i][best.j];
    const par = stats.partial[best.i][best.j];
    const via = DIMENSIONS.filter((d) => d !== from && d !== to);
    return {
      kind: "mediated",
      from,
      to,
      raw,
      partial: par,
      finding: {
        id: "network",
        title: "What the network shows",
        sentence:
          `${label(from)} looks tied to ${label(to)} (r = ${fmtR(raw)}), but that tie ` +
          `disappears once ${joinLabels(via)} are held constant (partial ${fmtR(par)}) — ` +
          `the connection runs through them, not directly.`,
      },
    };
  }

  // No mediated pair: report the strongest direct edge instead.
  let top = { i: 0, j: 1, v: -Infinity };
  for (let i = 0; i < DIMENSIONS.length; i++) {
    for (let j = i + 1; j < DIMENSIONS.length; j++) {
      const v = Math.abs(stats.partial[i][j]);
      if (v > top.v) top = { i, j, v };
    }
  }
  const from = DIMENSIONS[top.i];
  const to = DIMENSIONS[top.j];
  const par = stats.partial[top.i][top.j];

  return {
    kind: "strongest-edge",
    from,
    to,
    raw: stats.correlation[top.i][top.j],
    partial: par,
    finding: {
      id: "network",
      title: "What the network shows",
      sentence:
        `Every dimension holds a direct tie once the others are held constant. The strongest ` +
        `is ${label(from)}–${label(to)} (partial ${fmtR(par)}).`,
    },
  };
}

export type Findings = {
  loadBearing: LoadBearing;
  weakest: Weakest;
  gap: EfficacyStructureGap;
  network: NetworkHeadline;
  /** All four sentences in report order, for the PDF export. */
  all: Finding[];
};

export function buildFindings(stats: ReportStats): Findings {
  const loadBearing = loadBearingDimension(stats);
  const weakest = weakestDimension(stats);
  const gap = efficacyStructureGap(stats);
  const network = networkHeadline(stats);

  return {
    loadBearing,
    weakest,
    gap,
    network,
    all: [loadBearing.finding, gap.finding, weakest.finding, network.finding],
  };
}

/** Exposed for the panel layer, which needs the index into the matrices. */
export { dimensionIndex };
