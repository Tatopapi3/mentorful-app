"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * The one choice a teacher has about the lookbook: whether colleagues can find them there. On the caller's SESSION
 * client, so 018_teacher_lookbook.sql is the enforcement (a teacher can only write their own row, in their own school).
 */
type Result = { ok: true } | { ok: false; error: string };

export async function setLookbookHidden(hidden: boolean): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };
  const { data } = await supabase.from("profiles").select("id, school_id").eq("auth_user_id", user.id).maybeSingle();
  const me = data as { id: string; school_id: string | null } | null;
  if (!me) return { ok: false, error: "You need to be signed in." };
  if (!me.school_id) return { ok: false, error: "Your profile isn't linked to a school yet." };
  const { data: row } = await supabase.from("lookbook_choices").select("profile_id").eq("profile_id", me.id).maybeSingle();
  const now = new Date().toISOString();
  const r = row
    ? await supabase.from("lookbook_choices").update({ hidden, updated_at: now }).eq("profile_id", me.id)
    : await supabase.from("lookbook_choices").insert({ profile_id: me.id, school_id: me.school_id, hidden, updated_at: now });
  if (r.error) return { ok: false, error: `Couldn't save: ${r.error.message}` };
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
