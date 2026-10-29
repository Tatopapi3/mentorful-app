import { ARCHETYPE_LABEL, TEACHING_STYLE, domainsForTags, type ConcernDomain, type TeachingStyle } from "@/lib/domains";
import { initialsOf } from "./model";

/**
 * The teacher lookbook, as pure functions: what a card holds, how a teacher's input is checked, how the grid is
 * searched, filtered and paged. Cards are opt-in and self-authored (see scripts/018_teacher_lookbook.sql); nothing here
 * ranks or scores a teacher, and strengths are shown as sets, never as levels.
 */

export type Experience = { role: string; place: string; years: string };

/** What a teacher says they hope to get out of Mentorful. Presets keep the lookbook searchable; the free text adds nuance. */
export const WANTS = [
  "A thinking partner",
  "Feedback on my lessons",
  "Ideas for classroom culture",
  "Help with planning",
  "Better family communication",
  "Sharper assessment and feedback",
  "To see great teaching up close",
  "To share what works",
] as const;

export type CardInput = {
  headline: string;
  bio: string;
  experience: Experience[];
  achievements: string[];
  growingIn: string[];
  wants: string[];
  wantsText: string;
  showGrowth: boolean;
  published: boolean;
};

export type Card = {
  profileId: string;
  name: string;
  initials: string;
  department: string;
  yearsTeaching: number | null;
  strengthTags: string[];
  domains: ConcernDomain[];
  style: { label: string; tagline: string } | null;
  archetype: string | null;
  inspiration: string | null;
  headline: string;
  bio: string;
  photoUrl: string | null;
  experience: Experience[];
  achievements: string[];
  growingIn: string[];
  wants: string[];
  wantsText: string;
  updatedAt: string;
};

