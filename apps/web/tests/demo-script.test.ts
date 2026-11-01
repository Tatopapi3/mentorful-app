import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BEATS } from "@/lib/demo/script";

// The markdown marks stage directions as *(...)* and may split a speech around them; the words are what must match.
const plain = (t: string) => t.replace(/\*\([^)]*\)\*/g, "").replace(/"\s+"/g, " ").replace(/\s+/g, " ");
const md = plain(readFileSync(join(__dirname, "../../../docs/DEMO_SCRIPT.md"), "utf8"));
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

describe("the Demo Day script", () => {
  it("is the same in the page and in docs/DEMO_SCRIPT.md", () => {
    for (const b of BEATS) expect(md, `${b.t} ${b.who}`).toContain(plain(b.say));
  });

  it("starts at 0:00, moves forward, and ends before 5:00", () => {
    const secs = BEATS.map((b) => Number(b.t.split(":")[0]) * 60 + Number(b.t.split(":")[1]));
    expect(secs[0]).toBe(0);
    expect([...secs].sort((a, b) => a - b)).toEqual(secs);
    expect(secs[secs.length - 1]).toBeLessThan(300);
  });

  it("is short enough to say in about three minutes, leaving room for the clicks", () => {
    const spoken = BEATS.reduce((n, b) => n + words(b.say), 0);
    expect(spoken).toBeLessThan(480);
  });
});

describe("the cast", () => {
  it("lists the four people, with Eric as the narrator", async () => {
    const { CAST } = await import("@/lib/demo/script");
    expect(CAST.map((m) => m.name)).toEqual(["Eric", "Juan", "Bernard", "Bertrand"]);
    expect(CAST[0].plays).toMatch(/narrator/i);
  });

  it("says when each person speaks, matching the script", async () => {
    const { CAST } = await import("@/lib/demo/script");
    for (const m of CAST) {
      const times = BEATS.filter((b) => b.who.split(",")[0] === m.name).map((b) => b.t);
      expect(m.speaks.split(", "), m.name).toEqual(times);
    }
  });
});
