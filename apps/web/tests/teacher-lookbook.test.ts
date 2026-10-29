import { describe, expect, it } from "vitest";
import { LIMITS, NO_FILTERS, WANTS, cardFromRow, facetCounts, filterCards, hueFor, paginate, validateCard, type Card } from "@/lib/teacher/lookbook";

const row = (o: Record<string, unknown> = {}) => ({ profile_id: "p1", name: "Ana Alvarez", department: "Math", years_teaching: 9, strength_tags: ["Discussion Craft", "Rubric Clarity"], teaching_style: "nurturer", archetype_id: "collector", inspiration: "A coach who taught me to explain", headline: "Math teacher", bio: "Loves discussion", experience: [{ role: "Dept lead", place: "Lincoln", years: "2022–now" }], achievements: ["Teacher of the Year 2024"], growing_in: ["Wait time"], wants: ["A thinking partner"], wants_text: "Someone who will visit", updated_at: "2026-10-01T00:00:00Z", ...o });
const card = (o: Record<string, unknown> = {}): Card => cardFromRow(row(o), null);

describe("validating a card", () => {
  it("trims, caps and de-duplicates what a teacher writes", () => {
    const r = validateCard({ headline: `  ${"h".repeat(300)} `, bio: "b".repeat(900), achievements: ["Won an award", "won an AWARD", "", "  Another  "], growingIn: Array.from({ length: 12 }, (_, i) => `skill ${i}`), wants: ["A thinking partner", "Not a real option"], showGrowth: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.headline).toHaveLength(LIMITS.headline);
    expect(r.value.bio).toHaveLength(LIMITS.bio);
    expect(r.value.achievements).toEqual(["Won an award", "Another"]);
    expect(r.value.growingIn).toHaveLength(LIMITS.growingIn);
    expect(r.value.wants).toEqual(["A thinking partner"]);
    expect(r.value.showGrowth).toBe(true);
    expect(r.value.published).toBe(false);
  });
  it("is opt-in: sharing and showing 'growing in' are false unless explicitly true", () => {
    const r = validateCard({ headline: "x", published: "yes", showGrowth: 1 });
    expect(r.ok && r.value.published).toBe(false);
    expect(r.ok && r.value.showGrowth).toBe(false);
  });
  it("won't publish an empty card, but will save an empty draft", () => {
    expect(validateCard({ published: true }).ok).toBe(false);
    expect(validateCard({ published: false }).ok).toBe(true);
    expect(validateCard({ published: true, wants: [WANTS[0]] }).ok).toBe(true);
  });
  it("drops empty experience rows and caps the list", () => {
    const r = validateCard({ experience: [{ role: "", place: "" }, { role: "Coach", place: "" }, ...Array.from({ length: 9 }, (_, i) => ({ role: `r${i}`, place: "p", years: "2020" }))] });
    expect(r.ok && r.value.experience).toHaveLength(LIMITS.experience);
    expect(r.ok && r.value.experience[0].role).toBe("Coach");
  });
  it("rejects non-objects", () => {
    expect(validateCard(null).ok).toBe(false);
    expect(validateCard("x").ok).toBe(false);
  });
});

describe("building a card from a row", () => {
  it("reads strengths as domains (set membership), style and archetype labels", () => {
    const c = card();
    expect(c.domains).toEqual(["CLASSROOM", "ASSESSMENT"]);
    expect(c.style?.label).toBe("Nurturer");
    expect(c.archetype).toBe("Collector");
    expect(c.initials).toBe("AA");
  });
  it("tolerates missing and malformed fields", () => {
    const c = cardFromRow({ profile_id: "x", name: " ", strength_tags: "nope", experience: "nope", achievements: [1, "ok"] }, null);
    expect(c.name).toBe("A colleague");
    expect(c.domains).toEqual([]);
    expect(c.experience).toEqual([]);
    expect(c.achievements).toEqual(["ok"]);
  });
});

describe("browsing the lookbook", () => {
  const cards = [
    card({ profile_id: "a", name: "Ana Alvarez", department: "Math", years_teaching: 9 }),
    card({ profile_id: "b", name: "Ben Brown", department: "ELA", years_teaching: 2, strength_tags: ["Family Communication"], teaching_style: "activator", wants: ["Help with planning"], bio: "Writes with students", achievements: [] }),
    card({ profile_id: "c", name: "Cy Chen", department: "Science", years_teaching: 25, strength_tags: [], teaching_style: "architect", wants: [], headline: "Lab coordinator" }),
    card({ profile_id: "d", name: "Dee Diaz", department: "Math", years_teaching: null, strength_tags: ["Unit Architecture"], wants: ["A thinking partner", "Help with planning"] }),
  ];
  const ids = (f: Partial<typeof NO_FILTERS>) => filterCards(cards, { ...NO_FILTERS, ...f }).map((c) => c.profileId);
  it("shows everyone with no filters", () => expect(ids({})).toEqual(["a", "b", "c", "d"]));
  it("searches names, bios, achievements and roles, all terms required", () => {
    expect(ids({ q: "lab" })).toEqual(["c"]);
    expect(ids({ q: "teacher of the year" })).toEqual(["a", "c", "d"]);
    expect(ids({ q: "ben writes" })).toEqual(["b"]);
    expect(ids({ q: "nobody-matches" })).toEqual([]);
  });
  it("matches ANY option inside a facet and ALL facets together", () => {
    expect(ids({ departments: ["Math", "ELA"] })).toEqual(["a", "b", "d"]);
    expect(ids({ departments: ["Math"], wants: ["Help with planning"] })).toEqual(["d"]);
    expect(ids({ domains: ["COMMUNICATION", "PLANNING"] })).toEqual(["b", "d"]);
    expect(ids({ styles: ["Architect"] })).toEqual(["c"]);
  });
  it("filters by years of experience bands, leaving out cards with no years", () => {
    expect(ids({ bands: ["0-2"] })).toEqual(["b"]);
    expect(ids({ bands: ["6-10", "20+"] })).toEqual(["a", "c"]);
  });
  it("counts each option once per card", () => {
    const f = facetCounts(cards);
    expect(f.departments).toEqual([["ELA", 1], ["Math", 2], ["Science", 1]]);
    expect(f.wants.get("A thinking partner")).toBe(2);
    expect(f.bands.get("20+")).toBe(1);
  });
  it("pages and clamps", () => {
    const p = paginate([1, 2, 3, 4, 5], 2, 2);
    expect(p).toEqual({ page: 2, pages: 3, items: [3, 4] });
    expect(paginate([1, 2, 3], 99, 2).page).toBe(2);
    expect(paginate([], 1, 9)).toEqual({ page: 1, pages: 1, items: [] });
  });
  it("gives the same colour to the same name, inside the teal-to-violet range", () => {
    expect(hueFor("Ana Alvarez")).toBe(hueFor("Ana Alvarez"));
    for (const n of ["A", "Zed Zimmer", "Mia Chen", "Jo"]) expect(hueFor(n)).toBeGreaterThanOrEqual(165), expect(hueFor(n)).toBeLessThan(285);
  });
});
