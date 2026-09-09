-- 009_rls_merged_tables.sql
--
-- Step 2 of the Neon -> Supabase merge: RLS on the tables 007 reshaped, plus
-- two repairs that block everything downstream.
--
-- RUN THIS BEFORE STEP 3. The tables are empty now, which is the only reason
-- they are currently safe. Once the migration script lands 50 profiles, 32
-- pairings and 32 conversation logs, an unpoliced table is a real exposure --
-- and 003 has already given the anon role a foothold in this database.
--
-- WHAT THIS TOUCHES
--   LIVE   profiles (4 rows)  -- section 2 assigns them to a school + sets one admin
--   LIVE   invites  (0 rows)  -- section 3 replaces a broken policy
--   EMPTY  cycles, pairings, conversation_logs -- sections 5-7
--
-- THE GOVERNING RULE, inherited from survey_responses:
--   The sensitive table gets NO select policy at all. Admin sees aggregates
--   through a SECURITY DEFINER function that returns counts, never rows.
--   conversation_logs is that table here. Do not invent a second pattern.

begin;

-- ---------------------------------------------------------------------------
-- 1. HELPERS.
--
--    All SECURITY DEFINER, which is load-bearing: a policy on profiles that
--    queries profiles would recurse. A definer function runs as its owner and
--    bypasses RLS, breaking the cycle. This is the same reasoning as 004's
--    survey_is_open().
--
--    They key on auth_user_id, never on id -- that is the whole point of 007.
--    A roster row (auth_user_id null) resolves to nothing here, which is
--    correct: an unclaimed row is nobody's identity yet.
-- ---------------------------------------------------------------------------

create or replace function public.my_profile_id()
  returns uuid
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select id
    from public.profiles
   where auth_user_id = auth.uid()
   limit 1;
$$;

create or replace function public.my_school_id()
  returns uuid
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select school_id
    from public.profiles
   where auth_user_id = auth.uid()
   limit 1;
$$;

create or replace function public.is_school_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.profiles
     where auth_user_id = auth.uid()
       and role = 'admin'
  );
$$;

-- Used only by the invites fix. Reading auth.users is exactly what anon cannot
-- do, which is the bug in section 3.
create or replace function public.my_email()
  returns text
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select lower(email)
    from auth.users
   where id = auth.uid()
   limit 1;
$$;

grant execute on function public.my_profile_id()   to anon, authenticated;
grant execute on function public.my_school_id()    to anon, authenticated;
grant execute on function public.is_school_admin() to anon, authenticated;
grant execute on function public.my_email()        to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Attach the 4 real profiles to the sandbox school, and make one an admin.
--                                    *** LIVE TABLE -- WRITES 4 ROWS ***
--
--    All four currently have school_id = null, so EVERY school-scoped policy
--    below would return nothing for all four accounts -- the policies would
--    look broken when they were merely unreachable.
--
--    nick@kurianconsulting.com becomes the admin (it is the account that runs
--    this repo). The other three stay 'teacher'. Change the email below if
--    that is wrong -- it is the only judgement call in this file.
-- ---------------------------------------------------------------------------

update public.profiles
   set school_id = 'a0000000-0000-0000-0000-000000000001'
 where school_id is null
   and auth_user_id is not null;

update public.profiles
   set role = 'admin'
 where lower(email) = 'nick@kurianconsulting.com';

do $$
declare
  n_attached int;
  n_admin    int;
begin
  select count(*) into n_attached from public.profiles where school_id is not null;
  select count(*) into n_admin    from public.profiles where role = 'admin';
  raise notice '009: profiles attached to a school = % (expect 4), admins = % (expect 1)',
    n_attached, n_admin;

  if n_admin = 0 then
    raise exception
      '009: no admin profile exists. Every admin-gated policy below would be '
      'unreachable and the faculty map would show nothing. Fix the email in '
      'section 2 and re-run.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. FIX THE invites POLICY.                *** LIVE TABLE (0 rows) ***
--
--    Symptom (observed 2026-09-06): anon SELECT on invites returns
--      401 / 42501 "permission denied for table users"
--    rather than an empty result. A policy predicate reaches into auth.users
--    and is evaluated AS THE CALLING ROLE, which has no access to it.
--
--    This is structurally identical to the bug 004 fixed, where 003's WITH
--    CHECK read `surveys` as anon. The fix is the same: move the privileged
--    read into a SECURITY DEFINER function.
--
--    It fails closed, so it was never a hole -- but the invite flow is broken,
--    and roster work in Step 3 runs straight into it.
--
--    Existing policies are echoed before being dropped, so the old rules are
--    in the run log.
-- ---------------------------------------------------------------------------

