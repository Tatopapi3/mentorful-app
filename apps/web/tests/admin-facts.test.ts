import { describe, expect, it } from "vitest";
import { buildActions } from "@/lib/admin/actions";
import { buildFacts, departmentConnections, headlineSentence, type AdminSnapshot } from "@/lib/admin/facts";

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
  cycle: { name: "Fall", status: "active" },
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
    for (const a of buildActions(buildFacts(withData), "/admin")) expect(a.href).toMatch(/^\/admin\/(constellation|insights)$/);
    for (const a of buildActions(buildFacts(withData), "/admin/aurora")) expect(a.href).toMatch(/^\/admin\/aurora\/(constellation|insights)$/);
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
