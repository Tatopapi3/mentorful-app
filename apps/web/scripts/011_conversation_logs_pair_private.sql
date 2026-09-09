-- 011_conversation_logs_pair_private.sql
--   (scope grew past the filename: it also consolidates the read policies on
--    profiles, cycles and pairings)
--
-- *** APPLIED 2026-09-08. Do not re-run casually -- it is idempotent in shape
-- *** but it drops and recreates every read policy on four live tables.
--
-- RESULT, verified after the run: as the admin account,
--   select count(*) from public.conversation_logs   -->  32  BEFORE
--                                                        0  AFTER
-- which is the whole point: an admin is not a party to those conversations and
-- must see none of them. Admin visibility is concern_domain_counts() alone.
--
-- Closed a read leak on conversation_logs and consolidated duplicate read
-- policies on profiles, cycles and pairings.
--
-- ===========================================================================
-- WHAT WENT WRONG
-- ===========================================================================
-- 009 ADDED policies to conversation_logs, profiles, cycles and pairings but
-- never dropped what was already on those tables. Postgres OR-s permissive
-- policies, so every pre-existing grant kept working alongside the new one.
-- 009 §3 did drop-then-recreate for invites; §4-§7 did not, and that
-- inconsistency is the entire bug.
--
-- Audit findings, 2026-09-08:
--
--   conversation_logs  A pre-existing "teachers can read own logs" policy
--                      carries an is_admin() clause -- that is the leak: the
--                      admin account read all 32 pair-private logs. Its
--                      non-admin branch is ALSO broken, comparing
--                      host_id = auth.uid() instead of my_profile_id(); since
--                      010 those are different values, so it matched nothing
--                      and the admin branch was doing all the work.
--
--   profiles           Two redundant same-school SELECT policies, both
--                      exposing every column.
--
--   cycles, pairings   Redundant duplicate same-school policies (one for
--                      authenticated, one for public) sitting alongside the
--                      correct ones. Admin visibility into cycles and
--                      pairings is INTENDED -- who is paired with whom is
--                      administrative. Only the duplicates go.
--
-- BLAST RADIUS of the leak: authenticated only. anon saw 0 rows and no prose,
-- verified the same day. This was not public exposure.
--
-- WHY IT MATTERS ANYWAY: conversation_logs holds what a teacher said about
-- their own practice to one colleague. The product asks for candour on the
-- promise that leadership cannot read it. An admin who can read one log can
-- read every log, and no UI restraint changes what the grant permits.
--
-- ===========================================================================
-- APPROACH
-- ===========================================================================
-- Section 1 enumerates every SELECT/ALL policy on the four tables, echoes each
-- to the run log, and drops it. By enumeration, NOT by name -- the end state
-- does not depend on knowing what was there, which is the property 009 lacked.
-- Sections 2-5 then recreate exactly the intended set per table.
--
-- INSERT/UPDATE/DELETE policies are left alone: they are write paths, they
-- were written deliberately in 009, and they are already correctly scoped.
-- A pre-existing policy with cmd = ALL is dropped (it is also a read path);
-- 009's explicit write policies remain, so no write path is lost.
--
-- *** LIVE TABLES. No row is modified by this migration. ***

begin;

-- ---------------------------------------------------------------------------
-- 1. Drop every read policy on the four tables, loudly.
-- ---------------------------------------------------------------------------

do $$
declare
  tbl   text;
  pol   record;
  n_tbl int;
  n_all int := 0;
begin
  foreach tbl in array array['conversation_logs', 'profiles', 'cycles', 'pairings']
  loop
    n_tbl := 0;

    for pol in
      select policyname, cmd, permissive, roles::text as roles, qual
        from pg_policies
       where schemaname = 'public'
         and tablename  = tbl
         and cmd in ('SELECT', 'ALL')
       order by policyname
    loop
      n_tbl := n_tbl + 1;
      n_all := n_all + 1;
      raise notice '011: [%] dropping % % policy %  roles=%',
        tbl, lower(pol.permissive), pol.cmd, quote_literal(pol.policyname), pol.roles;
      raise notice '011: [%]    USING: %', tbl, coalesce(pol.qual, '<none>');
      execute format('drop policy %I on public.%I', pol.policyname, tbl);
    end loop;

    raise notice '011: [%] dropped % read policy/policies', tbl, n_tbl;
  end loop;

  raise notice '011: % read policies dropped in total; recreating the intended set', n_all;
