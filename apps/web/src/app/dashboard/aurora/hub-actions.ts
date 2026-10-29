"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toMessage, type Message } from "@/lib/teacher/hub-data";
import { MODULES, type GrowthKind } from "@/lib/teacher/hub";
import { cleanOutputs, protocolByName } from "@/lib/teacher/protocols";

/**
 * The hub's write paths. Like ../actions.ts, every one runs on the caller's SESSION client, so the policies in
 * 017_teacher_hub.sql are the enforcement; the checks here exist to fail early with a readable message. Nothing about
 * WHO is in a pair comes from the browser: a pairing id is checked against the pairings the caller can see.
 */

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const refresh = () => revalidatePath("/dashboard/aurora", "layout");
const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, me: null as string | null };
  const { data: profile } = await supabase.from("profiles").select("id").eq("auth_user_id", user.id).maybeSingle();
  return { supabase, me: (profile as { id: string } | null)?.id ?? null };
}

/** The caller must be in this approved pairing. */
async function inPair(supabase: Awaited<ReturnType<typeof createClient>>, me: string, pairingId: string) {
  const { data } = await supabase.from("pairings").select("id, host_id, visitor_id, status").eq("id", pairingId).maybeSingle();
  const p = data as { host_id: string; visitor_id: string; status: string } | null;
  return !!p && p.status === "approved" && (p.host_id === me || p.visitor_id === me);
}

/* -------------------------------------------------------------- pair chat */

export async function fetchMessages(pairingId: string): Promise<Message[]> {
  const { supabase, me } = await session();
  if (!me || !(await inPair(supabase, me, pairingId))) return [];
  const { data } = await supabase.from("pair_messages").select("id, pairing_id, sender_id, body, created_at").eq("pairing_id", pairingId).order("created_at", { ascending: false }).limit(200);
  return ((data ?? []) as Parameters<typeof toMessage>[0][]).map((r) => toMessage(r, me)).reverse();
}

export async function sendMessage(pairingId: string, text: string): Promise<{ ok: true; messages: Message[] } | { ok: false; error: string }> {
  const { supabase, me } = await session();
  if (!me) return fail("You need to be signed in.");
  const body = text.trim();
  if (!body) return fail("Write a message first.");
  if (body.length > 2000) return fail("That message is too long. Keep it under 2,000 characters.");
  if (!(await inPair(supabase, me, pairingId))) return fail("That pairing isn't one of yours.");
  const { error } = await supabase.from("pair_messages").insert({ pairing_id: pairingId, sender_id: me, body });
  if (error) return fail(`Couldn't send: ${error.message}`);
  return { ok: true, messages: await fetchMessages(pairingId) };
}

/* -------------------------------------------------------------- games hub */

export async function logGameSession(pairingId: string, module: string, minutes: number | null, completed: boolean, note: string, outputs?: Record<string, string>): Promise<Result> {
  const { supabase, me } = await session();
  if (!me) return fail("You need to be signed in.");
  if (!MODULES.some((m) => m.name === module)) return fail("That isn't one of the modules.");
  if (!(await inPair(supabase, me, pairingId))) return fail("That pairing isn't one of yours.");
  const mins = minutes && Number.isFinite(minutes) ? Math.min(600, Math.max(1, Math.round(minutes))) : null;
  const proto = protocolByName(module);
  const clean = proto && outputs ? cleanOutputs(proto, outputs) : {};
  const { error } = await supabase.from("pair_game_sessions").insert({ pairing_id: pairingId, module, logged_by: me, minutes: mins, completed, note: note.trim().slice(0, 500) || null, outputs: Object.keys(clean).length ? clean : null });
  if (error) return fail(`Couldn't save: ${error.message}`);
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------- notes to future self */

export async function saveFutureNote(body: string, openOn: string | null): Promise<Result> {
  const { supabase, me } = await session();
  if (!me) return fail("You need to be signed in.");
  const text = body.trim();
  if (!text) return fail("Write something to your future self first.");
  if (text.length > 4000) return fail("That note is too long. Keep it under 4,000 characters.");
  if (openOn !== null && !DAY.test(openOn)) return fail("Choose a valid date.");
  const { error } = await supabase.from("future_notes").insert({ profile_id: me, body: text, open_on: openOn });
  if (error) return fail(`Couldn't save: ${error.message}`);
  refresh();
  return { ok: true };
}

/** Opens a note (early if need be) and returns its words. The seal is the teacher's own choice to keep, so opening early is allowed. */
export async function openFutureNote(id: string): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  const { supabase, me } = await session();
  if (!me) return fail("You need to be signed in.");
  const { data } = await supabase.from("future_notes").select("id, body, opened_at").eq("id", id).eq("profile_id", me).maybeSingle();
  const note = data as { body: string; opened_at: string | null } | null;
  if (!note) return fail("That note isn't there.");
  if (!note.opened_at) {
    const { error } = await supabase.from("future_notes").update({ opened_at: new Date().toISOString() }).eq("id", id).eq("profile_id", me);
    if (error) return fail(`Couldn't open it: ${error.message}`);
  }
  refresh();
  return { ok: true, body: note.body };
}

