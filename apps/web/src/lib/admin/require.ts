import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  schoolId: string;
  displayName: string;
};

/**
 * Same rule as the existing leadership dashboard: a signed-in admin with a school, nobody else. Returns null
 * for a signed-in person who isn't one, so the page can say so; sends the signed-out to sign in.
 */
export async function requireAdmin(): Promise<AdminContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("id, school_id, role, first_name, last_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!me || me.role !== "admin" || !me.school_id) return null;

  return { supabase, schoolId: me.school_id, displayName: [me.first_name, me.last_name].filter(Boolean).join(" ") || "Administrator" };
}
