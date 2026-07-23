/**
 * Culture Scan — synthetic respondent generator + network math validation.
 *
 * Local dev only. Requires the Supabase service key (SUPABASE_SERVICE_ROLE_KEY in
 * .env.local) because survey_responses has no SELECT policy and inserting
 * synthetic = true must bypass RLS. Never import this from app code.
 *
 *   node scripts/seed-synthetic-culture-scan.ts --dry-run   # math only, no DB
 *   node scripts/seed-synthetic-culture-scan.ts             # insert + stats from DB
 *   node scripts/seed-synthetic-culture-scan.ts --stats-only # read-only, recompute from DB
 *   node scripts/seed-synthetic-culture-scan.ts --clean     # delete synthetic rows
 *
 * The generated data encodes the "fragile efficacy" story: relational, cognitive
 * and efficacy are high and tightly coupled; structural is low and only weakly
 * tied to the rest — and what tie it has runs *through* relational, so partialling
 * should collapse the structural–efficacy edge.
 */

import { createClient } from "@supabase/supabase-js";
import {
  DIMENSIONS,
  correlationMatrix,
  dimensionScores,
  mean,
  partialCorrelationMatrix,
  sd,
  type Dimension,
  type ReportItem,
} from "../src/lib/report/stats.ts";

// ---------------------------------------------------------------- config

const SURVEY_ID = "ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f";
const SCHOOL_ID = "a0000000-0000-0000-0000-000000000001";
const EXPECTED_WAVE = 1;
const N_RESPONDENTS = 50;

/**
 * At n = 50 the sampling error on a partial correlation is roughly +/- .14, so
 * individual draws from this model swing a lot — some land with a *negative*
 * structural-efficacy edge, which would read as "structural suppresses
 * efficacy" and is not what the model says. This seed was picked (out of 4000
 * scanned; ~4% qualify) as a draw that sits close to the model's population
 * values. Nothing is injected that the path model doesn't already imply —
 * see `--dry-run --n=5000` for the underlying structure.
 */
const SEED = 2568;

/** Dimension mean on the 1-6 scored scale, before clipping/rounding. */
const TARGET_MEAN: Record<Dimension, number> = {
  structural: 3.1,
  relational: 4.7,
  cognitive: 4.5,
  efficacy: 4.6,
};

/** Item loading on its dimension latent. With this item noise, within-dimension
 *  item correlations land near .55 — about what real scan items look like, and
 *  high enough that the dimension composites aren't badly attenuated. */
const LOADING = 1.1;
const ITEM_NOISE_SD = 0.95;

type Item = ReportItem;

/**
 * Only used by --dry-run, so the math can be checked without DB access.
 * Mirrors the real v2 layout as of 2026-07-21 (6/9/6/5, one reverse item per
 * dimension at positions 5/11/21/25). The real run always reads survey_items,
 * so this drifting is cosmetic — but keep it in sync if the instrument changes.
 */
export function fallbackItems(): Item[] {
  const counts: Array<[Dimension, number]> = [
    ["structural", 6],
    ["relational", 9],
    ["cognitive", 6],
    ["efficacy", 5],
  ];
  const reversePositions = new Set([5, 11, 21, 25]);
  const items: Item[] = [];
  let position = 1;
  for (const [dimension, n] of counts) {
    for (let i = 0; i < n; i++) {
      items.push({
        id: `fallback-${position}`,
        position,
        dimension,
        reverse: reversePositions.has(position),
      });
      position++;
    }
  }
  return items;
}

// ---------------------------------------------------------------- rng

/** Seeded PRNG so the demo data is reproducible run to run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rand = mulberry32(SEED);

export function setSeed(seed: number): void {
  rand = mulberry32(seed);
}

function randn(): number {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------------------------------------------------------- generation

/**
 * Latent structure, written as a path model so the partial-correlation result is
 * a consequence of the generating process rather than something we hand-tune.
 * The only edges are:
 *
 *   structural -> relational -> cognitive
 *                 relational -> efficacy <- cognitive
 *
 * Structural has NO direct path to cognitive or efficacy. So raw
 * corr(structural, efficacy) should be moderately positive (~.3, inherited
 * through relational) while the partial collapses to ~0 — that gap is the
 * whole point of showing a network instead of a correlation table.
 *
 * Implied population values (before measurement attenuation):
 *   corr:    s-r .45   s-c .29   s-e .31   r-c .65   r-e .69   c-e .69
 *   partial: s-r .45   s-c  0    s-e  0    r-c strong  r-e strong  c-e strong
 */
