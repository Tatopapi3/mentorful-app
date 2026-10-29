/**
 * The leadership deck: a few 16:9 slides an admin can take into a staff meeting or to the board. One model feeds both
 * the PowerPoint file and the print-ready page that saves as a PDF, so the two always say the same thing.
 * Aggregates only: counts and rates by school and by department of five or more teachers. No names, no survey
 * answers, no conversation content. Pure: no database, no React.
 */
import { demoCount, respondentsText } from "@/lib/report/gates";
import { DOMAIN_LABEL } from "@/lib/domains";
import { DIMENSIONS, DIMENSION_LABEL } from "@/lib/report/stats";
import { buildFacts, headlineSentence, type AdminSnapshot } from "./facts";
import { facultyOrbit } from "./faculty-orbit";
import { coverage, departmentMatrix, directions, progress } from "./network";
import { participationRates } from "./participation";

export type DeckStat = { value: string; label: string; note: string };
export type DeckBlock =
  | { kind: "stats"; items: DeckStat[] }
  | { kind: "bars"; rows: { label: string; value: number; max: number; text: string }[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "points"; items: { title: string; detail: string }[] }
  | { kind: "note"; text: string };
export type DeckSlide = { kicker: string; title: string; lead?: string; blocks: DeckBlock[]; cover?: boolean };
export type Deck = { school: string; cycle: string; date: string; slides: DeckSlide[] };

const pct = (n: number | null) => (n === null ? "n/a" : `${n}%`);

export function buildDeck(snap: AdminSnapshot, prev: AdminSnapshot | null, today: Date): Deck {
  const facts = buildFacts(snap);
  const m = departmentMatrix(snap);
  const cov = coverage(m);
  const orbit = facultyOrbit(snap, snap.participation ?? null, prev);
  const rates = snap.participation ? participationRates(snap.participation) : null;
  const dirs = directions(snap, m, progress(snap, prev), prev?.cycle?.name ?? null).slice(0, 4);
  const cycle = snap.cycle?.name ?? "No cycle";
  const date = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const slides: DeckSlide[] = [];

  slides.push({ cover: true, kicker: "Mentorful · Leadership summary", title: snap.school.name, lead: headlineSentence(facts), blocks: [{ kind: "note", text: `${cycle} · ${date}` }] });

  const topics = Object.entries(facts.domainCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const topicBlocks: DeckBlock[] =
    topics.length > 0 ? [{ kind: "bars", rows: topics.slice(0, 5).map(([d, n]) => ({ label: `Pairs working on ${DOMAIN_LABEL[d] ?? d}`, value: n, max: Math.max(...topics.map((x) => x[1])), text: String(n) })) }] : [];

  slides.push({
    kicker: "Where connection stands",
    title: "Everyone paired, and how far the pairs reach",
    lead: headlineSentence(facts),
    blocks: [
      {
        kind: "stats",
        items: [
          { value: pct(facts.pairedPct), label: "Have a partner", note: `${facts.paired} of ${facts.faculty} teachers` },
          { value: pct(facts.crossPct), label: "Pairs cross departments", note: `${facts.crossPairs} of ${facts.pairCount} pairs` },
          { value: String(facts.conversations), label: "Logged conversations", note: facts.conversationsPerPair !== null ? `${facts.conversationsPerPair} per pair` : "none yet" },
          { value: facts.scan ? facts.scan.cte.toFixed(1) : "n/a", label: "CTE score", note: facts.scan ? `out of 6 · ${facts.scan.n} responses` : "no scan results" },
        ],
      },
      ...topicBlocks,
    ],
  });

  if (snap.scan) {
    const s = snap.scan;
    slides.push({
      kicker: "Culture Scan · school-wide averages",
      title: "How teachers rate the four dimensions",
      lead: facts.scan ? `Teachers rate ${DIMENSION_LABEL[facts.scan.strongest.dimension].toLowerCase()} highest and ${DIMENSION_LABEL[facts.scan.weakest.dimension].toLowerCase()} lowest.` : undefined,
      blocks: [
        { kind: "bars", rows: DIMENSIONS.map((d) => ({ label: DIMENSION_LABEL[d], value: s.means[d], max: 6, text: `${s.means[d].toFixed(1)} of 6` })) },
        { kind: "note", text: `${respondentsText(s)}. Answers are anonymous and shown only as school-wide averages.${demoCount(s) > 0 ? " Includes synthetic demo data." : ""}` },
      ],
    });
  }

  if (orbit.planets.length >= 2) {
    slides.push({
      kicker: "Faculty connection",
      title: `${cov.connected} of ${cov.possible} department connections exist`,
      lead: "Departments with five or more teachers. A connection means at least one pair between two departments.",
      blocks: [
        {
          kind: "table",
          head: ["Department", "Teachers", "Reaches", "Pairs that cross", "Have talked"],
          rows: orbit.planets.map((p) => [p.dept, String(p.teachers), `${p.reach} of ${p.possible}`, p.pairs > 0 ? `${p.across} of ${p.pairs}` : "no pairs", p.activePct === null ? "n/a" : `${p.activePct}%`]),
        },
        ...(m.omitted.length > 0 ? [{ kind: "note" as const, text: `${m.omitted.length} group${m.omitted.length === 1 ? "" : "s"} with fewer than 5 teachers ${m.omitted.length === 1 ? "is" : "are"} hidden to protect privacy.` }] : []),
      ],
    });
  }

  if (dirs.length > 0) {
    slides.push({ kicker: "Where to head next", title: "What to do, in order", blocks: [{ kind: "points", items: dirs.map((d) => ({ title: d.title, detail: d.detail })) }] });
  }

  const rateRows = rates
    ? ([
        ["Pairs with a conversation", rates.conversationPct],
        ["Pairs with a debrief", rates.debriefPct],
        ["Pairs that did both", rates.completePct],
        ["Teachers in a pair that has talked", rates.activePct],
      ] as [string, number | null][]).flatMap(([label, v]) => (v === null ? [] : [{ label, value: v, max: 100, text: `${v}%` }]))
    : [];
  if (rateRows.length > 0) {
    slides.push({ kicker: "Participation", title: "How pairs are using their time", blocks: [{ kind: "bars", rows: rateRows }] });
  }

  slides.push({
    kicker: "Privacy",
    title: "What leadership can and cannot see",
    blocks: [
      {
        kind: "points",
        items: [
          { title: "Counts and rates only", detail: "Leadership sees how many conversations happened and in which areas, never what was said." },
          { title: "Small groups stay hidden", detail: "Any group under five people is left out, so no one can be picked out of a number." },
          { title: "Survey answers are anonymous", detail: "Results are school-wide averages with no link to a teacher or a department." },
        ],
      },
    ],
  });

  return { school: snap.school.name, cycle, date, slides };
}