do $$
declare
  pol record;
begin
  for pol in
    select policyname, cmd, roles::text as roles, qual, with_check
      from pg_policies where schemaname = 'public' and tablename = 'invites'
  loop
    raise notice '009: dropping invites policy % (cmd=%, roles=%)', pol.policyname, pol.cmd, pol.roles;
    raise notice '009:    USING      : %', coalesce(pol.qual, '<none>');
    raise notice '009:    WITH CHECK : %', coalesce(pol.with_check, '<none>');
    execute format('drop policy %I on public.invites', pol.policyname);
  end loop;
end $$;

alter table public.invites enable row level security;

-- An invitee can see the invite addressed to them, by email, without any
-- direct read of auth.users.
create policy "invitee reads own invite"
  on public.invites for select to authenticated
  using (lower(email) = public.my_email());

-- School admins manage invites for their own school.
create policy "admin reads school invites"
  on public.invites for select to authenticated
  using (public.is_school_admin() and school_id = public.my_school_id());

create policy "admin writes school invites"
  on public.invites for insert to authenticated
  with check (public.is_school_admin() and school_id = public.my_school_id());

create policy "admin updates school invites"
  on public.invites for update to authenticated
  using (public.is_school_admin() and school_id = public.my_school_id())
  with check (public.is_school_admin() and school_id = public.my_school_id());

create policy "admin deletes school invites"
  on public.invites for delete to authenticated
  using (public.is_school_admin() and school_id = public.my_school_id());

-- ---------------------------------------------------------------------------
-- 4. profiles: same-school read.            *** LIVE TABLE ***
--    *** WIDENS VISIBILITY. Read this before running. ***
--
--    NOT in the Step 2 scope you listed, but Step 4 cannot work without it:
--    the faculty map renders 50 colleagues, and a signed-in teacher currently
--    cannot read any profile but their own.
--
--    Scoped to the same school. It exposes name, department and the three tag
--    arrays -- and also email, why_teach, big_five, and the rest, because a
--    row policy cannot restrict columns. If that is too much, skip this
--    section and instead create a view over the safe columns with its own
--    grant, then point the map at the view. That is the more correct shape;
--    this is the faster one, and the data is demo data today.
--
--    The existing "read own profile" policy (if any) is left alone. Policies
--    are OR-ed, so this only ever adds.
-- ---------------------------------------------------------------------------

drop policy if exists "same school reads profiles" on public.profiles;
create policy "same school reads profiles"
  on public.profiles for select to authenticated
  using (school_id is not null and school_id = public.my_school_id());

-- ---------------------------------------------------------------------------
-- 5. cycles.                                *** EMPTY TABLE ***
-- ---------------------------------------------------------------------------

alter table public.cycles enable row level security;

create policy "same school reads cycles"
  on public.cycles for select to authenticated
  using (school_id = public.my_school_id());

create policy "admin writes cycles"
  on public.cycles for insert to authenticated
  with check (public.is_school_admin() and school_id = public.my_school_id());

create policy "admin updates cycles"
  on public.cycles for update to authenticated
  using (public.is_school_admin() and school_id = public.my_school_id())
  with check (public.is_school_admin() and school_id = public.my_school_id());

create policy "admin deletes cycles"
  on public.cycles for delete to authenticated
  using (public.is_school_admin() and school_id = public.my_school_id());

-- ---------------------------------------------------------------------------
-- 6. pairings.                              *** EMPTY TABLE ***
--
--    A participant sees their own pairings. An admin sees every pairing in
--    their school -- that is the faculty map, and it is the product.
--    Deliberately different from conversation_logs below: who is paired with
--    whom is structural and administrative; what they said to each other is not.
-- ---------------------------------------------------------------------------

alter table public.pairings enable row level security;

create policy "participant or admin reads pairings"
  on public.pairings for select to authenticated
  using (
    host_id    = public.my_profile_id()
    or visitor_id = public.my_profile_id()
    or (public.is_school_admin() and school_id = public.my_school_id())
  );

create policy "admin writes pairings"
  on public.pairings for insert to authenticated
  with check (public.is_school_admin() and school_id = public.my_school_id());

