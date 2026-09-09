/**
 * Step 3 of the Neon -> Supabase merge: copy the faculty data across.
 *
 *   npm run migrate:neon -- --dry-run    read Neon, print the full plan, touch nothing
 *   npm run migrate:neon                 upsert into Supabase, then verify
 *   npm run migrate:neon -- --clean      delete previously migrated rows (neon_id not null)
 *
 * Node runs this directly via type-stripping, same as the other seeders.
 *
 * WHAT MOVES
 *   School        Mentorful Demo School -> the existing Supabase school row
 *   UserProfile   50 -> profiles, is_demo = true, auth_user_id = null
 *   Cycle         1 of 3 -> cycles          (see COLLAPSE below)
 *   Pairing       32 -> pairings
 *   VisitRecord   32 -> conversation_logs, status 'submitted'
 *
 * WHAT DOES NOT MOVE, AND WHY
 *   Test School   Created by a stray GET handler at mentorful-app/src/app/api/
 *                 test/route.ts that calls prisma.school.create on every
 *                 request. Not real. Dropped.
 *   clerkUserId   Dead identity column from an abandoned Clerk integration.
 *                 UNIQUE NOT NULL, so the seeder invented demo_1..demo_50 to
 *                 satisfy it. References nothing, read by nothing. Dropped --
 *                 carrying it forward would recreate the exact illusion of an
 *                 identity link that made identity hard to reason about.
 *   2 of 3 cycles A seed bug (prisma/seed.ts:78 hardcodes a "Fall 2025" create
 *                 inside the loop over cycleDefs, ignoring the loop variable)
 *                 produced three byte-identical cycles. All 32 pairings hang
 *                 off exactly one. See COLLAPSE.
 *
 * IDEMPOTENCY
 *   Every target row carries neon_id, and every id is derived deterministically
 *   from that neon_id by UUIDv5. So a re-run computes the same uuids, upserts
 *   onto the same rows, and converges. The cuid->uuid map is therefore built in
 *   ONE pass up front, before any write -- which is what stops the classic
 *   failure of resolving a teacher's id separately per table and ending up with
 *   two uuids for one person.
 *
 * ANONYMITY
 *   Nothing here touches survey_responses. That table stays exactly as it is.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes("--dry-run");
const CLEAN = process.argv.includes("--clean");

/** Fixed namespace for UUIDv5. Never change it -- every derived id depends on it. */
const NAMESPACE = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";

/** Neon's school name. Its rows land on the Supabase school resolved below. */
const NEON_SCHOOL = "Mentorful Demo School";

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const local = loadEnv(new URL("../.env.local", import.meta.url).pathname);
const dotenv = loadEnv(new URL("../.env", import.meta.url).pathname);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? local.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? local.SUPABASE_SERVICE_ROLE_KEY;
const SCHOOL_ID = process.env.NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID ?? local.NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID;
const DATABASE_URL = process.env.DATABASE_URL ?? dotenv.DATABASE_URL;

if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL (Neon) in .env");

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// UUIDv5 -- deterministic id from a Neon cuid.
//
// Hand-rolled rather than pulling a dependency for ~15 lines. Standard RFC 4122
// v5: sha1(namespace_bytes || name), then stamp version 5 and the RFC variant.
// ---------------------------------------------------------------------------

function uuidv5(name: string, namespace = NAMESPACE): string {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(Buffer.concat([nsBytes, Buffer.from(name, "utf8")])).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Neon stores timestamps without a zone; the seeder wrote local midnights.
 * 2025-09-01T04:00:00Z is midnight EDT. Casting the UTC instant straight to a
 * date happens to give the right answer for these rows, but would silently slip
 * a day for a winter date -- so convert in the school's zone explicitly.
 */
function toSchoolDate(ts: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ts);
}

/** Neon has one `name`; profiles has first_name/last_name. All 50 are "First Last". */
function splitName(name: string): { first: string; last: string } {
  const t = name.trim();
  const i = t.indexOf(" ");
  return i === -1 ? { first: t, last: "" } : { first: t.slice(0, i), last: t.slice(i + 1) };
}

