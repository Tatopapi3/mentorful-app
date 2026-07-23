import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FacultyMapClient from "./FacultyMapClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminMapPage() {
  // Also directly routable at /admin/map, so it carries its own gate — not just
  // the one on /admin that renders it. Reads faculty data from Neon.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

   // Pick the school with the most user profiles (avoid Test School)
  const schools = await prisma.school.findMany({
    include: { _count: { select: { users: true } } },
  });

  const school = schools.sort((a, b) => b._count.users - a._count.users)[0];

  if (!school) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Faculty Map</h1>
        <p>No school found in database.</p>
      </main>
    );
  }

  // Pick most recent cycle by endDate, fall back to any cycle.
  const cycle =
    (await prisma.cycle.findFirst({
      where: { schoolId: school.id },
      orderBy: { endDate: "desc" },
    })) ??
    (await prisma.cycle.findFirst({
      where: { schoolId: school.id },
      orderBy: { createdAt: "desc" },
    }));

  const users = await prisma.userProfile.findMany({
    where: { schoolId: school.id },
    orderBy: [{ department: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      department: true,
      strengthTags: true,
      personalityTags: true,
      funTags: true,
    },
  });

  const pairings = cycle
    ? await prisma.pairing.findMany({
        where: { schoolId: school.id, cycleId: cycle.id, status: "APPROVED" },
        select: {
          id: true,
          hostId: true,
          visitorId: true,
          domain: true,
          strategicTag: true,
        },
      })
    : [];

  const edges = pairings.map((p) => ({
    id: p.id,
    source: p.hostId,
    target: p.visitorId,
    label: (p.strategicTag || p.domain || "").toString(),
  }));

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
            School: {school.name} {cycle ? `| Cycle: ${cycle.name}` : "| No cycle found"}
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
