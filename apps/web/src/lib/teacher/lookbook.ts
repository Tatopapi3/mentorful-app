import { domainsForTags, type ConcernDomain } from "@/lib/domains";
import { initialsOf } from "./model";

/**
 * The teacher lookbook, as pure functions: what a colleague shows, how the directory is searched, filtered and paged.
 *
 * Nick's decision (Oct 29): a teacher's visible profile is a FIXED, minimal set: name, department and strengths.
 * Nothing else about a teacher is shown to colleagues here: no photo, no bio, no experience, no years, no archetype.
 * Admins keep email for roster work only, and email is never read by this page. Per-field choices (the site promises
 * teachers choose what is shown) are a known later enhancement; until then the one choice a teacher has is whether
 * they appear in the lookbook at all (scripts/018_teacher_lookbook.sql). Strengths are shown as sets, never as levels,
 * and nothing here ranks or scores a teacher.
 */

export type Card = {
  profileId: string;
  name: string;
  initials: string;
  department: string;
  strengthTags: string[];
  domains: ConcernDomain[];
};

type Row = Record<string, unknown>;
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** One card from a row of lookbook_cards(). Reads only the three fields of the fixed set. */
export function cardFromRow(r: Row): Card {
  const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : "A colleague";
  const tags = arr(r.strength_tags);
  return {
    profileId: String(r.profile_id),
    name,
    initials: initialsOf(name),
    department: typeof r.department === "string" ? r.department : "",
    strengthTags: tags,
    domains: domainsForTags(tags),
  };
}

/* ---------------------------------------------------------------- browsing */

export type Filters = { q: string; departments: string[]; domains: ConcernDomain[] };
export const NO_FILTERS: Filters = { q: "", departments: [], domains: [] };
export const activeFilters = (f: Filters) => f.departments.length + f.domains.length + (f.q.trim() ? 1 : 0);

const haystack = (c: Card) => [c.name, c.department, ...c.strengthTags].join(" ").toLowerCase();

/** Within one facet a card matches ANY chosen option; across facets it must match ALL of them. */
export function filterCards(cards: Card[], f: Filters): Card[] {
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  return cards.filter((c) => {
    if (terms.length && !terms.every((t) => haystack(c).includes(t))) return false;
    if (f.departments.length && !f.departments.includes(c.department)) return false;
    if (f.domains.length && !f.domains.some((d) => c.domains.includes(d))) return false;
    return true;
  });
}

export function facetCounts(cards: Card[]) {
  const count = <T extends string>(vals: (c: Card) => T[]) => {
    const m = new Map<T, number>();
    for (const c of cards) for (const v of new Set(vals(c))) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  };
  return {
    departments: [...count((c) => (c.department ? [c.department] : []))].sort((a, b) => a[0].localeCompare(b[0])),
    domains: count((c) => c.domains),
  };
}

export function paginate<T>(items: T[], page: number, per: number) {
  const pages = Math.max(1, Math.ceil(items.length / per));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { page: p, pages, items: items.slice((p - 1) * per, p * per) };
}

/** A stable hue from a name, so every teacher keeps the same colour everywhere. Teal-to-indigo-to-violet only, to stay in the Aurora palette. */
export function hueFor(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 165 + (h % 120); // 165 (teal) through 285 (violet)
}
