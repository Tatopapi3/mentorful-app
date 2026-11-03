import { describe, expect, it } from "vitest";
import { departmentMatrix, gaps } from "@/lib/admin/network";
import { SLIDE_FACTS, pct } from "@/lib/demo/slide-facts";
import { buildStageTables, STAGE_LAST_YEAR } from "@/lib/preview/stageTables";

const t = buildStageTables();
const dim = new Map(t.survey_items.map((i) => [String(i.id), String(i.dimension)]));
const mean = (d: string) => {
  const v = t.survey_responses.filter((r) => dim.get(String(r.item_id)) === d).map((r) => Number(r.scored_value));
  return v.reduce((a, b) => a + b, 0) / v.length;
};

describe("the numbers on the slides match the stage data", () => {
  it("shows this year's and last year's averages to one decimal", () => {
    for (const d of SLIDE_FACTS.dimensions) {
      expect(d.now).toBeCloseTo(mean(d.key), 1);
      expect(d.before).toBeCloseTo(STAGE_LAST_YEAR.means[d.key], 1);
    }
    expect(SLIDE_FACTS.cte.now).toBeCloseTo(mean("efficacy"), 1);
    expect(SLIDE_FACTS.cte.before).toBeCloseTo(STAGE_LAST_YEAR.means.efficacy, 1);
  });
  it("says 85% then 70%", () => {
    expect(pct(SLIDE_FACTS.cte.before)).toBe(85);
    expect(pct(SLIDE_FACTS.cte.now)).toBe(70);
  });
  it("names the departments and the pairs of them with no pair between them", () => {
    const people = t.profiles
      .filter((p) => p.role === "teacher")
      .map((p) => ({ id: String(p.id), name: `${p.first_name} ${p.last_name}`, dept: String(p.department) }));
    const pairs = t.pairings.filter((p) => p.status === "approved").map((p) => ({ id: String(p.id), a: String(p.host_id), b: String(p.visitor_id), domain: null, tag: null }));
    const m = departmentMatrix({ people, pairs });
    expect([...m.depts].sort()).toEqual([...SLIDE_FACTS.departments]);
    const missing = gaps(m).map((g) => [g.a, g.b].sort().join("|")).sort();
    expect(missing).toEqual(SLIDE_FACTS.gaps.map((g) => [...g].sort().join("|")).sort());
  });
});
