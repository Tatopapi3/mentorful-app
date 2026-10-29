import { describe, expect, it } from "vitest";
import { ctleNotEnough, notEnough, readCtle, readGrowth, type GrowthActivity } from "@/lib/admin/growth";

const full: GrowthActivity = {
  teachers: 50, window_days: 30, enough: true, contributors: 15, share_pct: 30, active_week_pct: 65, typical_week_minutes: 25,
  days_buckets: [{ label: "Not at all", pct: 10 }, { label: "1 to 3 days", pct: 30 }, { label: "4 to 9 days", pct: 40 }, { label: "10 or more", pct: 20 }],
  has_goal_pct: 50, goals_done_pct: 35, practiced_pct: 55, practice_entries: 38, game_sessions: 21, game_modules_done: 9, pairs_playing: 11,
  weekly: [{ week: "2026-09-07", pct: 35 }, { week: "2026-09-14", pct: 40 }],
};

describe("reading the growth totals", () => {
  it("says nothing below the floor, and says why without pointing at anyone", () => {
    const g: GrowthActivity = { teachers: 50, window_days: 30, enough: false };
    expect(readGrowth(g)).toBeNull();
    expect(notEnough(g)).toMatch(/Fewer than 5 of your 50 teachers/);
    expect(notEnough(g)).not.toMatch(/\d+ (have|has) chosen/);
  });
  it("phrases the headline figures as 'about', as percentages, and by choice", () => {
    const r = readGrowth(full)!;
    expect(r.headline[0]).toMatchObject({ label: "Sharing their activity", value: "about 15" });
    expect(r.headline.map((h) => h.value)).toEqual(["about 15", "65%", "55%", "50%"]);
    expect(r.sentences[0]).toMatch(/About 15 teachers \(30% of 50\) chose to share/);
  });
  it("only mentions what the database chose to return", () => {
    const r = readGrowth({ ...full, typical_week_minutes: null, goals_done_pct: null, practice_entries: null, game_sessions: null, game_modules_done: null, pairs_playing: null, days_buckets: null })!;
    const text = r.sentences.join(" ");
    expect(text).not.toMatch(/typical sharing teacher/);
    expect(text).not.toMatch(/entries in all|game sessions|of the goals set are done/);
    expect(r.buckets).toEqual([]);
    expect(r.headline[3].note).toMatch(/too few to show/);
  });
  it("turns the weekly series into labelled bars", () => {
    const r = readGrowth(full)!;
    expect(r.trend).toEqual([{ label: "Sep 7", value: 35 }, { label: "Sep 14", value: 40 }]);
    expect(r.buckets[2]).toEqual({ label: "4 to 9 days", value: 40 });
  });
  it("never produces a per-person sentence", () => {
    const text = JSON.stringify(readGrowth(full)).toLowerCase();
    expect(text).not.toMatch(/\b(she|he)\b|named|ranked|lowest|highest|least active|most active/);
  });
});

describe("reading the CTLE totals", () => {
  const c = { teachers: 50, enough: true, contributors: 15, tracking_pct: 30, complete_pct: 20, on_pace_pct: 35, behind_pct: 45 };
  it("says nothing below the floor and doesn't point at anyone", () => {
    expect(readCtle({ teachers: 50, enough: false })).toBeNull();
    expect(ctleNotEnough({ teachers: 50, enough: false })).toMatch(/Fewer than 5 of your 50 teachers/);
    expect(ctleNotEnough({ teachers: 50, enough: false })).not.toMatch(/which|who /i);
  });
  it("gives the headline as 'about', by choice, with complete-or-on-pace combined", () => {
    const r = readCtle(c)!;
    expect(r.headline[0]).toMatchObject({ value: "about 15", note: "30% of 50 teachers, by choice" });
    expect(r.headline[1].value).toBe("55%");
  });
  it("lists the three states and caps the combined figure at 100", () => {
    expect(readCtle(c)!.rows).toEqual([{ label: "Complete", value: 20 }, { label: "On pace", value: 35 }, { label: "Behind pace", value: 45 }]);
    expect(readCtle({ ...c, complete_pct: 60, on_pace_pct: 55 })!.headline[1].value).toBe("100%");
  });
});
