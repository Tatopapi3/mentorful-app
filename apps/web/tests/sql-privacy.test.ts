/**
 * Runs the privacy scripts (022 to 025) against a throwaway Postgres (PGlite, in memory) with stand-ins for the tables,
 * roles and helper functions that Supabase and Nick's earlier scripts provide. It proves the rules as the database
 * enforces them: who can call what, results released only after close, the floor of five and the 60% rule, one-time
 * codes that can't be reused or traced, and the lock on direct inserts. It does NOT touch any real database.
 */
import { readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { DIMENSIONS, aggregatesFromRows, type ReportItem, type ResponseRow } from "@/lib/report/stats";

const script = (name: string) => readFileSync(new URL(`../scripts/${name}`, import.meta.url), "utf8");

const SCHOOL_A = "a0000000-0000-0000-0000-000000000001";
const SCHOOL_B = "b0000000-0000-0000-0000-000000000002";
const ADMIN_A = "00000000-0000-0000-0000-0000000000a1"; // auth user ids
const ADMIN_B = "00000000-0000-0000-0000-0000000000b1";
const TEACHER_A = "00000000-0000-0000-0000-0000000000c1";

/** Stand-ins for what exists in Supabase before our scripts run. Function bodies are the real ones from the live database. */
const BASE = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase's defaults: new functions and tables in public are open to its three roles.
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

  create type public.dimension as enum ('structural','relational','cognitive','efficacy');
  create table public.schools (id uuid primary key default gen_random_uuid(), name text, faculty_headcount int);
  create table public.profiles (id uuid primary key default gen_random_uuid(), auth_user_id uuid, school_id uuid, role text);
  create table public.surveys (id uuid primary key default gen_random_uuid(), school_id uuid, name text not null default 's', closes_at timestamptz);
  create table public.survey_items (
    id uuid primary key default gen_random_uuid(), position int, dimension public.dimension not null, reverse boolean not null default false,
    scale_min int not null default 1, scale_max int not null default 6, active boolean not null default true);
  create table public.survey_responses (
    id uuid primary key default gen_random_uuid(), survey_id uuid not null references public.surveys(id), school_id uuid not null,
    respondent uuid not null, item_id uuid not null references public.survey_items(id), raw_value int not null, scored_value int not null,
    created_at timestamptz not null default now(), synthetic boolean not null default false);
  alter table public.survey_responses enable row level security;
  create policy "demo anon submit survey responses" on public.survey_responses for insert to anon with check (true);
  create policy insert_response on public.survey_responses for insert to authenticated with check (true);

  create function public.is_admin() returns boolean language sql stable security definer as $$
    select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin')) $$;
  create function public.is_school_admin() returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
    select exists (select 1 from public.profiles where auth_user_id = auth.uid() and role = 'admin'); $$;
  create function public.my_school_id() returns uuid language sql stable security definer set search_path to 'public','pg_temp' as $$
    select school_id from public.profiles where auth_user_id = auth.uid() limit 1; $$;
  create function public.my_profile_id() returns uuid language sql stable security definer set search_path to 'public','pg_temp' as $$
    select id from public.profiles where auth_user_id = auth.uid() limit 1; $$;
  create function public.my_email() returns text language sql stable security definer as $$ select 'someone@example.com'::text $$;
  create function public.concern_domain_counts(p_cycle uuid) returns int language sql stable security definer as $$ select 1 $$;
  create function public.survey_is_open(sid uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
    select exists (select 1 from public.surveys s where s.id = sid and (s.closes_at is null or s.closes_at > now())); $$;
  create function public.handle_new_user() returns trigger language plpgsql security definer as $$ begin return new; end $$;
  create function public.survey_items_single_active_version() returns trigger language plpgsql security definer as $$ begin return new; end $$;
  create function public.rls_auto_enable() returns event_trigger language plpgsql security definer as $$ begin null; end $$;

  insert into public.schools (id, name, faculty_headcount) values ('${SCHOOL_A}', 'A', 50), ('${SCHOOL_B}', 'B', 50);
  insert into public.profiles (auth_user_id, school_id, role) values
    ('${ADMIN_A}', '${SCHOOL_A}', 'admin'), ('${ADMIN_B}', '${SCHOOL_B}', 'admin'), ('${TEACHER_A}', '${SCHOOL_A}', 'teacher');
`;

type Role = "anon" | "authenticated" | "postgres";

async function newDb() {
  const db = new PGlite();
  await db.exec(BASE);
  return db;
}

/** Runs `fn` as a database role, signed in as the given auth user (or nobody), then goes back to the owner. */
async function as<T>(db: PGlite, role: Role, sub: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false);`);
  if (role !== "postgres") await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

/** Resolves with the error, or null if it did not fail. */
async function failure(p: Promise<unknown>): Promise<{ message: string; code?: string } | null> {
  try {
    await p;
    return null;
  } catch (e) {
    const err = e as { message: string; code?: string };
    return { message: err.message, code: err.code };
  }
}

// The instrument, as in the database: 26 active items (6 / 9 / 6 / 5) and two retired ones that must be ignored.
const PER_DIM: Record<(typeof DIMENSIONS)[number], number> = { structural: 6, relational: 9, cognitive: 6, efficacy: 5 };
const ITEMS: (ReportItem & { reverse: boolean })[] = [];
for (const d of DIMENSIONS) for (let i = 0; i < PER_DIM[d]; i++) ITEMS.push({ id: randomUUID(), position: ITEMS.length + 1, dimension: d, reverse: i % 4 === 3 });
const RETIRED = [randomUUID(), randomUUID()];

async function seedItems(db: PGlite) {
  for (const it of ITEMS) await db.query("insert into public.survey_items (id, position, dimension, reverse, active) values ($1,$2,$3,$4,true)", [it.id, it.position, it.dimension, it.reverse]);
  for (const id of RETIRED) await db.query("insert into public.survey_items (id, position, dimension, active) values ($1, 99, 'structural', false)", [id]);
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Resp = { id: string; demo: boolean; skip?: (typeof DIMENSIONS)[number] };

/** Makes a survey and fills it. Returns the rows as the app would see them, for comparing with the database. */
async function makeSurvey(db: PGlite, opts: { school?: string; closes?: string | null; real?: number; demo?: number; incomplete?: number; seed?: number }) {
  const school = opts.school ?? SCHOOL_A;
  const sid = randomUUID();
  await db.query("insert into public.surveys (id, school_id, closes_at) values ($1,$2,$3)", [sid, school, opts.closes === undefined ? "2020-01-01T00:00:00Z" : opts.closes]);
  const r = rng(opts.seed ?? 11);
  const people: Resp[] = [
    ...Array.from({ length: opts.real ?? 0 }, () => ({ id: randomUUID(), demo: false })),
    ...Array.from({ length: opts.demo ?? 0 }, () => ({ id: randomUUID(), demo: true })),
    ...Array.from({ length: opts.incomplete ?? 0 }, () => ({ id: randomUUID(), demo: false, skip: "efficacy" as const })),
  ];
  const rows: ResponseRow[] = [];
  for (const p of people) {
    const mood = r() * 3;
    for (const it of ITEMS) {
      if (p.skip && it.dimension === p.skip) continue;
      const v = Math.max(1, Math.min(6, Math.round(2 + mood + (r() - 0.5) * 2.5)));
      await db.query(
        "insert into public.survey_responses (survey_id, school_id, respondent, item_id, raw_value, scored_value, synthetic) values ($1,$2,$3,$4,$5,$5,$6)",
        [sid, school, p.id, it.id, v, p.demo]
      );
      rows.push({ respondent: p.id, item_id: it.id, scored_value: v });
    }
    // A retired item's answer must never count.
    await db.query("insert into public.survey_responses (survey_id, school_id, respondent, item_id, raw_value, scored_value, synthetic) values ($1,$2,$3,$4,1,1,$5)", [sid, school, p.id, RETIRED[0], p.demo]);
  }
  return { sid, rows };
}

const aggregates = async (db: PGlite, sub: string | null, role: Role, sid: string) =>
  as(db, role, sub, async () => (await db.query<{ r: Record<string, unknown> }>("select public.culture_scan_aggregates($1) as r", [sid])).rows[0].r);

const FUNCS_CLOSED_BY_022 = ["concern_domain_counts", "is_admin", "is_school_admin", "my_email", "my_profile_id", "my_school_id"];
const callable = async (db: PGlite, role: Role, sub: string | null, call: string) => (await as(db, role, sub, () => failure(db.query(`select ${call}`)))) === null;

describe("022: functions that anyone could call without signing in", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await newDb();
  }, 60000);

  it("starts open, the way the live database was", async () => {
    expect(await callable(db, "anon", null, "public.is_admin()")).toBe(true);
    expect(await callable(db, "anon", null, "public.my_school_id()")).toBe(true);
    expect(await callable(db, "anon", null, "public.concern_domain_counts(gen_random_uuid())")).toBe(true);
  });

  it("closes every helper to anon, keeps the survey check open, and keeps signed-in users working", async () => {
    await db.exec(script("022_close_anon_functions.sql"));
    const calls: Record<string, string> = {
      concern_domain_counts: "public.concern_domain_counts(gen_random_uuid())",
      is_admin: "public.is_admin()",
      is_school_admin: "public.is_school_admin()",
      my_email: "public.my_email()",
      my_profile_id: "public.my_profile_id()",
      my_school_id: "public.my_school_id()",
    };
    for (const f of FUNCS_CLOSED_BY_022) {
      expect(await callable(db, "anon", null, calls[f]), `anon can still call ${f}`).toBe(false);
      expect(await callable(db, "authenticated", ADMIN_A, calls[f]), `signed-in users lost ${f}`).toBe(true);
    }
    expect(await callable(db, "anon", null, `public.survey_is_open('${randomUUID()}')`)).toBe(true);
  });

  it("closes trigger functions to everyone, since only Postgres runs them", async () => {
    for (const f of ["handle_new_user()", "survey_items_single_active_version()", "rls_auto_enable()"]) {
      expect(await as(db, "authenticated", ADMIN_A, async () => (await db.query(`select has_function_privilege('authenticated', 'public.${f}', 'execute') as x`)).rows[0]), f).toEqual({ x: false });
      expect(await as(db, "anon", null, async () => (await db.query(`select has_function_privilege('anon', 'public.${f}', 'execute') as x`)).rows[0]), f).toEqual({ x: false });
    }
  });

  it("still lets a row-level-security policy use the helpers for signed-in people", async () => {
    await db.exec(`create table public.t (id int); insert into public.t values (1),(2);
      alter table public.t enable row level security;
      create policy admins_read on public.t for select to authenticated using (public.is_school_admin());`);
    const rows = await as(db, "authenticated", ADMIN_A, async () => (await db.query("select * from public.t")).rows);
    expect(rows).toHaveLength(2);
    const none = await as(db, "authenticated", TEACHER_A, async () => (await db.query("select * from public.t")).rows);
    expect(none).toHaveLength(0);
  });

  it("does not open new functions to anon by default, and can be run twice", async () => {
    await db.exec(script("022_close_anon_functions.sql"));
    await db.exec("create function public.brand_new() returns int language sql security definer as $$ select 1 $$");
    expect(await callable(db, "anon", null, "public.brand_new()")).toBe(false);
  });
});