/* ------------------------------------------------------ time on the platform */

/**
 * Adds a little active time to a day. Called every half minute by the tracker while the page is visible and the
 * teacher is active, so the total is time spent, not time a tab sat open. No refresh: this must never re-render a page.
 */
export async function recordTime(day: string, seconds: number): Promise<void> {
  if (!DAY.test(day) || !Number.isFinite(seconds)) return;
  const add = Math.min(120, Math.max(0, Math.round(seconds)));
  if (add < 1) return;
  // The browser's local day can differ from the server's by up to a day either way, and no more.
  if (Math.abs(Date.parse(`${day}T00:00:00Z`) - Date.now()) > 2 * 86_400_000) return;
  const { supabase, me } = await session();
  if (!me) return;
  const bump = async () => {
    const { data } = await supabase.from("platform_time").select("seconds").eq("profile_id", me).eq("day", day).maybeSingle();
    const row = data as { seconds: number } | null;
    if (!row) return supabase.from("platform_time").insert({ profile_id: me, day, seconds: add });
    return supabase.from("platform_time").update({ seconds: Math.min(86_400, row.seconds + add), updated_at: new Date().toISOString() }).eq("profile_id", me).eq("day", day);
  };
  const { error } = await bump();
  if (error) await bump(); // two tabs creating the same day at once: the second try updates it
}

/* ------------------------------------------------------------ growth */

export async function saveGoal(title: string, area: string | null, why: string, targetDate: string | null): Promise<Result> {
  const { supabase, me } = await session();
  if (!me) return fail("You need to be signed in.");
  const t = title.trim();
  if (!t) return fail("Give the goal a short name.");
  if (t.length > 160) return fail("Keep the goal under 160 characters.");
  if (targetDate !== null && !DAY.test(targetDate)) return fail("Choose a valid date.");
  const { error } = await supabase.from("growth_goals").insert({ profile_id: me, title: t, area: area?.slice(0, 40) || null, why: why.trim().slice(0, 600) || null, target_date: targetDate, status: "active" });
  if (error) return fail(`Couldn't save: ${error.message}`);
  refresh();
  return { ok: true };
}

export async function setGoalStatus(id: string, status: "active" | "done" | "dropped"): Promise<Result> {
  const { supabase, me } = await session();
  if (!me) return fail("You need to be signed in.");
  if (!["active", "done", "dropped"].includes(status)) return fail("Unknown status.");
  const { error } = await supabase.from("growth_goals").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("profile_id", me);
  if (error) return fail(`Couldn't update: ${error.message}`);
  refresh();
  return { ok: true };
}

export async function addGrowthEntry(kind: GrowthKind, body: string, minutes: number | null, goalId: string | null): Promise<Result> {
  const { supabase, me } = await session();
  if (!me) return fail("You need to be signed in.");
  if (!["practice", "learning", "reflection", "observation"].includes(kind)) return fail("Choose what kind of entry this is.");
  const text = body.trim();
  if (!text) return fail("Write a line or two about it first.");
  if (text.length > 1000) return fail("Keep it under 1,000 characters.");
  const mins = minutes && Number.isFinite(minutes) ? Math.min(600, Math.max(1, Math.round(minutes))) : null;
  const { error } = await supabase.from("growth_entries").insert({ profile_id: me, goal_id: goalId || null, kind, minutes: mins, body: text });
  if (error) return fail(`Couldn't save: ${error.message}`);
  refresh();
  return { ok: true };
}
