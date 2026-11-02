import { describe, expect, it } from "vitest";
import type { ScanSummary } from "@/lib/admin/facts";
import { scanChange, scanChangeSentence } from "@/lib/admin/scan-change";

const scan = (m: [number, number, number, number]): ScanSummary => ({
  n: 32,
  means: { structural: m[0], relational: m[1], cognitive: m[2], efficacy: m[3] },
  ci: { structural: 0.3, relational: 0.3, cognitive: 0.3, efficacy: 0.3 },
  includesSynthetic: false,
});

describe("the Culture Scan compared with last year", () => {
  it("says nothing when there is no earlier scan", () => {
    expect(scanChange({ scan: scan([3, 4, 4, 4]), scanBefore: null })).toBeNull();
    expect(scanChange({ scan: null, scanBefore: scan([3, 4, 4, 4]) })).toBeNull();
  });
  it("finds the fall, the percentages and the dimension that moved most", () => {
    const c = scanChange({ scan: scan([2.6, 4.4, 4.3, 4.2]), scanBefore: scan([4.0, 5.2, 5.1, 5.1]) })!;
    expect(c.pctBefore).toBe(85);
    expect(c.pctNow).toBe(70);
    expect(c.biggest).toBe("structural");
    expect(c.byDimension.structural).toBeCloseTo(-1.4);
    expect(scanChangeSentence(c)).toBe("Down 0.9 since last year (5.1 to 4.2, 85% to 70%). Structural moved most (down 1.4).");
  });
  it("also reads a rise", () => {
    const c = scanChange({ scan: scan([4, 5, 5, 5]), scanBefore: scan([3, 4, 4, 4]) })!;
    expect(scanChangeSentence(c)).toMatch(/^Up 1\.0 since last year/);
  });
});
