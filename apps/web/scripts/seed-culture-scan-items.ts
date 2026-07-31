/**
 * Culture Scan — v2 item bank seed.
 *
 * The instrument is the product. Before this script it existed only as 26 rows
 * in one Supabase project: nothing to review, nothing to diff, nothing to
 * rebuild from if that project were lost. ITEMS below is the canonical
 * definition; the DB is downstream of it.
 *
 * Local dev only. Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — anon has
 * SELECT on survey_items but no write access, by design. Never import this from
 * app code.
 *
 *   node scripts/seed-culture-scan-items.ts --dry-run   # print + hash, no DB
 *   node scripts/seed-culture-scan-items.ts --verify    # read-only drift check
 *   node scripts/seed-culture-scan-items.ts             # upsert, then verify
 *
 * Idempotent: rows are upserted on their primary key, so running it twice is a
 * no-op. The ids are the ones already live, which is what makes this a rebuild
 * rather than a fork — survey_responses.item_id keeps resolving.
 *
 * WAVE COMPARISON. --verify prints a SHA-256 over every field that determines
 * what is asked and how it scores (see instrumentHash). A wave-2 delta is only
 * meaningful against
 * an unchanged instrument, so record the hash with each wave and compare before
 * reading any change as a change in the school rather than in the questions.
 */

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { DIMENSIONS, type Dimension } from "../src/lib/report/stats.ts";

// ---------------------------------------------------------------- config

/**
 * Applied to every row rather than repeated 26 times. Keeping them out of the
 * literal is deliberate: a seed that could emit mixed instrument_versions or a
 * half-active bank is exactly the "Section 4 of 6" failure, and 005 now rejects
 * it at the database anyway.
 */
const INSTRUMENT_VERSION = 2;
const ACTIVE = true;

type Framing = "I" | "we";

type SeedItem = {
  id: string;
  position: number;
  dimension: Dimension;
  /** Item stem person. Structural/relational ask about "I", cognitive/efficacy about "we". */
  framing: Framing;
  /** scored_value = reverse ? 7 - raw_value : raw_value. Applied by the survey flow. */
  reverse: boolean;
  text: string;
  scale_min: number;
  scale_max: number;
};

/**
 * The 26-item v2 social-capital scan, in presentation order.
 *
 * Section order in the UI is the order dimensions first appear by position, and
 * the dimension name is never shown to the respondent — naming it biases the
 * answers. Counts are uneven (6/9/6/5) on purpose, so every score must be a
 * mean, never a sum.
 */
