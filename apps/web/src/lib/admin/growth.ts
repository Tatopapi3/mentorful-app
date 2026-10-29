import type { AdminContext } from "./require";

/**
 * Anonymous growth-tool totals for the school lead (what growth_activity() in 019 returns), and how to read them aloud.
 * The database function is the privacy boundary: it only counts teachers who opted in, returns no per-person figure,
 * rounds, and withholds anything under the floor. This file adds nothing to what leaves the database; it only phrases it.
 */

export type GrowthActivity = {
  teachers: number;
  window_days: number;
  enough: boolean;
  contributors?: number;
  share_pct?: number;
  active_week_pct?: number;
  typical_week_minutes?: number | null;
  days_buckets?: { label: string; pct: number }[] | null;
  has_goal_pct?: number;
  goals_done_pct?: number | null;
  practiced_pct?: number;
  practice_entries?: number | null;
  game_sessions?: number | null;
  game_modules_done?: number | null;
  pairs_playing?: number | null;
  weekly?: { week: string; pct: number }[];
};

/** null when the function isn't there yet (019 not applied) or the caller isn't an admin. */
export async function loadGrowthActivity(admin: AdminContext, days = 30): Promise<GrowthActivity | null> {
  const { data, error } = await admin.supabase.rpc("growth_activity", { p_days: days });
  if (error || !data || typeof data !== "object") return null;
  return data as GrowthActivity;
}

export type Reading = {
  headline: { label: string; value: string; note: string }[];
  /** Plain sentences a principal could say out loud. */
  sentences: string[];
  trend: { label: string; value: number }[];
  buckets: { label: string; value: number }[];
};

const pct = (n: number | null | undefined) => (typeof n === "number" ? `${n}%` : "n/a");

export function readGrowth(g: GrowthActivity): Reading | null {
  if (!g.enough) return null;
  const about = g.contributors ?? 0;
  const sentences: string[] = [];
  sentences.push(`About ${about} teachers (${pct(g.share_pct)} of ${g.teachers}) chose to share their activity, and roughly ${pct(g.active_week_pct)} of them used Mentorful in the last week.`);
  if (g.typical_week_minutes != null) sentences.push(`A typical sharing teacher was active about ${g.typical_week_minutes} minutes in the last week.`);
  sentences.push(`${pct(g.practiced_pct)} logged something in their practice log in the last ${g.window_days} days${g.practice_entries != null ? `, ${g.practice_entries} entries in all` : ""}, and ${pct(g.has_goal_pct)} have set a goal${g.goals_done_pct != null ? ` (${pct(g.goals_done_pct)} of the goals set are done)` : ""}.`);
  if (g.game_sessions != null) sentences.push(`Pairs played ${g.game_sessions} game sessions${g.pairs_playing != null ? ` across ${g.pairs_playing} pairs` : ""}${g.game_modules_done != null ? `, finishing ${g.game_modules_done} modules` : ""}.`);
  return {
    headline: [
      { label: "Sharing their activity", value: `about ${about}`, note: `${pct(g.share_pct)} of ${g.teachers} teachers, by choice` },
      { label: "Active in the last week", value: pct(g.active_week_pct), note: "of those sharing" },
      { label: "Logged practice", value: pct(g.practiced_pct), note: `in the last ${g.window_days} days` },
      { label: "Have a goal", value: pct(g.has_goal_pct), note: g.goals_done_pct != null ? `${pct(g.goals_done_pct)} of goals done` : "goals done: too few to show" },
    ],
    sentences,
    trend: (g.weekly ?? []).map((w) => ({ label: new Date(`${w.week}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), value: w.pct })),
    buckets: (g.days_buckets ?? []).map((b) => ({ label: b.label, value: b.pct })),
  };
}

/** The sentence the panel shows when there is nothing to report yet, and why (never which teachers). */
export const notEnough = (g: GrowthActivity) =>
  `Fewer than 5 of your ${g.teachers} teachers have chosen to share their activity, so nothing is shown. This is on purpose: with so few, a figure could point at a person.`;