function generateLatents(n: number): Record<Dimension, number[]> {
  const raw: Record<Dimension, number[]> = {
    structural: [],
    relational: [],
    cognitive: [],
    efficacy: [],
  };

  for (let i = 0; i < n; i++) {
    const s = randn();
    const r = 0.45 * s + 0.9 * randn();
    const c = 0.65 * r + 0.76 * randn();
    const e = 0.45 * r + 0.45 * c + 0.7 * randn();
    raw.structural.push(s);
    raw.relational.push(r);
    raw.cognitive.push(c);
    raw.efficacy.push(e);
  }

  // z-score each latent so TARGET_MEAN / LOADING mean the same thing on every
  // dimension; standardising is monotone-linear so it leaves correlations alone.
  const out = {} as Record<Dimension, number[]>;
  for (const d of DIMENSIONS) {
    const col = raw[d];
    const m = mean(col);
    const sd = Math.sqrt(mean(col.map((x) => (x - m) ** 2)));
    out[d] = col.map((x) => (x - m) / sd);
  }
  return out;
}

type Row = {
  survey_id: string;
  school_id: string;
  respondent: string;
  item_id: string;
  raw_value: number;
  scored_value: number;
  synthetic: true;
};

export function generateRows(items: Item[], n: number): { rows: Row[]; respondents: string[] } {
  const latents = generateLatents(n);

  // Fixed per-item offset so items within a dimension aren't interchangeable.
  const itemOffset = new Map(items.map((i) => [i.id, (rand() - 0.5) * 0.7]));

  const rows: Row[] = [];
  const respondents: string[] = [];

  for (let i = 0; i < n; i++) {
    const respondent = crypto.randomUUID();
    respondents.push(respondent);

    for (const item of items) {
      const latent = latents[item.dimension][i];
      const continuous =
        TARGET_MEAN[item.dimension] +
        LOADING * latent +
        itemOffset.get(item.id)! +
        ITEM_NOISE_SD * randn();

      // We generate the construct-aligned value, i.e. scored_value, then invert
      // it to get what the respondent would have clicked. Matches the live flow:
      // scored = reverse ? 7 - raw : raw.
      const scored = clampRound(continuous);
      const raw = item.reverse ? 7 - scored : scored;

      rows.push({
        survey_id: SURVEY_ID,
        school_id: SCHOOL_ID,
        respondent,
        item_id: item.id,
        raw_value: raw,
        scored_value: scored,
        synthetic: true,
      });
    }
  }

  return { rows, respondents };
}

function clampRound(x: number): number {
  return Math.max(1, Math.min(6, Math.round(x)));
}

// Stats live in src/lib/report/stats.ts so this script and the /report page
// share one computation path — the console numbers and the rendered panels
// cannot drift apart.

// ---------------------------------------------------------------- printing

const LABEL_WIDTH = 12;
const CELL_WIDTH = 9;

function printMatrix(title: string, m: number[][]): void {
  console.log(`\n${title}`);
  const header = " ".repeat(LABEL_WIDTH) + DIMENSIONS.map((d) => pad(d)).join("");
  console.log(header);
  DIMENSIONS.forEach((d, i) => {
    const cells = m[i].map((v) => pad(v.toFixed(3))).join("");
    console.log(d.padEnd(LABEL_WIDTH) + cells);
  });
}

function pad(s: string): string {
  return s.padStart(CELL_WIDTH);
}

