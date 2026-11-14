/**
 * Runs script 026 (claim my profile, add teachers, remove a teacher) against a throwaway Postgres (PGlite, in memory) with
 * stand-ins for Supabase's roles and tables. It proves who can do what: a login claims only the one unlinked profile that has
 * its own confirmed email, only a school lead adds or removes teachers, and only for their own school. It does NOT touch any
 * real database.
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const script = readFileSync(new URL("../scripts/026_roster.sql", import.meta.url), "utf8");

const SCHOOL_A = "a0000000-0000-0000-0000-000000000001";
const SCHOOL_B = "b0000000-0000-0000-0000-000000000002";
const ADMIN_A = "00000000-0000-0000-0000-0000000000a1";
const ADMIN_B = "00000000-0000-0000-0000-0000000000b1";
const TEACHER_A = "00000000-0000-0000-0000-0000000000c1";
const NEWCOMER = "00000000-0000-0000-0000-0000000000d1";
const UNCONFIRMED = "00000000-0000-0000-0000-0000000000d2";
const IMPOSTOR = "00000000-0000-0000-0000-0000000000d3";

const BASE = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase's defaults: new functions in public are open to its three roles (script 022 closes this for later ones).
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

  create table public.schools (id uuid primary key default gen_random_uuid(), name text);
  create table public.profiles (
    id uuid primary key, auth_user_id uuid unique, school_id uuid references public.schools(id), role text, first_name text,
    last_name text, email text, department text, onboarding_complete boolean default false, is_demo boolean not null default false,
    updated_at timestamptz default now());
  create table public.pairings (id uuid primary key default gen_random_uuid(), host_id uuid references public.profiles(id), visitor_id uuid references public.profiles(id));

  insert into public.schools (id, name) values ('${SCHOOL_A}', 'A'), ('${SCHOOL_B}', 'B');
  insert into auth.users (id, email, email_confirmed_at) values
    ('${ADMIN_A}', 'lead.a@a.org', now()), ('${ADMIN_B}', 'lead.b@b.org', now()), ('${TEACHER_A}', 'teacher.a@a.org', now()),
    ('${NEWCOMER}', '  Ada.Lovelace@A.org ', now()), ('${UNCONFIRMED}', 'grace@a.org', null), ('${IMPOSTOR}', 'ada.lovelace@a.org', now());
  insert into public.profiles (id, auth_user_id, school_id, role, first_name, last_name, email) values
    (gen_random_uuid(), '${ADMIN_A}', '${SCHOOL_A}', 'admin', 'Lead', 'A', 'lead.a@a.org'),
    (gen_random_uuid(), '${ADMIN_B}', '${SCHOOL_B}', 'admin', 'Lead', 'B', 'lead.b@b.org'),
    (gen_random_uuid(), '${TEACHER_A}', '${SCHOOL_A}', 'teacher', 'Tess', 'Teacher', 'teacher.a@a.org');
`;

type Role = "anon" | "authenticated" | "postgres";

async function newDb() {
  const db = new PGlite();
  await db.exec(BASE);
  await db.exec(script);
  return db;
}

async function as<T>(db: PGlite, role: Role, sub: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false);`);
  if (role !== "postgres") await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

async function failure(p: Promise<unknown>): Promise<{ message: string; code?: string } | null> {
  try {
    await p;
    return null;
  } catch (e) {
    const err = e as { message: string; code?: string };
    return { message: err.message, code: err.code };
  }
}

type AddResult = { added: number; skipped: { row: number; email: string; reason: string }[] };
const add = async (db: PGlite, sub: string | null, rows: unknown, role: Role = "authenticated") =>
  as(db, role, sub, async () => (await db.query<{ roster_add: AddResult }>("select public.roster_add($1::jsonb) as roster_add", [JSON.stringify(rows)])).rows[0].roster_add);
const claim = (db: PGlite, sub: string | null) => as(db, "authenticated", sub, async () => (await db.query<{ c: string | null }>("select public.claim_my_profile() as c")).rows[0].c);
const row = (first: string, last: string, email: string, department?: string) => ({ first_name: first, last_name: last, email, department });

describe("script 026: the roster", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await newDb();
  });

  it("runs twice without error (it ends with its own self-test)", async () => {
    await db.exec(script);
  });

  describe("claim_my_profile", () => {
    it("links a login to the one unlinked profile that has its email, ignoring case and spaces", async () => {
      await add(db, ADMIN_A, [row("Ada", "Lovelace", "ADA.LOVELACE@a.org", "Math")]);
      const id = await claim(db, NEWCOMER);
      expect(id).toBeTruthy();
      const { rows } = await db.query<{ auth_user_id: string; school_id: string; role: string }>("select auth_user_id, school_id, role from public.profiles where id = $1", [id]);
      expect(rows[0]).toEqual({ auth_user_id: NEWCOMER, school_id: SCHOOL_A, role: "teacher" });
    });

    it("returns the same profile when called again, and never takes a profile that is already linked", async () => {
      await add(db, ADMIN_A, [row("Ada", "Lovelace", "ada.lovelace@a.org")]);
      const first = await claim(db, NEWCOMER);
      expect(await claim(db, NEWCOMER)).toBe(first);
      // Another login with the same address finds nothing left to claim.
      expect(await claim(db, IMPOSTOR)).toBeNull();
    });

    it("does nothing when the email is not on a roster, is not confirmed, or the caller is signed out", async () => {
      expect(await claim(db, NEWCOMER)).toBeNull();
      await add(db, ADMIN_A, [row("Grace", "Hopper", "grace@a.org")]);
      expect(await claim(db, UNCONFIRMED)).toBeNull();
      expect(await claim(db, null)).toBeNull();
    });

    it("links nobody when two unlinked profiles carry the same email", async () => {
      await db.exec(`insert into public.profiles (id, school_id, role, first_name, last_name, email) values
        (gen_random_uuid(), '${SCHOOL_A}', 'teacher', 'A', 'One', 'ada.lovelace@a.org'), (gen_random_uuid(), '${SCHOOL_B}', 'teacher', 'A', 'Two', 'ada.lovelace@a.org')`);
      expect(await claim(db, NEWCOMER)).toBeNull();
      const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.profiles where auth_user_id = $1", [NEWCOMER]);
      expect(rows[0].n).toBe(0);
    });

    it("is not callable without signing in", async () => {
      const err = await failure(as(db, "anon", null, () => db.query("select public.claim_my_profile()")));
      expect(err?.code).toBe("42501");
    });
  });

  describe("roster_add", () => {
    it("adds teachers to the lead's own school, as teachers, with the email stored in lower case", async () => {
      const r = await add(db, ADMIN_A, [row("Ada", "Lovelace", " ADA@a.org ", "Math"), row("Alan", "Turing", "alan@a.org")]);
      expect(r).toEqual({ added: 2, skipped: [] });
      const { rows } = await db.query<{ school_id: string; role: string; email: string; auth_user_id: string | null; is_demo: boolean }>(
        "select school_id, role, email, auth_user_id, is_demo from public.profiles where email in ('ada@a.org','alan@a.org') order by email"
      );
      expect(rows).toHaveLength(2);
      for (const p of rows) expect(p).toMatchObject({ school_id: SCHOOL_A, role: "teacher", auth_user_id: null, is_demo: false });
    });

    it("a lead of another school adds to their own school, never to A", async () => {
      await add(db, ADMIN_B, [row("Bea", "Bright", "bea@b.org")]);
      const { rows } = await db.query<{ school_id: string }>("select school_id from public.profiles where email = 'bea@b.org'");
      expect(rows[0].school_id).toBe(SCHOOL_B);
    });

    it("skips bad rows with a reason and still adds the good ones", async () => {
      const r = await add(db, ADMIN_A, [
        row("Ok", "Person", "ok@a.org"),
        row("", "NoFirst", "nofirst@a.org"),
        row("Bad", "Email", "not-an-email"),
        row("Dup", "InFile", "ok@a.org"),
        row("Long", "Name", "long@a.org", "x".repeat(81)),
      ]);
      expect(r.added).toBe(1);
      expect(r.skipped.map((s) => s.row)).toEqual([2, 3, 4, 5]);
      expect(r.skipped[0].reason).toMatch(/name/);
      expect(r.skipped[1].reason).toMatch(/email is not valid/);
      expect(r.skipped[2].reason).toMatch(/already has a profile/);
    });

    it("says the same thing for an email on this roster and for one on another school's, so a lead cannot probe other schools", async () => {
      const a = await add(db, ADMIN_A, [row("T", "Dup", "teacher.a@a.org")]);
      const b = await add(db, ADMIN_A, [row("L", "Dup", "lead.b@b.org")]);
      expect(a.skipped[0].reason).toBe(b.skipped[0].reason);
    });

    it("refuses a teacher, a signed-out caller and an anonymous caller", async () => {
      expect((await failure(add(db, TEACHER_A, [row("X", "Y", "xy@a.org")])))?.code).toBe("42501");
      expect((await failure(add(db, null, [row("X", "Y", "xy@a.org")])))?.code).toBe("42501");
      expect((await failure(add(db, null, [row("X", "Y", "xy@a.org")], "anon")))?.code).toBe("42501");
      const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.profiles where email = 'xy@a.org'");
      expect(rows[0].n).toBe(0);
    });

    it("refuses an empty list, more than 500 rows, and something that is not a list", async () => {
      expect((await failure(add(db, ADMIN_A, [])))?.code).toBe("22023");
      expect((await failure(add(db, ADMIN_A, Array.from({ length: 501 }, (_, i) => row("N", String(i), `n${i}@a.org`)))))?.code).toBe("22023");
      expect((await failure(add(db, ADMIN_A, { first_name: "x" })))?.code).toBe("22023");
    });
  });

  describe("roster_remove", () => {
    const remove = (sub: string | null, id: string, role: Role = "authenticated") =>
      as(db, role, sub, async () => (await db.query<{ r: boolean }>("select public.roster_remove($1) as r", [id])).rows[0].r);
    const idOf = async (email: string) => (await db.query<{ id: string }>("select id from public.profiles where email = $1", [email])).rows[0].id;

    it("removes a teacher of the lead's school who has never signed in", async () => {
      await add(db, ADMIN_A, [row("Gone", "Soon", "gone@a.org")]);
      expect(await remove(ADMIN_A, await idOf("gone@a.org"))).toBe(true);
      const { rows } = await db.query("select 1 from public.profiles where email = 'gone@a.org'");
      expect(rows).toHaveLength(0);
    });

    it("leaves a teacher who has signed in, another school's teacher and a school lead alone", async () => {
      await add(db, ADMIN_B, [row("Bea", "Bright", "bea@b.org")]);
      expect(await remove(ADMIN_A, await idOf("teacher.a@a.org"))).toBe(false);
      expect(await remove(ADMIN_A, await idOf("bea@b.org"))).toBe(false);
      expect(await remove(ADMIN_A, await idOf("lead.b@b.org"))).toBe(false);
      expect(await remove(ADMIN_A, await idOf("lead.a@a.org"))).toBe(false);
    });

    it("refuses a teacher with a pairing, because the foreign key stops it", async () => {
      await add(db, ADMIN_A, [row("Paired", "Person", "paired@a.org")]);
      const id = await idOf("paired@a.org");
      await db.query("insert into public.pairings (host_id, visitor_id) values ($1, $1)", [id]);
      expect((await failure(remove(ADMIN_A, id)))?.code).toBe("23503");
    });

    it("refuses a teacher and anyone signed out", async () => {
      await add(db, ADMIN_A, [row("Keep", "Me", "keep@a.org")]);
      const id = await idOf("keep@a.org");
      expect((await failure(remove(TEACHER_A, id)))?.code).toBe("42501");
      expect((await failure(remove(null, id, "anon")))?.code).toBe("42501");
    });
  });
});
