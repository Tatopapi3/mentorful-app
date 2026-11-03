/**
 * The numbers the Demo Day slides show, in one small file (the slides are a client component, so they cannot import the
 * stage dataset). tests/slide-facts.test.ts checks every number here against the stage data, so a slide can never say
 * something the app screens do not.
 */
export const SLIDE_FACTS = {
  /** Collective efficacy (the CTE score), out of 6, last year and this year. */
  cte: { before: 5.1, now: 4.2 },
  /** Each dimension's average out of 6. */
  dimensions: [
    { key: "structural", label: "Structural", note: "Who talks to whom", before: 4.0, now: 2.6 },
    { key: "relational", label: "Relational", note: "Psychological safety", before: 5.2, now: 4.4 },
    { key: "cognitive", label: "Cognitive", note: "Shared language", before: 5.1, now: 4.3 },
    { key: "efficacy", label: "Efficacy", note: "Collective efficacy", before: 5.1, now: 4.2 },
  ],
  unpaired: 8,
  /** The five departments of five or more teachers, and the pairs of them with no pair between them yet. */
  departments: ["Arts", "English", "History", "Math", "Science"],
  gaps: [
    ["English", "Science"],
    ["Arts", "English"],
    ["History", "Science"],
  ],
} as const;

export const pct = (outOfSix: number) => Math.round((outOfSix / 6) * 100);
