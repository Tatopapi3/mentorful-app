/**
 * Culture Scan report math — pure functions, no DB and no rendering.
 *
 * This is the single computation path for the report: the /report page and
 * `npm run synthetic:stats` both go through computeReportStats, so the console
 * numbers and the rendered panels can never drift apart.
 *
 * The partial-correlation route (invert the correlation matrix, convert the
 * precision matrix) was validated against an independent OLS-residual method;
 * they agree to ~2e-16. A wrong inversion produces plausible-looking numbers
 * rather than an obvious failure, so re-run that check if you touch `invert`.
 */

export const DIMENSIONS = ["structural", "relational", "cognitive", "efficacy"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** Display label for a dimension. Keep separate from the DB value. */
export const DIMENSION_LABEL: Record<Dimension, string> = {
  structural: "Structural",
  relational: "Relational",
  cognitive: "Cognitive",
  efficacy: "Efficacy",
};

export const SCALE_MIN = 1;
export const SCALE_MAX = 6;

/** 95% normal approximation. n = 50 here, so this is close enough to a t-interval. */
const Z_95 = 1.96;

export type ReportItem = {
  id: string;
  position: number;
  dimension: Dimension;
  reverse: boolean;
};

export type ResponseRow = {
  respondent: string;
  item_id: string;
  scored_value: number;
};

export type DimensionStat = {
  dimension: Dimension;
  itemCount: number;
  mean: number;
  sd: number;
  /** 1.96 * sd / sqrt(n) — half-width of the 95% CI on the mean. */
  ciHalfWidth: number;
  ciLow: number;
  ciHigh: number;
  /** Sum of |partial correlation| to the other three dimensions. */
  strength: number;
};

export type ReportStats = {
  n: number;
  droppedCount: number;
  itemTotal: number;
  dimensions: Record<Dimension, DimensionStat>;
  /** Pearson correlation between dimension scores across respondents. */
  correlation: number[][];
  /** Partial correlations — the network edges. */
  partial: number[][];
};

// ---------------------------------------------------------------- primitives

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function sd(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  return num / Math.sqrt(dx * dy);
}

/**
 * Per-respondent dimension scores: mean of scored_value over that dimension's
 * items. Returns one column per dimension, respondent-aligned.
 *
 * Dimensions have uneven item counts (6/9/6/5), so this must stay a mean.
 */
export function dimensionScores(
  rows: ResponseRow[],
  items: ReportItem[]
): { scores: Record<Dimension, number[]>; respondents: string[]; dropped: string[] } {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const perRespondent = new Map<string, Record<Dimension, number[]>>();

  for (const row of rows) {
    const item = itemById.get(row.item_id);
    if (!item) continue;
    let bucket = perRespondent.get(row.respondent);
    if (!bucket) {
      bucket = { structural: [], relational: [], cognitive: [], efficacy: [] };
      perRespondent.set(row.respondent, bucket);
    }
    bucket[item.dimension].push(row.scored_value);
  }

  const scores: Record<Dimension, number[]> = {
    structural: [],
    relational: [],
    cognitive: [],
    efficacy: [],
  };
  const respondents: string[] = [];
  const dropped: string[] = [];

  for (const [respondent, bucket] of perRespondent) {
    // Partial responses would bias the covariance; listwise-drop them.
    if (DIMENSIONS.some((d) => bucket[d].length === 0)) {
      dropped.push(respondent);
      continue;
    }
    respondents.push(respondent);
    for (const d of DIMENSIONS) scores[d].push(mean(bucket[d]));
  }

  return { scores, respondents, dropped };
}

export function correlationMatrix(scores: Record<Dimension, number[]>): number[][] {
  return DIMENSIONS.map((a) => DIMENSIONS.map((b) => pearson(scores[a], scores[b])));
}

/** Gauss-Jordan inverse with partial pivoting. */
export function invert(m: number[][]): number[][] {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) {
      throw new Error(
        `Correlation matrix is singular at column ${col} — cannot compute partial correlations.`
      );
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];

    const d = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= d;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) a[r][j] -= factor * a[col][j];
    }
  }

  return a.map((row) => row.slice(n));
}

/** partial(i,j) = -P(i,j) / sqrt(P(i,i) * P(j,j)), where P is the precision matrix. */
export function partialCorrelationMatrix(corr: number[][]): number[][] {
  const p = invert(corr);
  const n = corr.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : -p[i][j] / Math.sqrt(p[i][i] * p[j][j])))
  );
}

// ---------------------------------------------------------------- aggregate

export function dimensionIndex(d: Dimension): number {
  return DIMENSIONS.indexOf(d);
}

/**
 * The only numbers the report needs from the raw answers: how many complete respondents, the mean and standard
 * deviation of each dimension across them, and the 4 by 4 correlation table. The database computes exactly these
 * (script 023, culture_scan_aggregates), so the app never has to read a single answer; `aggregatesFromRows` computes
 * them from rows for the legacy path and for tests.
 */
export type Aggregates = {
  n: number;
  dropped: number;
  means: Record<Dimension, number>;
  sds: Record<Dimension, number>;
  correlation: number[][];
};

export function aggregatesFromRows(rows: ResponseRow[], items: ReportItem[]): Aggregates {
  const { scores, respondents, dropped } = dimensionScores(rows, items);
  const n = respondents.length;
  if (n < 3) {
    throw new Error(`Need at least 3 complete respondents to compute stats, got ${n}.`);
  }
  const means = {} as Record<Dimension, number>;
  const sds = {} as Record<Dimension, number>;
  for (const d of DIMENSIONS) {
    means[d] = mean(scores[d]);
    sds[d] = sd(scores[d]);
  }
  return { n, dropped: dropped.length, means, sds, correlation: correlationMatrix(scores) };
}

/**
 * The one entry point. Everything downstream (panels, findings, the CLI report)
 * consumes ReportStats rather than raw rows — the raw rows never leave the server.
 */
export function computeReportStats(rows: ResponseRow[], items: ReportItem[]): ReportStats {
  return statsFromAggregates(aggregatesFromRows(rows, items), items);
}

/** Builds the report from the aggregates alone: the confidence intervals, the partial correlations and each dimension's strength. */
export function statsFromAggregates(a: Aggregates, items: ReportItem[]): ReportStats {
  const { n, correlation } = a;
  const partial = partialCorrelationMatrix(correlation);

  const dimensions = {} as Record<Dimension, DimensionStat>;
  DIMENSIONS.forEach((d, i) => {
    const m = a.means[d];
    const s = a.sds[d];
    const half = (Z_95 * s) / Math.sqrt(n);
    const strength = DIMENSIONS.reduce(
      (acc, _, j) => (i === j ? acc : acc + Math.abs(partial[i][j])),
      0
    );
    dimensions[d] = {
      dimension: d,
      itemCount: items.filter((it) => it.dimension === d).length,
      mean: m,
      sd: s,
      ciHalfWidth: half,
      ciLow: m - half,
      ciHigh: m + half,
      strength,
    };
  });

  return {
    n,
    droppedCount: a.dropped,
    itemTotal: items.length,
    dimensions,
    correlation,
    partial,
  };
}
