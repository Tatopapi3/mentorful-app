import { describe, expect, it } from "vitest";
import { buildActions } from "@/lib/admin/actions";
import { buildFacts, departmentConnections, headlineSentence, type AdminSnapshot } from "@/lib/admin/facts";
import { facultyOrbit, farness, orbitDirections } from "@/lib/admin/faculty-orbit";
import { groupSummaries } from "@/lib/admin/summaries";
import { buildWeekly, weekLabel } from "@/lib/admin/trends";
import { cultureBubbles, flowArcs, pairingSplit } from "@/lib/admin/visuals";
import { headlineTitle } from "@/lib/admin/network";
import { activitySentence, buildActivity, cycleTrend, monthLabel, trendSentence } from "@/lib/admin/trends";
import { coverage, departmentMatrix, directions, gaps, progress, reach, suggestions } from "@/lib/admin/network";
import { csvEscape, resultsCsv } from "@/lib/admin/csv";
import { participationRates, quietLabel, type Participation } from "@/lib/admin/participation";

const people = [
  { id: "a", name: "A", dept: "Math" },
  { id: "b", name: "B", dept: "ELA" },
  { id: "c", name: "C", dept: "Math" },
  { id: "d", name: "D", dept: "Math" },
  { id: "e", name: "E", dept: "Science" },
  { id: "f", name: "F", dept: "Science" },
];
const base: AdminSnapshot = {
  school: { name: "S", priority: null },
  cycle: { id: "c1", name: "Fall", status: "active" },
  cycles: [{ id: "c1", name: "Fall", status: "active" }],
  people,
  pairs: [
    { id: "p1", a: "a", b: "b", domain: "CLASSROOM", tag: null }, // crosses departments
    { id: "p2", a: "c", b: "d", domain: "CLASSROOM", tag: null }, // same department
  ],
  requests: [],
  conversations: 6,
  scan: null,
};
const scan = {
  n: 4,
  means: { structural: 3, relational: 4.5, cognitive: 4, efficacy: 4.4 },
  ci: { structural: 0.4, relational: 0.4, cognitive: 0.4, efficacy: 0.3 },
  includesSynthetic: false,
};

describe("facts", () => {
  it("count who is paired, who isn't, and how many pairs cross departments", () => {
    const f = buildFacts(base);
    expect(f.faculty).toBe(6);
    expect(f.paired).toBe(4);
    expect(f.unpaired).toBe(2);
    expect(f.pairedPct).toBe(67);
    expect(f.pairCount).toBe(2);
    expect(f.crossPairs).toBe(1);
    expect(f.crossPct).toBe(50);
    expect(f.conversationsPerPair).toBe(3);
    expect(f.topDomain).toEqual({ domain: "CLASSROOM", count: 2 });
  });

  it("never divide by zero when the school is empty", () => {
    const f = buildFacts({ ...base, people: [], pairs: [], conversations: 0 });
    expect(f.pairedPct).toBeNull();
    expect(f.crossPct).toBeNull();
    expect(f.conversationsPerPair).toBeNull();
    expect(f.topDomain).toBeNull();
  });

  it("work out the strongest and weakest dimension and the efficacy-structure gap", () => {
    const f = buildFacts({ ...base, scan });
    expect(f.scan!.strongest.dimension).toBe("relational");
    expect(f.scan!.weakest.dimension).toBe("structural");
    expect(f.scan!.gap).toBeCloseTo(1.4, 10);
    expect(f.scan!.cte).toBe(4.4);
    expect(f.scan!.completionPct).toBe(67);
  });

  it("write one sentence that says where things stand", () => {
    expect(headlineSentence(buildFacts({ ...base, scan }))).toBe(
      "67% of your 6 teachers have a partner, and 50% of those pairs cross departments. Teachers rate relational highest and structural lowest.",
    );
  });
});