function printReport(
  scores: Record<Dimension, number[]>,
  items: Item[],
  n: number,
  source: string
): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Culture Scan — dimension stats (${source})`);
  console.log(`respondents: ${n}   items: ${items.length}`);
  console.log("=".repeat(60));

  console.log("\nDimension means (scored_value, 1-6)");
  console.log("dimension".padEnd(LABEL_WIDTH) + pad("items") + pad("mean") + pad("sd"));
  for (const d of DIMENSIONS) {
    const count = items.filter((i) => i.dimension === d).length;
    console.log(
      d.padEnd(LABEL_WIDTH) +
        pad(String(count)) +
        pad(mean(scores[d]).toFixed(3)) +
        pad(sd(scores[d]).toFixed(3))
    );
  }

  const corr = correlationMatrix(scores);
  printMatrix("Pearson correlation (raw)", corr);

  const partial = partialCorrelationMatrix(corr);
  printMatrix("Partial correlation (network edges)", partial);

  console.log("\nRaw vs partial, unique pairs");
  console.log(
    "pair".padEnd(26) + pad("raw") + pad("partial") + pad("delta")
  );
  for (let i = 0; i < DIMENSIONS.length; i++) {
    for (let j = i + 1; j < DIMENSIONS.length; j++) {
      const label = `${DIMENSIONS[i]} – ${DIMENSIONS[j]}`;
      console.log(
        label.padEnd(26) +
          pad(corr[i][j].toFixed(3)) +
          pad(partial[i][j].toFixed(3)) +
          pad((partial[i][j] - corr[i][j]).toFixed(3))
      );
    }
  }
  console.log("");
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
        "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API).\n" +
        "It is server-only: never prefix it with NEXT_PUBLIC_.\n" +
        "Or run with --dry-run to validate the math without touching the DB."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type Db = ReturnType<typeof serviceClient>;

async function fetchItems(db: Db): Promise<Item[]> {
  const { data, error } = await db
    .from("survey_items")
    .select("id, position, dimension, reverse")
    .eq("active", true)
    .order("position");
  if (error) throw new Error(`survey_items read failed: ${error.message}`);
  const items = (data ?? []) as Item[];
  if (items.length === 0) throw new Error("No active survey_items found.");

  const unknown = items.filter((i) => !DIMENSIONS.includes(i.dimension));
  if (unknown.length > 0) {
    throw new Error(
      `Unexpected dimension(s): ${[...new Set(unknown.map((i) => i.dimension))].join(", ")}`
    );
  }
  return items;
}

async function checkWave(db: Db): Promise<void> {
  const { data, error } = await db
    .from("surveys")
    .select("id, wave")
    .eq("id", SURVEY_ID)
    .maybeSingle();
  if (error) throw new Error(`surveys read failed: ${error.message}`);
  if (!data) throw new Error(`Survey ${SURVEY_ID} not found.`);
  if (data.wave !== EXPECTED_WAVE) {
    throw new Error(
      `Survey ${SURVEY_ID} is wave ${data.wave}, expected wave ${EXPECTED_WAVE}. ` +
        `wave lives on surveys, not survey_responses — point at the wave-1 survey row.`
    );
  }
}

async function countSynthetic(db: Db): Promise<number> {
  const { count, error } = await db
    .from("survey_responses")
    .select("*", { count: "exact", head: true })
    .eq("survey_id", SURVEY_ID)
    .eq("synthetic", true);
  if (error) throw new Error(`survey_responses count failed: ${error.message}`);
  return count ?? 0;
}

async function deleteSynthetic(db: Db): Promise<void> {
  const { error } = await db
    .from("survey_responses")
    .delete()
    .eq("survey_id", SURVEY_ID)
    .eq("synthetic", true);
  if (error) throw new Error(`synthetic delete failed: ${error.message}`);
}

async function insertRows(db: Db, rows: Row[]): Promise<void> {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await db.from("survey_responses").insert(chunk);
    if (error) throw new Error(`insert failed at row ${i}: ${error.message}`);
    console.log(`  inserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
}

/** Read the synthetic rows back so the stats describe what's actually in the DB. */
async function fetchSynthetic(
  db: Db
): Promise<Array<{ respondent: string; item_id: string; scored_value: number }>> {
  const PAGE = 1000;
  const all: Array<{ respondent: string; item_id: string; scored_value: number }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("survey_responses")
      .select("respondent, item_id, scored_value")
      .eq("survey_id", SURVEY_ID)
      .eq("synthetic", true)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`survey_responses read failed: ${error.message}`);
    const page = data ?? [];
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}

