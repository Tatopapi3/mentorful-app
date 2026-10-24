import { describe, expect, it } from "vitest";
import { buildFacts, type AdminPair, type AdminPerson, type AdminSnapshot } from "@/lib/admin/facts";
import { departmentMatrix, progress } from "@/lib/admin/network";
import { AUDIENCE_LABEL, audienceSize, coolingFrom, countLabel, defaultNudge, warningFor } from "@/lib/admin/early-warning";
import { matchesPriority, momentum, readThemes, themeSentences } from "@/lib/admin/themes";
import { bestRound, draftRound, impactOf, impactSentence, linksOpenedBy, metricsOf, swapVisitor, type PairIds } from "@/lib/admin/simulator";
import { buildNarrative, narrativeText } from "@/lib/admin/narrative";

// Four departments of five teachers each, so every one is drawn (the floor is 5), plus one small department that is not.
const DEPTS = ["Math", "ELA", "Science", "Arts"];
const people: AdminPerson[] = [
  ...DEPTS.flatMap((d) => Array.from({ length: 5 }, (_, i) => ({ id: `${d}${i}`, name: `${d} ${i}`, dept: d }))),
  { id: "pe0", name: "PE 0", dept: "PE" },
  { id: "pe1", name: "PE 1", dept: "PE" },
];
const P = (a: string, b: string): PairIds => [a, b];
const pair = (a: string, b: string, domain: string | null = "CLASSROOM", tag: string | null = null): AdminPair => ({ id: `${a}-${b}`, a, b, domain, tag });

