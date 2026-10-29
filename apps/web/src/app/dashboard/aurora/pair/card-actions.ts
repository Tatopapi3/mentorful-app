"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateCard } from "@/lib/teacher/lookbook";

/**
 * Writes for the teacher's own lookbook card. On the caller's SESSION client, so 018_teacher_lookbook.sql is the
 * enforcement (a teacher can only ever write their own card, in their own school); the checks here fail early with a
 * readable message. A card is created only when the teacher saves it, and stays private until they publish it.
 */
type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const BUCKET = "teacher-photos";

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, me: null as null | { id: string; school: string | null } };
  const { data } = await supabase.from("profiles").select("id, school_id").eq("auth_user_id", user.id).maybeSingle();
  const p = data as { id: string; school_id: string | null } | null;
  return { supabase, me: p ? { id: p.id, school: p.school_id } : null };
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function ensureRow(supabase: Client, me: { id: string; school: string | null }, patch: Record<string, unknown>): Promise<string | null> {
  if (!me.school) return "Your profile isn't linked to a school yet.";
  const { data } = await supabase.from("teacher_cards").select("profile_id").eq("profile_id", me.id).maybeSingle();
  const now = new Date().toISOString();
  const r = data
    ? await supabase.from("teacher_cards").update({ ...patch, updated_at: now }).eq("profile_id", me.id)
    : await supabase.from("teacher_cards").insert({ profile_id: me.id, school_id: me.school, ...patch, updated_at: now });
  return r.error ? `Couldn't save: ${r.error.message}` : null;
}

export async function saveCard(raw: unknown): Promise<Result> {
  const { supabase, me } = await session();
  if (!me) return fail("You need to be signed in.");
  const v = validateCard(raw);
  if (!v.ok) return fail(v.error);
  const c = v.value;
  const err = await ensureRow(supabase, me, {
    headline: c.headline || null,
    bio: c.bio || null,
    experience: c.experience,
    achievements: c.achievements,
    growing_in: c.growingIn,
    wants: c.wants,
    wants_text: c.wantsText || null,
    show_growth: c.showGrowth,
    published: c.published,
  });
  if (err) return fail(err);
  revalidatePath("/dashboard/aurora", "layout");
  return { ok: true };
}

/** Receives a photo the browser has already cropped and shrunk, and keeps it at <school>/<profile>.jpg. */
export async function uploadPhoto(form: FormData): Promise<Result> {
  const { supabase, me } = await session();
  if (!me || !me.school) return fail("You need to be signed in.");
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a photo first.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return fail("Use a JPEG, PNG or WebP photo.");
  if (file.size > 2 * 1024 * 1024) return fail("That photo is over 2 MB. Choose a smaller one.");
  const storage = (supabase as unknown as { storage?: { from: (b: string) => { upload: (p: string, f: File, o: object) => Promise<{ error: { message: string } | null }> } } }).storage;
  if (!storage) return fail("Photo upload isn't available in the preview.");
  const path = `${me.school}/${me.id}.jpg`;
  const up = await storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (up.error) return fail(`Couldn't upload: ${up.error.message}`);
  const err = await ensureRow(supabase, me, { photo_path: path });
  if (err) return fail(err);
  revalidatePath("/dashboard/aurora", "layout");
  return { ok: true };
}

export async function removePhoto(): Promise<Result> {
  const { supabase, me } = await session();
  if (!me || !me.school) return fail("You need to be signed in.");
  const storage = (supabase as unknown as { storage?: { from: (b: string) => { remove: (p: string[]) => Promise<{ error: { message: string } | null }> } } }).storage;
  if (storage) await storage.from(BUCKET).remove([`${me.school}/${me.id}.jpg`]);
  const err = await ensureRow(supabase, me, { photo_path: null });
  if (err) return fail(err);
  revalidatePath("/dashboard/aurora", "layout");
  return { ok: true };
}
