import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ArtifactDashboard from "./ArtifactDashboard";
import type { Datasets } from "./dash";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your dashboard (v2)" };

/**
 * The teacher dashboard in the design of the "Mentorful Teacher Dashboard"
 * artifact, on live Supabase data.
 *
 * Same reads as /dashboard, on the same session client, so 011 scopes a
 * teacher to their own profile, their own pairings and the logs they are a
 * party to. The rows are reshaped into the datasets the artifact page expects
 * (profiles, pairings, logs, cohort); its calcs do the rest in the browser.
 *
 * games, suggestions and chat have no tables, so they ship empty and the page
 * says so. Nothing here reads survey_responses.
 */

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  role: string | null;
  teaching_style: string | null;
  archetype_id: string | null;
  inspiration: string | null;
  strength_tags: unknown;
  school_id: string | null;
};

const PROFILE_COLS =
  "id, first_name, last_name, department, role, teaching_style, archetype_id, inspiration, strength_tags, school_id";

function toProfileRow(p: Profile, school: string, isMe: boolean) {
  const first = p.first_name ?? "";
  return {
    key: p.id,
    name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "A colleague",
    first_name: first || "there",
    department: p.department ?? "",
    school: isMe ? school : "",
    role: p.role ? p.role[0].toUpperCase() + p.role.slice(1) : "Teacher",
    inspiration: p.inspiration ?? "",
    strength_tags: Array.isArray(p.strength_tags) ? p.strength_tags.join(";") : "",
    teaching_style: p.teaching_style ?? "",
    archetype_id: p.archetype_id ?? "",
    // The artifact's "Viewing as" switcher lists demo_login rows. Under RLS a
    // teacher can only ever be themselves, so only their own row qualifies.
    demo_login: isMe,
  };
}

export default async function DashboardV2Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: meRow } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const me = meRow as Profile | null;

  if (!me) {
    return (
      <main className="wrap tch-denied">
        <h1>Your dashboard</h1>
        <p>
          No teacher profile is linked to {user.email}. Ask your school lead to add you to the
          roster.
        </p>
      </main>
    );
  }

  const [{ data: pairingRows }, { data: logRows }, { data: school }, { data: cycle }] =
    await Promise.all([
      supabase
        .from("pairings")
        .select("id, host_id, visitor_id, domain, status")
        .or(`host_id.eq.${me.id},visitor_id.eq.${me.id}`)
        .eq("status", "approved"),
      supabase
        .from("conversation_logs")
        .select(
          "id, domain, vision, strength_noted, more_frequently, less_frequently, resources, status, submitted_at, created_at, host_id, visitor_id"
        )
        .order("created_at", { ascending: false }),
      me.school_id
        ? supabase.from("schools").select("name").eq("id", me.school_id).maybeSingle()
        : Promise.resolve({ data: null }),
      // Most recent cycle, by ends_at rather than status — see the map page.
      supabase
        .from("cycles")
        .select("name, status, ends_at")
        .order("ends_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const pairings = pairingRows ?? [];
  const logs = logRows ?? [];

  const otherIds = new Set<string>();
  for (const r of [...pairings, ...logs]) {
    for (const id of [r.host_id, r.visitor_id]) if (id && id !== me.id) otherIds.add(id);
  }
  const { data: otherRows } = otherIds.size
    ? await supabase.from("profiles").select(PROFILE_COLS).in("id", [...otherIds])
    : { data: [] };

  const schoolName = (school as { name: string } | null)?.name ?? "";

  const endsAt = cycle?.ends_at ? new Date(cycle.ends_at) : null;
  const cycleWindow = endsAt
    ? `${cycle?.status === "complete" ? "Ended" : "Ends"} ${endsAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`
    : (cycle?.status ?? "");

  const data: Datasets = {
    profiles: [
      toProfileRow(me, schoolName, true),
      ...((otherRows ?? []) as Profile[]).map((p) => toProfileRow(p, "", false)),
    ],
    pairings: pairings.map((p) => ({
      id: p.id,
      host: p.host_id,
      visitor: p.visitor_id,
      status: p.status,
      domain: p.domain,
    })),
    logs: logs.map((l) => ({
      id: l.id,
      host: l.host_id,
      visitor: l.visitor_id,
      domain: l.domain,
      status: l.status,
      // Drafts have no submitted_at (the CHECK requires it null); date them by creation.
      submitted_at: l.submitted_at ?? l.created_at,
      vision: l.vision,
      strength_noted: l.strength_noted,
      more_frequently: l.more_frequently,
      less_frequently: l.less_frequently,
      resources: l.resources,
    })),
    cohort: cycle ? [{ cohort: cycle.name, window: cycleWindow }] : [],
    games: [],
    suggestions: [],
    chat: [],
  };

  return <ArtifactDashboard data={data} me={me.id} />;
}
