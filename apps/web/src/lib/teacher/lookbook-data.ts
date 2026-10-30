import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadTeacher } from "./load";
import { cardFromRow, type Card } from "./lookbook";

export type Lookbook = {
  /** False when 018 hasn't been applied to this database yet; the page then says so instead of failing. */
  ready: boolean;
  meId: string;
  cards: Card[];
  /** The teacher has chosen to stay out of the lookbook. */
  hidden: boolean;
};

const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "42883" || e.code === "PGRST202" || e.code === "PGRST205" || /does not exist|schema cache|Could not find the function/i.test(e.message ?? ""));

type Row = Record<string, unknown>;

/**
 * The lookbook for the signed-in teacher: the fixed set (name, department, strengths) of each colleague in their school
 * who hasn't chosen to hide, through lookbook_cards(), which is the only way a colleague's profile reaches them, and the
 * teacher's own hide/show choice.
 */
export const loadLookbook = cache(async (): Promise<Lookbook> => {
  const data = await loadTeacher();
  const none: Lookbook = { ready: true, meId: "", cards: [], hidden: false };
  if (!data.model) return none;
  const meId = data.model.me.id;
  const supabase = await createClient();
  const [cardsRes, mineRes] = await Promise.all([supabase.rpc("lookbook_cards"), supabase.from("lookbook_choices").select("hidden").eq("profile_id", meId).maybeSingle()]);
  if (missing(cardsRes.error) || missing(mineRes.error)) return { ...none, meId, ready: false };
  const rows = (Array.isArray(cardsRes.data) ? cardsRes.data : []) as Row[];
  return { ready: true, meId, cards: rows.map(cardFromRow), hidden: (mineRes.data as { hidden?: boolean } | null)?.hidden === true };
});