end $$;

-- ---------------------------------------------------------------------------
-- 2. conversation_logs -- PAIR-PRIVATE. Exactly one read path.
--
--    Host or visitor. No admin clause, no school clause, no role escape.
--
--    *** DO NOT ADD AN ADMIN BRANCH TO THIS POLICY. ***
--    That branch is precisely what leaked. Admin visibility into this table is
--    concern_domain_counts(cycle) and nothing else: counts per domain, nulled
--    below a cell floor of 5, never rows. Same contract as survey_responses.
--
--    Note my_profile_id(), not auth.uid(). Since 010 the two are different
--    values -- auth.uid() is the auth user id, my_profile_id() is the profile
--    row id, and host_id/visitor_id reference profiles. The dropped policy got
--    this wrong, which is why its non-admin branch matched nothing.
-- ---------------------------------------------------------------------------

create policy "pair reads own logs"
  on public.conversation_logs
  for select
  to authenticated
  using (
    host_id = public.my_profile_id()
    or visitor_id = public.my_profile_id()
  );

-- FORCE subjects even the table owner to these policies. The service key still
-- bypasses RLS by design -- that is the report engine's and the migration
-- script's channel, and it is server-only, never shipped to a browser.
-- Applied here and NOT to profiles: a signup trigger that creates a profile row
-- may run as the owner, and forcing RLS there could break account creation.
alter table public.conversation_logs enable row level security;
alter table public.conversation_logs force  row level security;

-- ---------------------------------------------------------------------------
-- 3. profiles -- self-read plus one same-school read.
--
--    TWO policies, not one. "Consolidate to one" applied to the two redundant
--    SAME-SCHOOL policies; a self-read path still has to exist independently.
--    Without it, anyone whose school_id is null -- which is the state every new
--    signup starts in -- could not read their own row, and /admin/map's
--    `select ... where auth_user_id = <me>` would return nothing.
--
--    ⚠️ TODO BEFORE REAL TEACHER DATA: the same-school policy is ROW-level, so
--    it exposes EVERY column of a colleague's row -- email, why_teach,
--    big_five, years_teaching -- not just the name/department/tags the faculty
--    map needs. An RLS policy cannot restrict columns.
--
--    The fix is a column-restricted view, e.g.
--
--      create view public.faculty_directory as
--        select id, school_id, first_name, last_name, department,
--               strength_tags, personality_tags, fun_tags, is_demo
--          from public.profiles;
--      -- then grant select on the view, drop the same-school row policy, and
--      -- point src/app/admin/map/page.tsx at the view instead of the table.
--
--    Not done here because it changes the app's read path and this migration
--    is a security fix that should be reviewable on its own. It is tracked in
--    CLAUDE.md under "Remaining". Today every mapped teacher is demo data
--    (is_demo = true), so nothing real is exposed yet -- that stops being true
--    the moment a real roster is loaded.
-- ---------------------------------------------------------------------------

create policy "read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth_user_id = auth.uid());

create policy "same school reads profiles"
  on public.profiles
  for select
  to authenticated
  using (
    school_id is not null
    and school_id = public.my_school_id()
  );

-- ---------------------------------------------------------------------------
-- 4. cycles -- one same-school read.
--    Admins additionally write, via 009's INSERT/UPDATE/DELETE policies, which
--    this migration does not touch.
-- ---------------------------------------------------------------------------

create policy "same school reads cycles"
  on public.cycles
  for select
  to authenticated
  using (school_id = public.my_school_id());

-- ---------------------------------------------------------------------------
-- 5. pairings -- participant or school admin.
--
--    Deliberately broader than conversation_logs, and that is correct: who is
--    paired with whom is structural and administrative. WHAT THEY SAID to each
--    other is not, which is why the two tables get different rules.
-- ---------------------------------------------------------------------------

create policy "participant or admin reads pairings"
  on public.pairings
  for select
  to authenticated
  using (
    host_id = public.my_profile_id()
    or visitor_id = public.my_profile_id()
    or (public.is_school_admin() and school_id = public.my_school_id())
  );

-- ---------------------------------------------------------------------------
-- 6. Self-test before committing. Aborts and rolls everything back on failure.
-- ---------------------------------------------------------------------------

