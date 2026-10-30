"use server";

import { redirect } from "next/navigation";
import { domainsForTags } from "@/lib/domains";
import { requireAdmin } from "@/lib/admin/require";

// The only two places a leader can change pairings. Both run on the signed-in admin's session, so the existing
// row-level policies for admins decide what is allowed, and both check the school again in the query.
const BACK = new Set(["/admin/pairings"]);
const back = (v: FormDataEntryValue | null) => (BACK.has(String(v)) ? String(v) : "/admin/pairings");
const done = (to: string, kind: "notice" | "error", message: string, cycle?: string) =>
  redirect(`${to}?${new URLSearchParams({ [kind]: message, ...(cycle ? { cycle } : {}) }).toString()}`);

/** Approve or decline one pairing a teacher asked for. The colleague is never told. */
export async function decidePairing(formData: FormData) {
  const to = back(formData.get("back"));
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const decision = formData.get("decision") === "approve" ? "approved" : "rejected";
  const cycle = String(formData.get("cycle") ?? "") || undefined;

  const patch = decision === "approved" ? { status: "approved", approved_at: new Date().toISOString() } : { status: "rejected" };
  const { error } = await admin.supabase.from("pairings").update(patch).eq("id", id).eq("school_id", admin.schoolId).eq("status", "pending");
  if (error) done(to, "error", `Couldn't save that decision: ${error.message}`, cycle);
  done(to, "notice", decision === "approved" ? "Pair approved. It now counts as an active pair." : "Request declined.", cycle);
}

/** Publish a reviewed randomized round as approved pairs. Nothing is saved until this is pressed. */
export async function publishRound(formData: FormData) {
  const to = back(formData.get("back"));
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  const cycleId = String(formData.get("cycle") ?? "");
  const pairs = formData.getAll("pair").map((v) => String(v).split(":")).filter((p) => p.length === 2 && p[0] !== p[1]);
  if (pairs.length === 0) done(to, "error", "There was nothing to publish.", cycleId);

  const { supabase, schoolId } = admin;
  const { data: cycle } = await supabase.from("cycles").select("id").eq("id", cycleId).eq("school_id", schoolId).maybeSingle();
  if (!cycle) done(to, "error", "That cycle isn't part of your school.", cycleId);

  const ids = [...new Set(pairs.flat())];
  const { data: people } = await supabase.from("profiles").select("id, strength_tags").eq("school_id", schoolId).eq("role", "teacher").in("id", ids);
  const tags = new Map((people ?? []).map((p) => [p.id, p.strength_tags]));
  if (ids.some((id) => !tags.has(id))) done(to, "error", "Someone in that round isn't a teacher at your school.", cycleId);

  const { data: existing } = await supabase.from("pairings").select("host_id, visitor_id").eq("school_id", schoolId).eq("cycle_id", cycleId).eq("status", "approved");
  const taken = new Set((existing ?? []).flatMap((p) => [p.host_id, p.visitor_id]));
  if (ids.some((id) => taken.has(id))) done(to, "error", "Someone in that round already has a partner this cycle. Draft a new round.", cycleId);

  const rows = pairs.map(([host, visitor]) => ({
    school_id: schoolId,
    cycle_id: cycleId,
    host_id: host,
    visitor_id: visitor,
    status: "approved",
    approved_at: new Date().toISOString(),
    // A starting domain both can work in: the host's first strength, else Classroom. The pair can change it.
    domain: domainsForTags(tags.get(host))[0] ?? "CLASSROOM",
  }));
  const { error } = await supabase.from("pairings").insert(rows);
  if (error) done(to, "error", `Couldn't publish the round: ${error.message}`, cycleId);
  done(to, "notice", `Published ${rows.length} ${rows.length === 1 ? "pair" : "pairs"}.`, cycleId);
}