describe("actions", () => {
  const ids = (s: AdminSnapshot) => buildActions(buildFacts(s)).map((a) => a.id);

  it("ask for a decision on pending requests, and name the number", () => {
    const s = { ...base, requests: [{ id: "r", a: "e", b: "f", domain: null, tag: null }] };
    const a = buildActions(buildFacts(s)).find((x) => x.id === "requests")!;
    expect(a.title).toBe("Decide on 1 pairing request");
    expect(a.severity).toBe("do");
  });

  it("only offer to pair teachers when some are unpaired", () => {
    expect(ids(base)).toContain("unpaired");
    const everyone = { ...base, pairs: [...base.pairs, { id: "p3", a: "e", b: "f", domain: null, tag: null }] };
    expect(ids(everyone)).not.toContain("unpaired");
  });

  it("start with the weakest dimension, with its distance from the top", () => {
    const a = buildActions(buildFacts({ ...base, scan })).find((x) => x.id === "weakest")!;
    expect(a.title).toBe("Start with Structural");
    expect(a.detail).toContain("3.0 of 6, 1.5 points below Relational");
  });

  it("flag a low completion rate against the 80% target", () => {
    const a = buildActions(buildFacts({ ...base, scan })).find((x) => x.id === "completion")!;
    expect(a.title).toBe("Scan completion is 67%, below the 80% target");
    expect(a.detail).toContain("2 teachers haven't responded");
  });

  it("route the most common domain to its PLC", () => {
    const a = buildActions(buildFacts(base)).find((x) => x.id === "domain")!;
    expect(a.detail).toContain("a Clinic would meet an existing need");
  });

  it("say so, instead of guessing, when there is no scan yet", () => {
    expect(ids(base)).toContain("no-scan");
    expect(ids({ ...base, scan })).not.toContain("no-scan");
  });

  it("keep every link inside the look it was asked for", () => {
    const withData = { ...base, scan, requests: [{ id: "r", a: "e", b: "f", domain: null, tag: null }] };
    for (const a of buildActions(buildFacts(withData), "/admin")) expect(a.href).toMatch(/^\/admin\/(constellation|insights|pairings)$/);
    for (const a of buildActions(buildFacts(withData), "/admin/aurora")) expect(a.href).toMatch(/^\/admin\/aurora\/(constellation|insights|pairings)$/);
  });

  it("put what to do before what to watch before what is going well", () => {
    const sev = buildActions(buildFacts({ ...base, scan, requests: [{ id: "r", a: "e", b: "f", domain: null, tag: null }] })).map((a) => a.severity);
    const rank = { do: 0, watch: 1, good: 2 } as const;
    expect(sev).toEqual([...sev].sort((x, y) => rank[x] - rank[y]));
  });
});

describe("department connections", () => {
  const big = (dept: string, n: number, start: number) => Array.from({ length: n }, (_, i) => ({ id: `${dept}${start + i}`, name: `${dept}${i}`, dept }));
  const school: AdminSnapshot = {
    ...base,
    people: [...big("Math", 5, 0), ...big("ELA", 5, 0), ...big("Arts", 2, 0)],
    pairs: [
      { id: "1", a: "Math0", b: "ELA0", domain: null, tag: null },
      { id: "2", a: "Math1", b: "ELA1", domain: null, tag: null },
      { id: "3", a: "Math2", b: "Math3", domain: null, tag: null },
      { id: "4", a: "Math4", b: "Arts0", domain: null, tag: null }, // Arts has 2 teachers: left out
    ],
  };

  it("count pairs between each two departments and inside one", () => {
    const c = departmentConnections(school);
    expect(c.links).toEqual([{ a: "ELA", b: "Math", count: 2 }]);
    expect(c.within).toBe(1);
  });

  it("leave out departments with fewer than 5 teachers, and say which", () => {
    const c = departmentConnections(school);
    expect(c.omitted).toEqual(["Arts"]);
    expect(c.links.some((l) => l.a === "Arts" || l.b === "Arts")).toBe(false);
  });
});