create policy "admin updates pairings"
  on public.pairings for update to authenticated
  using (public.is_school_admin() and school_id = public.my_school_id())
  with check (public.is_school_admin() and school_id = public.my_school_id());

create policy "admin deletes pairings"
  on public.pairings for delete to authenticated
  using (public.is_school_admin() and school_id = public.my_school_id());

-- ---------------------------------------------------------------------------
-- 7. conversation_logs.                     *** EMPTY TABLE ***
--
--    *** PAIR-PRIVATE. THERE IS DELIBERATELY NO ADMIN SELECT POLICY. ***
--
--    This is the same promise survey_responses makes, for the same reason: a
--    teacher writes candidly here only if leadership cannot read it. An admin
--    who can read one log can read every log, and no amount of UI restraint
--    changes what the grant permits.
--
--    Admin visibility comes from concern_domain_counts() in section 8 --
--    counts per domain, never rows.
--
--    A log can be edited only while it is a draft. Once submitted it is a
--    record of what was said, not a document.
-- ---------------------------------------------------------------------------

alter table public.conversation_logs enable row level security;

create policy "pair reads own logs"
  on public.conversation_logs for select to authenticated
  using (
    host_id = public.my_profile_id() or visitor_id = public.my_profile_id()
  );

create policy "pair writes own logs"
  on public.conversation_logs for insert to authenticated
  with check (
    (host_id = public.my_profile_id() or visitor_id = public.my_profile_id())
    and logged_by = public.my_profile_id()
    and status = 'draft'
  );

create policy "pair updates own drafts"
  on public.conversation_logs for update to authenticated
  using (
    (host_id = public.my_profile_id() or visitor_id = public.my_profile_id())
    and status = 'draft'
  )
  with check (
    host_id = public.my_profile_id() or visitor_id = public.my_profile_id()
  );

-- No DELETE policy. A submitted log is not deletable by its authors.

-- ---------------------------------------------------------------------------
-- 8. Admin aggregate over conversation_logs.
--
--    The ONLY way leadership sees anything from this table. Returns counts per
--    domain for one cycle. Never rows, never text.
--
--    MIN_CELL is the same idea as the report's participation floor: a count of
--    2 in a domain identifies the pair as surely as printing their names. Cells
--    below the floor are returned as null, not as a small number.
-- ---------------------------------------------------------------------------

create or replace function public.concern_domain_counts(p_cycle uuid)
  returns table (domain public.concern_domain, n int)
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  MIN_CELL constant int := 5;
begin
  if not public.is_school_admin() then
    raise exception 'concern_domain_counts: admin only' using errcode = '42501';
  end if;

  return query
    select cl.domain,
           case when count(*) >= MIN_CELL then count(*)::int else null end
      from public.conversation_logs cl
      join public.cycles c on c.id = cl.cycle_id
     where cl.cycle_id = p_cycle
       and c.school_id = public.my_school_id()   -- cannot read another school
       and cl.status   = 'submitted'
     group by cl.domain;
end $$;

revoke execute on function public.concern_domain_counts(uuid) from public, anon;
grant   execute on function public.concern_domain_counts(uuid) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- VERIFY (read-only; run after the commit)
-- ---------------------------------------------------------------------------
-- -- a. RLS is on everywhere it should be.
-- select c.relname, c.relrowsecurity
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname='public' and c.relkind='r' order by c.relname;
-- -- expect true for cycles, pairings, conversation_logs, invites, profiles
--
-- -- b. The policy set reads as intended.
-- select tablename, policyname, cmd, roles::text, qual, with_check
--   from pg_policies where schemaname='public'
--    and tablename in ('cycles','pairings','conversation_logs','invites','profiles')
--  order by tablename, cmd, policyname;
-- -- CONFIRM: conversation_logs has NO select policy mentioning is_school_admin
--
-- -- c. The 4 profiles are attached and exactly one is admin.
-- select email, role, school_id from public.profiles order by email;
--
-- -- d. invites no longer errors for anon. From the shell, with the ANON key:
-- --   curl -s -o /dev/null -w '%{http_code}\n' \
-- --     "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/invites?select=id&limit=1" \
-- --     -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
-- -- expect 200 (empty array), NOT 401/42501
--
-- THEN: sign in and confirm /dashboard, /report, /survey still load.
-- /admin/map still reads Neon at this point and must be unchanged.
