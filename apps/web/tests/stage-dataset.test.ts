import { describe, expect, it } from "vitest";
import { buildStageTables, STAGE_CHARACTERS, STAGE_DRAFT_SEED } from "@/lib/preview/stageTables";
import { departmentMatrix, crossCount, gaps } from "@/lib/admin/network";
import { orientPairs, randomizePairs, seededRandom } from "@/lib/pairing/randomize";

const t = buildStageTables();
const nm = (p: { first_name?: unknown; last_name?: unknown }) => [p.first_name, p.last_name].filter(Boolean).join(" ");
const teachers = t.profiles.filter((p) => p.role === "teacher");
const name = (id: unknown) => nm(t.profiles.find((x) => x.id === id)!);
const people = teachers.map((p) => ({ id: String(p.id), name: name(p.id), dept: String(p.department) }));
const pairsOf = (rows = t.pairings) => rows.map((p) => ({ id: String(p.id), a: String(p.host_id), b: String(p.visitor_id), domain: null, tag: null }));

describe("the stage dataset", () => {
  it("is a small faculty where every department clears the privacy floor", () => {
    expect(teachers).toHaveLength(32);
    const m = departmentMatrix({ people, pairs: pairsOf() });
    expect(m.omitted).toEqual([]);
    expect(m.depts).toEqual(["Arts", "English", "History", "Math", "Science"]);
    expect(t.schools[0].faculty_headcount).toBe(32);
  });

  it("has no pair at all between English and Science, the biggest gap in the school", () => {
    const m = departmentMatrix({ people, pairs: pairsOf() });
    expect(gaps(m)[0]).toEqual({ a: "English", b: "Science" });
    expect(crossCount(m, "English", "Science")).toBe(0);
    // The two biggest departments, so no other missing link outweighs it.
    expect(m.size.English + m.size.Science).toBeGreaterThan(Math.max(...gaps(m).slice(1).map((g) => m.size[g.a] + m.size[g.b])));
  });

  it("leaves four English and four Science teachers without a partner, and casts them from those", () => {
    const paired = new Set(t.pairings.flatMap((p) => [p.host_id, p.visitor_id]));
    const pool = teachers.filter((p) => !paired.has(p.id));
    expect(pool.filter((p) => p.department === "English")).toHaveLength(4);
    expect(pool.filter((p) => p.department === "Science")).toHaveLength(4);
    expect(pool.map((p) => nm(p))).toEqual(expect.arrayContaining([STAGE_CHARACTERS.first, STAGE_CHARACTERS.second]));
    expect(teachers.filter((p) => p.auth_user_id).map((p) => nm(p)).sort()).toEqual([STAGE_CHARACTERS.first, STAGE_CHARACTERS.second].sort());
  });

  it("opens with a draft that pairs the two characters and crosses every pair, and so does the next one", () => {
    const paired = new Set(t.pairings.flatMap((p) => [p.host_id, p.visitor_id]));
    // The pairing screen draws its pool from the snapshot, which is ordered by last name (plain string order, as the query does it).
    const pool = teachers.filter((p) => !paired.has(p.id)).sort((a, b) => (String(a.last_name) < String(b.last_name) ? -1 : String(a.last_name) > String(b.last_name) ? 1 : 0));
    for (const seed of [STAGE_DRAFT_SEED, STAGE_DRAFT_SEED + 1]) {
      const { pairs } = randomizePairs({ teachers: pool.map((p) => ({ id: String(p.id), department: String(p.department), gradeLevel: null })), exclusions: [], pastPairs: [], random: seededRandom(seed) });
      const draft = orientPairs(pairs, new Map(), seededRandom(seed + 1));
      expect(draft).toHaveLength(4);
      expect(draft.every((d) => d.host.department !== d.visitor.department)).toBe(true);
      expect(draft.some((d) => [name(d.host.id), name(d.visitor.id)].sort().join() === [STAGE_CHARACTERS.first, STAGE_CHARACTERS.second].sort().join())).toBe(true);
    }
    // Approving the first draft closes the English and Science gap.
    const { pairs } = randomizePairs({ teachers: pool.map((p) => ({ id: String(p.id), department: String(p.department), gradeLevel: null })), exclusions: [], pastPairs: [], random: seededRandom(STAGE_DRAFT_SEED) });
    const draft = orientPairs(pairs, new Map(), seededRandom(STAGE_DRAFT_SEED + 1));
    const after = departmentMatrix({ people, pairs: [...pairsOf(), ...pairsOf(draft.map((d, i) => ({ id: `d${i}`, host_id: d.host.id, visitor_id: d.visitor.id }) as never))] });
    expect(crossCount(after, "English", "Science")).toBe(4);
    expect(gaps(after).some((g) => g.a === "English" && g.b === "Science")).toBe(false);
  });

  it("tells a school one year into Mentorful: collective efficacy near 85% of 6, structural still the lowest", () => {
    const dim = new Map(t.survey_items.map((i) => [String(i.id), String(i.dimension)]));
    const mean = (d: string) => {
      const v = t.survey_responses.filter((r) => dim.get(String(r.item_id)) === d).map((r) => Number(r.scored_value));
      return v.reduce((a, b) => a + b, 0) / v.length;
    };
    expect(mean("efficacy") / 6).toBeGreaterThan(0.84);
    expect(mean("efficacy") / 6).toBeLessThan(0.87);
    const others = ["relational", "cognitive", "efficacy"].map(mean);
    expect(mean("structural")).toBeLessThan(Math.min(...others) - 0.8);
    expect(new Set(t.survey_responses.map((r) => r.respondent)).size).toBe(32);
  });

  it("has nine logged conversations, one per pair at most, all submitted", () => {
    expect(t.conversation_logs).toHaveLength(9);
    expect(t.conversation_logs.every((l) => l.status === "submitted")).toBe(true);
  });
});
