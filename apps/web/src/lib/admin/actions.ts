/**
 * "What to do next": rules over the facts, never guesses. Each action states the number that triggered
 * it. An action that doesn't apply simply doesn't appear, so different data gives a different list.
 */
import { DOMAIN_LABEL } from "@/lib/domains";
import { DIMENSION_LABEL } from "@/lib/report/stats";
import type { Facts } from "./facts";

export type Severity = "do" | "watch" | "good";
export type AdminAction = { id: string; severity: Severity; title: string; detail: string; href: string; cta: string };

/** Conversation domains route to a professional learning community type. */
export const PLC_FOR_DOMAIN: Record<string, string> = {
  CLASSROOM: "Clinic",
  PLANNING: "Toolbox",
  COMMUNICATION: "Task Force",
  ASSESSMENT: "Data Dive",
  CELEBRATIONS: "Celebrations",
};

export const TARGET_COMPLETION_PCT = 80;
export const TARGET_CROSS_PCT = 50;
export const GAP_NOTABLE = 0.5;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * The leadership views come in two looks: Nick's (under /admin) and Aurora (under /admin/aurora). Links
 * stay inside the look you are in, so `base` is the path prefix of the current look.
 */
export type LookBase = "/admin" | "/admin/aurora";

export function buildActions(f: Facts, base: LookBase = "/admin"): AdminAction[] {
  const out: AdminAction[] = [];

  if (f.pendingRequests > 0) {
    out.push({
      id: "requests",
      severity: "do",
      title: `Decide on ${f.pendingRequests} pairing ${plural(f.pendingRequests, "request", "requests")}`,
      detail: "Teachers proposed these pairs. They stay pending until you approve them, and the colleague is never told what you decide.",
      href: `${base}/constellation`,
      cta: "See them",
    });
  }

  if (f.unpaired > 0) {
    out.push({
      id: "unpaired",
      severity: "do",
      title: `Pair the ${f.unpaired} unpaired ${plural(f.unpaired, "teacher", "teachers")}`,
      detail: `${f.paired} of ${f.faculty} teachers have a partner. Pairs that mix departments connect people who rarely talk.`,
      href: `${base}/constellation`,
      cta: "Open the constellation",
    });
  }

  if (f.scan) {
    const w = f.scan.weakest;
    const top = f.scan.strongest;
    if (f.scan.completionPct !== null && f.scan.completionPct < TARGET_COMPLETION_PCT) {
      out.push({
        id: "completion",
        severity: "watch",
        title: `Scan completion is ${f.scan.completionPct}%, below the ${TARGET_COMPLETION_PCT}% target`,
        detail: `${f.faculty - f.scan.n} ${plural(f.faculty - f.scan.n, "teacher hasn't", "teachers haven't")} responded. Responses are anonymous, so follow up with the whole faculty.`,
        href: `${base}/insights`,
        cta: "Open Insights",
      });
    }
    out.push({
      id: "weakest",
      severity: "do",
      title: `Start with ${DIMENSION_LABEL[w.dimension]}`,
      detail: `${DIMENSION_LABEL[w.dimension]} is the weakest dimension at ${w.mean.toFixed(1)} of 6, ${(top.mean - w.mean).toFixed(1)} points below ${DIMENSION_LABEL[top.dimension]}. It is the lowest-cost place to intervene.`,
      href: `${base}/insights`,
      cta: "Open Insights",
    });
    if (f.scan.gap >= GAP_NOTABLE) {
      out.push({
        id: "gap",
        severity: "watch",
        title: `Efficacy runs ${f.scan.gap.toFixed(1)} points ahead of Structural`,
        detail: "Staff believe in what they can do together, but the structures meant to carry that belief are not keeping up. That belief is resting on goodwill.",
        href: `${base}/insights`,
        cta: "Open Insights",
      });
    }
  } else {
    out.push({
      id: "no-scan",
      severity: "watch",
      title: "No Culture Scan results yet",
      detail: "Results appear once enough teachers respond. Nothing is guessed before then.",
      href: `${base}/insights`,
      cta: "Open Insights",
    });
  }

  if (f.topDomain) {
    const plc = PLC_FOR_DOMAIN[f.topDomain.domain];
    out.push({
      id: "domain",
      severity: "watch",
      title: `Pairs work most on ${DOMAIN_LABEL[f.topDomain.domain] ?? f.topDomain.domain}`,
      detail: `${f.topDomain.count} of ${f.pairCount} pairs chose it.${plc ? ` Conversation domains route to PLCs: a ${plc} would meet an existing need.` : ""}`,
      href: `${base}/insights`,
      cta: "Open Insights",
    });
  }

  if (f.crossPct !== null && f.crossPct >= TARGET_CROSS_PCT) {
    out.push({
      id: "cross",
      severity: "good",
      title: `${f.crossPct}% of pairs cross departments`,
      detail: `${f.crossPairs} of ${f.pairCount} pairs connect people from different departments. That is the point of the program.`,
      href: `${base}/constellation`,
      cta: "Open the constellation",
    });
  }
  if (f.scan) {
    out.push({
      id: "strongest",
      severity: "good",
      title: `${DIMENSION_LABEL[f.scan.strongest.dimension]} is the strongest dimension`,
      detail: `${f.scan.strongest.mean.toFixed(1)} of 6 across ${f.scan.n} ${plural(f.scan.n, "respondent", "respondents")}. Name it, and protect the routines that produce it.`,
      href: `${base}/insights`,
      cta: "Open Insights",
    });
  }

  const order: Record<Severity, number> = { do: 0, watch: 1, good: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
