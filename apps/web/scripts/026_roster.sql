-- 026_roster.sql
--
-- A school lead can add teachers, and a teacher is linked to their profile the first time they sign in. Until now both were
-- done by hand in the SQL editor, and a teacher who signed in before anyone linked them saw "No teacher profile is linked yet".
--
--   claim_my_profile()      signed-in person: link my login to the one unlinked profile whose email is mine. Returns the
--                           profile id, or null when there is nothing to claim (no match, or more than one match).
--   roster_add(rows)        school lead only: add 1 to 500 teachers to the lead's own school. Each row is
--                           {first_name, last_name, email, department}. Bad rows are skipped and reported; the rest are added.
--   roster_remove(profile)  school lead only: remove a teacher of the lead's own school who has never signed in and has no
--                           pairings or conversations (the foreign keys refuse otherwise).
--
-- What it relies on: a magic-link login proves the person controls that inbox, so matching on the confirmed sign-in email is
-- safe. Roster rows are the profiles with auth_user_id empty (see the comment on that column). Only roles that
-- are already teacher rows are created here; a school lead is still added in the SQL editor (docs/NICK_SETUP.md, step 4).
--
-- Additive: three functions. No table changes, no existing row changes. Safe to run again. Ends with a self-test.
-- Run in the Supabase SQL editor. Needs 001 to 016 (profiles) and 022 (functions closed to anon by default).

begin;

-- ------------------------------------------------------------ claim my profile

create or replace function public.claim_my_profile()
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_id uuid;
  v_n int;
begin
  if v_uid is null then
    return null;
  end if;

  -- Already linked: nothing to claim. Return the profile so the caller can carry on.
  select id into v_id from public.profiles where auth_user_id = v_uid limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select lower(btrim(email)) into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null or v_email = '' then
    return null;
  end if;

  -- Exactly one unlinked profile may carry this email. Two would be a guess, so nobody is linked and a person has to look.
  select count(*) into v_n from public.profiles where auth_user_id is null and lower(btrim(email)) = v_email;
  if v_n <> 1 then
    return null;
  end if;

  update public.profiles
     set auth_user_id = v_uid, updated_at = now()
   where auth_user_id is null and lower(btrim(email)) = v_email
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.claim_my_profile() from public, anon;
grant execute on function public.claim_my_profile() to authenticated;

-- ------------------------------------------------------------ add teachers

create or replace function public.roster_add(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_school uuid;
  r jsonb;
  i int := 0;
  v_added int := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_first text;
  v_last text;
  v_email text;
  v_dept text;
  v_why text;
begin
  select school_id into v_school from public.profiles where auth_user_id = auth.uid() and role = 'admin' and school_id is not null limit 1;
  if v_school is null then
    raise exception 'roster_add: school leaders only' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 500 then
    raise exception 'roster_add: send between 1 and 500 rows' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    v_first := btrim(coalesce(r ->> 'first_name', ''));
    v_last := btrim(coalesce(r ->> 'last_name', ''));
    v_email := lower(btrim(coalesce(r ->> 'email', '')));
    v_dept := nullif(btrim(coalesce(r ->> 'department', '')), '');
    v_why := null;

    if v_first = '' or v_last = '' then
      v_why := 'first and last name are both needed';
    elsif length(v_first) > 80 or length(v_last) > 80 or length(coalesce(v_dept, '')) > 80 then
      v_why := 'a name or department is longer than 80 characters';
    elsif length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      v_why := 'the email is not valid';
    elsif exists (select 1 from public.profiles where lower(btrim(email)) = v_email) then
      -- The same words whether the email is on this roster or another school's, so a lead cannot probe other schools.
      v_why := 'this email already has a profile';
    end if;

    if v_why is null then
      insert into public.profiles (id, school_id, first_name, last_name, email, role, department, onboarding_complete, is_demo)
      values (gen_random_uuid(), v_school, v_first, v_last, v_email, 'teacher', v_dept, false, false);
      v_added := v_added + 1;
    else
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('row', i, 'email', v_email, 'reason', v_why));
    end if;
  end loop;

  return jsonb_build_object('added', v_added, 'skipped', v_skipped);
end;
$$;

revoke all on function public.roster_add(jsonb) from public, anon;
grant execute on function public.roster_add(jsonb) to authenticated;

-- ------------------------------------------------------------ remove a teacher who never signed in

create or replace function public.roster_remove(p_profile uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_school uuid;
  v_gone int;
begin
  select school_id into v_school from public.profiles where auth_user_id = auth.uid() and role = 'admin' and school_id is not null limit 1;
  if v_school is null then
    raise exception 'roster_remove: school leaders only' using errcode = '42501';
  end if;

  -- Only a teacher of this school who has never signed in. Pairings and conversations point at profiles, so a teacher with
  -- either cannot be removed: the foreign key raises an error and nothing changes.
  delete from public.profiles where id = p_profile and school_id = v_school and role = 'teacher' and auth_user_id is null;
  get diagnostics v_gone = row_count;
  return v_gone = 1;
end;
$$;

revoke all on function public.roster_remove(uuid) from public, anon;
grant execute on function public.roster_remove(uuid) to authenticated;

-- ------------------------------------------------------------ self-test

do $$
declare open_to_anon int; ready int;
begin
  select count(*) into open_to_anon from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('claim_my_profile', 'roster_add', 'roster_remove')
     and (has_function_privilege('anon', p.oid, 'execute') or p.proacl is null);
  select count(*) into ready from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('claim_my_profile', 'roster_add', 'roster_remove')
     and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute');
  if open_to_anon > 0 or ready <> 3 then
    raise exception '026: functions open to anon % (want 0), ready for signed-in users % (want 3)', open_to_anon, ready;
  end if;
  raise notice '026: OK: a login claims only the profile with its own confirmed email, and only a school lead can add or remove teachers, for their own school';
end $$;

commit;

notify pgrst, 'reload schema';
