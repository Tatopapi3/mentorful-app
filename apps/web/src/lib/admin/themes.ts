/**
 * What pairs are working on, as themes, worked out from the structured choices a pair already makes: the concern
 * domain and the strategic tag on the pairing. No conversation text is read, and leadership never sees any, so this
 * keeps the rule that conversations are pair-private. A theme backed by fewer than MIN_CELL pairs is not shown.
 * Pure: no database, no React.
 */
import { DOMAIN_LABEL } from "@/lib/domains";
import { PLC_FOR_DOMAIN } from "./actions";
import type { AdminPair, AdminPerson } from "./facts";
import { MIN_CELL } from "./participation";

export type Theme = {
  domain: string;
  label: string;
  pairs: number;
  sharePct: number;
  /** Pairs on this theme that cross departments, or null when the theme is too small to split. */
  crossPct: number | null;
  /** The professional learning community this theme routes to, if any. */
  plc: string | null;
};

export type ThemeReading = {
  total: number;
  shown: Theme[];
  /** How many pairs belong to a theme too small to show. */
  hiddenPairs: number;
  /** Domains no pair chose at all (an empty theme is a count of zero, which reveals nobody). */
  untouched: string[];
  alignment: { priority: string; matching: number; sharePct: number } | null;
};

const ALL_DOMAINS = ["CLASSROOM", "PLANNING", "COMMUNICATION", "ASSESSMENT"] as const;

/** Whether a pair's strategic tag speaks to the school's priority. A loose, case-insensitive containment match, nothing cleverer. */
export function matchesPriority(tag: string | null, priority: string | null): boolean {
  if (!tag || !priority) return false;
  const t = tag.trim().toLowerCase();
  const p = priority.trim().toLowerCase();
  return t.length > 0 && p.length > 0 && (t.includes(p) || p.includes(t));
}

export function readThemes(people: AdminPerson[], pairs: AdminPair[], priority: string | null): ThemeReading {
  const dept = new Map(people.map((p) => [p.id, p.dept]));
  const by = new Map<string, { n: number; cross: number }>();
  for (const p of pairs) {
    const d = p.domain ?? "NONE";
    const e = by.get(d) ?? { n: 0, cross: 0 };
    e.n++;
    if (dept.get(p.a) !== dept.get(p.b)) e.cross++;
    by.set(d, e);
  }
  const total = pairs.length;
  const shown: Theme[] = [];
  let hiddenPairs = 0;
  for (const [domain, e] of by) {
    if (domain === "NONE") continue;
    if (e.n < MIN_CELL) {
      hiddenPairs += e.n;
      continue;
    }
    shown.push({ domain, label: DOMAIN_LABEL[domain] ?? domain, pairs: e.n, sharePct: Math.round((e.n / total) * 100), crossPct: Math.round((e.cross / e.n) * 100), plc: PLC_FOR_DOMAIN[domain] ?? null });
  }
  shown.sort((a, b) => b.pairs - a.pairs || a.label.localeCompare(b.label));
  const matching = priority ? pairs.filter((p) => matchesPriority(p.tag, priority)).length : 0;
  return {
    total,
    shown,
    hiddenPairs,
    untouched: ALL_DOMAINS.filter((d) => !by.has(d)).map((d) => DOMAIN_LABEL[d]),
    alignment: priority && total > 0 && matching >= MIN_CELL ? { priority, matching, sharePct: Math.round((matching / total) * 100) } : null,
  };
}

/** Which way weekly conversation volume is moving: the last four weeks against the four before. Null without enough shown weeks. */
export function momentum(totals: { week: string; n: number | null }[]): { recent: number; before: number; direction: "up" | "down" | "level"; changePct: number } | null {
  const shown = totals.filter((t): t is { week: string; n: number } => t.n !== null).sort((a, b) => a.week.localeCompare(b.week));
  if (shown.length < 8) return null;
  const last = shown.slice(-4).reduce((s, t) => s + t.n, 0);
  const prev = shown.slice(-8, -4).reduce((s, t) => s + t.n, 0);
  if (prev === 0) return null;
  const changePct = Math.round(((last - prev) / prev) * 100);
  return { recent: last, before: prev, direction: changePct > 5 ? "up" : changePct < -5 ? "down" : "level", changePct };
}

/** The reading in one or two plain sentences. */
export function themeSentences(r: ThemeReading): string[] {
  if (r.total === 0) return ["No pairs have chosen a theme yet."];
  const out: string[] = [];
  const top = r.shown[0];
  if (top) out.push(`${top.label} is the most common theme: ${top.pairs} of ${r.total} pairs (${top.sharePct}%).`);
  else out.push("No single theme has five or more pairs yet, so none is shown.");
  if (r.untouched.length > 0 && r.shown.length > 0) out.push(`No pair has chosen ${r.untouched.join(" or ")}.`);
  if (r.alignment) out.push(`${r.alignment.matching} of ${r.total} pairs (${r.alignment.sharePct}%) are tagged to the school priority, "${r.alignment.priority}".`);
  return out;
}
