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
import { createPreviewClient, previewEnabled } from "@/lib/preview";
import {
  DIMENSIONS,
  computeReportStats,
  type Dimension,
  type ReportItem,
  type ReportStats,
  type ResponseRow,
} from "./stats.ts";
import { participation } from "./gates.ts";

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
 * Participation floor (Nick, Oct 29): 60% of the roster, the roster being
 * schools.faculty_headcount (script 020). It applies to REAL responses. While
 * synthetic demo rows are in the data the report is a demo and is labelled as
 * one (`demoN` says how many of the n are demo), so the gate is not enforced
 * on it; the moment the data is all real, the gate is. With no headcount on
 * the school record the report stays closed: there is nothing to measure 60% of.
 * Any response at all is still required.
 */
export const MIN_RESPONDENTS = 1;

export type ReportLoad =
  | { status: "ok"; stats: ReportStats; surveyId: string; includesSynthetic: boolean; /** How many of stats.n are demo rows. */ demoN: number }
  | { status: "no-data"; surveyId: string }
  | { status: "below-floor"; surveyId: string; n: number; floor: number; /** "no-headcount": the school record has no faculty headcount, so floor is 0. */ reason?: "participation" | "no-headcount" }
  | { status: "misconfigured"; message: string };

function serviceClient(url: string, key: string) {
  // Local preview only (see lib/preview): the report engine reads the made-up responses.
  if (previewEnabled()) return createPreviewClient("admin", { bypassRls: true }) as unknown as ReturnType<typeof createClient>;
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

/** The roster size, for the 60% gate. Null when it is not recorded (or script 020 is not applied). */
async function fetchHeadcount(db: Db): Promise<number | null> {
  const schoolId = process.env.NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID;
  if (!schoolId) return null;
  const { data, error } = await db.from("schools").select("faculty_headcount").eq("id", schoolId).maybeSingle();
  if (error || !data) return null;
  const n = (data as { faculty_headcount?: number | null }).faculty_headcount;
  return typeof n === "number" && n > 0 ? n : null;
}

/** PostgREST caps a response at 1000 rows, so page explicitly. */
async function fetchResponses(db: Db, surveyId: string): Promise<(ResponseRow & { synthetic?: boolean })[]> {
  const PAGE = 1000;
  const all: (ResponseRow & { synthetic?: boolean })[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db
      .from("survey_responses")
      .select("respondent, item_id, scored_value, synthetic")
      .eq("survey_id", surveyId);
    if (!INCLUDE_SYNTHETIC) q = q.eq("synthetic", false);

    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw new Error(`survey_responses read failed: ${error.message}`);

    const page = (data ?? []) as (ResponseRow & { synthetic?: boolean })[];
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
  const [items, rows, headcount] = await Promise.all([fetchItems(db), fetchResponses(db, surveyId), fetchHeadcount(db)]);

  if (rows.length === 0) return { status: "no-data", surveyId };

  const stats = computeReportStats(rows, items);
  if (stats.n < MIN_RESPONDENTS) {
    return { status: "below-floor", surveyId, n: stats.n, floor: MIN_RESPONDENTS };
  }

  // How many of the respondents are demo rows. Only these may be called demo; the rest are real.
  const demoN = new Set(rows.filter((r) => r.synthetic === true).map((r) => r.respondent)).size;

  if (demoN === 0) {
    const gate = participation(stats.n, headcount);
    if (gate.status === "no-headcount") return { status: "below-floor", surveyId, n: stats.n, floor: 0, reason: "no-headcount" };
    if (gate.status === "below") return { status: "below-floor", surveyId, n: stats.n, floor: gate.required, reason: "participation" };
  }

  return { status: "ok", stats, surveyId, includesSynthetic: INCLUDE_SYNTHETIC && demoN > 0, demoN };
}
