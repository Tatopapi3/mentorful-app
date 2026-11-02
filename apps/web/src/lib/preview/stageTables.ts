/**
 * The stage dataset for Demo Day (PREVIEW_DATASET=stage): a smaller faculty, so the audience sees few numbers and every
 * one of them can be said out loud. Everyone on it is a real person from Nick's sandbox faculty, with the name, department
 * and strengths they already have on the faculty map. Nothing is invented except the pairs and the logs, which are set up
 * to tell one story:
 *
 *   - 32 teachers in five departments of five or more, so every privacy floor still passes.
 *   - 12 pairs. Every pair of departments is connected except English and Science.
 *   - 8 teachers have no partner yet, four in English and four in Science, so "Draft new round" closes exactly that gap.
 *   - STAGE_CHARACTERS names the two teachers who play the scene: the signed-in teacher (English) and the other one
 *     (Science). Change the two names there to cast somebody else; everything follows from them.
 *
 * Pairs and logs are fixed, and the logs are dated relative to today, so the screens look current on any day.
 */
import data from "./nick-data.json";
import { IDS } from "./fixtures";
import type { Row, Tables } from "./mockQuery";

/**
 * The two teachers who play the scene, as they appear on screen: the first is the English teacher you are by default, the
 * second is the Science teacher (`?who=second`). The team cast two of its Pursuit teachers for fun, as Ms. Afiya and Mr. Stefano. Each stands in the place of
 * one of Nick's sandbox teachers (CAST_SLOTS), keeping that person's department and strengths and taking a new name.
 */
export const STAGE_CHARACTERS = { first: "Ms. Afiya", second: "Mr. Stefano" } as const;
const CAST_SLOTS = {
  first: { slot: "Henry White", first_name: "Ms. Afiya", last_name: "" },
  second: { slot: "Owen Perez", first_name: "Mr. Stefano", last_name: "" },
} as const;
export const AUTH_SECOND = "auth-teacher-2";
/** The draft the pairing screen opens with: this seed pairs the two characters, and every new pair crosses departments. The next seed (18) does too, so "Draft another round" still tells the same story (tests/stage-dataset.test.ts). */
export const STAGE_DRAFT_SEED = 17;

const FACULTY: Record<string, string[]> = {
  English: ["Henry White", "Ella Jackson", "James Thomas", "Mason Davis", "Amelia Chen", "Evelyn Anderson", "Logan Wilson", "Harper Lopez"],
  Science: ["Owen Perez", "Grace Clark", "Leo Moore", "Sofia Thompson", "Scarlett Lee", "Jack Martin", "Avery Harris"],
  Math: ["Lucas Brown", "Isabella Martinez", "Sophia Garcia", "Ethan Johnson", "Ava Patel", "Mia Kim", "Liam Rivera"],
  History: ["Wyatt Lewis", "Carter Allen", "Chloe Walker", "Lily Young", "Julian Hall"],
  Arts: ["Anthony Nelson", "Aria Hill", "Layla Adams", "Gabriel Baker", "Lincoln Campbell"],
};

/** The twelve pairs, host first. The first four teachers of English and of Science are left without a partner. */
const PAIRS: [string, string, string][] = [
  ["Lucas Brown", "Amelia Chen", "PLANNING"],
  ["Isabella Martinez", "Scarlett Lee", "ASSESSMENT"],
  ["Sophia Garcia", "Jack Martin", "CLASSROOM"],
  ["Ethan Johnson", "Wyatt Lewis", "PLANNING"],
  ["Ava Patel", "Anthony Nelson", "COMMUNICATION"],
  ["Mia Kim", "Liam Rivera", "CLASSROOM"],
  ["Carter Allen", "Evelyn Anderson", "COMMUNICATION"],
  ["Chloe Walker", "Aria Hill", "ASSESSMENT"],
  ["Lily Young", "Julian Hall", "PLANNING"],
  ["Layla Adams", "Avery Harris", "CLASSROOM"],
  ["Gabriel Baker", "Lincoln Campbell", "COMMUNICATION"],
  ["Logan Wilson", "Harper Lopez", "ASSESSMENT"],
];

/** Which pairs have already logged a conversation, and how many days ago. Nine in all, so the count starts at nine. */
const LOGGED: [number, number][] = [[0, 34], [1, 29], [2, 22], [3, 19], [4, 15], [6, 12], [7, 9], [9, 6], [11, 3]];

const DAY = 86_400_000;

/**
 * The chance that an answer drops one step, by dimension: this year's Culture Scan has fallen since last year, most in the
 * structural dimension (who talks to whom). tests/stage-dataset.test.ts checks where the means land.
 */
const DROP: Record<string, number> = { structural: 0.6, relational: 0.38, cognitive: 0.4, efficacy: 0.46 };

