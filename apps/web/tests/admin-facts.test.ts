import { describe, expect, it } from "vitest";
import { buildActions } from "@/lib/admin/actions";
import { buildFacts, departmentConnections, headlineSentence, type AdminSnapshot } from "@/lib/admin/facts";
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
