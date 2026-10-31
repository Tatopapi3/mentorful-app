import { describe, expect, it } from "vitest";
import { packJournal, unpackJournal } from "@/lib/preview/journal";
import type { Write } from "@/lib/preview/mockQuery";

const row = (i: number) => ({ id: `new-${i}abc123`, school_id: "a0000000-0000-0000-0000-000000000001", cycle_id: "16ddcc27-4ccf-5879-8ede-2d13f22376a1", host_id: `4${i}b6b7ad-e241-54bc-bae6-041e34ea308e`, visitor_id: `5${i}d6fb4-072a-59d0-95db-fe955f995f4a`, status: "approved", requested_by: null, approved_by: null, approved_at: "2026-10-31T16:00:00.000Z", created_at: "2026-10-31T16:00:00.000Z", domain: "PLANNING" });

describe("the demo's changes cookie", () => {
  const round: Write[] = [{ t: "i", table: "pairings", rows: [1, 2, 3, 4, 5, 6, 7, 8].map(row) }];

  it("round-trips what was written", () => {
    expect(unpackJournal(packJournal(round))).toEqual(round);
  });

  it("holds a round of eight pairs well under the 4 KB a browser accepts", () => {
    expect(packJournal(round).length).toBeLessThan(1500);
    // the old way, for comparison, was too big for four
    expect(encodeURIComponent(JSON.stringify(round)).length).toBeGreaterThan(4096);
  });

  it("still reads a plain cookie written before compression", () => {
    expect(unpackJournal(encodeURIComponent(JSON.stringify(round)))).toEqual(round);
  });

  it("reads nothing from a cookie it cannot understand", () => {
    expect(() => unpackJournal("z.not-a-journal")).toThrow();
  });
});
