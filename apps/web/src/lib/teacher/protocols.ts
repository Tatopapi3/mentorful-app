import { MODULES } from "./hub";

/**
 * The six pedagogy games as playable protocols.
 *
 * DRAFT CONTENT. Bertrand's games hub had only a name, a focus, a length and a progress number for each module; there
 * was no workflow anywhere (his cards were display-only). These flows are written here from standard peer-learning
 * practice (a debrief protocol, the four PLC questions, a feedback reframe) and from Mentorful's own rules: developmental
 * not evaluative, strengths first, nothing rated or scored. They are meant to be reviewed and rewritten by whoever owns
 * Mentorful's pedagogy (Nick, Bertrand), which is why every step is plain data and the player has no content of its own.
 *
 * A session is played by the two teachers together, on one screen (in the room, or on the visit screen). The player
 * keeps time and takes notes; the two people do the talking.
 */

export type Capture = { key: string; label: string; placeholder?: string; rows?: number };
/** A choice each teacher makes for themselves. Stored as `<key>.me` and `<key>.partner`. */
export type Choice = { key: string; label: string; options: string[] };

export type Step = {
  id: string;
  title: string;
  minutes: number;
  /** Who speaks or acts in this step, in a word or two. */
  who: string;
  instruction: string;
  /** Sentence stems to say out loud. */
  say?: string[];
  captures?: Capture[];
  choices?: Choice[];
  /** "domains" lays out both teachers' strengths from their profiles (Domain Mapping Dominoes). */
  kind?: "domains";
};

export type Protocol = {
  slug: string;
  /** Must equal a MODULES name: that is what a session is recorded under. */
  name: string;
  purpose: string;
  steps: Step[];
  /** What the pair walks away with. */
  outcome: string;
  /** The capture keys that make the one-line summary stored with the session. */
  summaryKeys: string[];
  /** Fishbowl only: how its notes map onto a journal entry's own fields, so a finished game can become a draft. */
  logMap?: { vision?: string; strength?: string; more?: string; less?: string; resources?: string };
  /** Efficacy Quest only: the capture keys joined into a private practice-log entry. */
  practiceKeys?: string[];
};

const talk = (id: string, title: string, minutes: number, who: string, instruction: string, extra: Partial<Step> = {}): Step => ({ id, title, minutes, who, instruction, ...extra });

