"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { allowlistActive, isAllowedEmail } from "@/lib/auth/allowlist";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Checked before a magic link is sent, so someone off the allowlist gets a
 * clear answer instead of an email that can't sign them in. Not the boundary:
 * the callback and the proxy enforce the same list.
 */
export async function checkSignIn(email: string): Promise<{ allowed: boolean; existingOnly: boolean }> {
  return { allowed: isAllowedEmail(email), existingOnly: allowlistActive() };
}