export const LIMITS = { headline: 120, bio: 600, wantsText: 500, achievement: 160, growing: 80, role: 80, place: 80, years: 24, experience: 6, achievements: 8, growingIn: 6, wants: 8 } as const;

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const list = (v: unknown, max: number, count: number) => {
  const out: string[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const s = clean(x, max);
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out.slice(0, count);
};

/** Checks a teacher's card before it is saved. Over-long text is trimmed rather than refused; a published card needs at least something to show. */
export function validateCard(raw: unknown): { ok: true; value: CardInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Nothing to save." };
  const r = raw as Record<string, unknown>;
  const experience: Experience[] = [];
  for (const e of Array.isArray(r.experience) ? r.experience : []) {
    const x = (e ?? {}) as Record<string, unknown>;
    const entry = { role: clean(x.role, LIMITS.role), place: clean(x.place, LIMITS.place), years: clean(x.years, LIMITS.years) };
    if (entry.role || entry.place) experience.push(entry);
  }
  const wants = list(r.wants, 60, LIMITS.wants).filter((w) => (WANTS as readonly string[]).includes(w));
  const value: CardInput = {
    headline: clean(r.headline, LIMITS.headline),
    bio: typeof r.bio === "string" ? r.bio.trim().slice(0, LIMITS.bio) : "",
    experience: experience.slice(0, LIMITS.experience),
    achievements: list(r.achievements, LIMITS.achievement, LIMITS.achievements),
    growingIn: list(r.growingIn, LIMITS.growing, LIMITS.growingIn),
    wants,
    wantsText: typeof r.wantsText === "string" ? r.wantsText.trim().slice(0, LIMITS.wantsText) : "",
    showGrowth: r.showGrowth === true,
    published: r.published === true,
  };
  if (value.published && !value.headline && !value.bio && !value.achievements.length && !value.experience.length && !value.wants.length && !value.wantsText) {
    return { ok: false, error: "Add a headline, a few words about you, or what you hope to get out of Mentorful before you share your card." };
  }
  return { ok: true, value };
}

type Row = Record<string, unknown>;
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** One card from a row of lookbook_cards() (or the author's own row), with its photo link already signed. */
export function cardFromRow(r: Row, photoUrl: string | null): Card {
  const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : "A colleague";
  const tags = arr(r.strength_tags);
  const style = typeof r.teaching_style === "string" ? (TEACHING_STYLE[r.teaching_style as TeachingStyle] ?? null) : null;
  const exp = (Array.isArray(r.experience) ? r.experience : []) as Row[];
  return {
    profileId: String(r.profile_id),
    name,
    initials: initialsOf(name),
    department: typeof r.department === "string" ? r.department : "",
    yearsTeaching: typeof r.years_teaching === "number" ? r.years_teaching : null,
    strengthTags: tags,
    domains: domainsForTags(tags),
    style,
    archetype: typeof r.archetype_id === "string" ? (ARCHETYPE_LABEL[r.archetype_id] ?? null) : null,
    inspiration: typeof r.inspiration === "string" && r.inspiration.trim() ? r.inspiration.trim() : null,
    headline: typeof r.headline === "string" ? r.headline : "",
    bio: typeof r.bio === "string" ? r.bio : "",
    photoUrl,
    experience: exp.map((e) => ({ role: String(e.role ?? ""), place: String(e.place ?? ""), years: String(e.years ?? "") })),
    achievements: arr(r.achievements),
    growingIn: arr(r.growing_in),
    wants: arr(r.wants),
    wantsText: typeof r.wants_text === "string" ? r.wants_text : "",
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : "",
  };
}

/* ---------------------------------------------------------------- browsing */

export const YEARS_BANDS = [
  { key: "0-2", label: "0–2 years", test: (y: number) => y <= 2 },
  { key: "3-5", label: "3–5 years", test: (y: number) => y >= 3 && y <= 5 },
  { key: "6-10", label: "6–10 years", test: (y: number) => y >= 6 && y <= 10 },
  { key: "11-20", label: "11–20 years", test: (y: number) => y >= 11 && y <= 20 },
  { key: "20+", label: "20+ years", test: (y: number) => y > 20 },
] as const;

export type Filters = { q: string; departments: string[]; domains: ConcernDomain[]; bands: string[]; wants: string[]; styles: string[] };
export const NO_FILTERS: Filters = { q: "", departments: [], domains: [], bands: [], wants: [], styles: [] };
export const activeFilters = (f: Filters) => f.departments.length + f.domains.length + f.bands.length + f.wants.length + f.styles.length + (f.q.trim() ? 1 : 0);

const haystack = (c: Card) => [c.name, c.headline, c.bio, c.department, c.wantsText, c.inspiration ?? "", ...c.achievements, ...c.strengthTags, ...c.wants, ...c.experience.flatMap((e) => [e.role, e.place])].join(" ").toLowerCase();

/** Within one facet a card matches ANY chosen option; across facets it must match ALL of them. */
export function filterCards(cards: Card[], f: Filters): Card[] {
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  return cards.filter((c) => {
    if (terms.length && !terms.every((t) => haystack(c).includes(t))) return false;
    if (f.departments.length && !f.departments.includes(c.department)) return false;
    if (f.domains.length && !f.domains.some((d) => c.domains.includes(d))) return false;
    if (f.styles.length && !(c.style && f.styles.includes(c.style.label))) return false;
    if (f.wants.length && !f.wants.some((w) => c.wants.includes(w))) return false;
    if (f.bands.length) {
      if (c.yearsTeaching === null) return false;
      const y = c.yearsTeaching;
      if (!YEARS_BANDS.some((b) => f.bands.includes(b.key) && b.test(y))) return false;
    }
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
    styles: count((c) => (c.style ? [c.style.label] : [])),
    wants: count((c) => c.wants),
    bands: new Map(YEARS_BANDS.map((b) => [b.key, cards.filter((c) => c.yearsTeaching !== null && b.test(c.yearsTeaching)).length])),
  };
}

export function paginate<T>(items: T[], page: number, per: number) {
  const pages = Math.max(1, Math.ceil(items.length / per));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { page: p, pages, items: items.slice((p - 1) * per, p * per) };
}

/** A stable hue from a name, so a teacher without a photo keeps the same colour everywhere. Teal-to-indigo-to-violet only, to stay in the Aurora palette. */
export function hueFor(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 165 + (h % 120); // 165 (teal) through 285 (violet)
}
