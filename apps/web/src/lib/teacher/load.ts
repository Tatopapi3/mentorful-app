import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildModel, type CycleRow, type LogRow, type Model, type PairingRow, type PersonRow } from "./model";

const PERSON_COLS = "id, first_name, last_name, department, teaching_style, archetype_id, inspiration, strength_tags, school_id";
const LOG_COLS =
  "id, pairing_id, cycle_id, domain, vision, strength_noted, more_frequently, less_frequently, resources, status, submitted_at, created_at, host_id, visitor_id, logged_by, is_visit_debrief";

export type TeacherData = { model: Model; schoolName: string; email: string | null } | { model: null; email: string | null };

/**
 * One read of everything the teacher's dashboard needs, shared by the layout and every tab in a request.
 *
 * Same reads as /dashboard, on the same session client, so the database's row-level rules decide what comes back:
 * the teacher's own profile, their approved pairings, and the conversation logs they are a party to. Nothing here
 * reads survey_responses; the Culture Scan is anonymous and a teacher's answers are unrecoverable by design.
 */
export const loadTeacher = cache(async (): Promise<TeacherData> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: meRow } = await supabase.from("profiles").select(PERSON_COLS).eq("auth_user_id", user.id).maybeSingle();
  const me = meRow as (PersonRow & { school_id: string | null }) | null;
  if (!me) return { model: null, email: user.email ?? null };

  const [{ data: pairingRows }, { data: logRows }, { data: school }, { data: cycleRow }] = await Promise.all([
    supabase
      .from("pairings")
      .select("id, host_id, visitor_id, domain, cycle_id")
      .or(`host_id.eq.${me.id},visitor_id.eq.${me.id}`)
      .eq("status", "approved"),
    supabase.from("conversation_logs").select(LOG_COLS).order("created_at", { ascending: false }),
    me.school_id ? supabase.from("schools").select("name").eq("id", me.school_id).maybeSingle() : Promise.resolve({ data: null }),
    // The most recent cycle by its end date, not its status (see the faculty map page).
    supabase.from("cycles").select("id, name, status, ends_at").order("ends_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const pairings = (pairingRows ?? []) as PairingRow[];
  const logs = (logRows ?? []) as LogRow[];

  const otherIds = new Set<string>();
  for (const r of [...pairings, ...logs]) for (const id of [r.host_id, r.visitor_id]) if (id && id !== me.id) otherIds.add(id);
  if (logs.length) for (const l of logs) if (l.logged_by && l.logged_by !== me.id) otherIds.add(l.logged_by);
  const { data: otherRows } = otherIds.size ? await supabase.from("profiles").select(PERSON_COLS).in("id", [...otherIds]) : { data: [] };

  const model = buildModel({
    me,
    people: [me, ...((otherRows ?? []) as PersonRow[])],
    pairings,
    logs,
    cycle: (cycleRow as CycleRow | null) ?? null,
  });
  return { model, schoolName: (school as { name: string } | null)?.name ?? "Your school", email: user.email ?? null };
});
