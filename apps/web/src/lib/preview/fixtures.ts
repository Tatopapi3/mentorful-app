/**
 * Made-up data for the local preview. Shaped like the rows Nick's pages read (profiles, schools, cycles,
 * pairings, conversation_logs, survey_items, survey_responses) from his CLAUDE.md and the queries in the app.
 * Every person, conversation and answer here is invented. Deterministic, so the preview looks the same
 * on every start.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { TAG_TO_DOMAIN } from "@/lib/domains";
import { PREVIEW_ITEMS } from "./items";
import type { Row, Tables } from "./mockQuery";

export const IDS = {
  school: "school-sandbox",
  cycle: "cycle-fall-2025",
  admin: "profile-admin",
  teacher: "profile-t01",
  authAdmin: "auth-admin",
  authTeacher: "auth-teacher",
};

function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const FIRST = ["Linda", "Marcus", "Priya", "Daniel", "Elena", "Samir", "Grace", "Tomás", "Hannah", "Kenji", "Aaliyah", "Rafael", "Mei", "Oluwaseun", "Sofia", "Andre", "Nadia", "Caleb", "Ingrid", "Jamal", "Rosa", "Viktor", "Amara", "Diego", "Yuki", "Theo", "Fatima", "Wesley", "Camila", "Hassan", "Noor", "Benji", "Lucia", "Darius", "Anika", "Miguel", "Bridget", "Tariq", "Esme", "Joaquin", "Selin", "Ravi", "Maya", "Isaiah", "Leila", "Owen", "Zainab", "Felix", "Carmen", "Dev"];
const LAST = ["Johnson", "Bell", "Nair", "Okafor", "Ruiz", "Haddad", "Lindqvist", "Ortega", "Watanabe", "Whitfield", "Brooks", "Castillo", "Chen", "Adeyemi", "Romano", "Washington", "Petrova", "Hughes", "Larsen", "Carter", "Mendez", "Novak", "Diallo", "Herrera", "Tanaka", "Murphy", "Rahman", "Dixon", "Reyes", "Farouk", "Khalil", "Stein", "Vargas", "Mitchell", "Gupta", "Torres", "Sullivan", "Aziz", "Fox", "Salazar", "Demir", "Iyer", "Patel", "Coleman", "Haidari", "Bennett", "Suleiman", "Weber", "Navarro", "Shah"];
const DEPARTMENTS = ["Math", "ELA", "Science", "Social Studies", "Arts", "World Languages", "PE & Health"];
const STYLES = ["nurturer", "activator", "architect"];
const ARCHETYPES = ["puzzler", "story-lover", "fixer", "mover-shaker", "competitor", "performer", "artist", "collector", "party-captain", "prankster", "novelty-seeker"];
const INSPIRATIONS = [
  "A teacher who never gave up on me in ninth grade.",
  "Watching a student finally say \"oh, I get it.\"",
  "My grandmother, who taught reading to the whole street.",
  "The idea that every room can be a place people want to be in.",
  "Curiosity. I follow it into every unit I plan.",
  "A coach who taught me to explain, not just demonstrate.",
];
const TAGS = Object.keys(TAG_TO_DOMAIN);
const DOMAIN_KEYS = ["CLASSROOM", "PLANNING", "COMMUNICATION", "ASSESSMENT"];
const STRATEGIC = ["Collaborative planning", "Feedback culture", "Student voice", "Data-informed reteach"];
const VISION = [
  "I'm working toward quieter, faster transitions so we get ten more minutes of real work.",
  "I want every student to be able to explain their reasoning to a partner before sharing out.",
  "We're trying a common rubric for lab reports across both sections.",
  "My goal is to get feedback back within two days, in fewer words.",
  "I'd like families to hear something good from me before they hear anything else.",
];
const STRENGTH = [
  "Students were explaining their thinking to each other without prompting.",
  "The opening question gave the whole lesson a clear point to return to.",
  "Warm, firm routines: nobody asked what to do next.",
  "Exit tickets were specific enough to plan tomorrow's reteach from.",
  "Every student had a way in, and a way to stretch.",
];

export function buildTables(surveyId: string, schoolId: string): Tables {
  const rand = prng(2568);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

  const school: Row = { id: schoolId || IDS.school, name: "Mentorful Sandbox", strategic_priority: "Strengthen cross-department collaboration" };
  const sid = school.id;
  const cycle: Row = { id: IDS.cycle, school_id: sid, name: "Fall 2025", status: "complete", ends_at: "2025-12-20", starts_at: "2025-09-02" };
  const spring: Row = { id: "cycle-spring-2025", school_id: sid, name: "Spring 2025", status: "complete", ends_at: "2025-06-10", starts_at: "2025-01-20" };

  const profiles: Row[] = [
    { id: IDS.admin, auth_user_id: IDS.authAdmin, school_id: sid, role: "admin", first_name: "Preview", last_name: "Admin", email: "admin@preview.test", department: null, is_demo: false, strength_tags: [], teaching_style: null, archetype_id: null, inspiration: null },
  ];
  for (let i = 0; i < 50; i++) {
    const t1 = pick(TAGS);
    let t2 = pick(TAGS);
    if (t2 === t1) t2 = TAGS[(TAGS.indexOf(t1) + 5) % TAGS.length];
    profiles.push({
      id: `profile-t${String(i + 1).padStart(2, "0")}`,
      auth_user_id: i === 0 ? IDS.authTeacher : null,
      school_id: sid,
      role: "teacher",
      first_name: FIRST[i],
      last_name: LAST[i],
      email: `${FIRST[i].toLowerCase()}.${LAST[i].toLowerCase()}@demo.mentorful.co`,
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      is_demo: true,
      strength_tags: [t1, t2],
      teaching_style: pick(STYLES),
      archetype_id: pick(ARCHETYPES),
      inspiration: pick(INSPIRATIONS),
    });
  }
  const teachers = profiles.filter((p) => p.role === "teacher");

  // 25 disjoint pairs, then 7 more so a few teachers (including the preview teacher) have two.
  const order = [...teachers].sort(() => rand() - 0.5);
  const pairings: Row[] = [];
  const addPair = (host: Row, visitor: Row) => {
    const n = pairings.length + 1;
    pairings.push({ id: `pairing-${String(n).padStart(2, "0")}`, school_id: sid, cycle_id: cycle.id, host_id: host.id, visitor_id: visitor.id, status: "approved", domain: pick(DOMAIN_KEYS), strategic_tag: pick(STRATEGIC) });
  };
  // 22 disjoint pairs leave six teachers unpaired, so a randomized round has someone to pair.
  for (let i = 0; i < 44; i += 2) addPair(order[i], order[i + 1]);
  const me = teachers[0];
  for (let k = 0; k < 7; k++) {
    const host = k === 0 ? teachers[1] : pick(teachers);
    const visitor = k === 0 ? me : pick(teachers);
    if (host.id !== visitor.id) addPair(host, visitor);
  }

  // An earlier cycle with a dozen pairs, so the cycle switcher has something to switch to.
  for (let k = 0; k < 12; k++) {
    pairings.push({ id: `pairing-sp-${k}`, school_id: sid, cycle_id: spring.id, host_id: teachers[k].id, visitor_id: teachers[(k + 13) % 50].id, status: "approved", domain: pick(DOMAIN_KEYS), strategic_tag: pick(STRATEGIC) });
  }

  // Three pairs teachers have asked for, still waiting for the admin.
  for (const [h, v] of [[3, 17], [8, 29], [21, 40]]) {
    pairings.push({ id: `pairing-req-${h}`, school_id: sid, cycle_id: cycle.id, host_id: teachers[h].id, visitor_id: teachers[v].id, status: "pending", domain: pick(DOMAIN_KEYS), strategic_tag: pick(STRATEGIC) });
  }

  // About one pair in five has logged nothing yet, and a third of the others also have a visit debrief.
  const conversation_logs: Row[] = pairings.filter((p) => p.status === "approved" && p.cycle_id === cycle.id).filter((_, i) => i % 5 !== 4).map((p, i) => ({
    id: `log-${String(i + 1).padStart(2, "0")}`,
    school_id: sid,
    cycle_id: cycle.id,
    pairing_id: p.id,
    host_id: p.host_id,
    visitor_id: p.visitor_id,
    logged_by: p.visitor_id,
    domain: p.domain,
    strategic_tag: p.strategic_tag,
    vision: pick(VISION),
    strength_noted: pick(STRENGTH),
    more_frequently: "Turn-and-talk before whole-class questions.",
    less_frequently: "Calling on volunteers first.",
    resources: "Twenty minutes of shared planning time on Thursdays.",
    status: "submitted",
    submitted_at: `2025-1${(i % 3) + 0}-${String((i % 27) + 1).padStart(2, "0")}T15:00:00Z`.replace("2025-10", "2025-10"),
    created_at: `2025-10-${String((i % 27) + 1).padStart(2, "0")}T14:00:00Z`,
    is_visit_debrief: false,
  }));
  for (let i = 0; i < conversation_logs.length; i += 3) {
    const base = conversation_logs[i];
    conversation_logs.push({ ...base, id: `${base.id}-debrief`, is_visit_debrief: true });
  }
  // One draft for the preview teacher, so the "submit" step is visible.
  const mine = pairings.find((p) => p.host_id === me.id || p.visitor_id === me.id)!;
  conversation_logs.push({
    id: "log-draft",
    school_id: sid,
    cycle_id: cycle.id,
    pairing_id: mine.id,
    host_id: mine.host_id,
    visitor_id: mine.visitor_id,
    logged_by: me.id,
    domain: mine.domain,
    strategic_tag: mine.strategic_tag,
    vision: "A draft thought I haven't submitted yet.",
    strength_noted: null,
    more_frequently: null,
    less_frequently: null,
    resources: null,
    status: "draft",
    submitted_at: null,
    created_at: "2025-12-01T10:00:00Z",
    is_visit_debrief: false,
  });

  // 50 synthetic respondents on the path model structural -> relational -> cognitive, relational -> efficacy.
  const survey_responses: Row[] = [];
  for (let r = 0; r < 50; r++) {
    const noise = () => (rand() + rand() + rand() - 1.5) * 0.9;
    const s = 3.1 + noise();
    const rel = 4.6 + 0.6 * (s - 3.1) + noise();
    const cog = 4.5 + 0.5 * (rel - 4.6) + noise();
    const eff = 4.5 + 0.7 * (rel - 4.6) + 0.35 * (cog - 4.5) + noise();
    const level: Record<string, number> = { structural: s, relational: rel, cognitive: cog, efficacy: eff };
    const respondent = `resp-${String(r + 1).padStart(3, "0")}`;
    for (const it of PREVIEW_ITEMS) {
      const scored = Math.min(6, Math.max(1, Math.round(level[it.dimension] + (rand() - 0.5))));
      survey_responses.push({ id: `${respondent}-${it.id}`, survey_id: surveyId, school_id: sid, respondent, item_id: it.id, raw_value: it.reverse ? 7 - scored : scored, scored_value: scored, synthetic: true });
    }
  }

  return {
    schools: [school],
    cycles: [cycle, spring],
    profiles,
    pairings,
    conversation_logs,
    survey_items: PREVIEW_ITEMS.map((i) => ({ ...i })),
    survey_responses,
  };
}