describe("participation", () => {
  const p: Participation = {
    pairs: 10,
    with_conversation: 8,
    with_debrief: 5,
    complete: 4,
    teachers: 20,
    active_teachers: 15,
    by_department: [
      { department: "Math", teachers: 8, active: 4 },
      { department: "ELA", teachers: 7, active: 7 },
    ],
  };

  it("turn counts into rates, and order departments by participation", () => {
    const r = participationRates(p);
    expect(r.conversationPct).toBe(80);
    expect(r.debriefPct).toBe(50);
    expect(r.completePct).toBe(40);
    expect(r.activePct).toBe(75);
    expect(r.departments.map((d) => [d.department, d.pct])).toEqual([["ELA", 100], ["Math", 50]]);
  });

  it("never divide by zero", () => {
    const r = participationRates({ ...p, pairs: 0, teachers: 0, by_department: [] });
    expect(r.conversationPct).toBeNull();
    expect(r.activePct).toBeNull();
  });

  it("hide a small count of quiet pairs", () => {
    expect(quietLabel(3)).toBe("fewer than 5");
    expect(quietLabel(5)).toBe("5");
    expect(quietLabel(12)).toBe("12");
  });

  it("only raise the quiet-pairs action at 5 or more, and name the number", () => {
    const some = buildActions(buildFacts({ ...base, quietPairs: 7 })).find((a) => a.id === "quiet");
    expect(some!.title).toBe("7 pairs haven't logged a conversation in 30 days");
    expect(buildActions(buildFacts({ ...base, quietPairs: 3 })).some((a) => a.id === "quiet")).toBe(false);
    expect(buildActions(buildFacts({ ...base, quietPairs: null })).some((a) => a.id === "quiet")).toBe(false);
  });

  it("flag a low share of pairs with a conversation against the 70% target", () => {
    const a = buildActions(buildFacts({ ...base, participation: { ...p, with_conversation: 5 } })).find((x) => x.id === "conversations");
    expect(a!.title).toBe("50% of pairs have logged a conversation, below the 70% target");
    expect(buildActions(buildFacts({ ...base, participation: p })).some((x) => x.id === "conversations")).toBe(false);
  });
});

describe("results CSV", () => {
  it("escapes commas, quotes and newlines", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("two\nlines")).toBe('"two\nlines"');
    expect(csvEscape(null)).toBe("");
  });

  it("holds aggregates only: averages, pair counts and rates, with no names", () => {
    const snap = { ...base, scan, participation: { pairs: 2, with_conversation: 2, with_debrief: 1, complete: 1, teachers: 6, active_teachers: 4, by_department: [] } };
    const csv = resultsCsv(snap, buildFacts(snap));
    expect(csv.split("\n")[0]).toBe("section,metric,value");
    expect(csv).toContain("culture scan,Respondents,4");
    expect(csv).toContain("dimension average,Structural,3.00");
    expect(csv).toContain("pairs,Pairs that cross departments (%),50");
    expect(csv).toContain("participation,Pairs with a debrief (%),50");
    for (const p of people) expect(csv).not.toContain(`,${p.name},`);
  });
});

