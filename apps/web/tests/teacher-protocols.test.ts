import { describe, expect, it } from "vitest";
import { MODULES } from "@/lib/teacher/hub";
import { PROTOCOLS, catalogueProblems, cleanOutputs, journalFields, outputKeys, protocolByName, protocolFor, summarize, totalMinutes } from "@/lib/teacher/protocols";

describe("the six games as protocols", () => {
  it("has one protocol per catalogue module, and each one's steps add up to the module's length", () => {
    expect(catalogueProblems()).toEqual([]);
    expect(PROTOCOLS.map((p) => p.name)).toEqual(MODULES.map((m) => m.name));
    for (const p of PROTOCOLS) expect(totalMinutes(p)).toBe(MODULES.find((m) => m.name === p.name)!.minutes);
  });
  it("gives every step an id, a speaker and an instruction, with unique ids and keys inside a protocol", () => {
    for (const p of PROTOCOLS) {
      expect(new Set(p.steps.map((s) => s.id)).size).toBe(p.steps.length);
      const keys = outputKeys(p);
      expect(new Set(keys).size).toBe(keys.length);
      for (const s of p.steps) {
        expect(s.title.length).toBeGreaterThan(3);
        expect(s.who.length).toBeGreaterThan(2);
        expect(s.instruction.length).toBeGreaterThan(20);
        expect(s.minutes).toBeGreaterThan(0);
      }
    }
  });
  it("only references capture keys that exist", () => {
    for (const p of PROTOCOLS) {
      const keys = new Set(outputKeys(p));
      for (const k of p.summaryKeys) expect(keys.has(k), `${p.name}: summary key ${k}`).toBe(true);
      for (const k of Object.values(p.logMap ?? {})) expect(keys.has(k), `${p.name}: log key ${k}`).toBe(true);
      for (const k of p.practiceKeys ?? []) expect(keys.has(k), `${p.name}: practice key ${k}`).toBe(true);
    }
  });
  it("never asks anyone to rate or score anything (the product has no ratings)", () => {
    const text = JSON.stringify(PROTOCOLS).toLowerCase();
    expect(text).not.toMatch(/\brate\b|\brating\b|out of (5|10)|\bscore (yourself|your)\b/);
  });
  it("finds a protocol by slug and by name", () => {
    expect(protocolFor("fishbowl")?.name).toBe("Fishbowl Protocol");
    expect(protocolByName("PLC Navigator")?.slug).toBe("plc");
    expect(protocolFor("nope")).toBeNull();
  });
});

describe("what a session stores", () => {
  const trust = protocolFor("trust")!;
  it("keeps only this protocol's keys, trimmed and capped", () => {
    const out = cleanOutputs(trust, { norms: "  1. Start with strengths  ", "hear.me": "Strengths only", "hear.partner": "Everything, straight", evil: "x", off: "y".repeat(900), safe: 42 });
    expect(Object.keys(out).sort()).toEqual(["hear.me", "hear.partner", "norms", "off"]);
    expect(out.norms).toBe("1. Start with strengths");
    expect(out.off).toHaveLength(400);
    expect(cleanOutputs(trust, null)).toEqual({});
  });
  it("writes a note that fits the 500-character column", () => {
    expect(summarize(trust, { norms: "Strengths first", off: "Say so within a day" })).toBe("Our three norms: Strengths first · If a visit ever feels off, we will…: Say so within a day");
    expect(summarize(trust, { norms: "n".repeat(400), off: "o".repeat(400) }).length).toBeLessThanOrEqual(500);
    expect(summarize(trust, {})).toBe("");
  });
  it("turns a finished Fishbowl into the five fields of a journal entry, and nothing else does", () => {
    const fish = protocolFor("fishbowl")!;
    expect(journalFields(fish, { lens: "Quieter transitions", strength: "Students explained their thinking", more: "Turn-and-talk", swap: "Checkpoint slide" })).toEqual({
      vision: "Quieter transitions", strength_noted: "Students explained their thinking", more_frequently: "Turn-and-talk", less_frequently: "", resources: "Checkpoint slide",
    });
    expect(journalFields(trust, {})).toBeNull();
  });
});
