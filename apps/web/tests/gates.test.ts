import { describe, expect, it } from "vitest";
import { CELL_FLOOR, NETWORK_FLOOR, REPORT_SHARE, evaluateGates, gateSentence } from "@/lib/report/gates.ts";
import { cteScore } from "@/lib/report/headline.ts";
import { prng } from "./helpers";
import { computeReportStats, DIMENSIONS, type ReportItem, type ResponseRow } from "@/lib/report/stats.ts";

describe("the three gates", () => {
  it("use the values from Mentorful's brief", () => {
    expect(REPORT_SHARE).toBe(0.6);
    expect(NETWORK_FLOOR).toBe(25);
    expect(CELL_FLOOR).toBe(5);
  });

  it("open the report at 60% of faculty, rounded up", () => {
    expect(evaluateGates(35, 60).report).toBe(false); // needs 36
    expect(evaluateGates(36, 60).report).toBe(true);
    expect(evaluateGates(36, 60).reportNeed).toBe(36);
    expect(evaluateGates(6, 9).reportNeed).toBe(6); // 5.4 rounds up
  });

  it("keep the network on its own absolute floor, separate from the report gate", () => {
    // A small school: 20 of 30 is 67% so the report opens, but 20 is under the network floor.
    const small = evaluateGates(20, 30);
    expect(small.report).toBe(true);
    expect(small.network).toBe(false);
    // A large school: 25 of 100 is 25% so the report stays closed, yet the network sample is large enough.
    const large = evaluateGates(25, 100);
    expect(large.report).toBe(false);
    expect(large.network).toBe(true);
  });

  it("treat an unknown headcount as closed, never as open", () => {
    const g = evaluateGates(50, 0);
    expect(g.report).toBe(false);
    expect(g.early).toBe(true);
    expect(g.reportNeed).toBeNull();
    expect(g.sharePct).toBeNull();
    expect(gateSentence(g)).toMatch(/headcount isn't known/);
  });

  it("describe an early look in one sentence with the numbers", () => {
    expect(gateSentence(evaluateGates(5, 60))).toBe("5 of 60 teachers (8%) have responded. The full report opens at 36 (60% of faculty).");
  });
});

describe("the headline score", () => {
  const sizes = { structural: 6, relational: 9, cognitive: 6, efficacy: 5 } as const;
  const items: ReportItem[] = [];
  for (const d of DIMENSIONS) for (let i = 0; i < sizes[d]; i++) items.push({ id: `${d}${i}`, position: items.length + 1, dimension: d, reverse: false });

  it("is the Efficacy mean, not the average of the four dimensions", () => {
    const rand = prng(11);
    const levels = { structural: 2.5, relational: 3.5, cognitive: 4, efficacy: 5 } as const;
    const rows: ResponseRow[] = [];
    for (let r = 0; r < 40; r++) {
      const person = Object.fromEntries(DIMENSIONS.map((d) => [d, levels[d] + (rand() - 0.5) * 1.4])) as Record<(typeof DIMENSIONS)[number], number>;
      for (const it of items) rows.push({ respondent: `p${r}`, item_id: it.id, scored_value: person[it.dimension] });
    }
    const stats = computeReportStats(rows, items);
    const cte = cteScore(stats);
    expect(cte.score).toBe(stats.dimensions.efficacy.mean);
    expect(cte.n).toBe(40);
    const fourWayAverage = DIMENSIONS.reduce((s, d) => s + stats.dimensions[d].mean, 0) / 4;
    expect(Math.abs(cte.score - fourWayAverage)).toBeGreaterThan(0.5);
  });
});
