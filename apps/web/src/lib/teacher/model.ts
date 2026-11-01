import { ARCHETYPE_LABEL, DOMAIN_LABEL, TEACHING_STYLE, domainsForTags, type ConcernDomain, type TeachingStyle } from "@/lib/domains";

/**
 * What the teacher's own dashboard shows, worked out from the rows they are allowed to read.
 *
 * Everything here is a pure function of those rows, so it can be tested without a database. Two rules from the
 * product carry through: nothing is scored or ranked (strengths are set membership, counts are counts), and the
 * text of a conversation only ever reaches the two people in it, which is why this model is built from the
 * signed-in teacher's own session reads and never from an admin read.
 */

export type PersonRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  teaching_style: string | null;
  archetype_id: string | null;
  inspiration?: string | null;
  strength_tags: unknown;
};

export type PairingRow = {
  id: string;
  host_id: string;
  visitor_id: string;
  domain: string | null;
  cycle_id: string | null;
};

export type LogRow = {
  id: string;
  pairing_id: string | null;
  cycle_id: string | null;
  domain: string;
  vision: string | null;
  strength_noted: string | null;
  more_frequently: string | null;
  less_frequently: string | null;
  resources: string | null;
  status: string;
  submitted_at: string | null;
  created_at: string;
  host_id: string;
  visitor_id: string;
  logged_by: string | null;
  is_visit_debrief?: boolean | null;
};

export type CycleRow = { id: string; name: string; status: string | null; ends_at: string | null };

export type Partner = {
  pairingId: string;
  id: string;
  name: string;
  first: string;
  initials: string;
  department: string;
  /** True when this colleague visits the teacher's classroom, false when the teacher visits theirs. */
  visitsMe: boolean;
  domain: string | null;
  domainLabel: string | null;
  theirDomains: ConcernDomain[];
  shared: ConcernDomain[];
  styleLine: string | null;
  archetype: string | null;
  contrast: boolean;
  conversations: number;
  lastAt: string | null;
};

export type Entry = {
  id: string;
  pairingId: string | null;
  partnerName: string;
  partnerFirst: string;
  /** "They observed you" or "You observed them", the same wording Nick's journal uses. */
  direction: "visitsMe" | "iVisit";
  domain: string;
  domainLabel: string;
  status: "draft" | "submitted";
  /** The best single moment for the entry: when it was submitted, or when the draft was started. */
  at: string;
  createdAt: string;
  submittedAt: string | null;
  vision: string | null;
  strength: string | null;
  more: string | null;
  less: string | null;
  resources: string | null;
  mine: boolean;
};

export type Noticed = { text: string; byFirst: string; at: string };

export type Model = {
  me: {
    id: string;
    name: string;
    first: string;
    initials: string;
    department: string;
    domains: ConcernDomain[];
    style: { label: string; tagline: string } | null;
    archetype: string | null;
    inspiration: string | null;
  };
  cycle: { name: string; ends: string | null; closed: boolean } | null;
  partners: Partner[];
  entries: Entry[];
  draft: Entry | null;
  /** Submitted entries in the current cycle. */
  conversations: number;
  byDomain: { domain: string; label: string; n: number }[];
  steps: { hosted: boolean; visited: boolean; debrief: boolean };
  lastAt: string | null;
  /** The strength a colleague last wrote down about this teacher, validation first. */
  noticed: Noticed | null;
  /** How a colleague last described what this teacher is working toward. */
  focus: Noticed | null;
};

const DAY = 86_400_000;

export const fullName = (p: { first_name: string | null; last_name: string | null } | null | undefined) =>
  (p ? [p.first_name, p.last_name].filter(Boolean).join(" ").trim() : "") || "A colleague";

/** Initials for an avatar. A leading title (Ms., Mr., Mrs., Dr.) is not part of anyone's initials. */
export const initialsOf = (name: string) =>
  name.split(/\s+/).filter((w) => w && !/^(ms|mr|mrs|mx|dr)\.?$/i.test(w)).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";

