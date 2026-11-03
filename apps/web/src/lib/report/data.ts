/**
 * Server-only data access for the Culture Scan report.
 *
 * survey_responses has NO select policy, so no signed-in user can read an answer. The report gets its numbers from
 * the database function culture_scan_aggregates (script 023), called on the signed-in administrator's own session:
 * it checks the caller is an admin of the school, releases nothing until the survey has closed, enforces the floor of
 * five and the 60% participation rule, and returns only counts, averages and the correlation table. No answer and no
 * respondent id ever reaches this server, let alone a browser.
 *
 * Until script 023 has been run on a database, this module falls back to the old route: read the answers with the
 * service key (SUPABASE_SERVICE_ROLE_KEY, deliberately not NEXT_PUBLIC_, so Next never inlines it into a client
 * bundle) and add them up here, with the same release rules applied in code. Once 023 is applied the service key is not
 * used by the report at all and can be rotated and removed from the environment.
 *
 * The guard below is a second line of defence in case someone imports this from "use client".
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DIMENSIONS,
  aggregatesFromRows,
  statsFromAggregates,
  type Aggregates,
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
 * Demo rows (generated for the sample school) are included in the numbers and labelled as demo, never passed off as
 * real: `demoN` says how many of the n respondents are demo. Flip to false to leave them out entirely.
 */
const INCLUDE_SYNTHETIC = true;

/**
 * The smallest group the report will ever describe: five complete respondents. The database function enforces the same
 * number; this copy covers the legacy path.
 */
export const MIN_RESPONDENTS = 5;

/*
 * Participation floor (Nick, Oct 29): 60% of the roster, the roster being schools.faculty_headcount (script 020). It
 * applies when every respondent is real. While demo rows are in the data the report is a demo and is labelled as one,
 * so the gate is not enforced on it; the moment the data is all real, the gate is. With no headcount on the school
 * record the report stays closed: there is nothing to measure 60% of.
 */

export type ReportLoad =
  | { status: "ok"; stats: ReportStats; surveyId: string; includesSynthetic: boolean; /** How many of stats.n are demo rows. */ demoN: number }
  | { status: "no-data"; surveyId: string }
  /** Results are released after the survey closes (Nick, Oct 29). `closesAt` is null when no close date is set. */
  | { status: "not-closed"; surveyId: string; closesAt: string | null }
  | { status: "below-floor"; surveyId: string; n: number; floor: number; /** "no-headcount": the school record has no faculty headcount, so floor is 0. */ reason?: "floor" | "participation" | "no-headcount" }
  | { status: "misconfigured"; message: string };

/** What the signed-in session can call: the database function and the survey questions. */
export type SessionDb = Pick<SupabaseClient, "rpc" | "from">;

function serviceClient(url: string, key: string) {
  return createClient(url, key, { auth: { persistSession: false } });
}

type Db = ReturnType<typeof serviceClient> | SessionDb;

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

/** The roster size, for the 60% gate. Null when it is not recorded (or script 020 is not applied). Legacy path only. */
async function fetchHeadcount(db: Db): Promise<number | null> {
  const schoolId = process.env.NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID;
  if (!schoolId) return null;
  const { data, error } = await db.from("schools").select("faculty_headcount").eq("id", schoolId).maybeSingle();
  if (error || !data) return null;
  const n = (data as { faculty_headcount?: number | null }).faculty_headcount;
  return typeof n === "number" && n > 0 ? n : null;
}

/** When the survey closes. Legacy path only. */
async function fetchClosesAt(db: Db, surveyId: string): Promise<string | null> {
  const { data } = await db.from("surveys").select("closes_at").eq("id", surveyId).maybeSingle();
  return (data as { closes_at?: string | null } | null)?.closes_at ?? null;
}

/** PostgREST caps a response at 1000 rows, so page explicitly. Legacy path only. */
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

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Turns what culture_scan_aggregates returned into a ReportLoad. Pure, so it is tested without a database. Anything
 * that is not exactly the shape the function documents is "misconfigured", never a half-built report.
 */
