import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadTeacher } from "./load";
import type { CtleEntry, CtleSettings } from "./ctle";

export type Ctle = {
  /** False when 020 hasn't been applied to this database yet; the panel then says so instead of failing. */
  ready: boolean;
  /** null until the teacher tells us when their registration period started. */
  settings: CtleSettings | null;
  entries: CtleEntry[];
};

const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message ?? ""));

/** The signed-in teacher's own CTLE record, on their own session client (the policies in 020 are the enforcement). */
export const loadCtle = cache(async (): Promise<Ctle> => {
  const data = await loadTeacher();
  const empty: Ctle = { ready: true, settings: null, entries: [] };
  if (!data.model) return empty;
  const me = data.model.me.id;
  const supabase = await createClient();
  const [settings, hours] = await Promise.all([
    supabase.from("ctle_settings").select("period_start, period_years, required_hours, language_pct").eq("profile_id", me).maybeSingle(),
    supabase.from("ctle_hours").select("id, taken_on, hours, title, sponsor, language, approved, certificate, voided_at").eq("profile_id", me).order("taken_on", { ascending: false }).limit(300),
  ]);
  if (missing(settings.error) || missing(hours.error)) return { ...empty, ready: false };
  return {
    ready: true,
    settings: (settings.data as CtleSettings | null) ?? null,
    entries: ((hours.data ?? []) as (Omit<CtleEntry, "hours"> & { hours: number | string })[]).map((r) => ({ ...r, hours: Number(r.hours) })),
  };
});