describe("023: the report's numbers, and when they are released", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await newDb();
    await seedItems(db);
    await db.exec(script("022_close_anon_functions.sql"));
    await db.exec(script("023_culture_scan_aggregates.sql"));
  }, 60000);

  it("matches adding up the raw answers in the app, to the last digit", async () => {
    const { sid, rows } = await makeSurvey(db, { real: 0, demo: 40, incomplete: 3 });
    const got = (await aggregates(db, ADMIN_A, "authenticated", sid)) as { status: string; n: number; dropped: number; demo_n: number; means: Record<string, number>; sds: Record<string, number>; correlation: number[][] };
    const want = aggregatesFromRows(rows, ITEMS);
    expect(got.status).toBe("ok");
    expect(got.n).toBe(40);
    expect(got.dropped).toBe(3);
    expect(got.demo_n).toBe(40);
    for (const d of DIMENSIONS) {
      expect(got.means[d]).toBeCloseTo(want.means[d], 9);
      expect(got.sds[d]).toBeCloseTo(want.sds[d], 9);
    }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) expect(got.correlation[i][j]).toBeCloseTo(want.correlation[i][j], 9);
  });

  it("returns only aggregates: no respondent, no answer, no row", async () => {
    const { sid } = await makeSurvey(db, { demo: 12 });
    const got = await aggregates(db, ADMIN_A, "authenticated", sid);
    expect(Object.keys(got).sort()).toEqual(["correlation", "demo_n", "dropped", "means", "n", "sds", "status"]);
  });

  it("holds results back until the survey has closed", async () => {
    const open = await makeSurvey(db, { demo: 12, closes: null });
    expect(await aggregates(db, ADMIN_A, "authenticated", open.sid)).toEqual({ status: "not-closed", closes_at: null });
    const future = await makeSurvey(db, { demo: 12, closes: "2099-01-01T00:00:00Z" });
    expect(((await aggregates(db, ADMIN_A, "authenticated", future.sid)) as { status: string }).status).toBe("not-closed");
  });

  it("says there is nothing yet when nobody has answered", async () => {
    const { sid } = await makeSurvey(db, {});
    expect(await aggregates(db, ADMIN_A, "authenticated", sid)).toEqual({ status: "no-data" });
  });

  it("never describes fewer than five complete respondents", async () => {
    const four = await makeSurvey(db, { real: 4 });
    expect(await aggregates(db, ADMIN_A, "authenticated", four.sid)).toEqual({ status: "below-floor", reason: "floor", n: 4, floor: 5 });
    // Partial answers do not count toward the five.
    const partial = await makeSurvey(db, { demo: 4, incomplete: 3 });
    expect(await aggregates(db, ADMIN_A, "authenticated", partial.sid)).toEqual({ status: "below-floor", reason: "floor", n: 4, floor: 5 });
  });

  it("holds all-real results to 60% of the roster, and says what is needed", async () => {
    const short = await makeSurvey(db, { real: 29 }); // headcount 50 needs 30
    expect(await aggregates(db, ADMIN_A, "authenticated", short.sid)).toEqual({ status: "below-floor", reason: "participation", n: 29, floor: 30 });
    const enough = await makeSurvey(db, { real: 30 });
    expect(((await aggregates(db, ADMIN_A, "authenticated", enough.sid)) as { status: string }).status).toBe("ok");
  });

  it("will not guess a roster: with no headcount, real results stay closed", async () => {
    const school = randomUUID();
    await db.query("insert into public.schools (id, name, faculty_headcount) values ($1, 'No headcount', null)", [school]);
    const admin = randomUUID();
    await db.query("insert into public.profiles (auth_user_id, school_id, role) values ($1, $2, 'admin')", [admin, school]);
    const { sid } = await makeSurvey(db, { school, real: 30 });
    expect(await aggregates(db, admin, "authenticated", sid)).toEqual({ status: "below-floor", reason: "no-headcount", n: 30, floor: 0 });
  });

  it("labels demo rows as demo and does not hold them to the 60% rule", async () => {
    const mixed = await makeSurvey(db, { real: 6, demo: 50 });
    const got = (await aggregates(db, ADMIN_A, "authenticated", mixed.sid)) as { status: string; n: number; demo_n: number };
    expect(got).toMatchObject({ status: "ok", n: 56, demo_n: 50 });
  });

  it("answers only an administrator of the school that owns the survey", async () => {
    const { sid } = await makeSurvey(db, { demo: 12 });
    const refusals = [
      await failure(aggregates(db, TEACHER_A, "authenticated", sid)), // a teacher
      await failure(aggregates(db, ADMIN_B, "authenticated", sid)), // another school's administrator
      await failure(aggregates(db, ADMIN_A, "authenticated", randomUUID())), // a survey that does not exist
      await failure(aggregates(db, null, "authenticated", sid)), // signed in as nobody
    ];
    for (const r of refusals) expect(r?.code).toBe("42501");
    // Another school's survey and a survey that does not exist get the same answer, so nothing leaks about either.
    expect(refusals[1]?.message).toBe(refusals[2]?.message);
    const anon = await failure(aggregates(db, null, "anon", sid));
    expect(anon?.message).toMatch(/permission denied/);
  });

  it("lets nobody read an answer directly, not even a school lead", async () => {
    const { sid } = await makeSurvey(db, { demo: 6 });
    // Row-level security with no select policy: signed-in users and anon both see zero rows.
    for (const [role, sub] of [["authenticated", ADMIN_A], ["anon", null]] as [Role, string | null][]) {
      const rows = await as(db, role, sub, async () => (await db.query("select * from public.survey_responses where survey_id = $1", [sid])).rows);
      expect(rows, role).toHaveLength(0);
    }
  });

  it("lets only a school lead close the survey, once, and never reopens it", async () => {
    const open = await makeSurvey(db, { demo: 12, closes: null });
    const closer = (sub: string | null, role: Role = "authenticated") => as(db, role, sub, async () => (await db.query<{ t: string }>("select public.close_culture_scan($1) as t", [open.sid])).rows[0].t);
    expect((await failure(closer(TEACHER_A)))?.code).toBe("42501");
    expect((await failure(closer(ADMIN_B)))?.code).toBe("42501");
    expect((await failure(closer(null, "anon")))?.message).toMatch(/permission denied/);
    expect(((await aggregates(db, ADMIN_A, "authenticated", open.sid)) as { status: string }).status).toBe("not-closed");
    const first = await closer(ADMIN_A);
    expect(first).toBeTruthy();
    expect(((await aggregates(db, ADMIN_A, "authenticated", open.sid)) as { status: string }).status).toBe("ok");
    expect(await closer(ADMIN_A)).toEqual(first); // closing again keeps the first close time
  });
});

