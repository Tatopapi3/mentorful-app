import { describe, expect, it } from "vitest";
import {
  MODULES, addDays, clip, dayLabel, deliveryOptions, formatDuration, moduleStatuses, noteState, practiceTotals, suggestionsFrom, timeTotals, weekBars, withheld,
  type GameSession, type GrowthEntry,
} from "@/lib/teacher/hub";
import type { Entry } from "@/lib/teacher/model";

const session = (o: Partial<GameSession> & { module: string }): GameSession => ({ id: Math.random().toString(36), pairing_id: "p1", logged_by: "me", minutes: null, completed: false, note: null, created_at: "2026-10-20T10:00:00Z", ...o });
const entry = (o: Partial<Entry> & { id: string }): Entry => ({
  pairingId: "p1", partnerName: "Daniel Okafor", partnerFirst: "Daniel", direction: "visitsMe", domain: "CLASSROOM", domainLabel: "Classroom Culture", status: "submitted",
  at: "2026-10-17T15:00:00Z", createdAt: "2026-10-17T15:00:00Z", submittedAt: "2026-10-17T15:05:00Z", vision: null, strength: null, more: null, less: null, resources: null, mine: false, ...o,
});

describe("games hub", () => {
  it("has the six modules from Bertrand's catalogue", () => {
    expect(MODULES.map((m) => m.name)).toEqual(["Trust Calibration Matrix", "Domain Mapping Dominoes", "PLC Navigator", "Fishbowl Protocol", "Efficacy Quest", "Feedback Reframing Relay"]);
  });
  it("derives status from sessions, never from a stored percentage", () => {
    const rows = moduleStatuses(
      [session({ module: "PLC Navigator", minutes: 25 }), session({ module: "PLC Navigator", minutes: 20, completed: true }), session({ module: "Efficacy Quest" }), session({ module: "Fishbowl Protocol", pairing_id: "other" })],
      "p1",
    );
    const by = Object.fromEntries(rows.map((r) => [r.module.name, r]));
    expect(by["PLC Navigator"]).toMatchObject({ state: "done", sessions: 2, minutes: 45 });
    expect(by["Efficacy Quest"]).toMatchObject({ state: "started", sessions: 1 });
    expect(by["Fishbowl Protocol"]).toMatchObject({ state: "new", sessions: 0 });
  });
});

describe("suggestions", () => {
  it("clips to a readable first sentence", () => {
    expect(clip("Turn-and-talk before the whole-group share. Students arrived with something formed.")).toBe("Turn-and-talk before the whole-group share");
    expect(clip("a".repeat(300), 50).length).toBeLessThanOrEqual(50);
    expect(clip("  spaced   out  words ")).toBe("spaced out words");
  });
  it("draws only from what a colleague wrote about me, what I wrote about them, and what we agreed to swap", () => {
    const list = suggestionsFrom([
      entry({ id: "a", more: "Write the objective where students can see it.", less: "Multi-step verbal directions during transitions.", resources: "I will share the checkpoint slide." }),
      entry({ id: "b", direction: "iVisit", mine: true, strength: "Her cold-call is genuinely warm.", more: "Something I wrote about their room (not a suggestion for me)." }),
    ]);
    const focuses = list.map((s) => s.focus);
    expect(focuses).toContain("Write the objective where students can see it");
    expect(focuses).toContain("Less of: Multi-step verbal directions during transitions");
    expect(focuses).toContain("Borrow from Daniel: Her cold-call is genuinely warm");
    expect(focuses).toContain("Follow through: I will share the checkpoint slide");
    expect(focuses.join("|")).not.toMatch(/not a suggestion/);
    expect(list.every((s) => s.why.length > 0 && s.module.length > 0)).toBe(true);
  });
  it("ignores drafts, de-duplicates, and respects the limit", () => {
    const list = suggestionsFrom([
      entry({ id: "d", status: "draft", more: "A draft thought." }),
      entry({ id: "a", more: "Same idea." }),
      entry({ id: "b", more: "Same idea." }),
      ...Array.from({ length: 10 }, (_, i) => entry({ id: `x${i}`, more: `Idea number ${i}.` })),
    ], 4);
    expect(list).toHaveLength(4);
    expect(new Set(list.map((s) => s.focus)).size).toBe(4);
    expect(list.map((s) => s.focus)).not.toContain("A draft thought");
  });
  it("points each suggestion at a module that suits its area", () => {
    expect(suggestionsFrom([entry({ id: "a", domain: "ASSESSMENT", more: "Score one rubric row live." })])[0].module).toBe("Feedback Reframing Relay");
  });
});