do $$
declare
  admin_auth  uuid;
  admin_prof  uuid;
  leaked      int;
  n_sel       int;
  admin_paths text;
begin
  select auth_user_id, id into admin_auth, admin_prof
    from public.profiles
   where role = 'admin' and auth_user_id is not null
   limit 1;

  if admin_auth is null then
    raise exception '011: no admin profile with an auth_user_id -- cannot self-test. Investigate.';
  end if;

  -- a. The admin must not be a party to any log, so the pair-private policy
  --    yields zero rows for them. (auth.uid() is unset inside a migration, so
  --    evaluate the equivalent condition directly.)
  select count(*) into leaked
    from public.conversation_logs
   where host_id = admin_prof or visitor_id = admin_prof;

  if leaked > 0 then
    raise exception
      '011: the admin profile is a party to % conversation log(s). The policy '
      'would legitimately show those, which is not the leak being fixed -- '
      'investigate before committing.', leaked;
  end if;

  -- b. Exactly one read policy on the pair-private table.
  select count(*) into n_sel
    from pg_policies
   where schemaname='public' and tablename='conversation_logs' and cmd in ('SELECT','ALL');

  if n_sel <> 1 then
    raise exception '011: conversation_logs has % read policies, expected exactly 1', n_sel;
  end if;

  -- c. No admin or school escape hatch anywhere in that policy.
  select string_agg(policyname, ', ') into admin_paths
    from pg_policies
   where schemaname='public' and tablename='conversation_logs' and cmd in ('SELECT','ALL')
     and (qual ilike '%is_school_admin%' or qual ilike '%my_school_id%' or qual ilike '%is_admin%');

  if admin_paths is not null then
    raise exception
      '011: conversation_logs read policy still contains an admin/school clause: %. '
      'This table is pair-private; admin visibility is concern_domain_counts() only.',
      admin_paths;
  end if;

  raise notice '011: self-test passed -- conversation_logs has exactly 1 read policy, pair-only, admin sees 0 rows';
end $$;

commit;

-- ---------------------------------------------------------------------------
-- VERIFY (read-only, after the commit)
-- ---------------------------------------------------------------------------
-- -- a. The full policy picture across the four tables.
-- select tablename, policyname, cmd, permissive, roles::text, qual
--   from pg_policies
--  where schemaname='public'
--    and tablename in ('conversation_logs','profiles','cycles','pairings')
--  order by tablename, cmd, policyname;
-- -- expect, for SELECT:
-- --   conversation_logs  1  (pair only, no admin clause)
-- --   profiles           2  (read own + same school)
-- --   cycles             1  (same school)
-- --   pairings           1  (participant or admin)
--
-- -- b. Re-run the check that caught the leak.
-- begin;
-- select set_config('request.jwt.claims',
--   '{"sub":"debf36dc-b98d-4d38-876b-6238af9eaf24","role":"authenticated"}', true);
-- set local role authenticated;
-- select count(*) as logs_visible from public.conversation_logs;  -- MUST be 0
-- select count(*) as profiles     from public.profiles;           -- expect 54
-- select count(*) as cycles       from public.cycles;             -- expect 1
-- select count(*) as pairings     from public.pairings
--  where status='approved';                                       -- expect 32
-- rollback;
--
-- -- c. The aggregate still works -- the fix is only correct if it closes the
-- --    raw read AND leaves the intended admin path intact.
-- begin;
-- select set_config('request.jwt.claims',
--   '{"sub":"debf36dc-b98d-4d38-876b-6238af9eaf24","role":"authenticated"}', true);
-- set local role authenticated;
-- select * from public.concern_domain_counts(
--   (select id from public.cycles order by ends_at desc limit 1));
-- rollback;
--
-- -- d. A teacher who IS a party still sees their own logs (the policy must not
-- --    be so tight it shows nobody anything). Pick any host and check.
-- begin;
-- select set_config('request.jwt.claims', json_build_object(
--   'sub', (select auth_user_id from public.profiles where auth_user_id is not null limit 1),
--   'role','authenticated')::text, true);
-- set local role authenticated;
-- select count(*) from public.conversation_logs;
-- rollback;
-- -- NOTE: all 50 migrated teachers have auth_user_id = null (unclaimed roster
-- -- rows), so no real session can currently be a party to these demo logs.
-- -- This check becomes meaningful once a roster is claimed.
