import { describe, expect, it } from "vitest";
import { MAX_NOTE, SAMPLE_NOTE, imageProblem, tidy } from "@/lib/teacher/scan";

const tiny = "data:image/jpeg;base64," + Buffer.from("hello photo").toString("base64");

describe("scan notes", () => {
  it("accepts a photo as a data URL and refuses anything else", () => {
    expect(imageProblem(tiny)).toBeNull();
    expect(imageProblem("data:text/html;base64,PGI+")).toMatch(/photo/);
    expect(imageProblem("https://example.com/a.jpg")).toMatch(/photo/);
    expect(imageProblem("")).toMatch(/photo/);
  });

  it("refuses a photo over 6 MB", () => {
    const big = "data:image/png;base64," + "A".repeat(8_400_000);
    expect(imageProblem(big)).toMatch(/too large/);
  });

  it("tidies spacing and keeps a reading inside one entry's limit, cutting at a word", () => {
    expect(tidy("  one   two \n\n  three  ")).toBe("one two\nthree");
    const long = "word ".repeat(400);
    const out = tidy(long);
    expect(out.length).toBeLessThanOrEqual(MAX_NOTE);
    expect(out.endsWith("word")).toBe(true);
  });

  it("has a prepared sample that fits as a note", () => {
    expect(SAMPLE_NOTE.length).toBeGreaterThan(100);
    expect(SAMPLE_NOTE.length).toBeLessThan(MAX_NOTE);
    expect(tidy(SAMPLE_NOTE)).toBe(SAMPLE_NOTE);
  });
});
