import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NetworkSlide from "@/app/report/slides/NetworkSlide";
import { NEGLIGIBLE_PARTIAL, isNegligible, nodeRadius, samplingCaveat, samplingHalfWidth } from "@/lib/report/networkStyle.ts";
import { DIMENSIONS, computeReportStats, type Dimension, type ReportItem, type ResponseRow } from "@/lib/report/stats.ts";
import { prng } from "./helpers";

describe("network drawing rules", () => {
  it("treats a partial correlation under 0.1 as no direct tie", () => {
    expect(NEGLIGIBLE_PARTIAL).toBe(0.1);
    expect(isNegligible(0.099)).toBe(true);
    expect(isNegligible(-0.05)).toBe(true);
    expect(isNegligible(0.1)).toBe(false);
    expect(isNegligible(-0.3)).toBe(false);
  });

  it("makes a node bigger as its average rises, within fixed bounds", () => {
    expect(nodeRadius(1)).toBeLessThan(nodeRadius(3.5));
    expect(nodeRadius(3.5)).toBeLessThan(nodeRadius(6));
    expect(nodeRadius(-4)).toBe(nodeRadius(1));
    expect(nodeRadius(99)).toBe(nodeRadius(6));
    expect(nodeRadius(1)).toBeGreaterThanOrEqual(42);
  });

  it("quotes about ±0.14 at 50 respondents, and a wider band with fewer", () => {
    expect(samplingHalfWidth(50)).toBeCloseTo(0.14, 2);
    expect(samplingHalfWidth(25)).toBeGreaterThan(samplingHalfWidth(50));
    expect(samplingHalfWidth(100)).toBeLessThan(samplingHalfWidth(50));
    expect(samplingCaveat(50)).toContain("±0.14");
    expect(samplingCaveat(50)).toContain("50 respondents");
  });
});

describe("the network slide", () => {
  // Structural is unrelated to the other three, so its edges are negligible; the other three are tied.
  const sizes: Record<Dimension, number> = { structural: 6, relational: 9, cognitive: 6, efficacy: 5 };
  const items: ReportItem[] = [];
  for (const d of DIMENSIONS) for (let i = 0; i < sizes[d]; i++) items.push({ id: `${d}${i}`, position: items.length + 1, dimension: d, reverse: false });
  const rand = prng(21);
  const rows: ResponseRow[] = [];
  for (let r = 0; r < 60; r++) {
    const shared = (rand() - 0.5) * 3;
    const score: Record<Dimension, number> = {
      structural: 3 + (rand() - 0.5) * 2,
      relational: 4.5 + shared + (rand() - 0.5) * 0.6,
      cognitive: 3.5 + shared + (rand() - 0.5) * 0.6,
      efficacy: 2 + shared + (rand() - 0.5) * 0.6,
    };
    for (const it of items) rows.push({ respondent: `p${r}`, item_id: it.id, scored_value: Math.min(6, Math.max(1, score[it.dimension])) });
  }
  const stats = computeReportStats(rows, items);
  const html = renderToStaticMarkup(<NetworkSlide stats={stats} finding="f" synthetic={false} footerLeft="x" />);

  it("draws ties under the threshold dashed, and the others solid", () => {
    const faint = stats.partial.flatMap((row, i) => row.filter((_, j) => j > i && isNegligible(stats.partial[i][j])));
    expect(faint.length).toBeGreaterThan(0);
    expect(html).toContain('stroke-dasharray="10 8"');
    expect(html).toContain("No direct tie (|r| &lt; 0.1)");
  });

  it("sizes each node by its average, so nodes are not all the same", () => {
    const radii = [...html.matchAll(/<circle[^>]*\sr="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(radii).toHaveLength(4);
    expect(new Set(radii.map((r) => r.toFixed(2))).size).toBeGreaterThan(1);
  });

  it("always carries the sampling caveat with the real n", () => {
    expect(html).toContain("With 60 respondents");
    expect(html).toContain("±0.13");
  });
});
