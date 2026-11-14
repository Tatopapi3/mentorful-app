import { AdminFrame, Panel } from "@/components/admin/kit";
import RosterPanel, { type RosterPerson } from "@/components/admin/roster-panel";
import { requireAdmin } from "@/lib/admin/require";

export const dynamic = "force-dynamic";
export const metadata = { title: "Roster" };

// The school lead's list of teachers: who is on the roster, who has signed in, and a way to add more. The layout has already
// checked that this is a signed-in school lead, so a null here only happens in the instant a session ends.
export default async function Page() {
  const admin = await requireAdmin("/admin/roster");
  if (!admin) return null;
  const { data } = await admin.supabase
    .from("profiles")
    .select("id, first_name, last_name, email, department, role, auth_user_id")
    .eq("school_id", admin.schoolId)
    .eq("role", "teacher")
    .order("last_name", { ascending: true });
  const people: RosterPerson[] = (data ?? []).map((p) => ({
    id: p.id as string,
    name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed",
    email: (p.email as string | null) ?? "",
    department: (p.department as string | null) ?? "",
    signedIn: !!p.auth_user_id,
  }));

  return (
    <AdminFrame
      skin="aurora"
      eyebrow="Roster"
      title="Your teachers"
      sub="Add each teacher by email. The first time they sign in with that address, they are linked to their place here and land on their own dashboard."
    >
      <Panel skin="aurora" title="Teachers" count={`${people.length} on the roster`}>
        <RosterPanel people={people} />
      </Panel>
    </AdminFrame>
  );
}