// ---------------------------------------------------------------- main

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const clean = argv.includes("--clean");
  const force = argv.includes("--force");
  const statsOnly = argv.includes("--stats-only");

  loadEnv();

  if (dryRun) {
    const nArg = argv.find((a) => a.startsWith("--n="));
    const n = nArg ? Number(nArg.slice(4)) : N_RESPONDENTS;
    if (!Number.isFinite(n) || n < 5) throw new Error(`--n must be a number >= 5, got ${nArg}`);

    const items = fallbackItems();
    console.log(
      "DRY RUN — no DB access. Item layout is assumed " +
        "(6/9/6/5, reverse at positions 5/11/21/25); the real run reads survey_items."
    );
    if (n !== N_RESPONDENTS) {
      console.log(`n = ${n} (override) — use a large n to see the generator's true structure.`);
    }
    const { rows } = generateRows(items, n);
    const { scores, respondents } = dimensionScores(rows, items);
    verifyReverseScoring(rows, items);
    printReport(scores, items, respondents.length, "in-memory, not inserted");
    return;
  }

  const db = serviceClient();

  if (clean) {
    const before = await countSynthetic(db);
    await deleteSynthetic(db);
    console.log(`Deleted ${before} synthetic rows for survey ${SURVEY_ID}.`);
    return;
  }

  if (statsOnly) {
    // Read-only: recompute the report math from whatever is already stored.
    const items = await fetchItems(db);
    const stored = await fetchSynthetic(db);
    if (stored.length === 0) throw new Error("No synthetic rows stored for this survey.");
    const { scores, respondents, dropped } = dimensionScores(stored, items);
    if (dropped.length > 0) {
      console.log(`Dropped ${dropped.length} respondent(s) missing a whole dimension.`);
    }
    printReport(scores, items, respondents.length, "read back from Supabase, no writes");
    return;
  }

  await checkWave(db);
  const items = await fetchItems(db);
  console.log(`Loaded ${items.length} active items.`);
  for (const d of DIMENSIONS) {
    const n = items.filter((i) => i.dimension === d).length;
    const rev = items.filter((i) => i.dimension === d && i.reverse).map((i) => i.position);
    console.log(`  ${d.padEnd(11)} ${n} items, reverse at position(s): ${rev.join(", ") || "none"}`);
  }

  const existing = await countSynthetic(db);
  if (existing > 0 && !force) {
    throw new Error(
      `${existing} synthetic rows already exist for this survey. ` +
        `Re-run with --clean first, or --force to add another batch.`
    );
  }

  const { rows } = generateRows(items, N_RESPONDENTS);
  verifyReverseScoring(rows, items);
  console.log(`\nInserting ${rows.length} rows (${N_RESPONDENTS} respondents × ${items.length} items)…`);
  await insertRows(db, rows);

  const stored = await fetchSynthetic(db);
  const { scores, respondents, dropped } = dimensionScores(stored, items);
  if (dropped.length > 0) {
    console.log(`Dropped ${dropped.length} respondent(s) missing a whole dimension.`);
  }
  printReport(scores, items, respondents.length, "read back from Supabase");
}

/** Cheap invariant: every stored pair must satisfy the live flow's scoring rule. */
function verifyReverseScoring(rows: Row[], items: Item[]): void {
  const itemById = new Map(items.map((i) => [i.id, i]));
  for (const row of rows) {
    const item = itemById.get(row.item_id)!;
    const expected = item.reverse ? 7 - row.raw_value : row.raw_value;
    if (expected !== row.scored_value) {
      throw new Error(
        `Reverse-scoring broken on item ${item.position}: raw ${row.raw_value}, scored ${row.scored_value}`
      );
    }
    if (row.raw_value < 1 || row.raw_value > 6 || row.scored_value < 1 || row.scored_value > 6) {
      throw new Error(`Value out of 1-6 range on item ${item.position}`);
    }
  }
}

// Only run when executed directly, so the generator/stat helpers can be imported.
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  main().catch((err) => {
    console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
