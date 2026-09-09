-- 010_drop_profiles_id_fkey.sql
--
-- Finish the identity decoupling that 007 started.
--
-- WHAT 007 MISSED
-- 007 added profiles.auth_user_id (nullable, unique, FK to auth.users with
-- ON DELETE SET NULL) and rewrote the UPDATE policy to key on it. But
-- profiles.id ALSO carries a foreign key to auth.users(id) -- profiles_id_fkey --
-- and 007 left it in place. So id is still *required* to be a real auth user,
-- and a roster row for a teacher who has not signed up is rejected:
--
--   insert or update on table "profiles" violates foreign key constraint
--   "profiles_id_fkey"
--
-- which is exactly what the Step 3 migration hit on its first write.
--
-- WHY IT WAS NOT CAUGHT
-- Every schema probe in this work read PostgREST's OpenAPI document, which
-- reports foreign keys only to tables in the EXPOSED schema. profiles_id_fkey
-- targets auth.users, so it never appeared -- the OpenAPI listing for profiles
-- shows school_id -> schools.id and nothing about id. The system catalog is the
-- authority; the API description is not.
--
-- WHAT THIS CHANGES
-- After this migration, profiles.id is an ordinary uuid primary key. The link
-- to auth.users lives in exactly one place: auth_user_id. That is the whole
-- point of the decoupling -- one column carries the relationship, and it is
-- nullable because "invited but not yet signed up" is a real state.
--
-- The four existing rows are unaffected: their id still equals their
-- auth_user_id, that equality is just no longer enforced by the schema.
-- Anything that creates a profile on signup with id = new.id keeps working;
-- it is now a convention rather than a constraint.
--
-- *** LIVE TABLE: profiles, 4 rows. Drops a constraint; adds none. ***
-- No row is modified. No data is lost. Reversible by re-adding the FK, which
-- would succeed today and fail the moment a roster row exists.

begin;

-- ---------------------------------------------------------------------------
-- 1. Confirm the constraint is what we think, and say so out loud before
--    dropping it. If it turns out to point somewhere other than auth.users,
--    stop -- that is a different constraint with a different reason to exist.
-- ---------------------------------------------------------------------------

do $$
declare
  con_def text;
  n_bad   int;
begin
  select pg_get_constraintdef(oid) into con_def
    from pg_constraint
   where conrelid = 'public.profiles'::regclass
     and conname  = 'profiles_id_fkey';

  if con_def is null then
    raise notice '010: profiles_id_fkey does not exist -- already dropped, nothing to do';
    return;
  end if;

  raise notice '010: profiles_id_fkey is: %', con_def;

  if con_def !~* 'auth\.users' then
    raise exception
      '010: profiles_id_fkey does not reference auth.users -- it is: %. '
      'This migration only expects the auth coupling. Stop and inspect.', con_def;
  end if;

  -- auth_user_id must be carrying the link before id stops enforcing it,
  -- otherwise this drops the only thing tying profiles to real users.
  select count(*) into n_bad
    from public.profiles p
   where p.auth_user_id is null
     and exists (select 1 from auth.users u where u.id = p.id);

  if n_bad > 0 then
    raise exception
      '010: % profile(s) have an id matching an auth user but a NULL auth_user_id. '
      'Backfill auth_user_id first (007 section 3) -- dropping the FK now would '
      'lose the only record of who they are.', n_bad;
  end if;

  raise notice '010: auth_user_id carries the link for every linked row; safe to drop the id FK';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Drop it.
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_id_fkey;

comment on column public.profiles.id is
  'Ordinary uuid primary key. NOT the auth user id -- that link lives in '
  'auth_user_id alone (see 007, 010). For rows created at signup the two happen '
  'to be equal; that is a convention, not a constraint, and roster rows migrated '
  'from Neon have a UUIDv5 derived from their old cuid instead.';

-- ---------------------------------------------------------------------------
-- 3. Report anything still keyed on the old coupling.
--    007 rewrote the UPDATE policy and raised a notice about the rest; this is
--    the same check, run again now that the constraint is gone and any
--    remaining offender is genuinely broken rather than merely redundant.
-- ---------------------------------------------------------------------------

do $$
declare
  leftovers text;
begin
  select string_agg(format('%s.%s/%s', tablename, cmd, policyname), '; ')
    into leftovers
    from pg_policies
   where schemaname = 'public'
     and (coalesce(qual, '') like '%id = auth.uid()%'
       or coalesce(with_check, '') like '%id = auth.uid()%')
     and coalesce(qual, '') || coalesce(with_check, '') not like '%auth_user_id = auth.uid()%';

  if leftovers is null then
    raise notice '010: no policy still keys on id = auth.uid()';
  else
    raise notice
      '010: policies still keyed on id = auth.uid(): %. These worked while id '
      'was forced to equal the auth id. They will now silently fail for any '
      'roster row. Repoint them to auth_user_id.', leftovers;
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- VERIFY (read-only; run after the commit)
-- ---------------------------------------------------------------------------
-- -- a. The constraint is gone, and no other FK sits on profiles.id.
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.profiles'::regclass and contype = 'f';
-- -- expect: profiles_school_id_fkey and profiles_auth_user_id_fkey only
--
-- -- b. The 4 real rows are untouched and still linked.
-- select email, role, school_id, (id = auth_user_id) as still_equal
--   from public.profiles order by email;
-- -- expect: 4 rows, still_equal = true on all
--
-- THEN: sign in with a magic link end to end. This is the constraint that tied
-- a profile to an auth user, so login is exactly what to re-test.
-- Then re-run: npm run migrate:neon