export const PROTOCOLS: Protocol[] = [
  {
    slug: "trust",
    name: "Trust Calibration Matrix",
    purpose: "Agree how you want visits and feedback to feel before the first one, so safety is something you chose together.",
    outcome: "Three norms you both wrote, and what each of you wants to hear and when.",
    summaryKeys: ["norms", "off"],
    steps: [
      talk("safe", "Say what safe feels like", 3, "Both, in turn", "Take turns finishing the stems below. There are no wrong answers; this is just so each of you knows the other.", {
        say: ["A visit feels safe to me when…", "It gets harder for me when…"],
        captures: [{ key: "safe", label: "What we each said", placeholder: "A line from each of you", rows: 3 }],
      }),
      talk("prefs", "Tune your preferences", 4, "Each of you picks", "Each of you chooses the option that fits you best today. Nobody is scored: this just tells your partner how to be helpful to you.", {
        choices: [
          { key: "hear", label: "How much I want to hear", options: ["Strengths only", "Strengths and one thing to wonder about", "Everything, straight"] },
          { key: "when", label: "When I want to hear it", options: ["Right after", "Same day, once I've had time", "A day or two later"] },
        ],
      }),
      talk("norms", "Agree three norms", 5, "Both", "Write three promises you will keep for each other's visits. Short and concrete beats clever.", {
        say: ["We will always start with…", "We will never…", "If something feels off, we will…"],
        captures: [{ key: "norms", label: "Our three norms", placeholder: "1.\n2.\n3.", rows: 4 }],
      }),
      talk("check", "How you'll keep them", 3, "Both", "Decide how you'll notice if a norm slips, and what you'll do about it.", {
        captures: [{ key: "off", label: "If a visit ever feels off, we will…", placeholder: "e.g. say so within a day, and start the next one with the norms", rows: 2 }],
      }),
    ],
  },
  {
    slug: "dominoes",
    name: "Domain Mapping Dominoes",
    purpose: "See where your strengths overlap and where they complement each other, then trade something real.",
    outcome: "A matched strength, one thing each of you will borrow or offer, and a focus for your next visit.",
    summaryKeys: ["match", "borrow", "offer", "focus"],
    steps: [
      talk("lay", "Lay out your strengths", 4, "Each of you reads yours", "These come from your profiles. Read yours aloud and add anything the list misses. Nothing here is a score: you are simply naming what you are good at.", { kind: "domains" }),
      talk("match", "Match the dominoes", 8, "Both", "Look at each area. Where you are both strong, compare how you each do it. Where only one of you is, that is something to offer. Where neither is, it is open ground.", {
        kind: "domains",
        captures: [{ key: "match", label: "One match worth talking about", placeholder: "e.g. We're both strong in Classroom Culture: she does cold-calls, I do routines", rows: 3 }],
      }),
      talk("trade", "Pick a trade", 5, "Both", "Choose one thing each way. Small and specific: something you could try next week.", {
        say: ["One thing I'd like to borrow from you is…", "One thing I can offer you is…"],
        captures: [
          { key: "borrow", label: "What I'll borrow", rows: 2 },
          { key: "offer", label: "What I'll offer", rows: 2 },
        ],
      }),
      talk("point", "Point the next visit", 3, "Both", "Decide what the next visit should look for, so it is about something you both care about.", {
        captures: [{ key: "focus", label: "The next visit will look at…", rows: 2 }],
      }),
    ],
  },
  {
    slug: "plc",
    name: "PLC Navigator",
    purpose: "Run one short, focused professional-learning cycle on a single learning target, using the four questions every PLC returns to.",
    outcome: "A learning target, how you will know it landed, and what you will each do if it did or did not.",
    summaryKeys: ["target", "evidence", "reteach", "extend", "commit"],
    steps: [
      talk("target", "What do we want students to learn?", 5, "Both", "Pick one learning target from the next two weeks. One sentence, in student language.", {
        say: ["By the end of this, students will be able to…"],
        captures: [{ key: "target", label: "Our learning target", rows: 2 }],
      }),
      talk("evidence", "How will we know they learned it?", 5, "Both", "Decide what you would see or hear, not a grade. A sentence a student says, a problem they solve unaided.", {
        captures: [{ key: "evidence", label: "We'll know when we see…", rows: 2 }],
      }),
      talk("reteach", "What if they haven't?", 5, "Both", "Plan the response now, so it isn't improvised on the day.", {
        captures: [{ key: "reteach", label: "If they haven't, we will…", rows: 2 }],
      }),
      talk("extend", "What if they already know it?", 5, "Both", "Plan the stretch for students who are ahead.", {
        captures: [{ key: "extend", label: "If they already do, we will…", rows: 2 }],
      }),
      talk("commit", "Commit to next steps", 5, "Both", "Each of you chooses one thing to do before you meet again, and when.", {
        captures: [{ key: "commit", label: "Before we meet again, I will… (and you will…)", rows: 3 }],
      }),
    ],
  },
  {
    slug: "fishbowl",
    name: "Fishbowl Protocol",
    purpose: "Observe one lesson and debrief it, strengths first, with the host choosing the lens.",
    outcome: "A debrief that fills in a conversation entry for you: the focus, a strength, one more-of, one less-of, and what you'll swap.",
    summaryKeys: ["lens", "strength", "more"],
    logMap: { vision: "lens", strength: "strength", more: "more", less: "less", resources: "swap" },
    steps: [
      talk("lens", "Set the lens", 5, "Host talks, visitor listens", "The host says what they are working toward and names the one thing they would like the visitor to watch for. The visitor only listens and writes it down.", {
        say: ["I'm working toward…", "Please watch for…"],
        captures: [{ key: "lens", label: "What the host is working toward", rows: 2 }],
      }),
      talk("watch", "Observe", 10, "Visitor watches and writes", "The visitor writes only what they see and hear, with no judgments. Quotes and moments, not opinions. The host teaches as normal.", {
        captures: [{ key: "seen", label: "What I saw and heard", placeholder: "Moments, quotes, what students did", rows: 5 }],
      }),
      talk("strength", "Name a strength first", 5, "Visitor speaks, host reflects", "The visitor names what worked, as specifically as they can. The host says what it was like to hear it.", {
        say: ["I noticed that…", "That worked because…"],
        captures: [{ key: "strength", label: "What I noticed working", rows: 3 }],
      }),
      talk("wonder", "One wonder, one try", 5, "Both", "The visitor offers one thing to do more of, and, only if it helps, one thing to do less of. The host chooses what to take.", {
        say: ["I wonder what would happen if…"],
        captures: [
          { key: "more", label: "One thing to do more of", rows: 2 },
          { key: "less", label: "One thing to do less of (optional)", rows: 2 },
        ],
      }),
      talk("swap", "What you'll swap", 5, "Both", "Name something each of you will share with the other: a resource, a routine, a handout.", {
        captures: [{ key: "swap", label: "What we'll swap", rows: 2 }],
      }),
    ],
  },
  {
    slug: "efficacy",
    name: "Efficacy Quest",
    purpose: "Notice your wins, work out why they happened, and spot them in your partner. Confidence grows from evidence.",
    outcome: "A win, what made it work, where else it could work, and a win you saw in your partner.",
    summaryKeys: ["win", "why", "saw"],
    practiceKeys: ["win", "why", "again"],
    steps: [
      talk("win", "Name a win", 3, "Each of you, in turn", "Something that went well in your teaching this week. It does not have to be big.", {
        say: ["This week, something that went well was…"],
        captures: [{ key: "win", label: "A win", rows: 2 }],
      }),
      talk("why", "What made it work?", 3, "Each of you", "Look for what you did, not what you were lucky to have. That is the part you can repeat.", {
        captures: [{ key: "why", label: "What I did that made it work", rows: 2 }],
      }),
      talk("again", "Where else could it work?", 2, "Both", "Pick another class, lesson or student where the same move might help.", {
        captures: [{ key: "again", label: "I could try it with…", rows: 2 }],
      }),
      talk("saw", "A win I saw in you", 2, "Each of you", "Tell your partner one thing you have seen them do well.", {
        say: ["One thing I've seen you do really well is…"],
        captures: [{ key: "saw", label: "A win I saw in my partner", rows: 2 }],
      }),
    ],
  },
  {
    slug: "relay",
    name: "Feedback Reframing Relay",
    purpose: "Turn a piece of feedback or a worry into a next step you can act on, with your partner doing the reframing.",
    outcome: "A reframed piece of feedback, one next step, and what changed about how it sounded.",
    summaryKeys: ["reframe", "next"],
    steps: [
      talk("raw", "Write it as it feels", 3, "Teacher 1", "Write one piece of feedback you've received, or a worry about your teaching, in the words you'd naturally use. Don't soften it.", {
        captures: [{ key: "raw", label: "As it feels", rows: 2 }],
      }),
      talk("reframe", "Pass it on and reframe", 6, "Teacher 2", "Teacher 2 rewrites it using the three stems. The point is to keep what's true and make it something you can do something about.", {
        say: ["I noticed…", "I wonder…", "A next step could be…"],
        captures: [{ key: "reframe", label: "The reframe", placeholder: "I noticed… I wonder… A next step could be…", rows: 4 }],
      }),
      talk("next", "Choose one next step", 3, "Teacher 1 chooses", "Pick one next step from the reframe, and say when you'll try it.", {
        captures: [{ key: "next", label: "My one next step, and when", rows: 2 }],
      }),
      talk("swap", "Swap roles", 3, "Both", "Teacher 2 now shares something. Teacher 1 reframes it. Then say what changed about how it sounded.", {
        captures: [{ key: "changed", label: "What changed about how it sounded", rows: 2 }],
      }),
    ],
  },
];

