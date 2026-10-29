import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadTeacher } from "./load";
import { noteState, withheld, type FutureNote, type GameSession, type Goal, type GrowthEntry, type PlatformDay } from "./hub";

export type Message = { id: string; pairingId: string; senderId: string; mine: boolean; text: string; at: string };

export type Hub = {
  /** False when 017 hasn't been applied to this database yet; the page then says so instead of failing. */
  ready: boolean;
  messages: Message[];
  games: GameSession[];
  notes: FutureNote[];
  time: PlatformDay[];
  goals: Goal[];
  practice: GrowthEntry[];
};

// A table that isn't there yet (migration not applied) reads as "not switched on", not as an error.
const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message ?? ""));

export const toMessage = (r: { id: string; pairing_id: string; sender_id: string; body: string; created_at: string }, me: string): Message => ({
  id: r.id,
  pairingId: r.pairing_id,
  senderId: r.sender_id,
  mine: r.sender_id === me,
  text: r.body,
  at: r.created_at,
});

/**
 * Everything the hub needs that isn't a conversation log. Same rule as the rest of the teacher side: the signed-in
 * teacher's own session client, with explicit filters on top of the database's row-level rules. The words of a note
 * whose date hasn't come never leave the server.
 */
export const loadHub = cache(async (): Promise<Hub> => {
  const data = await loadTeacher();
  const empty: Hub = { ready: true, messages: [], games: [], notes: [], time: [], goals: [], practice: [] };
  if (!data.model) return empty;
  const me = data.model.me.id;
  const pairIds = data.model.partners.map((p) => p.pairingId);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const none = Promise.resolve({ data: [] as never[], error: null });
  const [msgs, games, notes, time, goals, practice] = await Promise.all([
    pairIds.length ? supabase.from("pair_messages").select("id, pairing_id, sender_id, body, created_at").in("pairing_id", pairIds).order("created_at", { ascending: false }).limit(300) : none,
    pairIds.length ? supabase.from("pair_game_sessions").select("id, pairing_id, module, logged_by, minutes, completed, note, created_at").in("pairing_id", pairIds).order("created_at", { ascending: false }).limit(300) : none,
    supabase.from("future_notes").select("id, body, open_on, opened_at, created_at").eq("profile_id", me).order("created_at", { ascending: false }).limit(100),
    supabase.from("platform_time").select("day, seconds").eq("profile_id", me).order("day", { ascending: false }).limit(60),
    supabase.from("growth_goals").select("id, title, area, why, target_date, status, created_at").eq("profile_id", me).order("created_at", { ascending: false }).limit(50),
    supabase.from("growth_entries").select("id, goal_id, kind, minutes, body, created_at").eq("profile_id", me).order("created_at", { ascending: false }).limit(100),
  ]);

  if ([msgs, games, notes, time, goals, practice].some((r) => missing(r.error))) return { ...empty, ready: false };

  return {
    ready: true,
    messages: ((msgs.data ?? []) as Parameters<typeof toMessage>[0][]).map((r) => toMessage(r, me)).reverse(),
    games: (games.data ?? []) as GameSession[],
    notes: ((notes.data ?? []) as FutureNote[]).map((n) => withheld(n, noteState(n, today))),
    time: (time.data ?? []) as PlatformDay[],
    goals: (goals.data ?? []) as Goal[],
    practice: (practice.data ?? []) as GrowthEntry[],
  };
});