const whenOf = (l: Pick<LogRow, "submitted_at" | "created_at">) => l.submitted_at ?? l.created_at;

export function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY));
}

export function agoLabel(days: number | null): string {
  if (days === null) return "not yet";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export function buildModel(input: {
  me: PersonRow;
  people: PersonRow[];
  pairings: PairingRow[];
  logs: LogRow[];
  cycle: CycleRow | null;
}): Model {
  const { me, cycle } = input;
  const byId = new Map(input.people.map((p) => [p.id, p]));
  const inCycle = (cycleId: string | null) => !cycle || cycleId === cycle.id;

  const myDomains = domainsForTags(me.strength_tags);
  const myArchetype = me.archetype_id ? (ARCHETYPE_LABEL[me.archetype_id] ?? null) : null;
  const style = me.teaching_style ? (TEACHING_STYLE[me.teaching_style as TeachingStyle] ?? null) : null;

  const logs = [...input.logs].sort((a, b) => Date.parse(whenOf(b)) - Date.parse(whenOf(a)));
  const submitted = logs.filter((l) => l.status === "submitted");

  const pairings = input.pairings.filter((p) => inCycle(p.cycle_id));
  const partners: Partner[] = pairings.map((p) => {
    const visitsMe = p.visitor_id !== me.id;
    const other = byId.get(visitsMe ? p.visitor_id : p.host_id) ?? null;
    const name = fullName(other);
    const theirDomains = domainsForTags(other?.strength_tags);
    const theirArchetype = other?.archetype_id ? (ARCHETYPE_LABEL[other.archetype_id] ?? null) : null;
    const style2 = other?.teaching_style ? (TEACHING_STYLE[other.teaching_style as TeachingStyle] ?? null) : null;
    const together = submitted.filter((l) => (l.pairing_id ? l.pairing_id === p.id : l.host_id === p.host_id && l.visitor_id === p.visitor_id));
    return {
      pairingId: p.id,
      id: other?.id ?? "",
      name,
      first: other?.first_name?.trim() || name,
      initials: initialsOf(name),
      department: other?.department ?? "",
      visitsMe,
      domain: p.domain,
      domainLabel: p.domain ? (DOMAIN_LABEL[p.domain] ?? p.domain) : null,
      theirDomains,
      shared: myDomains.filter((d) => theirDomains.includes(d)),
      styleLine: style2 ? `${style2.label}: ${style2.tagline}` : null,
      archetype: theirArchetype,
      contrast: !!(myArchetype && theirArchetype && myArchetype !== theirArchetype),
      conversations: together.length,
      lastAt: together[0] ? whenOf(together[0]) : null,
    };
  });

  // Drafts first: a half-written note is the thing the teacher most needs to see, whatever its date.
  const ordered = [...logs.filter((l) => l.status === "draft"), ...logs.filter((l) => l.status !== "draft")];
  const entries: Entry[] = ordered.map((l) => {
    const iHost = l.host_id === me.id;
    const other = byId.get(iHost ? l.visitor_id : l.host_id) ?? null;
    return {
      id: l.id,
      pairingId: l.pairing_id,
      partnerName: fullName(other),
      partnerFirst: other?.first_name?.trim() || fullName(other),
      direction: iHost ? "visitsMe" : "iVisit",
      domain: l.domain,
      domainLabel: DOMAIN_LABEL[l.domain] ?? l.domain,
      status: l.status === "draft" ? "draft" : "submitted",
      at: whenOf(l),
      createdAt: l.created_at,
      submittedAt: l.submitted_at,
      vision: l.vision,
      strength: l.strength_noted,
      more: l.more_frequently,
      less: l.less_frequently,
      resources: l.resources,
      mine: l.logged_by === me.id,
    };
  });

  const thisCycle = submitted.filter((l) => inCycle(l.cycle_id));
  const counts = new Map<string, number>();
  for (const l of thisCycle) counts.set(l.domain, (counts.get(l.domain) ?? 0) + 1);

  // Words a colleague wrote about this teacher: logs where the teacher hosted and someone else wrote it.
  const aboutMe = (field: "strength_noted" | "vision"): Noticed | null => {
    const l = submitted.find((x) => x.host_id === me.id && x.logged_by && x.logged_by !== me.id && (x[field] ?? "").trim());
    if (!l) return null;
    const by = byId.get(l.logged_by!) ?? null;
    return { text: (l[field] as string).trim(), byFirst: by?.first_name?.trim() || fullName(by), at: whenOf(l) };
  };

  return {
    me: {
      id: me.id,
      name: fullName(me),
      first: me.first_name?.trim() || "there",
      initials: initialsOf(fullName(me)),
      department: me.department ?? "",
      domains: myDomains,
      style,
      archetype: myArchetype,
      inspiration: me.inspiration?.trim() || null,
    },
    cycle: cycle ? { name: cycle.name, ends: cycle.ends_at, closed: cycle.status === "complete" || cycle.status === "closed" } : null,
    partners,
    entries,
    draft: entries.find((e) => e.status === "draft" && e.mine) ?? null,
    conversations: thisCycle.length,
    byDomain: [...counts].map(([domain, n]) => ({ domain, label: DOMAIN_LABEL[domain] ?? domain, n })).sort((a, b) => a.label.localeCompare(b.label)),
    steps: {
      hosted: thisCycle.some((l) => l.host_id === me.id),
      visited: thisCycle.some((l) => l.visitor_id === me.id),
      debrief: thisCycle.some((l) => l.logged_by === me.id),
    },
    lastAt: submitted[0] ? whenOf(submitted[0]) : null,
    noticed: aboutMe("strength_noted"),
    focus: aboutMe("vision"),
  };
}

export type NextStep =
  | { kind: "none"; title: string; body: string }
  | { kind: "draft"; title: string; body: string; cta: string }
  | { kind: "start" | "reconnect" | "rhythm"; title: string; body: string; cta: string; partner: Partner };

/**
 * The one thing the home screen asks of the teacher. A draft comes first because it is already half done; after
 * that it is the partner they have gone longest without writing to, so a teacher with two partners is nudged
 * toward the quieter one. Never a count or a target: the wording stays an invitation.
 */
export function nextStep(model: Model, now: Date): NextStep {
  if (model.partners.length === 0) {
    return {
      kind: "none",
      title: "Your partner is on the way",
      body: "Your school lead is still pairing the faculty. When yours is confirmed they will show up here, with a note on what you two have in common.",
    };
  }
  if (model.draft) {
    return {
      kind: "draft",
      title: `Finish your note about ${model.draft.partnerFirst}`,
      body: "You started writing this down. A minute is enough to finish it while it is fresh.",
      cta: "Open the draft",
    };
  }
  const quietest = [...model.partners].sort((a, b) => {
    const da = daysSince(a.lastAt, now) ?? Infinity;
    const db = daysSince(b.lastAt, now) ?? Infinity;
    return db - da;
  })[0];
  const gap = daysSince(quietest.lastAt, now);
  if (gap === null) {
    return {
      kind: "start",
      partner: quietest,
      title: `Start with ${quietest.first}`,
      body: quietest.visitsMe
        ? `${quietest.first} will visit your classroom. After you have talked, write down what stood out. No summary needed, and it takes under a minute.`
        : `You visit ${quietest.first}'s classroom. After you have talked, write down what you saw working. It takes under a minute.`,
      cta: `Log a conversation with ${quietest.first}`,
    };
  }
  if (gap >= 21) {
    return {
      kind: "reconnect",
      partner: quietest,
      title: `It has been a while since you and ${quietest.first} wrote anything down`,
      body: `Your last entry together was ${agoLabel(gap)}. A short catch-up still counts, and a line or two is plenty.`,
      cta: `Log a conversation with ${quietest.first}`,
    };
  }
  return {
    kind: "rhythm",
    partner: quietest,
    title: "Had a meaningful conversation?",
    body: `You and ${quietest.first} last wrote something down ${agoLabel(gap)}. Capture the next one while it is fresh. No summary required.`,
    cta: "Log a conversation",
  };
}
