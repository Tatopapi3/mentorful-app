"use server";

import { requireAdmin } from "@/lib/admin/require";

/**
 * The two things a school lead does with the Culture Scan besides reading it: hand out one-time codes, and close the
 * survey so results are released. Both call database functions (scripts 023 and 024) on the signed-in administrator's own
 * session; the functions check again that the caller leads the school that owns the survey.
 */

export type CodesResult = { ok: true; codes: string[] } | { ok: false; message: string };
export type CloseResult = { ok: true; closedAt: string } | { ok: false; message: string };

const missing = (e: { code?: string; message?: string }) => e.code === "PGRST202" || e.code === "42883" || /could not find the function|schema cache/i.test(e.message ?? "");

/** Makes 1 to 200 one-time codes. They are shown once; the database keeps only a scrambled copy. */
export async function makeSurveyCodes(count: number): Promise<CodesResult> {
  const admin = await requireAdmin("/admin/reports");
  if (!admin) return { ok: false, message: "Only the school lead can make codes." };
  const surveyId = process.env.NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID;
  if (!surveyId) return { ok: false, message: "The Culture Scan is not set up on this site." };
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n < 1 || n > 200) return { ok: false, message: "Ask for between 1 and 200 codes." };

  const { data, error } = await admin.supabase.rpc("issue_survey_codes", { p_survey: surveyId, p_count: n });
  if (error) {
    return { ok: false, message: missing(error) ? "The one-time code scripts have not been run on this database yet (scripts/024)." : error.message };
  }
  return { ok: true, codes: (data ?? []) as string[] };
}

/** Closes the survey now. From then on its results can be released. Nothing is deleted. */
export async function closeCultureScan(): Promise<CloseResult> {
  const admin = await requireAdmin("/admin/reports");
  if (!admin) return { ok: false, message: "Only the school lead can close the survey." };
  const surveyId = process.env.NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID;
  if (!surveyId) return { ok: false, message: "The Culture Scan is not set up on this site." };

  const { data, error } = await admin.supabase.rpc("close_culture_scan", { p_survey: surveyId });
  if (error) {
    return { ok: false, message: missing(error) ? "The results scripts have not been run on this database yet (scripts/023)." : error.message };
  }
  return { ok: true, closedAt: String(data) };
}
