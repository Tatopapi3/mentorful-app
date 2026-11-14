"use server";

import { requireAdmin } from "@/lib/admin/require";
import { MAX_ROSTER_ROWS, type RosterRow } from "./csv";

/**
 * What a school lead does with the roster: add teachers, and take back one who has not signed in yet. Both call database
 * functions (script 026) on the signed-in lead's own session; the functions check again that the caller leads a school and
 * only ever touch that school.
 */

export type AddResult = { ok: true; added: number; skipped: { row: number; email: string; reason: string }[] } | { ok: false; message: string };
export type RemoveResult = { ok: true } | { ok: false; message: string };

const missing = (e: { code?: string; message?: string }) => e.code === "PGRST202" || e.code === "42883" || /could not find the function|schema cache/i.test(e.message ?? "");

export async function addToRoster(rows: RosterRow[]): Promise<AddResult> {
  const admin = await requireAdmin("/admin/roster");
  if (!admin) return { ok: false, message: "Only the school lead can add teachers." };
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_ROSTER_ROWS) return { ok: false, message: `Add between 1 and ${MAX_ROSTER_ROWS} teachers at a time.` };

  const { data, error } = await admin.supabase.rpc("roster_add", { p_rows: rows });
  if (error) return { ok: false, message: missing(error) ? "The roster script has not been run on this database yet (scripts/026)." : error.message };
  const r = data as { added: number; skipped: { row: number; email: string; reason: string }[] };
  return { ok: true, added: r.added, skipped: r.skipped ?? [] };
}

export async function removeFromRoster(profileId: string): Promise<RemoveResult> {
  const admin = await requireAdmin("/admin/roster");
  if (!admin) return { ok: false, message: "Only the school lead can remove a teacher." };
  const { data, error } = await admin.supabase.rpc("roster_remove", { p_profile: profileId });
  if (error) {
    if (error.code === "23503") return { ok: false, message: "This teacher already has a partner or logged conversations, so they can't be removed here." };
    return { ok: false, message: missing(error) ? "The roster script has not been run on this database yet (scripts/026)." : error.message };
  }
  return data === true ? { ok: true } : { ok: false, message: "Only a teacher who has not signed in yet can be removed." };
}