describe("time on the platform", () => {
  it("words durations plainly", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(40)).toBe("under a minute");
    expect(formatDuration(45 * 60)).toBe("45m");
    expect(formatDuration(2 * 3600 + 5 * 60)).toBe("2h 05m");
  });
  it("does date arithmetic on calendar days", () => {
    expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(dayLabel("2026-12-19")).toBe("Dec 19");
  });
  it("shows the last seven days, oldest first, with gaps as zero", () => {
    const bars = weekBars([{ day: "2026-10-28", seconds: 600 }, { day: "2026-10-26", seconds: 1200 }, { day: "2026-10-01", seconds: 99999 }], "2026-10-28");
    expect(bars).toHaveLength(7);
    expect(bars[0].day).toBe("2026-10-22");
    expect(bars[6]).toMatchObject({ day: "2026-10-28", seconds: 600, today: true });
    expect(bars[4].seconds).toBe(1200);
    expect(bars.reduce((n, b) => n + b.seconds, 0)).toBe(1800);
  });
  it("totals today, the week and the month, counting a day as active from one minute", () => {
    const t = timeTotals([{ day: "2026-10-28", seconds: 600 }, { day: "2026-10-23", seconds: 30 }, { day: "2026-10-10", seconds: 3600 }, { day: "2026-08-01", seconds: 7200 }], "2026-10-28");
    expect(t.today).toBe(600);
    expect(t.week).toBe(630);
    expect(t.month).toBe(4230);
    expect(t.daysActive).toBe(2);
  });
});

describe("notes to future self", () => {
  it("is sealed until its day, arrived on it, opened once read, and kept when it has no date", () => {
    expect(noteState({ open_on: "2026-12-19", opened_at: null }, "2026-10-28")).toBe("sealed");
    expect(noteState({ open_on: "2026-10-28", opened_at: null }, "2026-10-28")).toBe("arrived");
    expect(noteState({ open_on: "2026-10-01", opened_at: null }, "2026-10-28")).toBe("arrived");
    expect(noteState({ open_on: "2026-10-01", opened_at: "2026-10-02T10:00:00Z" }, "2026-10-28")).toBe("opened");
    expect(noteState({ open_on: null, opened_at: null }, "2026-10-28")).toBe("kept");
  });
  it("keeps the words of a sealed note off the page", () => {
    const n = { id: "1", body: "secret", open_on: "2026-12-19", opened_at: null, created_at: "x" };
    expect(withheld(n, "sealed").body).toBeNull();
    expect(withheld(n, "arrived").body).toBe("secret");
  });
  it("offers delivery dates, including the end of the cycle only when it is far enough away", () => {
    expect(deliveryOptions("2026-10-28", "2026-12-19T00:00:00Z").map((o) => [o.key, o.date])).toEqual([["week", "2026-11-04"], ["month", "2026-11-27"], ["cycle", "2026-12-19"], ["keep", null]]);
    expect(deliveryOptions("2026-12-15", "2026-12-19T00:00:00Z").map((o) => o.key)).toEqual(["week", "month", "keep"]);
    expect(deliveryOptions("2026-10-28", null).map((o) => o.key)).toEqual(["week", "month", "keep"]);
  });
});

describe("practice log", () => {
  it("totals the last thirty days only", () => {
    const e = (created_at: string, minutes: number | null): GrowthEntry => ({ id: created_at, goal_id: null, kind: "practice", minutes, body: "x", created_at });
    const t = practiceTotals([e("2026-10-20T10:00:00Z", 15), e("2026-10-01T10:00:00Z", null), e("2026-08-01T10:00:00Z", 60)], new Date("2026-10-28T12:00:00Z"));
    expect(t).toEqual({ entries: 2, minutes: 15 });
  });
});
