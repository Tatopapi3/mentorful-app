"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { entryProblem, settingsProblem, type CtleSettings } from "@/lib/teacher/ctle";

/**
 * The CTLE tracker's write paths. Like hub-actions.ts, each runs on the caller's SESSION client, so the policies in
 * 020_ctle_hours.sql are the enforcement; the checks here exist to fail early with a readable message.
 */

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const refresh = () => revalidatePath("/dashboard", "layout");

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, me: null as string | null };
  const { data: profile } = await supabase.from("profiles").select("id").eq("auth_user_id", user.id).maybeSingle();
  return { supabase, me: (profile as { id: string } | null)?.id ?? null };
}

export async function saveCtleSettings(s: CtleSettings): Promise<Result> {
  const { supabase, me } = await session();
  if (!me) return fail("You need to be signed in.");
  const today = new Date().toISOString().slice(0, 10);
  const problem = settingsProblem(s, today);
  if (problem) return fail(problem);
  const row = { period_start: s.period_start, period_years: s.period_years, required_hours: s.required_hours, language_pct: s.language_pct };
  const { data: existing } = await supabase.from("ctle_settings").select("profile_id").eq("profile_id", me).maybeSingle();
  const now = new Date().toISOString();
  const { error } = existing
    ? await supabase.from("ctle_settings").update({ ...row, updated_at: now }).eq("profile_id", me)
    : await supabase.from("ctle_settings").insert({ profile_id: me, ...row, updated_at: now });
  if (error) return fail(`Couldn't save: ${error.message}`);
  refresh();
  return { ok: true };
}

export async function addCtleHours(e: { taken_on: string; hours: number; title: string; sponsor: string; language: boolean; approved: boolean; certificate: boolean }): Promise<Result> {
  const { supabase, me } = await session();
  if (!me) return fail("You need to be signed in.");
  const problem = entryProblem(e, new Date().toISOString().slice(0, 10));
  if (problem) return fail(problem);
  const { error } = await supabase.from("ctle_hours").insert({
    profile_id: me,
    taken_on: e.taken_on,
    hours: e.hours,
    title: e.title.trim().slice(0, 200),
    sponsor: e.sponsor.trim().slice(0, 120) || null,
    language: e.language,
    approved: e.approved,
    certificate: e.certificate,
  });
  if (error) return fail(`Couldn't save: ${error.message}`);
  refresh();
  return { ok: true };
}

/** Nothing is deleted: a mistaken entry is marked removed and stops counting. */
export async function removeCtleHours(id: string): Promise<Result> {
  const { supabase, me } = await session();
  if (!me) return fail("You need to be signed in.");
  const { error } = await supabase.from("ctle_hours").update({ voided_at: new Date().toISOString() }).eq("id", id).eq("profile_id", me);
  if (error) return fail(`Couldn't remove: ${error.message}`);
  refresh();
  return { ok: true };
}
