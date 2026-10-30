import { describe, expect, it } from "vitest";
import { connectionCsv } from "@/lib/admin/csv";
import type { AdminSnapshot } from "@/lib/admin/facts";

// Two departments of 5+ (Math 6, Science 5) and one of 2 (Art): Art must never appear, and a pair count under 5 is withheld.
const mk = (id: string, name: string, dept: string) => ({ id, name, dept });
const people = [
  ...["m1", "m2", "m3", "m4", "m5", "m6"].map((id, i) => mk(id, `Mia Person${i}`, "Math")),
  ...["s1", "s2", "s3", "s4", "s5"].map((id, i) => mk(id, `Sam Person${i}`, "Science")),
  mk("a1", "Ana Artist", "Art"),
  mk("a2", "Al Artist", "Art"),
];
const snap: AdminSnapshot = {
  school: { name: "Sample School", priority: null },
  cycle: { id: "c1", name: "Fall", status: "active" },
  cycles: [{ id: "c1", name: "Fall", status: "active" }],
  people,
  pairs: [
    { id: "1", a: "m1", b: "s1", domain: "CLASSROOM", tag: null },
    { id: "2", a: "m2", b: "s2", domain: "CLASSROOM", tag: null },
    { id: "3", a: "m3", b: "m4", domain: "PLANNING", tag: null },
    { id: "4", a: "a1", b: "m5", domain: "PLANNING", tag: null },
  ],
  requests: [],
  conversations: 3,
  scan: null,
};

describe("the faculty connection spreadsheet", () => {
  const csv = connectionCsv(snap, null);
  const lines = csv.trim().split("\n");
  it("has one row per department of 5 or more teachers", () => {
    expect(lines[0]).toMatch(/^department,teachers,/);
    expect(lines.filter((l) => /^(Math|Science),/.test(l))).toHaveLength(2);
  });
  it("leaves out departments under 5 and says so", () => {
    expect(csv).not.toMatch(/^Art,/m);
    expect(csv).toMatch(/1 department with fewer than 5 teachers left out/);
  });
  it("names nobody", () => {
    expect(csv).not.toMatch(/Mia Person|Sam Person|Ana Artist|Al Artist/);
  });
  it("withholds a pair count under 5 instead of printing it", () => {
    const math = lines.find((l) => l.startsWith("Math,"))!;
    expect(math).toMatch(/fewer than 5/);
  });
  it("counts the department connections that exist", () => {
    expect(csv).toMatch(/department connections that exist,1/);
    expect(csv).toMatch(/department connections possible,1/);
  });
});
