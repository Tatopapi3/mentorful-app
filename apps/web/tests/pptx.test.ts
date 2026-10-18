import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { deckBuffer } from "@/lib/report/pptx.ts";
import { evaluateGates } from "@/lib/report/gates.ts";
import { DIMENSIONS, computeReportStats, type Dimension, type ReportItem, type ResponseRow } from "@/lib/report/stats.ts";
import { prng, read } from "./helpers";

const sizes: Record<Dimension, number> = { structural: 6, relational: 9, cognitive: 6, efficacy: 5 };
const items: ReportItem[] = [];
for (const d of DIMENSIONS) for (let i = 0; i < sizes[d]; i++) items.push({ id: `${d}${i}`, position: items.length + 1, dimension: d, reverse: false });
const rand = prng(33);
const rows: ResponseRow[] = [];
for (let r = 0; r < 40; r++) {
  const shared = (rand() - 0.5) * 3;
  const score: Record<Dimension, number> = {
    structural: 3 + (rand() - 0.5) * 2,
    relational: 4.5 + shared + (rand() - 0.5) * 0.6,
    cognitive: 3.5 + shared + (rand() - 0.5) * 0.6,
    efficacy: 4 + shared + (rand() - 0.5) * 0.6,
  };
  for (const it of items) rows.push({ respondent: `p${r}`, item_id: it.id, scored_value: Math.min(6, Math.max(1, score[it.dimension])) });
}
const stats = computeReportStats(rows, items);

async function slides(gates: ReturnType<typeof evaluateGates>, synthetic = false) {
  const zip = await JSZip.loadAsync(await deckBuffer(stats, { schoolName: "Test School", dateLabel: "Oct 18, 2026", gates, synthetic }));
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const xml = await Promise.all(names.map((n) => zip.file(n)!.async("string")));
  return { names, xml, all: xml.join("\n") };
}

describe("the PowerPoint deck", () => {
  it("has six slides and opens as a real .pptx", async () => {
    const { names } = await slides(evaluateGates(40, 60));
    expect(names).toHaveLength(6);
  });

  it("leads with the CTE score, the Efficacy average", async () => {
    const { xml } = await slides(evaluateGates(40, 60));
    const cte = stats.dimensions.efficacy.mean.toFixed(1);
    expect(xml[0]).toContain(`>${cte}<`);
    expect(xml[0]).toContain("CTE score");
  });

  it("labels an early look on every slide when the report gate is closed, and not when it is open", async () => {
    const early = await slides(evaluateGates(40, 100));
    for (const x of early.xml) expect(x).toContain("Early look, not yet representative");
    const open = await slides(evaluateGates(40, 60));
    expect(open.all).not.toContain("Early look");
  });

  it("draws the network with dashed faint ties, node sizes and the caveat when the network gate is open", async () => {
    const { xml } = await slides(evaluateGates(40, 60));
    expect(xml[2]).toContain('prstDash val="dash"');
    expect(xml[2]).toContain("With 40 respondents");
    expect(xml[2]).not.toContain("Locked");
  });

  it("replaces the network with a locked slide below the network floor", async () => {
    const { xml } = await slides(evaluateGates(20, 30));
    expect(xml[2]).toContain("Locked");
    expect(xml[2]).toContain("at least 25 responses");
    expect(xml[2]).not.toContain('prstDash val="dash"');
  });

  it("says when the data is synthetic", async () => {
    const { all } = await slides(evaluateGates(40, 60), true);
    expect(all).toContain("Synthetic demo data");
  });
});

describe("the export route", () => {
  const route = read("src/app/report/export/pptx/route.ts");
  it("is gated like the page: signed in, an admin, their own school, no demo data", () => {
    expect(route).toMatch(/getUser\(\)/);
    expect(route).toMatch(/role !== "admin"/);
    expect(route).toMatch(/status: 403/);
    expect(route).toMatch(/me\.school_id/);
    expect(route).not.toMatch(/includeSynthetic:\s*true/);
  });
});
