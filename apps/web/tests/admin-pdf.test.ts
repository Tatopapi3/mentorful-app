import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildDeck } from "@/lib/admin/deck";
import type { AdminSnapshot } from "@/lib/admin/facts";
import { clean, connectionPdf, deckPdf, summaryPdf } from "@/lib/admin/pdf";
import { summaryPdfInput } from "@/lib/admin/pdf-input";

// The same shape as the faculty connection test: Math 6 and Science 5 are drawn, Art (2) is left out, and nobody is named.
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

const today = new Date("2026-11-01T12:00:00Z");
const pages = (pdf: ArrayBuffer) => (Buffer.from(pdf).toString("latin1").match(/\/Type \/Page\b(?!s)/g) ?? []).length;
/** Everything the PDF draws, with its compressed streams opened up, so a test can look for text. */
function drawn(pdf: ArrayBuffer): string {
  const raw = Buffer.from(pdf).toString("latin1");
  const parts: string[] = [raw];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      parts.push(inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"));
    } catch {
      /* not a compressed stream */
    }
  }
  return parts.join("\n");
}

describe("the PDF downloads", () => {
  const deck = buildDeck(snap, null, today);
  const pdfs = {
    deck: deckPdf(deck),
    summary: summaryPdf(summaryPdfInput(snap, today)),
    connection: connectionPdf(snap, "November 1, 2026"),
  };

  it("are real PDF files", () => {
    for (const pdf of Object.values(pdfs)) expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("give the deck one page per slide, the summary one page and the connection one page", () => {
    expect(pages(pdfs.deck)).toBe(deck.slides.length);
    expect(pages(pdfs.summary)).toBe(1);
    expect(pages(pdfs.connection)).toBe(1);
  });
  it("name nobody", () => {
    for (const pdf of Object.values(pdfs)) {
      const text = drawn(pdf);
      expect(text).not.toMatch(/Person\d|Artist/);
    }
  });
  it("draw the departments of 5 or more teachers and leave out the small one", () => {
    const text = drawn(pdfs.connection);
    expect(text).toMatch(/Math/);
    expect(text).toMatch(/Science/);
    expect(text).not.toMatch(/\(Art\)/);
    // The note wraps over lines in the file, so look for its two halves.
    expect(text).toMatch(/1 department with fewer than 5/);
    expect(text).toMatch(/left out to protect privacy/);
  });
  it("simplify characters the built-in PDF fonts cannot print", () => {
    expect(clean("English → Science ≥ 5")).toBe("English  to  Science >= 5");
    expect(clean("Mentorful · “quoted” — dash")).toBe("Mentorful · “quoted” — dash");
    expect(clean("check ✓ ok")).toBe("check  ok");
  });
});
