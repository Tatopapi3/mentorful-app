import { describe, expect, it } from "vitest";
import { cellText, floorCell, floorCrossing, floorDepartments, floorRows, floorShare } from "@/lib/admin/overview-floor";

describe("a count under 5 is withheld", () => {
  it("withholds 0 to 4 and shows 5 and up", () => {
    expect([0, 1, 4].map(floorCell)).toEqual([null, null, null]);
    expect([5, 12].map(floorCell)).toEqual([5, 12]);
  });
  it("keeps row order and labels", () => {
    expect(floorRows([["Classroom", 9], ["Planning", 3]])).toEqual([["Classroom", 9], ["Planning", null]]);
  });
  it("gives no percentage for a withheld count", () => {
    expect(floorShare(3, 40)).toBeNull();
    expect(floorShare(10, 40)).toBe(25);
    expect(floorShare(10, 0)).toBeNull();
  });
  it("words it plainly", () => {
    expect(cellText(null, "teachers")).toBe("fewer than 5");
    expect(cellText(7, "teachers")).toBe("7 teachers");
  });
});

describe("departments", () => {
  it("lists only departments of 5 or more, largest first", () => {
    const d = floorDepartments({ Math: 8, Science: 12, Art: 2 });
    expect(d.rows).toEqual([["Science", 12], ["Math", 8]]);
  });
  it("combines small departments only when together they reach 5", () => {
    expect(floorDepartments({ Math: 9, Art: 3, Music: 2 }).combined).toEqual({ departments: 2, teachers: 5 });
    const apart = floorDepartments({ Math: 9, Art: 2, Music: 2 });
    expect(apart.combined).toBeNull();
    expect(apart.notShown).toBe(4);
  });
  it("never shows a lone small department, even alone", () => {
    const d = floorDepartments({ Math: 9, Art: 4 });
    expect(d.combined).toBeNull();
    expect(d.rows.map(([n]) => n)).toEqual(["Math"]);
    expect(d.notShown).toBe(4);
  });
  it("never names a department under 5 in any output", () => {
    const d = floorDepartments({ Math: 9, Art: 3, Music: 2 });
    expect(JSON.stringify(d)).not.toMatch(/Art|Music/);
  });
});

describe("pairs across departments", () => {
  const pair = (host: string, visitor: string) => ({ host, visitor });
  it("is shown when both sides are 5 or more", () => {
    const pairs = [...Array(6).fill(0).map(() => pair("Math", "Art")), ...Array(5).fill(0).map(() => pair("Math", "Math"))];
    expect(floorCrossing(pairs)).toEqual({ across: 6, within: 5 });
  });
  it("is withheld if either side is under 5, because one would give away the other", () => {
    const pairs = [...Array(9).fill(0).map(() => pair("Math", "Art")), ...Array(3).fill(0).map(() => pair("Math", "Math"))];
    expect(floorCrossing(pairs)).toBeNull();
    expect(floorCrossing([])).toBeNull();
  });
});