export function loadFromAggregateJson(json: unknown, items: ReportItem[], surveyId: string): ReportLoad {
  const j = json as Record<string, unknown> | null;
  const bad = (what: string): ReportLoad => ({ status: "misconfigured", message: `culture_scan_aggregates returned something unexpected (${what}).` });
  if (!j || typeof j !== "object") return bad("no answer");

  switch (j.status) {
    case "no-data":
      return { status: "no-data", surveyId };
    case "not-closed":
      return { status: "not-closed", surveyId, closesAt: typeof j.closes_at === "string" ? j.closes_at : null };
    case "below-floor": {
      const reason = j.reason === "participation" || j.reason === "no-headcount" || j.reason === "floor" ? j.reason : "floor";
      return { status: "below-floor", surveyId, n: isFiniteNumber(j.n) ? j.n : 0, floor: isFiniteNumber(j.floor) ? j.floor : MIN_RESPONDENTS, reason };
    }
    case "ok": {
      const means = j.means as Record<string, unknown> | undefined;
      const sds = j.sds as Record<string, unknown> | undefined;
      const corr = j.correlation as unknown;
      if (!isFiniteNumber(j.n) || !means || !sds || !Array.isArray(corr) || corr.length !== DIMENSIONS.length) return bad("missing figures");
      const m = {} as Record<Dimension, number>;
      const s = {} as Record<Dimension, number>;
      for (const d of DIMENSIONS) {
        if (!isFiniteNumber(means[d]) || !isFiniteNumber(sds[d])) return bad(`dimension ${d}`);
        m[d] = means[d] as number;
        s[d] = sds[d] as number;
      }
      const correlation = corr.map((row) => (Array.isArray(row) ? row.map(Number) : []));
      if (correlation.some((row) => row.length !== DIMENSIONS.length || row.some((x) => !Number.isFinite(x)))) return bad("correlation table");
      const agg: Aggregates = { n: j.n, dropped: isFiniteNumber(j.dropped) ? j.dropped : 0, means: m, sds: s, correlation };
      const demoN = isFiniteNumber(j.demo_n) ? j.demo_n : 0;
      return { status: "ok", stats: statsFromAggregates(agg, items), surveyId, includesSynthetic: INCLUDE_SYNTHETIC && demoN > 0, demoN };
    }
    default:
      return bad("unknown status");
  }
}

/** The database does not have script 023 yet: PostgREST says it cannot find the function. */
const functionMissing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function|schema cache/i.test(e.message ?? ""));

/**
 * Loads the aggregate for the Culture Scan survey. Returns ReportStats only, never raw rows.
 *
 * Pass the signed-in administrator's Supabase client. With script 023 applied that is all it needs (no service key).
 * Without a client, or before 023 is applied, it falls back to reading with the service key.
 */
export async function loadReportStats(session?: SessionDb): Promise<ReportLoad> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const surveyId = process.env.NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID;

  if (!url) {
    return { status: "misconfigured", message: "Missing NEXT_PUBLIC_SUPABASE_URL." };
  }
  if (!surveyId) {
    return { status: "misconfigured", message: "Missing NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID in .env.local." };
  }

  if (session) {
    const { data, error } = await session.rpc("culture_scan_aggregates", { p_survey: surveyId });
    if (!error) {
      const items = await fetchItems(session);
      return loadFromAggregateJson(data, items, surveyId);
    }
    if (!functionMissing(error)) {
      return { status: "misconfigured", message: `The Culture Scan could not be read: ${error.message}` };
    }
    // Script 023 is not applied yet: fall through to the legacy read.
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    return {
      status: "misconfigured",
      message: "The database function culture_scan_aggregates is not installed (run scripts/023) and there is no SUPABASE_SERVICE_ROLE_KEY to fall back on.",
    };
  }

  const db = serviceClient(url, key);

  // Results are released after the survey closes.
  const closesAt = await fetchClosesAt(db, surveyId);
  if (!closesAt || new Date(closesAt).getTime() > Date.now()) return { status: "not-closed", surveyId, closesAt };

  const [items, rows, headcount] = await Promise.all([fetchItems(db), fetchResponses(db, surveyId), fetchHeadcount(db)]);

  if (rows.length === 0) return { status: "no-data", surveyId };

  // Complete respondents only, as the aggregate function does. Fewer than five and the report stays closed.
  let agg: Aggregates;
  try {
    agg = aggregatesFromRows(rows, items);
  } catch {
    return { status: "below-floor", surveyId, n: 0, floor: MIN_RESPONDENTS, reason: "floor" };
  }
  if (agg.n < MIN_RESPONDENTS) {
    return { status: "below-floor", surveyId, n: agg.n, floor: MIN_RESPONDENTS, reason: "floor" };
  }

  // How many of the respondents are demo rows. Only these may be called demo; the rest are real.
  const demoN = new Set(rows.filter((r) => r.synthetic === true).map((r) => r.respondent)).size;

  if (demoN === 0) {
    const gate = participation(agg.n, headcount);
    if (gate.status === "no-headcount") return { status: "below-floor", surveyId, n: agg.n, floor: 0, reason: "no-headcount" };
    if (gate.status === "below") return { status: "below-floor", surveyId, n: agg.n, floor: gate.required, reason: "participation" };
  }

  return { status: "ok", stats: statsFromAggregates(agg, items), surveyId, includesSynthetic: INCLUDE_SYNTHETIC && demoN > 0, demoN };
}