describe("024: one-time survey codes", () => {
  let db: PGlite;
  let sid: string;
  const answers = () => Object.fromEntries(ITEMS.map((it, i) => [it.id, 1 + (i % 6)]));
  const issue = (n: number, sub = ADMIN_A, survey = sid) => as(db, "authenticated", sub, async () => (await db.query<{ c: string[] }>("select public.issue_survey_codes($1, $2) as c", [survey, n])).rows[0].c);
  const ok = (code: string, role: Role = "anon") => as(db, role, null, async () => (await db.query<{ ok: boolean }>("select public.survey_code_ok($1) as ok", [code])).rows[0].ok);
  const submit = (code: string, a: unknown, role: Role = "anon") => as(db, role, null, () => db.query("select public.submit_survey($1, $2::jsonb)", [code, JSON.stringify(a)]));
  const codeRows = async () => (await db.query<{ code_hash: string; survey_id: string; used: boolean }>("select * from public.survey_codes order by code_hash")).rows;

  beforeAll(async () => {
    db = await newDb();
    await seedItems(db);
    await db.exec(script("022_close_anon_functions.sql"));
    await db.exec(script("023_culture_scan_aggregates.sql"));
    await db.exec(script("024_survey_codes.sql"));
    sid = (await makeSurvey(db, { closes: null })).sid;
  }, 60000);

  it("makes codes only for a school lead, 1 to 200 at a time, on an open survey", async () => {
    expect((await failure(issue(3, TEACHER_A)))?.code).toBe("42501");
    expect((await failure(issue(3, ADMIN_B)))?.code).toBe("42501");
    expect((await failure(issue(0)))?.code).toBe("22023");
    expect((await failure(issue(201)))?.code).toBe("22023");
    const closed = (await makeSurvey(db, { closes: "2020-01-01T00:00:00Z" })).sid;
    expect((await failure(issue(3, ADMIN_A, closed)))?.message).toMatch(/closed/);
    const anon = await failure(as(db, "anon", null, () => db.query("select public.issue_survey_codes($1, 3)", [sid])));
    expect(anon?.message).toMatch(/permission denied/);
  });

  it("stores only a scrambled copy: no code in the clear, and nothing that could link it to an answer, a person or a time", async () => {
    const codes = await issue(5);
    expect(codes).toHaveLength(5);
    expect(new Set(codes).size).toBe(5);
    for (const c of codes) expect(c).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    const stored = await codeRows();
    const hashes = stored.map((r) => r.code_hash);
    for (const c of codes) {
      expect(hashes).toContain(createHash("sha256").update(c.replace(/-/g, "")).digest("hex"));
      expect(JSON.stringify(stored)).not.toContain(c.replace(/-/g, ""));
    }
    const cols = (await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'survey_codes' order by 1")).rows.map((r) => r.column_name);
    expect(cols).toEqual(["code_hash", "survey_id", "used"]);
  });

  it("lets nobody read or write the code table directly", async () => {
    for (const [role, sub] of [["anon", null], ["authenticated", ADMIN_A]] as [Role, string | null][]) {
      expect((await as(db, role, sub, () => failure(db.query("select * from public.survey_codes"))))?.message, role).toMatch(/permission denied/);
      expect((await as(db, role, sub, () => failure(db.query("update public.survey_codes set used = false"))))?.message, role).toMatch(/permission denied/);
    }
  });

  it("recognises a fresh code however it is typed, and nothing else", async () => {
    const [code] = await issue(1);
    expect(await ok(code)).toBe(true);
    expect(await ok(code.toLowerCase())).toBe(true);
    expect(await ok(` ${code.replace(/-/g, " ")} `)).toBe(true);
    for (const bad of ["", "0000-0000-0000-0000", "garbage", code.slice(0, -1)]) expect(await ok(bad)).toBe(false);
  });

  it("saves a whole survey under a fresh random id, scores reversed items, and uses the code up", async () => {
    const respondents = async () => new Set((await db.query<{ respondent: string }>("select distinct respondent from public.survey_responses where survey_id = $1 and synthetic = false", [sid])).rows.map((r) => r.respondent));
    const before = await respondents();
    const [code] = await issue(1);
    await submit(code, answers());
    const added = [...(await respondents())].filter((r) => !before.has(r));
    expect(added).toHaveLength(1);
    const rows = (await db.query<{ item_id: string; raw_value: number; scored_value: number; synthetic: boolean }>("select item_id, raw_value, scored_value, synthetic from public.survey_responses where respondent = $1", [added[0]])).rows;
    expect(rows).toHaveLength(26); // one per active item
    expect(rows.every((r) => !r.synthetic)).toBe(true);
    for (const it of ITEMS) {
      const row = rows.find((r) => r.item_id === it.id)!;
      expect(row.raw_value).toBe(answers()[it.id]);
      expect(row.scored_value).toBe(it.reverse ? 7 - row.raw_value : row.raw_value);
    }
    // The respondent id is random: it is not the code, not its hash, and not derived from either.
    const plain = code.replace(/-/g, "");
    const hash = createHash("sha256").update(plain).digest("hex");
    const idHex = added[0].replace(/-/g, "");
    expect(idHex).not.toContain(plain.toLowerCase());
    expect(hash).not.toContain(idHex.slice(0, 10));
    expect(await ok(code)).toBe(false);
  });

  it("refuses a code twice, and says the same thing for a used code and an unknown one", async () => {
    const [code] = await issue(1);
    await submit(code, answers());
    const used = await failure(submit(code, answers()));
    const unknown = await failure(submit("FFFF-FFFF-FFFF-FFFF", answers()));
    expect(used?.message).toBe("That code is not valid, or it has already been used.");
    expect(unknown?.message).toBe(used?.message);
  });

  it("refuses an incomplete or invalid answer sheet and leaves the code usable", async () => {
    const [code] = await issue(1);
    const full = answers();
    const missingOne = { ...full };
    delete missingOne[ITEMS[0].id];
    const tooHigh = { ...full, [ITEMS[1].id]: 7 };
    const tooLow = { ...full, [ITEMS[2].id]: 0 };
    const text = { ...full, [ITEMS[3].id]: "five" };
    const extra = { ...full, [randomUUID()]: 3 };
    const decimals = { ...full, [ITEMS[4].id]: 3.5 };
    for (const bad of [missingOne, tooHigh, tooLow, text, extra, decimals, [1, 2, 3], null, {}]) {
      expect((await failure(submit(code, bad)))?.message).toBe("Every question needs an answer.");
    }
    expect(await ok(code)).toBe(true);
    await submit(code, full);
    expect(await ok(code)).toBe(false);
  });

  it("refuses answers once the survey has closed", async () => {
    const [code] = await issue(1);
    await db.query("update public.surveys set closes_at = now() - interval '1 minute' where id = $1", [sid]);
    expect(await ok(code)).toBe(false);
    expect((await failure(submit(code, answers())))?.message).toBe("This survey is closed.");
    await db.query("update public.surveys set closes_at = null where id = $1", [sid]);
  });

  it("works for a signed-in teacher too, and two submissions never share an id", async () => {
    const [a, b] = await issue(2);
    await submit(a, answers(), "authenticated");
    await submit(b, answers());
    const ids = (await db.query<{ respondent: string }>("select distinct respondent from public.survey_responses where synthetic = false and survey_id = $1 and item_id = $2", [sid, ITEMS[0].id])).rows;
    expect(new Set(ids.map((r) => r.respondent)).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the new survey functions the only things anon can call, and makes no admin function public", async () => {
    const open = (await db.query<{ proname: string }>(
      "select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege('anon', p.oid, 'execute') order by 1"
    )).rows.map((r) => r.proname);
    expect(open).toEqual(["submit_survey", "survey_code_ok", "survey_is_open"]);
  });
});

describe("025: the lock", () => {
  it("refuses to run before 024, so the survey can never be left unable to save", async () => {
    const db = await newDb();
    await seedItems(db);
    await db.exec(script("022_close_anon_functions.sql"));
    const e = await failure(db.exec(script("025_close_anon_insert.sql")));
    expect(e?.message).toMatch(/run 024_survey_codes\.sql first/);
  }, 60000);

  describe("after 024", () => {
    let db: PGlite;
    let sid: string;
    const answers = () => Object.fromEntries(ITEMS.map((it, i) => [it.id, 1 + (i % 6)]));
    const directInsert = (role: Role, sub: string | null) =>
      as(db, role, sub, () =>
        db.query("insert into public.survey_responses (survey_id, school_id, respondent, item_id, raw_value, scored_value) values ($1,$2,$3,$4,3,3)", [sid, SCHOOL_A, randomUUID(), ITEMS[0].id])
      );

    beforeAll(async () => {
      db = await newDb();
      await seedItems(db);
      await db.exec(script("022_close_anon_functions.sql"));
      await db.exec(script("023_culture_scan_aggregates.sql"));
      await db.exec(script("024_survey_codes.sql"));
      sid = (await makeSurvey(db, { closes: null })).sid;
    }, 60000);

    it("until the lock, a direct insert still works (the old page keeps saving)", async () => {
      expect(await failure(directInsert("anon", null))).toBeNull();
    });

    it("after the lock, nobody can add an answer except with a code", async () => {
      await db.exec(script("025_close_anon_insert.sql"));
      expect((await failure(directInsert("anon", null)))?.message).toMatch(/permission denied/);
      expect((await failure(directInsert("authenticated", ADMIN_A)))?.message).toMatch(/permission denied/);
      const [code] = await as(db, "authenticated", ADMIN_A, async () => (await db.query<{ c: string[] }>("select public.issue_survey_codes($1, 1) as c", [sid])).rows[0].c);
      await as(db, "anon", null, () => db.query("select public.submit_survey($1, $2::jsonb)", [code, JSON.stringify(answers())]));
      const stored = await db.query("select count(*)::int as n from public.survey_responses where survey_id = $1 and synthetic = false", [sid]);
      expect((stored.rows[0] as { n: number }).n).toBeGreaterThanOrEqual(27); // the earlier direct row plus the 26 from the code
    });

    it("can be run twice", async () => {
      await db.exec(script("025_close_anon_insert.sql"));
    });
  });
});

describe("the combined script Juan pastes into the SQL editor", () => {
  it("is exactly the three scripts, in order, and runs clean from scratch and again", async () => {
    const combined = script("apply_022_to_024.sql");
    let at = -1;
    for (const f of ["022_close_anon_functions.sql", "023_culture_scan_aggregates.sql", "024_survey_codes.sql"]) {
      const body = script(f).trim();
      const i = combined.indexOf(body);
      expect(i, `${f} is not in apply_022_to_024.sql: regenerate it`).toBeGreaterThan(at);
      at = i;
    }
    const db = await newDb();
    await seedItems(db);
    await db.exec(combined);
    await db.exec(combined);
  }, 60000);

  it("does not include the lock, which must wait for the new survey page", () => {
    expect(script("apply_022_to_024.sql")).not.toContain("drop policy");
  });
});