describe("network reading", () => {
  const dept = (d: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${d}${i}`, name: `${d} ${i}`, dept: d }));
  const school: AdminSnapshot = {
    ...base,
    people: [...dept("Math", 5), ...dept("ELA", 5), ...dept("Arts", 5), ...dept("PE", 2)],
    pairs: [
      { id: "1", a: "Math0", b: "ELA0", domain: null, tag: null },
      { id: "2", a: "Math1", b: "ELA1", domain: null, tag: null },
      { id: "3", a: "Math2", b: "Math3", domain: null, tag: null },
    ],
    requests: [],
  };
  const m = departmentMatrix(school);

  it("count connections between departments and leave out the small ones", () => {
    expect(m.depts).toEqual(["Arts", "ELA", "Math"]);
    expect(m.omitted).toEqual(["PE"]);
    expect(coverage(m)).toEqual({ connected: 1, possible: 3 });
  });

  it("list the department pairs that have no pair between them, and who is least connected", () => {
    expect(gaps(m).map((g) => `${g.a}-${g.b}`).sort()).toEqual(["Arts-ELA", "Arts-Math"]);
    expect(reach(m)[0]).toEqual({ dept: "Arts", connected: 0, possible: 2 });
  });

  it("suggest pairs among unpaired teachers that would close those gaps, using each person once", () => {
    const s = suggestions(school, m);
    expect(s.length).toBeGreaterThan(0);
    const ids = s.flatMap((x) => [x.host.id, x.visitor.id]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of s) {
      expect(x.host.dept).not.toBe(x.visitor.dept);
      expect(gaps(m).some((g) => (g.a === x.closes[0] && g.b === x.closes[1]) || (g.a === x.closes[1] && g.b === x.closes[0]))).toBe(true);
    }
  });

  it("never suggest someone who is already paired or has a request waiting", () => {
    const withReq = { ...school, requests: [{ id: "r", a: "Arts0", b: "Math4", domain: null, tag: null }] };
    const ids = suggestions(withReq, departmentMatrix(withReq)).flatMap((x) => [x.host.id, x.visitor.id]);
    expect(ids).not.toContain("Arts0");
    expect(ids).not.toContain("Math0");
  });

  it("compare this cycle with the one before, and say whether it is progress", () => {
    const before: AdminSnapshot = { ...school, pairs: [{ id: "x", a: "Math0", b: "Math1", domain: null, tag: null }] };
    const rows = progress(school, before);
    const cross = rows.find((r) => r.label === "Pairs that cross departments")!;
    expect(cross.before).toBe("0%");
    expect(cross.now).toBe("67%");
    expect(cross.delta).toBe("up");
    expect(cross.good).toBe(true);
    expect(progress(school, null)).toEqual([]);
  });

  it("read the sky in plain language, starting with what to do", () => {
    const d = directions(school, m, progress(school, null), null);
    expect(d[0].severity).toBe("do");
    expect(d.find((x) => x.id === "gaps")!.title).toBe("2 of 3 department connections don't exist yet");
    expect(d.find((x) => x.id === "least")!.title).toBe("Arts is the least connected department");
  });
});

describe("trends", () => {
  const people = [...Array.from({ length: 5 }, (_, i) => ({ id: `M${i}`, name: `M${i}`, dept: "Math" })), ...Array.from({ length: 5 }, (_, i) => ({ id: `E${i}`, name: `E${i}`, dept: "ELA" }))];
  const pair = (id: string, a: string, b: string) => ({ id, a, b, domain: null, tag: null });
  const rows = cycleTrend(people, [{ id: "c1", name: "Spring" }, { id: "c2", name: "Fall" }], {
    c1: [pair("1", "M0", "M1")],
    c2: [pair("2", "M0", "E0"), pair("3", "M1", "E1"), pair("4", "M2", "M3")],
  });

  it("work out each cycle's numbers, oldest first", () => {
    expect(rows.map((r) => [r.name, r.pairs, r.partneredPct, r.crossPct, r.connections])).toEqual([["Spring", 1, 20, 0, 0], ["Fall", 3, 60, 67, 1]]);
    expect(rows[1].possible).toBe(1);
  });

  it("say what moved, and say so plainly when there is only one cycle", () => {
    expect(trendSentence(rows)).toBe("Between Spring and Fall, teachers with a partner went from 20% to 60%, connected department pairs went from 0 to 1 of 1, pairs across departments went from 0% to 67%.");
    expect(trendSentence(rows.slice(0, 1))).toContain("one cycle so far");
  });

  const raw = {
    months: [{ month: "2025-11", n: 9 }, { month: "2025-10", n: 12 }, { month: "2025-12", n: 3 }],
    heat: [{ department: "Math", month: "2025-10", n: 7 }, { department: "Math", month: "2025-11", n: 2 }, { department: "ELA", month: "2025-10", n: 5 }],
  };

  it("sort months, label them, and hide any count under 5 even if the database let one through", () => {
    const a = buildActivity(raw);
    expect(a.months).toEqual(["2025-10", "2025-11", "2025-12"]);
    expect(a.totals.map((t) => t.n)).toEqual([12, 9, null]);
    expect(a.cell("Math", "2025-10")).toBe(7);
    expect(a.cell("Math", "2025-11")).toBeNull();
    expect(a.cell("ELA", "2025-12")).toBeNull();
    expect(a.departments).toEqual(["ELA", "Math"]);
    expect(monthLabel("2025-10")).toBe("Oct 2025");
  });

  it("describe the busiest month from the numbers that are shown", () => {
    expect(activitySentence(buildActivity(raw))).toBe("21 conversations are counted in the months shown. Oct 2025 was the busiest, with 12.");
    expect(activitySentence(buildActivity({ months: [{ month: "2025-10", n: 3 }], heat: [] }))).toBeNull();
  });
});

describe("pulse headline", () => {
  const row = (delta: "up" | "down" | "same") => ({ label: "x", now: "1", before: "0", delta, good: delta !== "down" });
  it("claim a direction only when there is an earlier cycle and the numbers back it", () => {
    expect(headlineTitle([])).toEqual({ lead: "Where connection", em: "stands." });
    expect(headlineTitle([row("up"), row("same")]).em).toBe("growing.");
    expect(headlineTitle([row("down"), row("same")]).em).toBe("slipped.");
    expect(headlineTitle([row("up"), row("down")]).em).toBe("shifting.");
    expect(headlineTitle([row("same"), row("same")]).em).toBe("holding steady.");
  });
});

describe("diagrams", () => {
  const dim = (mean: number) => ({ mean }) as never;
  const stats = {
    dimensions: { structural: dim(3.1), relational: dim(4.6), cognitive: dim(4.4), efficacy: dim(4.5) },
    // order: structural, relational, cognitive, efficacy
    partial: [[1, 0.43, 0.05, -0.05], [0.43, 1, 0.41, 0.3], [0.05, 0.41, 1, 0.08], [-0.05, 0.3, 0.08, 1]],
  };

  it("size the bubbles by the average, mark the lowest as the focus, and draw weak ties faint", () => {
    const { bubbles, ties, focus } = cultureBubbles(stats);
    expect(focus).toBe("structural");
    expect(bubbles.filter((b) => b.focus).map((b) => b.dimension)).toEqual(["structural"]);
    const r = Object.fromEntries(bubbles.map((b) => [b.dimension, b.r]));
    expect(r.relational).toBeGreaterThan(r.structural);
    expect(ties).toHaveLength(6);
    const t = (a: string, b: string) => ties.find((x) => x.a === a && x.b === b)!;
    expect(t("structural", "relational").weak).toBe(false);
    expect(t("structural", "relational").width).toBeGreaterThan(t("relational", "efficacy").width);
    expect(t("structural", "cognitive").weak).toBe(true);
    expect(t("structural", "cognitive").width).toBe(1.2);
  });

  it("draw one arc per connected pair of departments, thicker for more pairs, and none for departments with no pair", () => {
    const people = [...Array.from({ length: 5 }, (_, i) => ({ id: `A${i}`, name: "a", dept: "Arts" })), ...Array.from({ length: 5 }, (_, i) => ({ id: `B${i}`, name: "b", dept: "Math" })), ...Array.from({ length: 5 }, (_, i) => ({ id: `C${i}`, name: "c", dept: "ELA" }))];
    const pair = (a: string, b: string) => ({ id: a + b, a, b, domain: null, tag: null });
    const m = departmentMatrix({ people, pairs: [pair("A0", "B0"), pair("A1", "B1"), pair("A2", "B2"), pair("B3", "C0"), pair("A3", "A4")] });
    const { dots, arcs } = flowArcs(m);
    expect(dots.map((d) => d.dept)).toEqual(["Arts", "ELA", "Math"]);
    expect(dots.find((d) => d.dept === "Arts")!.within).toBe(1);
    expect(arcs.map((a) => `${a.a}-${a.b}:${a.count}`)).toEqual(["Arts-Math:3", "ELA-Math:1"]);
    expect(arcs[0].width).toBeGreaterThan(arcs[1].width);
  });

  it("split pairs into on track and needing a nudge without naming any pair", () => {
    expect(pairingSplit(30, 5, 19)).toEqual({ active: 25, nudge: 5, crossing: 19, inside: 11 });
    expect(pairingSplit(30, null, 19).active).toBe(30);
    expect(pairingSplit(4, 9, 1).active).toBe(0);
  });
});

describe("weekly activity and group summaries", () => {
  it("build the weekly grid, hide small cells even if the database let one through, and label weeks", () => {
    const w = buildWeekly({ months: [], heat: [], weeks: [{ week: "2026-03-09", n: 12 }, { week: "2026-03-02", n: 3 }], heat_weeks: [{ department: "Math", week: "2026-03-02", n: 2 }, { department: "Math", week: "2026-03-09", n: 7 }] })!;
    expect(w.weeks).toEqual(["2026-03-02", "2026-03-09"]);
    expect(w.totals.map((t) => t.n)).toEqual([null, 12]);
    expect(w.cell("Math", "2026-03-02")).toBeNull();
    expect(w.cell("Math", "2026-03-09")).toBe(7);
    expect(weekLabel("2026-03-09")).toBe("Mar 9");
    expect(buildWeekly({ months: [], heat: [] })).toBeNull();
  });

  const people = [...Array.from({ length: 5 }, (_, i) => ({ id: `A${i}`, name: "a", dept: "Arts" })), ...Array.from({ length: 5 }, (_, i) => ({ id: `B${i}`, name: "b", dept: "Math" })), ...Array.from({ length: 5 }, (_, i) => ({ id: `C${i}`, name: "c", dept: "ELA" })), { id: "P0", name: "p", dept: "PE" }];
  const pr = (a: string, b: string) => ({ id: a + b, a, b, domain: null, tag: null });
  const snap = { people, pairs: [pr("A0", "B0"), pr("A1", "B1"), pr("A2", "A3"), pr("B2", "C0")] };

  it("summarise a department with counts only, and give a department under 5 no summary", () => {
    const m = departmentMatrix(snap);
    const s = groupSummaries(snap, m, { pairs: 4, with_conversation: 3, with_debrief: 0, complete: 0, teachers: 16, active_teachers: 8, by_department: [{ department: "Arts", teachers: 5, active: 4 }] }, null);
    expect(Object.keys(s).sort()).toEqual(["ELA", "Arts", "Math"].sort());
    expect(s.PE).toBeUndefined();
    expect(s.Arts).toMatchObject({ teachers: 5, pairs: 3, within: 1, across: 2, activePct: 80 });
    expect(s.Arts.connected).toEqual([{ dept: "Math", count: 2 }]);
    expect(s.Arts.notConnected).toEqual(["ELA"]);
    expect(s.Math.connected.map((c) => c.dept)).toEqual(["Arts", "ELA"]);
  });
});

describe("faculty orbit", () => {
  const dept = (d: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${d}${i}`, name: d, dept: d }));
  const people = [...dept("Arts", 5), ...dept("ELA", 5), ...dept("Math", 6), ...dept("Sci", 5), ...dept("PE", 3)];
  const pr = (a: string, b: string) => ({ id: a + b, a, b, domain: null, tag: null });
  const now = { school: { name: "s", priority: null }, cycle: null, cycles: [], people, pairs: [pr("Math0", "ELA0"), pr("Math1", "Sci0"), pr("Math2", "Arts0"), pr("Math3", "Math4"), pr("ELA1", "ELA2")], requests: [], conversations: null, scan: null } as never;
  const before = { ...(now as object), pairs: [pr("Math0", "ELA0"), pr("Math3", "Math4")] } as never;
  const part = { pairs: 5, with_conversation: 5, with_debrief: 0, complete: 0, teachers: 24, active_teachers: 12, by_department: [{ department: "Arts", teachers: 5, active: 1 }, { department: "ELA", teachers: 5, active: 4 }, { department: "Math", teachers: 6, active: 6 }, { department: "Sci", teachers: 5, active: 3 }] };
  const o = facultyOrbit(now, part, before);

  it("make a planet for each department of 5 or more and none for a smaller one", () => {
    expect(o.planets.map((p) => p.dept).sort()).toEqual(["Arts", "ELA", "Math", "Sci"]);
  });

  it("work out each lens, with Math the hub and Arts furthest out on participation", () => {
    const by = Object.fromEntries(o.planets.map((p) => [p.dept, p]));
    expect(by.Math.reach).toBe(3);
    expect(by.Math.values.connections).toBe(1);
    expect(by.Arts.values.participation).toBeCloseTo(0.2);
    expect(by.Math.values.mix).toBeCloseTo(0.75);
    expect(by.Arts.notes.participation).toBe("20% talked");
    expect(farness(by.Math.values.connections)).toBe(0);
    expect(farness(null)).toBe(1);
  });

  it("offer the growth lens only when there is an earlier cycle, and show who gained", () => {
    expect(o.lenses).toContain("growth");
    const none = facultyOrbit(now, part, null);
    expect(none.lenses).not.toContain("growth");
    expect(o.planets.find((p) => p.dept === "Math")!.growth).toBe(2);
  });

  it("say where to head in plain words for each lens", () => {
    const conn = orbitDirections(o.planets, "connections");
    expect(conn[0].title).toBe("Bring Arts closer");
    expect(conn[0].detail).toContain("ELA");
    expect(conn.some((d) => d.title === "Learn from Math")).toBe(true);
    expect(orbitDirections(o.planets, "participation")[0].title).toBe("Check in with Arts");
    expect(orbitDirections(o.planets, "growth").some((d) => d.title === "Math grew the most")).toBe(true);
  });
});
