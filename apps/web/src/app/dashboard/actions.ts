"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Write paths for the teacher's conversation journal.
 *
 * Both actions run on the caller's SESSION client, so 011's policies are the
 * enforcement, not these functions. The checks here exist to fail early with a
 * readable message rather than to be the security boundary — an RLS denial
 * returns "no rows", which is a confusing thing to surface as an error.
 *
 * Nothing about WHO is in the conversation comes from the form. The client
 * sends a pairing id and prose; host, visitor, school and cycle are all read
 * off the pairing row server-side. A teacher could otherwise post a log into
 * somebody else's pair — RLS would reject it, but only because the predicate
 * happens to catch it, which is a thin place to rely on.
 */

type ActionResult = { ok: true } | { ok: false; error: string };

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null as null | { id: string } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return { supabase, profile };
}

export async function createLog(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { ok: false, error: "You need to be signed in." };

  const pairingId = String(formData.get("pairing_id") ?? "");
  if (!pairingId) return { ok: false, error: "Choose who the conversation was with." };

  // The pairing is read through RLS, so this only resolves for a pair the
  // caller is actually in. Everything structural is derived from it.
  const { data: pairing } = await supabase
    .from("pairings")
    .select("id, school_id, cycle_id, host_id, visitor_id, domain, strategic_tag")
    .eq("id", pairingId)
    .maybeSingle();

  if (!pairing) return { ok: false, error: "That pairing isn't one of yours." };
  if (pairing.host_id !== profile.id && pairing.visitor_id !== profile.id) {
    return { ok: false, error: "That pairing isn't one of yours." };
  }

  const text = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v.length ? v : null;
  };

  const vision = text("vision");
  const strength = text("strength_noted");
  if (!vision && !strength) {
    return { ok: false, error: "Add at least what you're working toward or what you noticed." };
  }

  const domain = String(formData.get("domain") ?? "") || pairing.domain;

  // status must be 'draft' on insert: 011's insert policy requires it, and the
  // submitted_at CHECK requires submitted_at to be null while it is.
  const { error } = await supabase.from("conversation_logs").insert({
    school_id: pairing.school_id,
    cycle_id: pairing.cycle_id,
    pairing_id: pairing.id,
    host_id: pairing.host_id,
    visitor_id: pairing.visitor_id,
    logged_by: profile.id,
    domain,
    strategic_tag: pairing.strategic_tag,
    vision,
    strength_noted: strength,
    more_frequently: text("more_frequently"),
    less_frequently: text("less_frequently"),
    resources: text("resources"),
    status: "draft",
    submitted_at: null,
    is_visit_debrief: false,
  });

  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Returns void, not a result: it is wired to a plain <form action={...}> with
 * no client state to render an error into. A failure throws, which the route's
 * error boundary surfaces — louder than a silently unchanged draft.
 */
export async function submitLog(formData: FormData): Promise<void> {
  const { supabase, profile } = await me();
  if (!profile) throw new Error("You need to be signed in.");

  const id = String(formData.get("log_id") ?? "");
  if (!id) throw new Error("Missing log.");

  // 011's update policy only matches rows that are still drafts, so this can
  // run exactly once per log. submitted_at has to be set in the same statement
  // or conversation_logs_submitted_at_check rejects it.
  const { error } = await supabase
    .from("conversation_logs")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Couldn't submit: ${error.message}`);

  revalidatePath("/dashboard");
}