export const protocolFor = (slug: string): Protocol | null => PROTOCOLS.find((p) => p.slug === slug) ?? null;
export const protocolByName = (name: string): Protocol | null => PROTOCOLS.find((p) => p.name === name) ?? null;
export const totalMinutes = (p: Protocol) => p.steps.reduce((n, s) => n + s.minutes, 0);

export type Outputs = Record<string, string>;

/** Every key a protocol can store: captures and per-person choices. */
export function outputKeys(p: Protocol): string[] {
  return p.steps.flatMap((s) => [...(s.captures ?? []).map((c) => c.key), ...(s.choices ?? []).flatMap((c) => [`${c.key}.me`, `${c.key}.partner`])]);
}

/** Keeps only the keys this protocol defines, trimmed and capped, so what is stored is always well-formed. */
export function cleanOutputs(p: Protocol, raw: unknown): Outputs {
  const allowed = new Set(outputKeys(p));
  const out: Outputs = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (allowed.has(k) && typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 400);
    }
  }
  return out;
}

/** The short note stored with the session (at most 500 characters). */
export function summarize(p: Protocol, outputs: Outputs): string {
  const label = new Map(p.steps.flatMap((s) => (s.captures ?? []).map((c) => [c.key, c.label] as const)));
  const parts = p.summaryKeys.filter((k) => outputs[k]).map((k) => `${label.get(k) ?? k}: ${outputs[k].replace(/\s+/g, " ")}`);
  const text = parts.join(" · ");
  return text.length > 500 ? `${text.slice(0, 499).trimEnd()}…` : text;
}

/** For a finished Fishbowl: the five journal-entry fields, ready to save as a draft. */
export function journalFields(p: Protocol, outputs: Outputs) {
  const m = p.logMap;
  if (!m) return null;
  const f = (k?: string) => (k ? (outputs[k] ?? "") : "");
  return { vision: f(m.vision), strength_noted: f(m.strength), more_frequently: f(m.more), less_frequently: f(m.less), resources: f(m.resources) };
}

// Fail loudly in tests, not at 3pm in a classroom: every protocol is a catalogue module and its minutes add up.
export const catalogueProblems = (): string[] => {
  const problems: string[] = [];
  for (const m of MODULES) {
    const p = protocolByName(m.name);
    if (!p) problems.push(`${m.name} has no protocol`);
    else if (totalMinutes(p) !== m.minutes) problems.push(`${m.name}: steps add to ${totalMinutes(p)} min, catalogue says ${m.minutes}`);
  }
  return problems;
};
