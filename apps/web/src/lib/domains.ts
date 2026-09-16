/**
 * Axis B: the Domains of Concern.
 *
 * Read the two-axes rule in CLAUDE.md before touching this file. This is NOT
 * the Culture Scan's four social-capital dimensions (`culture_dimension`:
 * structural / relational / cognitive / efficacy). The two are separate
 * measurement axes that happen to both have four values, and they must never
 * be merged into one field or one lookup.
 *
 * Domain strength is SET MEMBERSHIP, deliberately. A teacher's strengths are
 * stored as `profiles.strength_tags` — free-text tags — and resolved to
 * domains through the table below. There is no score, no ranking and no
 * primary domain, because the data does not contain one: every seeded teacher
 * carries exactly two tags spanning exactly two domains. Anything that renders
 * a bar length or sorts teachers "by strength" would be inventing a magnitude.
 */

export const CONCERN_DOMAINS = [
  "CLASSROOM",
  "PLANNING",
  "COMMUNICATION",
  "ASSESSMENT",
] as const;

export type ConcernDomain = (typeof CONCERN_DOMAINS)[number];

/** Display copy. CELEBRATIONS exists in the DB enum but has no data yet. */
export const DOMAIN_LABEL: Record<string, string> = {
  CLASSROOM: "Classroom Culture",
  PLANNING: "Lesson Planning",
  COMMUNICATION: "Communication",
  ASSESSMENT: "Assessment & Feedback",
  CELEBRATIONS: "Celebrations",
};

/**
 * The canonical 16-tag → 4-domain lookup. Mirrored in
 * scripts/013_demo_enrichment.sql, which derives `teaching_style` from the
 * same mapping — keep the two in step.
 */
export const TAG_TO_DOMAIN: Record<string, ConcernDomain> = {
  "Classroom Presence": "CLASSROOM",
  "Discussion Craft": "CLASSROOM",
  "Clear Explanations": "CLASSROOM",
  "Warm-Strict Culture": "CLASSROOM",

  "Unit Architecture": "PLANNING",
  "Task Design": "PLANNING",
  "Pacing and Sequencing": "PLANNING",
  "Differentiation Planning": "PLANNING",

  "Family Communication": "COMMUNICATION",
  "Student Conferencing": "COMMUNICATION",
  "Team Coordination": "COMMUNICATION",
  "De-escalation and Repair": "COMMUNICATION",

  "Rubric Clarity": "ASSESSMENT",
  "Feedback Efficiency": "ASSESSMENT",
  "Mastery Checks": "ASSESSMENT",
  "Data-Informed Reteach": "ASSESSMENT",
};

/**
 * Resolves a teacher's strength tags to the set of domains they cover.
 * Unknown tags are dropped rather than guessed at — a tag that is not in the
 * lookup is a data problem, and silently bucketing it would hide that.
 */
export function domainsForTags(tags: unknown): ConcernDomain[] {
  if (!Array.isArray(tags)) return [];
  const found = new Set<ConcernDomain>();
  for (const t of tags) {
    const d = TAG_TO_DOMAIN[String(t)];
    if (d) found.add(d);
  }
  return CONCERN_DOMAINS.filter((d) => found.has(d));
}

/* -------------------------------------------------------------- archetypes */

/**
 * Hargreaves teaching styles. Copy is verbatim from the canonical source
 * (~/mentorful-app/app/onboarding/data.js) — do not rewrite it here, or the
 * dashboards and onboarding will drift apart.
 */
export const TEACHING_STYLES = ["nurturer", "activator", "architect"] as const;
export type TeachingStyle = (typeof TEACHING_STYLES)[number];

export const TEACHING_STYLE: Record<TeachingStyle, { label: string; tagline: string }> = {
  nurturer: { label: "Nurturer", tagline: "Care first, then challenge." },
  activator: { label: "Activator", tagline: "Spark curiosity, ignite action." },
  architect: { label: "Architect", tagline: "Design clarity, build mastery." },
};

/**
 * The 11 Kurian Consulting archetypes. Retained for in-person PD and to give
 * co-mentor copy something to contrast on. NOT a dashboard grouping axis.
 */
export const ARCHETYPE_LABEL: Record<string, string> = {
  puzzler: "Puzzler",
  "story-lover": "Story-Lover",
  fixer: "Fixer",
  "mover-shaker": "Mover & Shaker",
  competitor: "Competitor",
  performer: "Performer",
  artist: "Artist",
  collector: "Collector",
  "party-captain": "Party Captain",
  prankster: "Prankster",
  "novelty-seeker": "Novelty-Seeker",
};
