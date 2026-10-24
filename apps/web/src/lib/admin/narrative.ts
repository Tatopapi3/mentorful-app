/**
 * The board narrative: a plain-language account of a cycle, written from the same numbers the dashboard shows. It is
 * built from templates over those numbers, not generated freely, so every sentence can name the figure behind it,
 * nothing is said that the data doesn't support, and the page works the same offline. Counts and averages only: no
 * names, no answers, no conversations. Pure: no database, no React.
 */
import { DIMENSION_LABEL } from "@/lib/report/stats";
import { buildActions } from "./actions";
import type { Facts, AdminSnapshot } from "./facts";
import { headlineTitle, type DeptMatrix, type Progress, coverage, directions, gaps, reach } from "./network";
import { countLabel, type Cooling } from "./early-warning";
import { themeSentences, type ThemeReading } from "./themes";

export type NarrativeSection = { heading: string; paragraphs: string[] };
export type Narrative = { title: string; sections: NarrativeSection[]; basis: string[] };

export type NarrativeInput = {
  snap: AdminSnapshot;
  facts: Facts;
  matrix: DeptMatrix;
  progress: Progress[];
  /** Name of the cycle before this one, when there is one. */
  previousName: string | null;
  cooling: Cooling | null;
  themes: ThemeReading;
  momentum: { direction: "up" | "down" | "level"; changePct: number; recent: number; before: number } | null;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Representative once at least this share of faculty responded; below it the Culture Scan is called an early look. */
const REPRESENTATIVE_SHARE = 0.6;

export function buildNarrative(i: NarrativeInput): Narrative {
  const { snap, facts, matrix, progress, previousName, cooling, themes, momentum } = i;
  const cycle = snap.cycle?.name ?? "this cycle";
  const head = headlineTitle(progress);
  const sections: NarrativeSection[] = [];
  const basis: string[] = [];

  // 1. Where things stand
  const stand: string[] = [];
  stand.push(`${snap.school.name} has ${facts.faculty} teachers in ${cycle}. ${facts.paired} of them (${facts.pairedPct ?? 0}%) have a co-mentor, in ${facts.pairCount} ${plural(facts.pairCount, "pair", "pairs")}.`);
  if (facts.crossPct !== null) stand.push(`${facts.crossPairs} of those pairs (${facts.crossPct}%) connect teachers from different departments.`);
  const cov = coverage(matrix);
  if (matrix.depts.length >= 2) stand.push(`Across ${matrix.depts.length} departments of five or more teachers, ${cov.connected} of ${cov.possible} possible department-to-department connections exist.`);
  if (facts.conversations > 0) stand.push(`${facts.conversations} ${plural(facts.conversations, "conversation has", "conversations have")} been logged${facts.conversationsPerPair !== null ? `, ${facts.conversationsPerPair} per pair` : ""}.`);
  sections.push({ heading: `${head.lead} ${head.em}`, paragraphs: stand });
  basis.push(`Teachers: ${facts.faculty}`, `Teachers with a partner: ${facts.paired} (${facts.pairedPct ?? 0}%)`, `Pairs: ${facts.pairCount}`, `Pairs across departments: ${facts.crossPairs}${facts.crossPct !== null ? ` (${facts.crossPct}%)` : ""}`, `Department connections: ${cov.connected} of ${cov.possible}`);

  // 2. Change since last cycle
  if (progress.length > 0 && previousName) {
    sections.push({
      heading: `Since ${previousName}`,
      paragraphs: [progress.map((p) => `${p.label.toLowerCase()} ${p.delta === "same" ? `stayed at ${p.now}` : `went from ${p.before} to ${p.now}`}`).join("; ").replace(/^./, (c) => c.toUpperCase()) + "."],
    });
  }

  // 3. Momentum and early warning
  const pace: string[] = [];
  if (momentum) {
    pace.push(
      momentum.direction === "level"
        ? `Conversation volume is level: ${momentum.recent} in the last four weeks against ${momentum.before} in the four before.`
        : `Conversation volume is ${momentum.direction === "up" ? "up" : "down"} ${Math.abs(momentum.changePct)}%: ${momentum.recent} in the last four weeks against ${momentum.before} in the four before.`,
    );
    basis.push(`Conversations, last four weeks: ${momentum.recent} (before: ${momentum.before})`);
  }
  if (cooling && cooling.pairs > 0) {
    if (cooling.cooling + cooling.quiet === 0) pace.push("Every pair has logged a conversation in the last two weeks.");
    else {
      if (cooling.cooling > 0) pace.push(`${countLabel(cooling.cooling)} ${plural(cooling.cooling, "pair has", "pairs have")} been silent for two to four weeks, the group most likely to drift without a nudge.`);
      if (cooling.quiet > 0) pace.push(`${countLabel(cooling.quiet)} ${plural(cooling.quiet, "pair has", "pairs have")} been silent for a month or more.`);
    }
    basis.push(`Pairs silent 14 to 30 days: ${countLabel(cooling.cooling)}`, `Pairs silent 30 days or more: ${countLabel(cooling.quiet)}`);
  }
  if (pace.length > 0) sections.push({ heading: "Pace", paragraphs: pace });

  // 4. What pairs are working on
  if (themes.total > 0) {
    sections.push({ heading: "What pairs are working on", paragraphs: themeSentences(themes) });
    for (const t of themes.shown.slice(0, 3)) basis.push(`${t.label}: ${t.pairs} ${plural(t.pairs, "pair", "pairs")}`);
  }

  // 5. Culture Scan
  if (snap.scan && facts.scan) {
    const early = snap.scan.n < REPRESENTATIVE_SHARE * facts.faculty;
    const s = facts.scan;
    const lines = [
      `${snap.scan.n} ${plural(snap.scan.n, "response", "responses")} so far. Teachers rate ${DIMENSION_LABEL[s.strongest.dimension].toLowerCase()} highest (${s.strongest.mean.toFixed(1)} of 6) and ${DIMENSION_LABEL[s.weakest.dimension].toLowerCase()} lowest (${s.weakest.mean.toFixed(1)}). Collective teacher efficacy is ${s.cte.toFixed(1)}, give or take ${s.cteCi.toFixed(1)}.`,
    ];
    if (early) lines.push(`This is an early look, not yet representative: ${snap.scan.n} of ${facts.faculty} teachers have responded. Read these averages as a first impression.`);
    if (snap.scan.includesSynthetic) lines.push("Some of these responses are demonstration data.");
    sections.push({ heading: "School culture", paragraphs: lines });
    basis.push(`Culture Scan responses: ${snap.scan.n}`, `Collective efficacy: ${s.cte.toFixed(1)} of 6`);
  }

  // 6. What is going well / what needs attention
  const dirs = directions(snap, matrix, progress, previousName);
  const good = dirs.filter((d) => d.severity === "good");
  const attention = dirs.filter((d) => d.severity !== "good");
  if (good.length > 0) sections.push({ heading: "What is going well", paragraphs: good.map((d) => `${d.title}. ${d.detail}`) });
  if (attention.length > 0) sections.push({ heading: "What needs attention", paragraphs: attention.slice(0, 4).map((d) => `${d.title}. ${d.detail}`) });

  // 7. Next steps
  const next = buildActions(facts).filter((a) => a.severity !== "good").slice(0, 3);
  const g = gaps(matrix);
  const steps = next.map((a, n) => `${n + 1}. ${a.title}. ${a.detail}`);
  if (steps.length === 0 && g.length === 0) steps.push("Nothing needs doing right now. Keep the pairs talking.");
  const edge = reach(matrix)[0];
  if (edge && edge.connected === 0 && matrix.depts.length >= 3) steps.push(`${edge.dept} reaches none of the other ${edge.possible} departments. One pair from ${edge.dept} to any of them is the single biggest gain available.`);
  sections.push({ heading: "Recommended next steps", paragraphs: steps });

  return { title: `${snap.school.name}: the story of ${cycle}`, sections, basis };
}

/** The narrative as plain text, for copying into an email or a board packet. */
export function narrativeText(n: Narrative): string {
  const body = n.sections.map((s) => `${s.heading}\n${s.paragraphs.join("\n")}`).join("\n\n");
  return `${n.title}\n\n${body}\n\nThe numbers behind this\n${n.basis.map((b) => `- ${b}`).join("\n")}\n\nCounts and averages only. Groups under five are left out, survey answers are anonymous, and nothing here shows what teachers said to each other.`;
}
