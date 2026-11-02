import { demoCount, respondentLabel, respondentsText } from "@/lib/report/gates";
import { buildActions } from "./actions";
import { buildFacts, headlineSentence, type AdminSnapshot } from "./facts";
import { participationRates } from "./participation";
import { scanChange } from "./scan-change";
import type { SummaryPdfInput } from "./pdf";

const LABEL = { do: "Do this", watch: "Keep an eye on", good: "Going well" } as const;

/** The board summary's numbers and words, the same ones the page shows, ready for the PDF. */
export function summaryPdfInput(snap: AdminSnapshot, today: Date): SummaryPdfInput {
  const facts = buildFacts(snap);
  const change = scanChange(snap);
  const sinceLast = change ? ` · ${change.cteNow < change.cteBefore ? "down" : "up"} ${Math.abs(change.cteNow - change.cteBefore).toFixed(1)} since last year` : "";
  const rates = snap.participation ? participationRates(snap.participation) : null;
  const actions = buildActions(facts).filter((a) => a.severity !== "good").slice(0, 3);
  return {
    school: snap.school.name,
    cycle: snap.cycle?.name ?? "No cycle",
    date: today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    headline: headlineSentence(facts),
    stats: [
      { label: "Have a partner", value: facts.pairedPct === null ? "n/a" : `${facts.pairedPct}%`, note: `${facts.paired} of ${facts.faculty} teachers` },
      { label: "Cross departments", value: facts.crossPct === null ? "n/a" : `${facts.crossPct}%`, note: `${facts.crossPairs} of ${facts.pairCount} pairs` },
      { label: "Logged conversations", value: String(facts.conversations), note: facts.conversationsPerPair !== null ? `${facts.conversationsPerPair} per pair` : "none yet" },
      { label: "CTE score", value: facts.scan ? facts.scan.cte.toFixed(1) : "n/a", note: facts.scan ? `out of 6 · ${respondentLabel(facts.scan.n, demoCount(facts.scan))}${sinceLast}` : "no scan results" },
    ],
    scan: snap.scan ? { means: snap.scan.means, ci: snap.scan.ci, respondents: respondentsText(snap.scan) } : null,
    participation: rates
      ? `${rates.conversationPct}% of pairs have logged a conversation, ${rates.debriefPct}% have held a debrief, and ${rates.completePct}% have done both. ${rates.activePct}% of teachers are in a pair that has talked.`
      : null,
    actions: actions.map((a) => ({ tone: a.severity, label: LABEL[a.severity], title: a.title, detail: a.detail })),
    footnote: "Survey answers are anonymous and shown only as school-wide averages. Leadership sees that conversations happened and how many, never what was said.",
  };
}