export const ITEMS: SeedItem[] = [
  {
    id: "6719968f-41c7-4905-874c-11747c7ab5e3",
    position: 1,
    dimension: "structural",
    framing: "I",
    reverse: false,
    text: "When a lesson isn't working, there's a specific colleague I can go to.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "932e3d51-820e-48d5-90c3-b0934171be3d",
    position: 2,
    dimension: "structural",
    framing: "I",
    reverse: false,
    text: "In the past month, at least one colleague has come to me for help with their teaching.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "0f65a05a-8b99-47a2-be89-97d1fa3e31d0",
    position: 3,
    dimension: "structural",
    framing: "I",
    reverse: false,
    text: "The people I turn to for help teach different subjects or grades than I do.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "31f15fda-0c0d-441b-9aa2-e70fb97fc1cc",
    position: 4,
    dimension: "structural",
    framing: "I",
    reverse: false,
    text: "I regularly talk with colleagues about the actual work of teaching, not just logistics.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "692c0cf4-a1cd-4655-8603-791e5900ef43",
    position: 5,
    dimension: "structural",
    framing: "I",
    reverse: true,
    text: "When I have a hard teaching problem, I mostly work it out on my own.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "54b58e4f-69dc-44b9-993f-6acdaa84b56c",
    position: 6,
    dimension: "structural",
    framing: "I",
    reverse: false,
    text: "I've built a new working relationship with a colleague this year.",
    scale_min: 1,
    scale_max: 6,
  },

  {
    id: "704411e7-e372-41cf-9797-8333554dba60",
    position: 7,
    dimension: "relational",
    framing: "I",
    reverse: false,
    text: "I feel like a full member of this faculty, not a guest in it.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "8b8d307e-bfa5-406d-8d06-6ad26dc66cd6",
    position: 8,
    dimension: "relational",
    framing: "I",
    reverse: false,
    text: "There are people here who would notice and care if I left.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "cde36b5a-9ba6-4068-bacc-48e73422a43c",
    position: 9,
    dimension: "relational",
    framing: "I",
    reverse: false,
    text: "I can tell a colleague that a lesson failed without it being held against me.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "12aed47e-7498-4c49-87fe-86a96d2f6b4b",
    position: 10,
    dimension: "relational",
    framing: "I",
    reverse: false,
    text: "When I've tried something new and it flopped, I've felt supported, not judged.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "0beac4db-206d-498b-852e-ced7a137074b",
    position: 11,
    dimension: "relational",
    framing: "I",
    reverse: true,
    text: "There are colleagues I'd never be fully honest with about my teaching.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "50dbae72-9a1d-4fd9-928b-301e852cad68",
    position: 12,
    dimension: "relational",
    framing: "I",
    reverse: false,
    text: "When I've raised a real concern, I've seen it lead to something.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf",
    position: 13,
    dimension: "relational",
    framing: "I",
    reverse: false,
    text: "My expertise gets used in decisions here, not just my compliance.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "fb9d8599-17df-4d90-bae1-f4c19a597ac3",
    position: 14,
    dimension: "relational",
    framing: "I",
    reverse: false,
    text: "The work I do here connects to something I actually believe in.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "f9f07677-fb34-4877-85d1-a883dfab8025",
    position: 15,
    dimension: "relational",
    framing: "I",
    reverse: false,
    text: "I share a sense of mission with the colleagues I work most closely with.",
    scale_min: 1,
    scale_max: 6,
  },

  {
    id: "0e549040-6265-402f-951a-d0aab6b09263",
    position: 16,
    dimension: "cognitive",
    framing: "we",
    reverse: false,
    text: "The teachers I work with and I share a common language for what good teaching looks like.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "15850608-0316-4548-88ab-9489a5118f61",
    position: 17,
    dimension: "cognitive",
    framing: "we",
    reverse: false,
    text: "If we compared, my colleagues and I would largely agree on what makes a lesson excellent.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "9ca78e45-60fb-40ae-9375-4637946e2405",
    position: 18,
    dimension: "cognitive",
    framing: "we",
    reverse: false,
    text: "When we look at student work together, we're using the same standards.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "fc7c1510-f0ca-40ba-a15f-b6cc24a8027c",
    position: 19,
    dimension: "cognitive",
    framing: "we",
    reverse: false,
    text: "I could name what this school is trying to accomplish this year.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9",
    position: 20,
    dimension: "cognitive",
    framing: "we",
    reverse: false,
    text: "The goals leadership talks about and the goals I care about are the same goals.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "9159ad92-33f2-4324-a469-462295b10cde",
    position: 21,
    dimension: "cognitive",
    framing: "we",
    reverse: true,
    text: "Good practice here stays private; we each just figure it out alone.",
    scale_min: 1,
    scale_max: 6,
  },

  {
    id: "de32f83f-df9f-4a2c-8c9c-df9d48792e6b",
    position: 22,
    dimension: "efficacy",
    framing: "we",
    reverse: false,
    text: "I've seen this staff solve a problem together that none of us could have solved alone.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "d0886045-cca4-42bb-8796-1a24c7fe8023",
    position: 23,
    dimension: "efficacy",
    framing: "we",
    reverse: false,
    text: "Working together, the teachers here can reach even our most disengaged students.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "072e52b6-eacc-46e6-8fa4-a6ff04242c1b",
    position: 24,
    dimension: "efficacy",
    framing: "we",
    reverse: false,
    text: "When a student is struggling, we're good at changing course as a group.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "edd88ef1-c137-4c93-b824-783b445be228",
    position: 25,
    dimension: "efficacy",
    framing: "we",
    reverse: true,
    text: "Whether a kid succeeds here comes down to which teacher they got, not us as a staff.",
    scale_min: 1,
    scale_max: 6,
  },
  {
    id: "fe3f810e-a1fb-4830-8d96-ea5850a61cbc",
    position: 26,
    dimension: "efficacy",
    framing: "we",
    reverse: false,
    text: "I'm confident this faculty can improve outcomes for our hardest-to-teach students.",
    scale_min: 1,
    scale_max: 6,
  },
];

