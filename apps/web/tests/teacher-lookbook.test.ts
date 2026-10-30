import { describe, expect, it } from "vitest";
import { NO_FILTERS, activeFilters, cardFromRow, facetCounts, filterCards, hueFor, paginate } from "@/lib/teacher/lookbook";

const row = (o: Record<string, unknown> = {}) => ({ profile_id: "p1", name: "Daniel Okafor", department: "Math", strength_tags: ["Classroom Presence", "Task Design"], ...o });

describe("a lookbook card is the fixed set: name, department, strengths", () => {
  it("reads those three fields", () => {
    const c = cardFromRow(row());
    expect(c.name).toBe("Daniel Okafor");
    expect(c.initials).toBe("DO");
    expect(c.department).toBe("Math");
    expect(c.strengthTags).toEqual(["Classroom Presence", "Task Design"]);
    expect(c.domains).toEqual(["CLASSROOM", "PLANNING"]);
  });
  it("carries nothing else, even if the row did (no photo, bio, years, style, archetype, email)", () => {
    const c = cardFromRow(row({ email: "d@school.org", years_teaching: 12, bio: "x", headline: "y", photo_path: "a.jpg", archetype_id: "builder", teaching_style: "ARCHITECT", inspiration: "z", experience: [{ role: "r" }], wants: ["w"] }));
    expect(Object.keys(c).sort()).toEqual(["department", "domains", "initials", "name", "profileId", "strengthTags"]);
    expect(JSON.stringify(c)).not.toMatch(/d@school|12|photo|builder|ARCHITECT/);
  });
  it("falls back to 'A colleague' for a missing name and copes with missing fields", () => {
    const c = cardFromRow({ profile_id: "p2" });
    expect(c.name).toBe("A colleague");
    expect(c.department).toBe("");
    expect(c.strengthTags).toEqual([]);
  });
});

describe("browsing", () => {
  const cards = [
    cardFromRow(row({ profile_id: "a", name: "Ada Park", department: "Math", strength_tags: ["Classroom Presence"] })),
    cardFromRow(row({ profile_id: "b", name: "Ben Ruiz", department: "Science", strength_tags: ["Unit Architecture"] })),
    cardFromRow(row({ profile_id: "c", name: "Cy Lowe", department: "Math", strength_tags: ["Family Communication"] })),
  ];
  it("searches name, department and strengths", () => {
    expect(filterCards(cards, { ...NO_FILTERS, q: "ruiz" }).map((c) => c.profileId)).toEqual(["b"]);
    expect(filterCards(cards, { ...NO_FILTERS, q: "math" }).map((c) => c.profileId)).toEqual(["a", "c"]);
    expect(filterCards(cards, { ...NO_FILTERS, q: "architecture" }).map((c) => c.profileId)).toEqual(["b"]);
  });
  it("does not search anything that is not on the card", () => {
    expect(filterCards(cards, { ...NO_FILTERS, q: "achievement" })).toEqual([]);
  });
  it("matches ANY chosen option within a facet and ALL across facets", () => {
    expect(filterCards(cards, { ...NO_FILTERS, departments: ["Math", "Science"] })).toHaveLength(3);
    expect(filterCards(cards, { ...NO_FILTERS, departments: ["Math"], domains: ["COMMUNICATION"] }).map((c) => c.profileId)).toEqual(["c"]);
  });
  it("counts facets and active filters", () => {
    const f = facetCounts(cards);
    expect(f.departments).toEqual([["Math", 2], ["Science", 1]]);
    expect(Object.keys(f).sort()).toEqual(["departments", "domains"]);
    expect(activeFilters({ q: " ", departments: ["Math"], domains: [] })).toBe(1);
  });
  it("pages and clamps", () => {
    const p = paginate([1, 2, 3, 4, 5], 9, 2);
    expect(p).toEqual({ page: 3, pages: 3, items: [5] });
    expect(paginate([], 1, 9)).toEqual({ page: 1, pages: 1, items: [] });
  });
  it("gives a name the same colour every time, inside the Aurora range", () => {
    expect(hueFor("Ada Park")).toBe(hueFor("Ada Park"));
    for (const n of ["Ada", "Ben Ruiz", "Cy Lowe", "Zed"]) expect(hueFor(n)).toBeGreaterThanOrEqual(165), expect(hueFor(n)).toBeLessThan(285);
  });
});
