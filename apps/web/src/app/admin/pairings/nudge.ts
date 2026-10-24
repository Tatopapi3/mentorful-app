"use server";

import { redirect } from "next/navigation";
import { audienceSize, type NudgeAudience } from "@/lib/admin/early-warning";
import { loadCooling } from "@/lib/admin/early-warning-data";
import { requireAdmin } from "@/lib/admin/require";

const BACK = new Set(["/admin/pairings", "/admin/aurora/pairings", "/admin/blend/pairings"]);

/**
 * PROTOTYPE. Checks the admin, works out how many pairs the chosen group is, and says what would happen. It sends
 * nothing and stores nothing: delivery is the part that needs a decision (a table of messages, and a function that
 * writes to each pair's inbox so the admin never sees who got it). The design is the point of this step.
 */
export async function sendNudge(formData: FormData) {
  const back = BACK.has(String(formData.get("back"))) ? String(formData.get("back")) : "/admin/pairings";
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  const cycle = String(formData.get("cycle") ?? "");
  const audience = (["cooling", "quiet", "both"] as const).find((a) => a === formData.get("audience")) as NudgeAudience | undefined;
  const message = String(formData.get("message") ?? "").trim();
  const q = (kind: "notice" | "error", text: string) => redirect(`${back}?${new URLSearchParams({ [kind]: text, ...(cycle ? { cycle } : {}) }).toString()}`);
  if (!audience || message.length < 10) q("error", "Choose who the nudge is for and write a message of at least a sentence.");

  const { count } = await admin.supabase.from("pairings").select("id", { count: "exact", head: true }).eq("school_id", admin.schoolId).eq("cycle_id", cycle).eq("status", "approved");
  const cooling = await loadCooling(admin, cycle, count ?? 0);
  if (!cooling) q("error", "The quiet-pair function isn't available, so the nudge can't be sized.");
  const n = audienceSize(cooling!, audience!);
  const who = n >= 5 ? `${n} pairs` : "the pairs in that group";
  q("notice", `Prototype: nothing was sent. In the real version this message would go to ${who} through the system, and you would not see which pairs received it.`);
}
