import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { WEB } from "./helpers";

// The Culture Scan is the product. These pin the frozen instrument, so a wave-2 comparison is
// never silently comparing different questions. Runs the seed script in its no-database mode.
const out = execFileSync("node", ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/seed-culture-scan-items.ts", "--dry-run"], {
  cwd: WEB,
  encoding: "utf8",
});

describe("the frozen instrument (Culture Scan v2)", () => {
  it("has 26 items, split 6 / 9 / 6 / 5 across the four dimensions", () => {
    expect(out).toContain("26 items");
    for (const [dim, n] of [["structural", 6], ["relational", 9], ["cognitive", 6], ["efficacy", 5]] as const)
      expect(out).toMatch(new RegExp(`${dim}\\s+${n} items`));
  });

  it("reverse-scores exactly positions 5, 11, 21 and 25", () => {
    const reversed = out.split("\n").filter((l) => /^\s+\d+\s+\w+\s+(I|we)\s+REV/.test(l)).map((l) => Number(l.trim().split(/\s+/)[0]));
    expect(reversed).toEqual([5, 11, 21, 25]);
  });

  it("still hashes to the value recorded when the instrument was frozen", () => {
    expect(out).toContain("d9ca364b4feae67af90ab764bd5ed1ef5cfb71f3618dad5a3797eb28b517843d");
    expect(out).toContain("mentorful.culture-scan.canonical.v1");
  });
});
