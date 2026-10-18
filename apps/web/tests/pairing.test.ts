import { describe, expect, it } from "vitest";
import { orientPairs, randomizePairs, seededRandom, type PoolTeacher } from "@/lib/pairing/randomize";

function t(id: string, department: string | null = null, gradeLevel: string | null = null): PoolTeacher {
  return { id, department, gradeLevel };
}

const ids = (pair: [PoolTeacher, PoolTeacher]) => [pair[0].id, pair[1].id].sort().join("+");

describe("randomizePairs", () => {
  it("pairs everyone exactly once when the count is even", () => {
    const teachers = Array.from({ length: 10 }, (_, i) => t(`t${i}`, `d${i % 3}`));
    const { pairs, unpaired } = randomizePairs({
      teachers,
      exclusions: [],
      pastPairs: [],
      random: seededRandom(1),
    });
    expect(pairs).toHaveLength(5);
    expect(unpaired).toHaveLength(0);
    const seen = pairs.flatMap(([a, b]) => [a.id, b.id]);
    expect(new Set(seen).size).toBe(10);
  });

  it("mixes departments whenever it can", () => {
    const teachers = [t("m1", "Math"), t("m2", "Math"), t("e1", "ELA"), t("e2", "ELA")];
    for (let seed = 0; seed < 20; seed++) {
      const { pairs } = randomizePairs({
        teachers,
        exclusions: [],
        pastPairs: [],
        random: seededRandom(seed),
      });
      for (const [a, b] of pairs) expect(a.department).not.toBe(b.department);
    }
  });

  it("never creates an excluded pair, even when it's the cheapest", () => {
    const teachers = [t("a", "Math"), t("b", "ELA"), t("c", "Math"), t("d", "Math")];
    for (let seed = 0; seed < 20; seed++) {
      const { pairs } = randomizePairs({
        teachers,
        exclusions: [["b", "a"]],
        pastPairs: [],
        random: seededRandom(seed),
      });
      expect(pairs.map(ids)).not.toContain("a+b");
    }
  });

  it("flags the odd one out instead of forcing a pair", () => {
    const { pairs, unpaired } = randomizePairs({
      teachers: [t("a"), t("b"), t("c")],
      exclusions: [],
      pastPairs: [],
      random: seededRandom(3),
    });
    expect(pairs).toHaveLength(1);
    expect(unpaired).toHaveLength(1);
    expect(unpaired[0].reason).toBe("odd_count");
  });

  it("flags a teacher whose every possible partner is excluded", () => {
    const { pairs, unpaired } = randomizePairs({
      teachers: [t("a"), t("b"), t("c")],
      exclusions: [
        ["a", "b"],
        ["a", "c"],
      ],
      pastPairs: [],
      random: seededRandom(5),
    });
    expect(pairs.map(ids)).toEqual(["b+c"]);
    expect(unpaired).toEqual([{ teacher: t("a"), reason: "no_valid_partner" }]);
  });

  it("avoids repeating a past partner when another option is equally mixed", () => {
    const teachers = [t("a", "Math"), t("b", "ELA"), t("c", "Math"), t("d", "ELA")];
    for (let seed = 0; seed < 20; seed++) {
      const { pairs } = randomizePairs({
        teachers,
        exclusions: [],
        pastPairs: [
          ["a", "b"],
          ["c", "d"],
        ],
        random: seededRandom(seed),
      });
      expect(pairs.map(ids).sort()).toEqual(["a+d", "b+c"]);
    }
  });

  it("is reproducible for the same seed", () => {
    const teachers = Array.from({ length: 12 }, (_, i) => t(`t${i}`, `d${i % 4}`, `g${i % 3}`));
    const run = (seed: number) =>
      randomizePairs({ teachers, exclusions: [], pastPairs: [], random: seededRandom(seed) })
        .pairs.map(ids)
        .sort();
    expect(run(42)).toEqual(run(42));
  });
});

describe("orientPairs", () => {
  const a = t("a", "Math");
  const b = t("b", "ELA");

  it("lets whoever has hosted less host this time", () => {
    const [p] = orientPairs([[a, b]], new Map([["a", 3], ["b", 1]]), seededRandom(1));
    expect(p.host.id).toBe("b");
    expect(p.visitor.id).toBe("a");
    const [q] = orientPairs([[a, b]], new Map([["a", 0], ["b", 2]]), seededRandom(1));
    expect(q.host.id).toBe("a");
  });

  it("never loses or duplicates anyone, and is reproducible for the same seed", () => {
    const teachers = Array.from({ length: 12 }, (_, i) => t(`t${i}`, `d${i % 4}`));
    const { pairs } = randomizePairs({ teachers, exclusions: [], pastPairs: [], random: seededRandom(9) });
    const run = () => orientPairs(pairs, new Map(), seededRandom(9)).map((p) => `${p.host.id}>${p.visitor.id}`);
    expect(run()).toEqual(run());
    const people = run().flatMap((x) => x.split(">"));
    expect(new Set(people).size).toBe(12);
  });

  it("splits hosting roughly evenly over many rounds when ties are broken at random", () => {
    const rand = seededRandom(5);
    let hosted = new Map<string, number>();
    for (let round = 0; round < 40; round++) {
      const next = new Map(hosted);
      for (const p of orientPairs([[a, b]], hosted, rand)) next.set(p.host.id, (next.get(p.host.id) ?? 0) + 1);
      hosted = next;
    }
    expect(Math.abs((hosted.get("a") ?? 0) - (hosted.get("b") ?? 0))).toBeLessThanOrEqual(1);
  });
});