function log(...a: unknown[]) {
  console.log(...a);
}

async function upsert(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  if (DRY_RUN) {
    log(`   [dry-run] would upsert ${rows.length} row(s) into ${table}`);
    return;
  }
  const { error } = await db.from(table).upsert(rows, { onConflict: "neon_id" });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  log(`   upserted ${rows.length} row(s) into ${table}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log(DRY_RUN ? "\n=== DRY RUN -- no writes ===\n" : "\n=== Neon -> Supabase migration ===\n");

  // --- resolve the destination school -------------------------------------
  const { data: schools, error: schoolErr } = await db.from("schools").select("id, name");
  if (schoolErr) throw new Error(`schools read failed: ${schoolErr.message}`);

  let targetSchool = schools?.find((s) => s.id === SCHOOL_ID) ?? null;
  if (!targetSchool && schools?.length === 1) targetSchool = schools[0];
  if (!targetSchool) {
    throw new Error(
      `Could not resolve a destination school. NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID=${SCHOOL_ID ?? "<unset>"}, ` +
        `schools table holds: ${JSON.stringify(schools)}`
    );
  }
  log(`school: Neon "${NEON_SCHOOL}" -> Supabase "${targetSchool.name}" (${targetSchool.id})\n`);

  // --- clean ---------------------------------------------------------------
  if (CLEAN) {
    log("--clean: removing previously migrated rows (neon_id not null), children first");
    for (const t of ["conversation_logs", "pairings", "cycles", "profiles"]) {
      if (DRY_RUN) {
        const { count } = await db.from(t).select("id", { count: "exact", head: true }).not("neon_id", "is", null);
        log(`   [dry-run] would delete ${count ?? 0} row(s) from ${t}`);
        continue;
      }
      const { error } = await db.from(t).delete().not("neon_id", "is", null);
      if (error) throw new Error(`${t} clean failed: ${error.message}`);
      log(`   cleaned ${t}`);
    }
    log("");
    if (!DRY_RUN) return;
  }

  // --- read Neon -----------------------------------------------------------
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const q = async <T = Record<string, unknown>>(sql: string): Promise<T[]> => (await client.query(sql)).rows;

  const school = (
    await q<{ id: string }>(`select id from "School" where name = '${NEON_SCHOOL}' limit 1`)
  )[0];
  if (!school) throw new Error(`Neon has no School named "${NEON_SCHOOL}"`);

  const users = await q(`
    select id, name, email, department, role, "strengthTags", "personalityTags", "funTags", "createdAt"
      from "UserProfile" where "schoolId" = '${school.id}' order by name`);

  const cyclesAll = await q(`
    select c.id, c.name, c."startDate", c."endDate", c."strategicPriority",
           (select count(*)::int from "Pairing" p where p."cycleId" = c.id) as pairing_count
      from "Cycle" c where c."schoolId" = '${school.id}' order by c."endDate"`);

  const pairings = await q(`
    select id, "cycleId", "hostId", "visitorId", domain, "strategicTag", status, "createdAt", "approvedAt"
      from "Pairing" where "schoolId" = '${school.id}' order by "createdAt"`);

  const visits = await q(`
    select id, "cycleId", "pairingId", "hostId", "visitorId", domain, "strategicTag",
           "visionText", "strengthsText", "moreText", "lessText", "supportText",
           status, "createdAt", "updatedAt"
      from "VisitRecord" where "schoolId" = '${school.id}' order by "createdAt"`);

  await client.end();

  log(`read from Neon: ${users.length} users, ${cyclesAll.length} cycles, ${pairings.length} pairings, ${visits.length} visits\n`);

  // --- COLLAPSE the duplicate cycles ---------------------------------------
  // Keep only cycles that actually carry pairings. The seed bug produced three
  // identical "Fall 2025" rows; exactly one is referenced.
  const cycles = cyclesAll.filter((c) => (c.pairing_count as number) > 0);
  const dropped = cyclesAll.length - cycles.length;
  if (cycles.length !== 1) {
    throw new Error(
      `Expected exactly 1 cycle carrying pairings, found ${cycles.length}. ` +
        `Cycle collapse is only safe when it is unambiguous. Inspect: ${JSON.stringify(cyclesAll)}`
    );
  }
  log(`cycles: keeping ${cycles.length} (carries pairings), dropping ${dropped} empty duplicate(s) from the seed bug\n`);

  // --- ONE-PASS cuid -> uuid map -------------------------------------------
  const idMap = new Map<string, string>();
  for (const u of users) idMap.set(u.id as string, uuidv5(u.id as string));
  for (const c of cycles) idMap.set(c.id as string, uuidv5(c.id as string));
  for (const p of pairings) idMap.set(p.id as string, uuidv5(p.id as string));
  for (const v of visits) idMap.set(v.id as string, uuidv5(v.id as string));

  const mapId = (cuid: string, what: string): string => {
    const u = idMap.get(cuid);
    if (!u) throw new Error(`Unmapped ${what}: ${cuid}. The map is built in one pass; this means a dangling reference in Neon.`);
    return u;
  };

  log(`id map: ${idMap.size} cuid -> uuid entries, all derived by UUIDv5\n`);

  // --- build rows ----------------------------------------------------------

  const profileRows = users.map((u) => {
    const { first, last } = splitName(u.name as string);
    return {
      id: mapId(u.id as string, "user"),
      neon_id: u.id,
      school_id: targetSchool.id,
      first_name: first,
      last_name: last,
      email: (u.email as string).toLowerCase(),
      role: (u.role as string) === "ADMIN" ? "admin" : "teacher",
      department: u.department,
      strength_tags: u.strengthTags,
      personality_tags: u.personalityTags,
      fun_tags: u.funTags,
      // Generated demo identities. auth_user_id stays null: none of these
      // @demo.mentorful.co addresses corresponds to a real auth user, and a
      // roster row without a claimant is exactly what 007's decoupling is for.
      auth_user_id: null,
      is_demo: true,
      onboarding_complete: false,
      created_at: u.createdAt,
    };
  });

  const now = new Date();
  const cycleRows = cycles.map((c) => {
    const starts = c.startDate as Date;
    const ends = c.endDate as Date;

    // The schema's vocabulary is upcoming | active | complete, per
    // cycles_status_check. It is NOT planned/active/closed: 007 tried to add
    // that set under a constraint name that was already taken, so its ADD was
    // skipped and the table kept its original -- and intentional -- wording.
    // Adopt the schema's words rather than overwrite someone's design.
    //
    // Truthful, not convenient: this cycle ended 2025-12-20, so it is
    // 'complete'. Step 4 must therefore pick the cycle by `ends_at desc`, NOT
    // by status = 'active', or the map renders nothing. Fine now -- after the
    // collapse there is exactly one.
    const status = ends < now ? "complete" : starts > now ? "upcoming" : "active";

    return {
      id: mapId(c.id as string, "cycle"),
      neon_id: c.id,
      school_id: targetSchool.id,
      name: c.name,
      starts_at: toSchoolDate(starts),
      ends_at: toSchoolDate(ends),
      status,
      academic_year: "2025-26",
      strategic_priority: c.strategicPriority,
    };
  });

  const pairingRows = pairings.map((p) => {
    const status = (p.status as string).toLowerCase();
    return {
      id: mapId(p.id as string, "pairing"),
      neon_id: p.id,
      school_id: targetSchool.id,
      cycle_id: mapId(p.cycleId as string, "pairing.cycle"),
      host_id: mapId(p.hostId as string, "pairing.host"),
      visitor_id: mapId(p.visitorId as string, "pairing.visitor"),
      domain: p.domain, // Neon enum labels match concern_domain exactly
      strategic_tag: p.strategicTag,
      status,
      // Neon's seeder set status APPROVED but never wrote approvedAt, leaving
      // all 32 rows internally inconsistent: approved, with no approval date.
      // Backfill from createdAt so the pair agrees. A real approvedAt, if one
      // ever exists, wins -- this only fills the gap the seeder left.
      approved_at: p.approvedAt ?? (status === "approved" ? p.createdAt : null),
      created_at: p.createdAt,
    };
  });

  const logRows = visits.map((v) => ({
    id: mapId(v.id as string, "visit"),
    neon_id: v.id,
    school_id: targetSchool.id,
    cycle_id: mapId(v.cycleId as string, "visit.cycle"),
    pairing_id: mapId(v.pairingId as string, "visit.pairing"),
    host_id: mapId(v.hostId as string, "visit.host"),
    visitor_id: mapId(v.visitorId as string, "visit.visitor"),
    // The visitor observes and writes the debrief. Neon had no author column;
    // this is an assumption, and it is the only invented value in the file.
    logged_by: mapId(v.visitorId as string, "visit.visitor"),
    domain: v.domain,
    strategic_tag: v.strategicTag,
    vision: v.visionText,
    strength_noted: v.strengthsText,
    more_frequently: v.moreText,
    less_frequently: v.lessText,
    resources: v.supportText,
    concern: null, // no Neon source
    obstacles: null, // no Neon source
    is_visit_debrief: true,
    // Migrating as 'submitted' per the locked decision. All 32 are DRAFT in
    // Neon, but they hold finished prose written to be read, and the RLS check
    // requires submitted_at to be non-null exactly when status is 'submitted'.
    status: "submitted",
    submitted_at: v.updatedAt,
    created_at: v.createdAt,
  }));

  // --- dry-run report ------------------------------------------------------
  if (DRY_RUN) {
    log("--- sample profile ---");
    log(JSON.stringify(profileRows[0], null, 2));
    log("\n--- the cycle ---");
    log(JSON.stringify(cycleRows[0], null, 2));
    log("\n--- sample pairing ---");
    log(JSON.stringify(pairingRows[0], null, 2));
    log("\n--- sample conversation log ---");
    log(JSON.stringify(logRows[0], null, 2));
    log("\n--- domain tally ---");
    const tally: Record<string, number> = {};
    for (const p of pairingRows) tally[p.domain as string] = (tally[p.domain as string] ?? 0) + 1;
    log(JSON.stringify(tally));
    log(`\nwould write: ${profileRows.length} profiles, ${cycleRows.length} cycles, ${pairingRows.length} pairings, ${logRows.length} logs`);
    log("\nNothing was written. Re-run without --dry-run to apply.\n");
    return;
  }

  // --- write, parents first ------------------------------------------------
  log("writing (parents first, so foreign keys always resolve):");
  await upsert("profiles", profileRows);
  await upsert("cycles", cycleRows);
  await upsert("pairings", pairingRows);
  await upsert("conversation_logs", logRows);

  // --- verify --------------------------------------------------------------
  log("\nverifying against Supabase:");
  const checks: [string, number][] = [
    ["profiles", profileRows.length],
    ["cycles", cycleRows.length],
    ["pairings", pairingRows.length],
    ["conversation_logs", logRows.length],
  ];
  let ok = true;
  for (const [table, expected] of checks) {
    const { count, error } = await db
      .from(table)
      .select("id", { count: "exact", head: true })
      .not("neon_id", "is", null);
    if (error) throw new Error(`${table} verify failed: ${error.message}`);
    const good = count === expected;
    ok &&= good;
    log(`   ${table.padEnd(20)} ${count} migrated, expected ${expected}  ${good ? "OK" : "*** MISMATCH ***"}`);
  }

  // Referential integrity: every pairing endpoint must resolve to a profile.
  const { data: orphans, error: orphanErr } = await db
    .from("pairings")
    .select("id, host_id, visitor_id, profiles!pairings_host_id_fkey(id)")
    .is("profiles", null);
  if (orphanErr) log(`   (orphan check skipped: ${orphanErr.message})`);
  else log(`   orphaned pairing hosts  ${orphans?.length ?? 0}  ${(orphans?.length ?? 0) === 0 ? "OK" : "*** ORPHANS ***"}`);

  log(
    ok
      ? "\nMigration complete.\n\nNext: /admin/map still reads Neon and must still show Nodes: 50 | Edges: 32.\nThat is the baseline Step 4 has to reproduce from Supabase.\n"
      : "\n*** Counts do not match. Investigate before Step 4. ***\n"
  );
}

main().catch((e) => {
  console.error("\nMigration failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