const TABLE = "survey_items";

/** The columns that define an item. created_at is DB-owned and not seeded. */
const COLUMNS = [
  "id",
  "position",
  "dimension",
  "framing",
  "reverse",
  "text",
  "scale_min",
  "scale_max",
  "active",
  "instrument_version",
] as const;

type Row = SeedItem & { active: boolean; instrument_version: number };

function toRow(item: SeedItem): Row {
  return { ...item, active: ACTIVE, instrument_version: INSTRUMENT_VERSION };
}

// ---------------------------------------------------------------- hash

/**
 * Identifies the recipe below, not the instrument. It is hashed as the first
 * record, so changing how the digest is computed necessarily changes both the
 * number and the label that travels with it. Without this, a future tweak to
 * the canonical form would silently produce a different hash for an unchanged
 * instrument, and read as "the questions changed".
 *
 * Bump to v2 if any of these change: the field set, the field order, the
 * separators, the sort, or the encoding.
 */
export const CANONICAL_FORM = "mentorful.culture-scan.canonical.v1";

/** Unit separator and record separator: control characters, so they cannot
 *  collide with item text. validateLiteral() rejects text containing either. */
const US = "\u001f";
const RS = "\u001e";

/**
 * SHA-256 over everything that determines what a respondent is asked, in what
 * order, and how their answer is scored. Each of these breaks wave-to-wave
 * comparability just as badly as a reworded stem:
 *
 *   position    presentation order; section boundaries derive from it
 *   dimension   which construct the item scores into
 *   framing     "I" vs "we" stem person
 *   reverse     scored_value = reverse ? 7 - raw_value : raw_value
 *   scale_min   response scale bounds - changing them rescales every mean
 *   scale_max
 *   text        the stem itself
 *
 * Excludes id (a storage detail no respondent experiences) and active /
 * instrument_version (deployment state, enforced by scripts/005).
 *
 * The point is that comparing two hashes is sufficient. It should never depend
 * on someone having remembered to run --verify.
 *
 * Canonical form v1, reproducible outside this script:
 *   sort items by position ascending
 *   record 0:  CANONICAL_FORM
 *   per item:  position US dimension US framing US <reverse as 1|0> US scale_min US scale_max US text
 *   join every record with RS
 *   US = U+001F, RS = U+001E; hash the UTF-8 bytes; hex digest.
 *
 * Numbers render as base-10 integers, no padding.
 */
