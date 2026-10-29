import { describe, expect, it } from "vitest";
import { agoLabel, buildModel, daysSince, nextStep, type LogRow, type PairingRow, type PersonRow } from "@/lib/teacher/model";

const NOW = new Date("2026-10-28T12:00:00Z");
const person = (id: string, first: string, tags: string[] = [], archetype: string | null = null): PersonRow => ({
  id, first_name: first, last_name: "Test", department: "Math", teaching_style: "nurturer", archetype_id: archetype, strength_tags: tags,
});
const me = person("me", "Linda", ["Discussion Craft", "Rubric Clarity"], "collector");
const dan = person("dan", "Daniel", ["Clear Explanations"], "story-lover");
const mar = person("mar", "Marcus", ["Unit Architecture"]);
const cycle = { id: "c1", name: "Fall 2026", status: "active", ends_at: "2026-12-19T00:00:00Z" };
const pair = (id: string, host: string, visitor: string, cycle_id = "c1"): PairingRow => ({ id, host_id: host, visitor_id: visitor, domain: "CLASSROOM", cycle_id });
const log = (o: Partial<LogRow> & { id: string }): LogRow => ({
  pairing_id: "p1", cycle_id: "c1", domain: "CLASSROOM", vision: null, strength_noted: null, more_frequently: null, less_frequently: null, resources: null,
  status: "submitted", submitted_at: "2026-10-20T10:00:00Z", created_at: "2026-10-20T09:00:00Z", host_id: "me", visitor_id: "dan", logged_by: "dan", ...o,
});
const build = (pairings: PairingRow[], logs: LogRow[]) => buildModel({ me, people: [me, dan, mar], pairings, logs, cycle });

describe("teacher model", () => {
  it("works out who visits whom and what the pair shares, as set membership", () => {
    const m = build([pair("p1", "me", "dan"), pair("p2", "mar", "me")], []);
    expect(m.partners.map((p) => [p.first, p.visitsMe])).toEqual([["Daniel", true], ["Marcus", false]]);
    expect(m.partners[0].shared).toEqual(["CLASSROOM"]);
    expect(m.partners[0].contrast).toBe(true);
    expect(m.partners[1].shared).toEqual([]);
  });

  it("leaves out pairings from other cycles", () => {
    expect(build([pair("p1", "me", "dan"), pair("old", "me", "mar", "c0")], []).partners).toHaveLength(1);
  });

  it("surfaces the strength a colleague wrote about the teacher, never one the teacher wrote about someone else", () => {
    const m = build([pair("p1", "me", "dan")], [
      log({ id: "a", strength_noted: "Students explain their thinking", vision: "Quieter transitions" }),
      log({ id: "b", host_id: "dan", visitor_id: "me", logged_by: "me", strength_noted: "My own note about Daniel", submitted_at: "2026-10-25T10:00:00Z" }),
    ]);
    expect(m.noticed).toMatchObject({ text: "Students explain their thinking", byFirst: "Daniel" });
    expect(m.focus?.text).toBe("Quieter transitions");
  });

  it("has no noticed strength until a colleague writes one", () => {
    expect(build([pair("p1", "me", "dan")], []).noticed).toBeNull();
  });

  it("counts only submitted entries in the current cycle, by area, and keeps drafts out of the numbers", () => {
    const m = build([pair("p1", "me", "dan")], [
      log({ id: "a" }),
      log({ id: "b", domain: "PLANNING" }),
      log({ id: "c", status: "draft", submitted_at: null, logged_by: "me" }),
      log({ id: "old", cycle_id: "c0" }),
    ]);
    expect(m.conversations).toBe(2);
    expect(m.byDomain.map((d) => d.n)).toEqual([1, 1]);
    expect(m.entries).toHaveLength(4);
  });

  it("puts a draft first whatever its date", () => {
    const m = build([pair("p1", "me", "dan")], [
      log({ id: "new", submitted_at: "2026-10-27T10:00:00Z" }),
      log({ id: "d", status: "draft", submitted_at: null, created_at: "2026-01-01T00:00:00Z", logged_by: "me" }),
    ]);
    expect(m.entries[0].id).toBe("d");
    expect(m.draft?.id).toBe("d");
  });

  it("tracks the three cycle steps from submitted entries only", () => {
    expect(build([pair("p1", "me", "dan")], [log({ id: "a" })]).steps).toEqual({ hosted: true, visited: false, debrief: false });
    expect(build([pair("p1", "dan", "me")], [log({ id: "a", host_id: "dan", visitor_id: "me", logged_by: "me" })]).steps).toEqual({ hosted: false, visited: true, debrief: true });
  });
});

describe("next step", () => {
  it("says so plainly when there is no partner yet", () => {
    expect(nextStep(build([], []), NOW).kind).toBe("none");
  });

  it("asks to finish a draft before anything else", () => {
    const m = build([pair("p1", "me", "dan")], [log({ id: "d", status: "draft", submitted_at: null, logged_by: "me" })]);
    expect(nextStep(m, NOW).kind).toBe("draft");
  });

  it("invites a first entry when nothing is written", () => {
    expect(nextStep(build([pair("p1", "me", "dan")], []), NOW).kind).toBe("start");
  });

  it("reconnects after three quiet weeks, pointing at the quieter partner", () => {
    const m = build([pair("p1", "me", "dan"), pair("p2", "mar", "me")], [
      log({ id: "a", submitted_at: "2026-10-26T10:00:00Z" }),
      log({ id: "b", pairing_id: "p2", host_id: "mar", visitor_id: "me", logged_by: "me", submitted_at: "2026-09-20T10:00:00Z" }),
    ]);
    const s = nextStep(m, NOW);
    expect(s.kind).toBe("reconnect");
    expect("partner" in s && s.partner.first).toBe("Marcus");
  });

  it("keeps the wording an invitation when the rhythm is healthy", () => {
    const s = nextStep(build([pair("p1", "me", "dan")], [log({ id: "a", submitted_at: "2026-10-26T10:00:00Z" })]), NOW);
    expect(s.kind).toBe("rhythm");
    expect(s.body).not.toMatch(/overdue|behind|must|score/i);
  });
});

describe("dates", () => {
  it("words gaps in days, weeks and months", () => {
    expect(agoLabel(null)).toBe("not yet");
    expect(agoLabel(0)).toBe("today");
    expect(agoLabel(1)).toBe("yesterday");
    expect(agoLabel(5)).toBe("5 days ago");
    expect(agoLabel(21)).toBe("3 weeks ago");
    expect(agoLabel(120)).toBe("4 months ago");
    expect(daysSince("2026-10-21T12:00:00Z", NOW)).toBe(7);
    expect(daysSince("nonsense", NOW)).toBeNull();
  });
});
