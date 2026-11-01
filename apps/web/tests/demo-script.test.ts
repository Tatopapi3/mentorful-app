import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BEATS } from "@/lib/demo/script";

// The markdown marks stage directions as *(...)* and may split a speech around them; the words are what must match.
const plain = (t: string) => t.replace(/\*\([^)]*\)\*/g, "").replace(/"\s+"/g, " ").replace(/\s+/g, " ");
const md = plain(readFileSync(join(__dirname, "../../../docs/DEMO_SCRIPT.md"), "utf8"));
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
// A [bracket] stands for something the speaker fills in; its hint says how many words ("about 10 words").
const spokenSeconds = (say: string) => {
  const hinted = [...say.matchAll(/\[[^\]]*about (\d+) words\]/g)].reduce((n, m) => n + Number(m[1]), 0);
  const typed = words(say.replace(/\[[^\]]*\]/g, " "));
  return ((typed + hinted) / 130) * 60;
};

describe("the Demo Day script", () => {
  it("is the same in the page and in docs/DEMO_SCRIPT.md", () => {
    for (const b of BEATS) expect(md, `${b.t} ${b.who}`).toContain(plain(b.say));
  });

  it("has seconds for every line that add up to under 5:00, with start times that follow from them", () => {
    let t = 0;
    for (const b of BEATS) {
      expect(b.t, b.who).toBe(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`);
      t += b.secs;
    }
    expect(t).toBeLessThanOrEqual(295);
    expect(md).toContain(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")} | | End`);
  });

  it("gives each line enough seconds to say its words at a calm stage pace (130 words a minute)", () => {
    for (const b of BEATS) expect(spokenSeconds(b.say), `${b.t} ${b.who}`).toBeLessThanOrEqual(b.secs);
  });

  it("gives Juan, Bernard and Bertrand 25 seconds each, and Eric a little longer to open", () => {
    const intro = (n: string) => BEATS.find((b) => b.who === n)!;
    expect(intro("Juan").secs).toBe(25);
    expect(intro("Bernard").secs).toBe(25);
    expect(intro("Bertrand").secs).toBe(25);
    expect(BEATS[0].who).toBe("Eric");
    expect(BEATS[0].secs).toBeGreaterThan(25);
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
