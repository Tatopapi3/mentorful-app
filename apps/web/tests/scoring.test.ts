import { describe, expect, it } from "vitest";
import {
  DIMENSIONS,
  computeReportStats,
  correlationMatrix,
  dimensionScores,
  invert,
  partialCorrelationMatrix,
  type Dimension,
  type ReportItem,
  type ResponseRow,
} from "@/lib/report/stats.ts";
import { prng } from "./helpers";

// One item bank shaped like the real one: 6 / 9 / 6 / 5 items.
const SIZES: Record<Dimension, number> = { structural: 6, relational: 9, cognitive: 6, efficacy: 5 };
const items: ReportItem[] = [];
for (const d of DIMENSIONS) for (let i = 0; i < SIZES[d]; i++) items.push({ id: `${d}-${i}`, position: items.length + 1, dimension: d, reverse: false });

function respondent(id: string, score: Record<Dimension, number>): ResponseRow[] {
  return items.map((it) => ({ respondent: id, item_id: it.id, scored_value: score[it.dimension] }));
}

describe("dimension scores", () => {
  it("are means, not sums, so uneven item counts don't bias a dimension", () => {
    const rows = respondent("r1", { structural: 4, relational: 4, cognitive: 4, efficacy: 4 });
    const { scores } = dimensionScores(rows, items);
    for (const d of DIMENSIONS) expect(scores[d]).toEqual([4]);
  });

  it("drop a respondent who skipped a whole dimension, and count them", () => {
    const full = respondent("full", { structural: 3, relational: 3, cognitive: 3, efficacy: 3 });
    const partial = respondent("partial", { structural: 3, relational: 3, cognitive: 3, efficacy: 3 }).filter((r) => !r.item_id.startsWith("efficacy"));
    const { respondents, dropped } = dimensionScores([...full, ...partial], items);
    expect(respondents).toEqual(["full"]);
    expect(dropped).toEqual(["partial"]);
  });
});

describe("correlation and partial correlation", () => {
  // The path model Mentorful's own demo uses: structural -> relational -> efficacy, with no direct
  // structural -> efficacy path. The headline finding is that their raw link vanishes once the others
  // are held constant.
  const rand = prng(7);
  const noise = () => (rand() + rand() + rand() - 1.5) * 1.2;
  const rows: ResponseRow[] = [];
  for (let i = 0; i < 1500; i++) {
    const s = 3 + noise();
    const r = 3 + 0.8 * (s - 3) + noise();
    const c = 3 + 0.5 * (r - 3) + noise();
    const e = 3 + 0.8 * (r - 3) + 0.4 * (c - 3) + noise();
    rows.push(...respondent(`p${i}`, { structural: s, relational: r, cognitive: c, efficacy: e }));
  }
  const stats = computeReportStats(rows, items);
  const si = DIMENSIONS.indexOf("structural");
  const ei = DIMENSIONS.indexOf("efficacy");

  it("keeps every respondent who answered everything", () => {
    expect(stats.n).toBe(1500);
    expect(stats.droppedCount).toBe(0);
  });

  it("gives symmetric matrices with a unit diagonal on the correlation", () => {
    for (let i = 0; i < 4; i++) {
      expect(stats.correlation[i][i]).toBeCloseTo(1, 10);
      for (let j = 0; j < 4; j++) {
        expect(stats.correlation[i][j]).toBeCloseTo(stats.correlation[j][i], 10);
        expect(stats.partial[i][j]).toBeCloseTo(stats.partial[j][i], 10);
        expect(Math.abs(stats.partial[i][j])).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it("inverts the correlation matrix correctly (R times its inverse is the identity)", () => {
    const R = correlationMatrix(dimensionScores(rows, items).scores);
    const inv = invert(R);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const cell = R[i].reduce((sum, _, k) => sum + R[i][k] * inv[k][j], 0);
        expect(cell).toBeCloseTo(i === j ? 1 : 0, 8);
      }
  });

  it("shows structural and efficacy linked on their own, but not once the others are held constant", () => {
    expect(stats.correlation[si][ei]).toBeGreaterThan(0.2);
    expect(Math.abs(stats.partial[si][ei])).toBeLessThan(0.1);
  });

  it("returns an all-zero partial matrix when the dimensions are independent", () => {
    const identity = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    const p = partialCorrelationMatrix(identity);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j) expect(p[i][j]).toBeCloseTo(0, 10);
  });
});