export function instrumentHash(
  items: Pick<
    SeedItem,
    "position" | "dimension" | "framing" | "reverse" | "scale_min" | "scale_max" | "text"
  >[]
): string {
  const records = [...items]
    .sort((a, b) => a.position - b.position)
    .map((i) =>
      [
        i.position,
        i.dimension,
        i.framing,
        i.reverse ? "1" : "0",
        i.scale_min,
        i.scale_max,
        i.text,
      ].join(US)
    );
  const canonical = [CANONICAL_FORM, ...records].join(RS);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

// ---------------------------------------------------------------- validation

/** Fail before touching the DB if the literal itself is malformed. */
function validateLiteral(): void {
  const problems: string[] = [];

  const ids = new Set(ITEMS.map((i) => i.id));
  if (ids.size !== ITEMS.length) problems.push("duplicate id(s) in ITEMS");

  const positions = ITEMS.map((i) => i.position).sort((a, b) => a - b);
  positions.forEach((p, idx) => {
    if (p !== idx + 1) problems.push(`positions must be 1..${ITEMS.length} with no gaps (saw ${p} at index ${idx})`);
  });

  for (const i of ITEMS) {
    if (!DIMENSIONS.includes(i.dimension)) problems.push(`item ${i.position}: unknown dimension "${i.dimension}"`);
    if (!i.text.trim()) problems.push(`item ${i.position}: empty text`);
    // Item text containing a separator would make the canonical encoding
    // ambiguous, so two different instruments could hash to the same digest.
    if (i.text.includes(US) || i.text.includes(RS)) {
      problems.push(`item ${i.position}: text contains a U+001F/U+001E separator`);
    }
    if (i.scale_min >= i.scale_max) problems.push(`item ${i.position}: scale_min must be < scale_max`);
  }

  // Section order is derived from position, so a dimension's items must be
  // contiguous or the survey would revisit a section it already showed.
  const order: Dimension[] = [];
  for (const i of [...ITEMS].sort((a, b) => a.position - b.position)) {
    if (order[order.length - 1] !== i.dimension) order.push(i.dimension);
  }
  if (new Set(order).size !== order.length) problems.push(`dimensions are not contiguous by position: ${order.join(" -> ")}`);

  if (problems.length > 0) throw new Error(`ITEMS is invalid:\n  ${problems.join("\n  ")}`);
}

// ---------------------------------------------------------------- db

function loadEnv(): void {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // fine — env may already be exported
  }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase -> Project Settings -> API).\n" +
        "It is server-only: never prefix it with NEXT_PUBLIC_.\n" +
        "Or run with --dry-run to inspect the instrument without touching the DB."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type Db = ReturnType<typeof serviceClient>;

async function fetchRows(db: Db): Promise<Row[]> {
  const { data, error } = await db
    .from(TABLE)
    .select(COLUMNS.join(", "))
    .eq("instrument_version", INSTRUMENT_VERSION)
    .order("position");
  if (error) throw new Error(`${TABLE} read failed: ${error.message}`);
  return (data ?? []) as unknown as Row[];
}

/**
 * Guard against writing a bank that 005 would reject: if some *other* version
 * is currently active, activating v2 would leave two versions live and the
 * survey's `active = true` filter would span both.
 */
async function checkNoOtherActiveVersion(db: Db): Promise<void> {
  const { data, error } = await db
    .from(TABLE)
    .select("instrument_version")
    .eq("active", true)
    .neq("instrument_version", INSTRUMENT_VERSION);
  if (error) throw new Error(`${TABLE} read failed: ${error.message}`);
  const others = [...new Set((data ?? []).map((r: { instrument_version: number }) => r.instrument_version))];
  if (others.length > 0) {
    throw new Error(
      `Instrument version(s) ${others.join(", ")} are still active.\n` +
        `Activating v${INSTRUMENT_VERSION} would leave more than one version live, which is what makes\n` +
        `the survey show "Section 4 of 6". Deactivate them in the same transaction, then re-run.`
    );
  }
}

async function upsertItems(db: Db): Promise<void> {
  const rows = ITEMS.map(toRow);
  const { error } = await db.from(TABLE).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`upsert failed: ${error.message}`);
}

// ---------------------------------------------------------------- compare

type Diff = { position: number; column: string; expected: unknown; actual: unknown };

