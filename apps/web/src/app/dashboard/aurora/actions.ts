"use server";

import { revalidatePath } from "next/cache";
import { createLog, submitLog } from "../actions";

/**
 * The teacher's write paths, reused as they are. The Aurora tabs sit under /dashboard/aurora, which the original
 * actions don't revalidate, so each one is wrapped to refresh these pages as well. All the checks (who the pair is,
 * draft-then-submit) stay in ../actions.ts, where Nick's policies are the enforcement.
 */
type Result = { ok: true } | { ok: false; error: string };

export async function saveEntry(formData: FormData): Promise<Result> {
  const r = await createLog(formData);
  if (r.ok) revalidatePath("/dashboard/aurora", "layout");
  return r;
}

export async function submitEntry(formData: FormData): Promise<void> {
  await submitLog(formData);
  revalidatePath("/dashboard/aurora", "layout");
}
