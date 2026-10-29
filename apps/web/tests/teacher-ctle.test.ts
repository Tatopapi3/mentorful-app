import { describe, expect, it } from "vitest";
import { DEFAULTS, ctleProgress, dateLabel, entryProblem, hoursLabel, isDay, paceSentence, periodEnd, settingsProblem, type CtleEntry, type CtleSettings } from "@/lib/teacher/ctle";

const S: CtleSettings = { period_start: "2024-09-01", period_years: DEFAULTS.periodYears, required_hours: DEFAULTS.requiredHours, language_pct: DEFAULTS.languagePct };
const e = (o: Partial<CtleEntry>): CtleEntry => ({ id: Math.random().toString(36), taken_on: "2025-01-10", hours: 1, title: "Workshop", sponsor: "District", language: false, approved: true, certificate: true, voided_at: null, ...o });

describe("the registration period", () => {
  it("runs five years and ends the day before the anniversary", () => {
    expect(periodEnd("2024-09-01", 5)).toBe("2029-09-01");
    expect(ctleProgress([], S, "2026-10-29").periodEnd).toBe("2029-08-31");
  });
  it("accepts only real calendar days", () => {
    expect(isDay("2026-02-28")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("10/29/2026")).toBe(false);
  });
});

it("labels a day with its year", () => {
  expect(dateLabel("2024-09-01")).toBe("Sep 1, 2024");
});

describe("counting hours", () => {
  it("counts only approved-sponsor hours toward the total", () => {
    const p = ctleProgress([e({ hours: 6 }), e({ hours: 3, approved: false })], S, "2026-10-29");
    expect(p.counted).toBe(6);
    expect(p.personal).toBe(3);
  });
  it("counts language hours inside the total, not on top of it", () => {
    const p = ctleProgress([e({ hours: 10, language: true }), e({ hours: 5 })], S, "2026-10-29");
    expect(p.counted).toBe(15);
    expect(p.language).toBe(10);
    expect(p.languageRequired).toBe(15);
    expect(p.languageRemaining).toBe(5);
  });
  it("ignores removed entries and entries outside the period", () => {
    const p = ctleProgress([e({ hours: 4, voided_at: "2026-01-01T00:00:00Z" }), e({ hours: 4, taken_on: "2024-08-31" }), e({ hours: 4, taken_on: "2029-09-01" }), e({ hours: 2 })], S, "2026-10-29");
    expect(p.counted).toBe(2);
  });
  it("adds quarter hours without float dust", () => {
    const p = ctleProgress([e({ hours: 0.25 }), e({ hours: 0.5 }), e({ hours: 0.75 })], S, "2026-10-29");
    expect(p.counted).toBe(1.5);
    expect(hoursLabel(p.counted)).toBe("1.5");
  });
});

describe("pace", () => {
  // 2026-10-29 is 788 of 1826 days in: about 43% of the period, so 43 of 100 hours is "even".
  it("is behind when under the even pace", () => {
    expect(ctleProgress([e({ hours: 20 })], S, "2026-10-29").pace).toBe("behind");
  });
  it("is on pace at or above the even pace, language included", () => {
    const ok = ctleProgress([e({ hours: 38 }), e({ hours: 8, language: true })], S, "2026-10-29");
    expect(ok.counted).toBe(46);
    expect(ok.pace).toBe("on-pace");
    const noLang = ctleProgress([e({ hours: 60 })], S, "2026-10-29");
    expect(noLang.pace).toBe("behind");
  });
  it("is complete only when both the total and the language share are met", () => {
    expect(ctleProgress([e({ hours: 100 })], S, "2026-10-29").pace).toBe("behind");
    expect(ctleProgress([e({ hours: 85 }), e({ hours: 15, language: true })], S, "2026-10-29").pace).toBe("complete");
  });
  it("is at the start of the period with nothing expected yet", () => {
    const p = ctleProgress([], S, "2024-09-01");
    expect(p.elapsed).toBe(0);
    expect(p.pace).toBe("on-pace");
  });
  it("is behind at the very end if anything is missing", () => {
    const p = ctleProgress([e({ hours: 99, taken_on: "2029-01-01" })], S, "2029-09-01");
    expect(p.daysLeft).toBe(0);
    expect(p.pace).toBe("behind");
    expect(paceSentence(p)).toMatch(/period has ended/);
  });
  it("respects other requirements, like 75 hours", () => {
    const p = ctleProgress([e({ hours: 75 })], { ...S, required_hours: 75, language_pct: 0 }, "2026-10-29");
    expect(p.pace).toBe("complete");
  });
  it("says what an even pace asks of the rest of the period", () => {
    const p = ctleProgress([e({ hours: 50 })], S, "2026-10-29");
    expect(p.perMonth).toBeGreaterThan(0);
    expect(paceSentence(p)).toMatch(/hours to go/);
    expect(ctleProgress([e({ hours: 85 }), e({ hours: 15, language: true })], S, "2026-10-29").perMonth).toBeNull();
  });
});

describe("what a teacher can type", () => {
  const today = "2026-10-29";
  it("accepts a normal entry", () => {
    expect(entryProblem({ taken_on: "2026-10-01", hours: 1.5, title: "Culturally responsive teaching" }, today)).toBeNull();
  });
  it("refuses blank titles, future dates, too small, too large and odd fractions", () => {
    expect(entryProblem({ taken_on: "2026-10-01", hours: 1, title: "  " }, today)).toMatch(/what the course/);
    expect(entryProblem({ taken_on: "2026-11-01", hours: 1, title: "x" }, today)).toMatch(/hasn't happened/);
    expect(entryProblem({ taken_on: "2026-10-01", hours: 0.1, title: "x" }, today)).toMatch(/quarter hour/);
    expect(entryProblem({ taken_on: "2026-10-01", hours: 101, title: "x" }, today)).toMatch(/more than 100/);
    expect(entryProblem({ taken_on: "2026-10-01", hours: 1.3, title: "x" }, today)).toMatch(/quarter hours/);
    expect(entryProblem({ taken_on: "nope", hours: 1, title: "x" }, today)).toMatch(/date/);
  });
  it("checks the settings", () => {
    expect(settingsProblem(S, today)).toBeNull();
    expect(settingsProblem({ ...S, period_years: 6 }, today)).toMatch(/1 to 5/);
    expect(settingsProblem({ ...S, required_hours: 0 }, today)).toMatch(/between 1 and 300/);
    expect(settingsProblem({ ...S, language_pct: 120 }, today)).toMatch(/0 to 100/);
    expect(settingsProblem({ ...S, period_start: "x" }, today)).toMatch(/started/);
  });
});
