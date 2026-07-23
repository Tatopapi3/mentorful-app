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

if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/report/data.ts was imported in the browser. It holds the Supabase " +
      "service key and must only be used from server components or route handlers."
  );
}

/**
 * TODO: all current responses are synthetic demo data. Flip to false (or make it
 * a per-request option) once real submissions exist, so a live report never
 * silently blends demo rows into a school's numbers.
 */
const INCLUDE_SYNTHETIC = true;

/**
 * TODO: the real participation floor is >= 30 respondents OR 60% of faculty,
 * whichever is higher. Faculty headcount isn't modelled yet, so for now the
 * report only requires that responses exist.
 */
export const MIN_RESPONDENTS = 1;

export type ReportLoad =
  | { status: "ok"; stats: ReportStats; surveyId: string; includesSynthetic: boolean }
  | { status: "no-data"; surveyId: string }
  | { status: "below-floor"; surveyId: string; n: number; floor: number }
  | { status: "misconfigured"; message: string };

function serviceClient(url: string, key: string) {
  return createClient(url, key, { auth: { persistSession: false } });
}

type Db = ReturnType<typeof serviceClient>;

async function fetchItems(db: Db): Promise<ReportItem[]> {
  // TODO: once surveys.instrument_version exists, pin this to the survey's
  // version instead of "every active item" — otherwise a future v3 instrument
  // silently blends into these aggregates.
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
async function fetchResponses(db: Db, surveyId: string): Promise<ResponseRow[]> {
  const PAGE = 1000;
  const all: ResponseRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db
      .from("survey_responses")
      .select("respondent, item_id, scored_value")
      .eq("survey_id", surveyId);
    if (!INCLUDE_SYNTHETIC) q = q.eq("synthetic", false);

    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw new Error(`survey_responses read failed: ${error.message}`);

    const page = (data ?? []) as ResponseRow[];
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}

/**
 * Loads the aggregate for the Culture Scan survey. Returns ReportStats only —
 * never raw rows.
 */
export async function loadReportStats(): Promise<ReportLoad> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const surveyId = process.env.NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID;

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

  const db = serviceClient(url, key);
  const [items, rows] = await Promise.all([fetchItems(db), fetchResponses(db, surveyId)]);

  if (rows.length === 0) return { status: "no-data", surveyId };

  const stats = computeReportStats(rows, items);
  if (stats.n < MIN_RESPONDENTS) {
    return { status: "below-floor", surveyId, n: stats.n, floor: MIN_RESPONDENTS };
  }

  return { status: "ok", stats, surveyId, includesSynthetic: INCLUDE_SYNTHETIC };
}
