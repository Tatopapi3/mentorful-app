import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FacultyMapClient from "./FacultyMapClient";

export const dynamic = "force-dynamic";

/** The prop shape FacultyMapClient expects. */
type MapUser = {
  id: string;
  name: string;
  department: string | null;
  strengthTags?: unknown;
  personalityTags?: unknown;
  funTags?: unknown;
};
type MapEdge = { id: string; source: string; target: string; label?: string };
type MapData = {
  schoolName: string;
  cycleName: string | null;
  users: MapUser[];
  edges: MapEdge[];
};

/**
 * Runs on the caller's SESSION client (anon key + their cookies), never the
 * service key. That is load-bearing: 009/011's policies are what scope this
 * page to the reader's own school, and the service key would bypass every one
 * of them — silently showing one school's faculty to another.
 *
 * A row that RLS hides comes back as an absent row, not an error — so an
 * unexpectedly empty map means a policy denied it, not that a query failed.
 */
async function loadFacultyMap(): Promise<MapData | { error: string }> {
  const supabase = await createClient();

  // 1. The reader's own profile: identity and school in one read.
  //    Keyed on auth_user_id, not id — see 007/010, the two are no longer
  //    required to be equal.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: me, error: meErr } = await supabase
    .from("profiles")
    .select("id, school_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (meErr) return { error: `profile read failed: ${meErr.message}` };
  if (!me) return { error: "No profile is linked to this account." };
  if (!me.school_id) return { error: "Your profile is not attached to a school." };

  // 2. The school.
  const { data: school, error: schoolErr } = await supabase
    .from("schools")
    .select("id, name")
    .eq("id", me.school_id)
    .maybeSingle();

  if (schoolErr) return { error: `school read failed: ${schoolErr.message}` };
  if (!school) return { error: "School not found (or not readable)." };

  // 3. The cycle: most recent by ends_at.
  //    NOT status = 'active'. The one migrated cycle is 'complete' (Fall 2025,
  //    ended 2025-12-20) and filtering on 'active' would render an empty graph.
  const { data: cycle, error: cycleErr } = await supabase
    .from("cycles")
    .select("id, name")
    .eq("school_id", school.id)
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cycleErr) return { error: `cycle read failed: ${cycleErr.message}` };

  // 4. Faculty. is_demo keeps generated identities separate from real ones the
  //    same way survey_responses.synthetic does; today every mapped teacher is
  //    demo data. DROP THIS FILTER once a real roster exists, or real teachers
  //    will not appear on the map.
  const { data: people, error: peopleErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, department, strength_tags, personality_tags, fun_tags")
    .eq("school_id", school.id)
    .eq("is_demo", true)
    .order("department", { ascending: true })
    .order("last_name", { ascending: true });

  if (peopleErr) return { error: `profiles read failed: ${peopleErr.message}` };

  // 5. Approved pairings for that cycle -> edges.
  const { data: pairings, error: pairErr } = cycle
    ? await supabase
        .from("pairings")
        .select("id, host_id, visitor_id, domain, strategic_tag")
        .eq("school_id", school.id)
        .eq("cycle_id", cycle.id)
        .eq("status", "approved")
    : { data: [], error: null };

  if (pairErr) return { error: `pairings read failed: ${pairErr.message}` };

  return {
    schoolName: school.name,
    cycleName: cycle?.name ?? null,
    users: (people ?? []).map((p) => ({
      id: p.id,
      // Supabase splits the name; the client wants one string.
      name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim(),
      department: p.department,
      strengthTags: p.strength_tags,
      personalityTags: p.personality_tags,
      funTags: p.fun_tags,
    })),
    edges: (pairings ?? []).map((p) => ({
      id: p.id,
      source: p.host_id,
      target: p.visitor_id,
      label: (p.strategic_tag || p.domain || "").toString(),
    })),
  };
}

export default async function AdminMapPage() {
  // Also directly routable at /admin/map, so it carries its own gate — not just
  // the one on /admin that renders it.
  // TODO: authentication only. Any signed-in user reaches this page; the data
  // is at least scoped to their own school by RLS.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const result = await loadFacultyMap();

  if ("error" in result) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Faculty Map</h1>
        <p style={{ color: "#b45309" }}>{result.error}</p>
      </main>
    );
  }

  const { schoolName, cycleName, users, edges } = result;

  return (
    <main style={{ padding: 16, fontFamily: "system-ui" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Faculty Map</h1>
          <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
            School: {schoolName} {cycleName ? `| Cycle: ${cycleName}` : "| No cycle found"}
          </div>
        </div>

        <div style={{ color: "#666", fontSize: 12 }}>
          Nodes: {users.length} | Edges: {edges.length}
        </div>
      </div>

      <FacultyMapClient users={users} edges={edges} />
    </main>
  );
}
