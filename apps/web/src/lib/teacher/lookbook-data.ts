import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadTeacher } from "./load";
import { cardFromRow, type Card, type CardInput } from "./lookbook";

export const PHOTO_BUCKET = "teacher-photos";

export type MyCard = { input: CardInput; photoUrl: string | null; saved: boolean };
export type Lookbook = { ready: boolean; meId: string; cards: Card[]; mine: MyCard };

const EMPTY: CardInput = { headline: "", bio: "", experience: [], achievements: [], growingIn: [], wants: [], wantsText: "", showGrowth: false, published: false };
const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "42883" || e.code === "PGRST202" || e.code === "PGRST205" || /does not exist|schema cache|Could not find the function/i.test(e.message ?? ""));

type Row = Record<string, unknown>;

/**
 * The lookbook for the signed-in teacher: every published card in their school (through lookbook_cards(), which is the
 * only way a colleague's card reaches them) and their own card for the editor, published or not. Photos are private,
 * so each is a short-lived signed link made here on the server.
 */
export const loadLookbook = cache(async (): Promise<Lookbook> => {
  const data = await loadTeacher();
  const none: Lookbook = { ready: true, meId: "", cards: [], mine: { input: EMPTY, photoUrl: null, saved: false } };
  if (!data.model) return none;
  const meId = data.model.me.id;
  const supabase = await createClient();

  const [cardsRes, mineRes] = await Promise.all([
    supabase.rpc("lookbook_cards"),
    supabase.from("teacher_cards").select("headline, bio, photo_path, experience, achievements, growing_in, wants, wants_text, show_growth, published").eq("profile_id", meId).maybeSingle(),
  ]);
  if (missing(cardsRes.error) || missing(mineRes.error)) return { ...none, meId, ready: false };

  const rows = (Array.isArray(cardsRes.data) ? cardsRes.data : []) as Row[];
  const mineRow = mineRes.data as Row | null;

  // Signed photo links, in one call. The offline preview has no storage, so there it is skipped and initials show.
  const paths = [...new Set([...rows.map((r) => r.photo_path), mineRow?.photo_path].filter((p): p is string => typeof p === "string" && p.length > 0))];
  const urls = new Map<string, string>();
  const storage = (supabase as unknown as { storage?: { from: (b: string) => { createSignedUrls: (p: string[], s: number) => Promise<{ data: { path: string | null; signedUrl: string }[] | null }> } } }).storage;
  if (paths.length && storage) {
    try {
      const { data: signed } = await storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
      for (const s of signed ?? []) if (s.path) urls.set(s.path, s.signedUrl);
    } catch {
      // no photos this time; the cards fall back to initials
    }
  }
  const photo = (p: unknown) => (typeof p === "string" ? (urls.get(p) ?? null) : null);

  const mine: MyCard = mineRow
    ? {
        saved: true,
        photoUrl: photo(mineRow.photo_path),
        input: {
          headline: String(mineRow.headline ?? ""),
          bio: String(mineRow.bio ?? ""),
          experience: (Array.isArray(mineRow.experience) ? (mineRow.experience as Row[]) : []).map((e) => ({ role: String(e.role ?? ""), place: String(e.place ?? ""), years: String(e.years ?? "") })),
          achievements: Array.isArray(mineRow.achievements) ? (mineRow.achievements as string[]) : [],
          growingIn: Array.isArray(mineRow.growing_in) ? (mineRow.growing_in as string[]) : [],
          wants: Array.isArray(mineRow.wants) ? (mineRow.wants as string[]) : [],
          wantsText: String(mineRow.wants_text ?? ""),
          showGrowth: mineRow.show_growth === true,
          published: mineRow.published === true,
        },
      }
    : { input: EMPTY, photoUrl: null, saved: false };

  return { ready: true, meId, cards: rows.map((r) => cardFromRow(r, photo(r.photo_path))), mine };
});