function compare(expected: Row[], actual: Row[]): { diffs: Diff[]; missing: number[]; extra: number[] } {
  const byId = new Map(actual.map((r) => [r.id, r]));
  const expectedIds = new Set(expected.map((r) => r.id));

  const diffs: Diff[] = [];
  const missing: number[] = [];

  for (const want of expected) {
    const got = byId.get(want.id);
    if (!got) {
      missing.push(want.position);
      continue;
    }
    for (const col of COLUMNS) {
      if (want[col as keyof Row] !== got[col as keyof Row]) {
        diffs.push({ position: want.position, column: col, expected: want[col as keyof Row], actual: got[col as keyof Row] });
      }
    }
  }

  const extra = actual.filter((r) => !expectedIds.has(r.id)).map((r) => r.position);
  return { diffs, missing, extra };
}

// ---------------------------------------------------------------- printing

function printItems(): void {
  console.log(`\nCulture Scan v${INSTRUMENT_VERSION} — ${ITEMS.length} items`);
  console.log("-".repeat(112));
  let last: string | null = null;
  for (const i of [...ITEMS].sort((a, b) => a.position - b.position)) {
    if (last && i.dimension !== last) console.log("");
    last = i.dimension;
    const rev = i.reverse ? "REV" : "   ";
    console.log(`${String(i.position).padStart(4)}  ${i.dimension.padEnd(11)} ${i.framing.padEnd(3)} ${rev}  ${i.text}`);
  }
  console.log("");
  for (const d of DIMENSIONS) {
    const group = ITEMS.filter((i) => i.dimension === d);
    const rev = group.filter((i) => i.reverse).map((i) => i.position);
    console.log(`  ${d.padEnd(11)} ${String(group.length).padStart(2)} items, reverse at: ${rev.join(", ") || "none"}`);
  }
}

// ---------------------------------------------------------------- main

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const verifyOnly = argv.includes("--verify");

  validateLiteral();
  const hash = instrumentHash(ITEMS);

  if (dryRun) {
    printItems();
    console.log(`\nDRY RUN — no DB access.`);
    console.log(`canonical form:  ${CANONICAL_FORM}`);
    console.log(`instrument hash: ${hash}\n`);
    return;
  }

  loadEnv();
  const db = serviceClient();

  if (!verifyOnly) {
    await checkNoOtherActiveVersion(db);
    await upsertItems(db);
    console.log(`Upserted ${ITEMS.length} items into ${TABLE} (instrument_version = ${INSTRUMENT_VERSION}).`);
  }

  const actual = await fetchRows(db);
  const { diffs, missing, extra } = compare(ITEMS.map(toRow), actual);

  if (missing.length > 0) console.error(`\nMissing from DB — position(s): ${missing.join(", ")}`);
  if (extra.length > 0) {
    console.error(
      `\nExtra v${INSTRUMENT_VERSION} row(s) in DB not present in ITEMS — position(s): ${extra.join(", ")}\n` +
        `  Not deleted automatically: survey_responses.item_id may reference them.\n` +
        `  Set active = false by hand once you have confirmed no responses depend on them.`
    );
  }
  for (const d of diffs) {
    console.error(`\nitem ${d.position}, column ${d.column}:\n  expected: ${JSON.stringify(d.expected)}\n  actual:   ${JSON.stringify(d.actual)}`);
  }

  const clean = diffs.length === 0 && missing.length === 0 && extra.length === 0;

  console.log(`\n${"=".repeat(60)}`);
  console.log(clean ? `DB matches ITEMS exactly (${actual.length} rows).` : `DB DOES NOT MATCH ITEMS.`);
  console.log(`canonical form:  ${CANONICAL_FORM}`);
  console.log(`instrument hash: ${hash}`);
  console.log(`  (record BOTH lines with each wave — the hash only means anything`);
  console.log(`   alongside the canonical form that produced it)`);
  console.log("=".repeat(60) + "\n");

  if (!clean) process.exit(1);
}

// Only run when executed directly, so ITEMS and instrumentHash can be imported.
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  main().catch((err) => {
    console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
