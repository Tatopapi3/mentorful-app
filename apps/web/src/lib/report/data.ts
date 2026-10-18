/**
 * Server-only data access for the Culture Scan report.
 *
 * survey_responses has NO select policy — only the service role can read it.
 * This module is the boundary: raw response rows are fetched here, reduced to
 * ReportStats, and only the aggregate crosses into the render layer. Individual
 * responses must never reach a client component.
 *
 * The service key is read from SUPABASE_SERVICE_ROLE_KEY (deliberately not
 * NEXT_PUBLIC_, so Next never inlines it into a client bundle). The guard below
 * is a second line of defence in case someone imports this from "use client".
 */

import { createClient } from "@supabase/supabase-js";
import {
  DIMENSIONS,
  computeReportStats,
  type Dimension,
  type ReportItem,
  type ReportStats,
  type ResponseRow,
} from "./stats.ts";
import { CELL_FLOOR, evaluateGates, type Gates } from "./gates.ts";

if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/report/data.ts was imported in the browser. It holds the Supabase " +
      "service key and must only be used from server components or route handlers."
  );
}

export type ReportOptions = {
  /** The reader's own school. Responses from any other school are never read. */
  schoolId: string;
  /** Faculty headcount at that school. 0 when unknown, which keeps the report closed. */
  faculty: number;
  /** Off unless a caller asks for demo data by name. Synthetic rows never blend into a real school. */
  includeSynthetic?: boolean;
  /** The public sample report: demo data on purpose, so the gates are treated as met. */
  sample?: boolean;
};

export type ReportLoad =
  | { status: "ok"; stats: ReportStats; surveyId: string; includesSynthetic: boolean; gates: Gates }
  | { status: "early-look"; stats: ReportStats; surveyId: string; includesSynthetic: boolean; gates: Gates }
  | { status: "no-data"; surveyId: string }
  | { status: "below-floor"; surveyId: string; n: number; floor: number }
  | { status: "misconfigured"; message: string };

function serviceClient(url: string, key: string) {
  return createClient(url, key, { auth: { persistSession: false } });
}

type Db = ReturnType<typeof serviceClient>;

async function fetchItems(db: Db): Promise<ReportItem[]> {
  // active = true is sufficient on its own: scripts/005 enforces that all active
  // rows share one instrument_version, so this can never blend a future v3 into
  // the aggregates. The invariant lives in the database rather than in a filter
  // every caller has to remember.
  const { data, error } = await db
    .from("survey_items")
    .select("id, position, dimension, reverse")
    .eq("active", true)
    .order("position");
  if (error) throw new Error(`survey_items read failed: ${error.message}`);

  const items = (data ?? []) as ReportItem[];
  const unknown = items.filter((i) => !DIMENSIONS.includes(i.dimension as Dimension));
  if (unknown.length > 0) {
    throw new Error(
      `Unexpected dimension(s) in survey_items: ${[
        ...new Set(unknown.map((i) => i.dimension)),
      ].join(", ")}`
    );
  }
  return items;
}

/** PostgREST caps a response at 1000 rows, so page explicitly. */
async function fetchResponses(db: Db, surveyId: string, schoolId: string, includeSynthetic: boolean): Promise<ResponseRow[]> {
  const PAGE = 1000;
  const all: ResponseRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db
      .from("survey_responses")
      .select("respondent, item_id, scored_value")
      .eq("survey_id", surveyId)
      .eq("school_id", schoolId);
    if (!includeSynthetic) q = q.eq("synthetic", false);

    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw new Error(`survey_responses read failed: ${error.message}`);

    const page = (data ?? []) as ResponseRow[];
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}

/**
 * Loads the aggregate for the Culture Scan survey, for one school. Returns ReportStats only, never raw
 * rows. Callers must already have checked who the reader is and which school they belong to.
 */
export async function loadReportStats(opts: ReportOptions): Promise<ReportLoad> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const surveyId = process.env.NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID;
  const includeSynthetic = opts.includeSynthetic ?? false;

  if (!url || !key) {
    return {
      status: "misconfigured",
      message:
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add the service key to .env.local.",
    };
  }
  if (!surveyId) {
    return {
      status: "misconfigured",
      message: "Missing NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID in .env.local.",
    };
  }
  if (!opts.schoolId) {
    return { status: "misconfigured", message: "No school was given, so there is nothing to scope the report to." };
  }

  const db = serviceClient(url, key);
  const [items, rows] = await Promise.all([fetchItems(db), fetchResponses(db, surveyId, opts.schoolId, includeSynthetic)]);

  if (rows.length === 0) return { status: "no-data", surveyId };

  const stats = computeReportStats(rows, items);
  if (stats.n < CELL_FLOOR) {
    return { status: "below-floor", surveyId, n: stats.n, floor: CELL_FLOOR };
  }

  const gates = opts.sample ? evaluateGates(stats.n, stats.n) : evaluateGates(stats.n, opts.faculty);
  const base = { stats, surveyId, includesSynthetic: includeSynthetic, gates };
  return gates.report ? { status: "ok", ...base } : { status: "early-look", ...base };
}