/**
 * Last year's scan for the same school, as the story tells it: collective efficacy 5.1 of 6 (85%), every dimension higher.
 * Only the stage uses it, to show how far this year's scan has fallen (the real product has one scan per survey).
 */
export const STAGE_LAST_YEAR = {
  label: "Last year",
  n: 32,
  means: { structural: 4.03, relational: 5.19, cognitive: 5.08, efficacy: 5.1 },
  ci: { structural: 0.36, relational: 0.2, cognitive: 0.24, efficacy: 0.28 },
} as const;

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildStageTables(): Tables {
  const src = structuredClone(data) as unknown as Record<string, Row[]>;
  const school = src.schools[0];
  const byName = new Map(src.profiles.filter((p) => p.role === "teacher").map((p) => [`${p.first_name} ${p.last_name}`, p]));
  const id = (name: string) => {
    const p = byName.get(name);
    if (!p) throw new Error(`stage dataset: ${name} is not on the faculty map`);
    return String(p.id);
  };

  const admin = src.profiles.find((p) => p.role === "admin")!;
  Object.assign(admin, { auth_user_id: IDS.authAdmin, first_name: "Juan", last_name: "Fernandez", email: "admin@preview.test" });
  const teachers = Object.values(FACULTY).flat().map((n) => {
    const p = byName.get(n);
    if (!p) throw new Error(`stage dataset: ${n} is not on the faculty map`);
    p.auth_user_id = n === CAST_SLOTS.first.slot ? IDS.authTeacher : n === CAST_SLOTS.second.slot ? AUTH_SECOND : null;
    for (const c of [CAST_SLOTS.first, CAST_SLOTS.second]) {
      if (n === c.slot) Object.assign(p, { first_name: c.first_name, last_name: c.last_name, email: `${c.first_name.toLowerCase().replace(/[^a-z]+/g, ".")}@demo.mentorful.co` });
    }
    return p;
  });

  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const cycle: Row = { ...src.cycles[0], name: "Fall 2026", academic_year: "2026-27", starts_at: iso(now - 60 * DAY).slice(0, 10), ends_at: iso(now + 50 * DAY).slice(0, 10), status: "active" };

  const pairings: Row[] = PAIRS.map(([host, visitor, domain], i) => ({
    id: `stage-pair-${String(i + 1).padStart(2, "0")}`,
    school_id: school.id,
    cycle_id: cycle.id,
    host_id: id(host),
    visitor_id: id(visitor),
    status: "approved",
    requested_by: null,
    approved_by: null,
    approved_at: iso(now - 58 * DAY),
    created_at: iso(now - 58 * DAY),
    domain,
    strategic_tag: "AI and academic integrity",
  }));

  // Each logged conversation reuses the wording of one of Nick's own logs, so the text reads like the real thing.
  const words = src.conversation_logs.filter((l) => !l.is_visit_debrief);
  const conversation_logs: Row[] = LOGGED.map(([pairIndex, ago], n) => {
    const p = pairings[pairIndex];
    const w = words[n % words.length];
    return {
      ...w,
      id: `stage-log-${String(n + 1).padStart(2, "0")}`,
      school_id: school.id,
      cycle_id: cycle.id,
      pairing_id: p.id,
      host_id: p.host_id,
      visitor_id: p.visitor_id,
      logged_by: p.visitor_id,
      domain: p.domain,
      strategic_tag: p.strategic_tag,
      is_visit_debrief: false,
      status: "submitted",
      submitted_at: iso(now - ago * DAY),
      created_at: iso(now - ago * DAY),
    };
  });

  // The Culture Scan: the first 32 respondents, one per teacher, so the page reads as a school where everyone answered.
  const respondents = [...new Set(src.survey_responses.map((r) => String(r.respondent)))].slice(0, teachers.length);
  const keep = new Set(respondents);
  const dimension = new Map(src.survey_items.map((i) => [String(i.id), String(i.dimension)]));
  const reversed = new Map(src.survey_items.map((i) => [String(i.id), i.reverse === true]));
  // The story is a school that scored 85% a year ago and has slipped: collective efficacy about 4.2 of 6 (70%), with the
  // structural dimension, who talks to whom, falling most. Each answer above 1 drops one step with a fixed chance.
  const rnd = lcg(85);
  const survey_responses = src.survey_responses
    .filter((r) => keep.has(String(r.respondent)))
    .map((r) => {
      let v = Number(r.scored_value);
      if (v > 1 && rnd() < DROP[dimension.get(String(r.item_id)) ?? "efficacy"]) v -= 1;
      return { ...r, scored_value: v, raw_value: reversed.get(String(r.item_id)) ? 7 - v : v, synthetic: false };
    });

  return {
    schools: [{ ...school, faculty_headcount: teachers.length }],
    cycles: [cycle],
    profiles: [admin, ...teachers],
    pairings,
    conversation_logs,
    survey_items: src.survey_items,
    survey_responses,
    surveys: src.surveys,
  } as unknown as Tables;
}