describe("simulator", () => {
  // Math and ELA are connected; Arts has no partner at all.
  const now: PairIds[] = [P("Math0", "ELA0"), P("Math1", "Math2"), P("Science0", "Science1")];

  it("measures a round against the baseline", () => {
    const before = metricsOf(people, now);
    expect(before.pairs).toBe(3);
    expect(before.crossPct).toBe(33);
    expect(before.connected).toBe(1);
    expect(before.possible).toBe(6);
  });

  it("counts a new department connection only once, and marks it new on the grid", () => {
    const added: PairIds[] = [P("Arts0", "Science2"), P("Arts1", "Science3")];
    const impact = impactOf(people, now, added);
    expect(impact.after.connected).toBe(2);
    expect(impact.grid.find((c) => c.a === "Arts" && c.b === "Science")?.state).toBe("new");
    expect(impact.grid.find((c) => c.a === "ELA" && c.b === "Math")?.state).toBe("kept");
    expect(impact.grid.find((c) => c.a === "Arts" && c.b === "Math")?.state).toBe("missing");
    expect(impactSentence(impact)).toContain("adds 1 department connection (1 to 2 of 6)");
  });

  it("leaves small departments out of every number", () => {
    const impact = impactOf(people, now, [P("pe0", "pe1")]);
    expect(impact.omitted).toEqual(["PE"]);
    expect(impact.depts).not.toContain("PE");
  });

  it("names which links a pair opens, and none when another pair already opens it", () => {
    const proposal: PairIds[] = [P("Arts0", "Science2"), P("Arts1", "Science3")];
    expect(linksOpenedBy(people, now, proposal, 0)).toEqual([]);
    expect(linksOpenedBy(people, now, [P("Arts0", "Science2")], 0)).toEqual([["Arts", "Science"]]);
    expect(linksOpenedBy(people, now, [P("Math3", "Math4")], 0)).toEqual([]);
  });

  it("swaps a partner and hands the old one to whoever gave up the new one", () => {
    const out = swapVisitor([P("a", "b"), P("c", "d")], 0, "d");
    expect(out).toEqual([P("a", "d"), P("c", "b")]);
    expect(swapVisitor([P("a", "b")], 0, "a")).toEqual([P("a", "b")]);
  });

  it("drafts the same round for the same seed", () => {
    const pool = people.filter((p) => p.dept !== "PE").map((p) => p.id);
    expect(draftRound(people, pool, [], 7)).toEqual(draftRound(people, pool, [], 7));
  });

  it("finds a round that connects at least as many departments as any single random draft", () => {
    const pool = people.filter((p) => p.dept !== "PE").map((p) => p.id);
    const best = bestRound(people, pool, [], [], 60, 1);
    const bestMetrics = metricsOf(people, best.pairs);
    for (let s = 1; s <= 60; s++) expect(bestMetrics.connected).toBeGreaterThanOrEqual(metricsOf(people, draftRound(people, pool, [], s).pairs).connected);
    // every teacher in a legal pair, nobody twice
    const ids = best.pairs.flat();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("avoids repeating earlier pairs when planning a new cycle", () => {
    const pool = people.filter((p) => p.dept !== "PE").map((p) => p.id);
    const past: PairIds[] = [P("Math0", "ELA0"), P("Math1", "ELA1")];
    const best = bestRound(people, pool, [], past, 60, 1);
    const key = (a: string, b: string) => [a, b].sort().join("|");
    const pastKeys = new Set(past.map(([a, b]) => key(a, b)));
    expect(best.pairs.filter(([a, b]) => pastKeys.has(key(a, b)))).toHaveLength(0);
  });
});

describe("early warning", () => {
  it("splits pairs into on track, cooling and quiet", () => {
    const c = coolingFrom({ pairs: 32, quiet14: 14, quiet30: 6, quiet45: 2 });
    expect(c).toEqual({ pairs: 32, onTrack: 18, cooling: 8, quiet: 6, longQuiet: 2 });
  });

  it("never returns a negative count if the windows come back out of order", () => {
    const c = coolingFrom({ pairs: 10, quiet14: 2, quiet30: 5, quiet45: 9 });
    expect(c.cooling).toBeGreaterThanOrEqual(0);
    expect(c.onTrack).toBeGreaterThanOrEqual(0);
    expect(c.longQuiet).toBeLessThanOrEqual(c.quiet);
  });

  it("hides small counts", () => {
    expect(countLabel(3)).toBe("fewer than 5");
    expect(countLabel(0)).toBe("none");
    expect(countLabel(9)).toBe("9");
  });

  it("says so plainly when every pair is active, and warns with the number when they are not", () => {
    expect(warningFor(coolingFrom({ pairs: 12, quiet14: 0, quiet30: 0, quiet45: 0 })).level).toBe("calm");
    const w = warningFor(coolingFrom({ pairs: 20, quiet14: 12, quiet30: 4, quiet45: 0 }));
    expect(w.level).toBe("act");
    expect(w.detail).toContain("8 pairs have been silent for 14 to 30 days");
    expect(w.detail).toContain("If nothing changes");
  });

  it("sizes each audience and writes a message that names nobody", () => {
    const c = coolingFrom({ pairs: 20, quiet14: 12, quiet30: 4, quiet45: 0 });
    expect(audienceSize(c, "cooling")).toBe(8);
    expect(audienceSize(c, "quiet")).toBe(4);
    expect(audienceSize(c, "both")).toBe(12);
    for (const a of Object.keys(AUDIENCE_LABEL) as (keyof typeof AUDIENCE_LABEL)[]) expect(defaultNudge(a)).not.toMatch(/\b(you were|your partner is)\b/i);
  });
});

describe("themes", () => {
  const many = (n: number, domain: string, tag: string | null = null): AdminPair[] => Array.from({ length: n }, (_, i) => pair(`Math${i % 5}`, `ELA${i % 5}`, domain, tag));

  it("shows a theme only when five or more pairs back it", () => {
    const r = readThemes(people, [...many(6, "CLASSROOM"), ...many(3, "PLANNING")], null);
    expect(r.shown.map((t) => t.domain)).toEqual(["CLASSROOM"]);
    expect(r.hiddenPairs).toBe(3);
    expect(r.untouched).toContain("Communication");
  });

  it("reports the share of pairs, and whether they cross departments", () => {
    const r = readThemes(people, [...many(5, "ASSESSMENT"), pair("Math0", "Math1", "ASSESSMENT")], null);
    expect(r.shown[0]).toMatchObject({ domain: "ASSESSMENT", pairs: 6, sharePct: 100, crossPct: 83, plc: "Data Dive" });
  });

  it("matches a strategic tag to the school priority loosely, and shows alignment only above the floor", () => {
    expect(matchesPriority("Feedback culture", "feedback")).toBe(true);
    expect(matchesPriority(null, "feedback")).toBe(false);
    expect(matchesPriority("Student voice", "Feedback culture")).toBe(false);
    const r = readThemes(people, [...many(5, "CLASSROOM", "Feedback culture"), ...many(2, "PLANNING", "Student voice")], "Feedback culture");
    expect(r.alignment).toMatchObject({ matching: 5, sharePct: 71 });
    expect(readThemes(people, many(4, "CLASSROOM", "Feedback culture"), "Feedback culture").alignment).toBeNull();
  });

  it("reads momentum from the last four weeks against the four before, and shows nothing for too few weeks", () => {
    const w = (n: number[]) => n.map((v, i) => ({ week: `2026-0${(i % 9) + 1}-01`, n: v }));
    expect(momentum(w([10, 10, 10, 10, 15, 15, 15, 15]))).toMatchObject({ direction: "up", changePct: 50, recent: 60, before: 40 });
    expect(momentum(w([10, 10, 10, 10, 5, 5, 5, 5]))?.direction).toBe("down");
    expect(momentum(w([10, 10, 10, 10, 10, 10, 10, 10]))?.direction).toBe("level");
    expect(momentum(w([10, 10, 10]))).toBeNull();
    expect(momentum([{ week: "2026-01-05", n: null }])).toBeNull();
  });

  it("says nothing when there are no pairs", () => {
    expect(themeSentences(readThemes(people, [], null))).toEqual(["No pairs have chosen a theme yet."]);
  });
});

describe("board narrative", () => {
  const snap: AdminSnapshot = {
    school: { name: "Test School", priority: null },
    cycle: { id: "c2", name: "Spring", status: "active" },
    cycles: [{ id: "c2", name: "Spring", status: "active" }],
    people,
    pairs: [pair("Math0", "ELA0"), pair("Math1", "Science0"), pair("Arts0", "Math2"), pair("ELA1", "ELA2")],
    requests: [],
    conversations: 9,
    scan: null,
  };
  const facts = buildFacts(snap);
  const matrix = departmentMatrix(snap);
  const themes = readThemes(people, snap.pairs, null);
  const base = { snap, facts, matrix, progress: [], previousName: null, cooling: null, themes, momentum: null };

  it("states the figures it was given and nothing else", () => {
    const n = buildNarrative(base);
    const text = narrativeText(n);
    expect(n.title).toBe("Test School: the story of Spring");
    expect(text).toContain("22 teachers in Spring");
    expect(text).toContain("8 of them (36%) have a co-mentor, in 4 pairs");
    expect(text).toContain("3 of those pairs (75%) connect teachers from different departments");
    expect(text).toContain("Counts and averages only");
  });

  it("includes no person's name", () => {
    const text = narrativeText(buildNarrative(base));
    for (const p of people) expect(text).not.toContain(p.name);
  });

  it("compares with the last cycle only when there is one", () => {
    expect(narrativeText(buildNarrative(base))).not.toContain("Since");
    const prev = { ...snap, cycle: { id: "c1", name: "Fall", status: "complete" }, pairs: snap.pairs.slice(0, 1) };
    const n = buildNarrative({ ...base, progress: progress(snap, prev), previousName: "Fall" });
    expect(narrativeText(n)).toContain("Since Fall");
  });

  it("warns about cooling pairs with the hidden-count wording", () => {
    const n = buildNarrative({ ...base, cooling: coolingFrom({ pairs: 4, quiet14: 3, quiet30: 1, quiet45: 0 }) });
    expect(narrativeText(n)).toContain("fewer than 5 pairs have been silent for two to four weeks");
  });

  it("calls a low response rate an early look", () => {
    const withScan: AdminSnapshot = { ...snap, scan: { n: 5, means: { structural: 3, relational: 4, cognitive: 4, efficacy: 4.5 }, ci: { structural: 0.4, relational: 0.4, cognitive: 0.4, efficacy: 0.3 }, includesSynthetic: true } };
    const text = narrativeText(buildNarrative({ ...base, snap: withScan, facts: buildFacts(withScan) }));
    expect(text).toContain("early look, not yet representative");
    expect(text).toContain("demonstration data");
  });

  it("ends with next steps", () => {
    const n = buildNarrative(base);
    expect(n.sections[n.sections.length - 1].heading).toBe("Recommended next steps");
  });
});
