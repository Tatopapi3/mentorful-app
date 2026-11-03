-- 022_close_anon_functions.sql
--
-- Nick's SECURITY DEFINER helpers can be called by anyone on the internet who has the project's public (anon) key,
-- without signing in. Supabase's security advisor lists them. This closes them: only survey_is_open() stays callable
-- without a login, because the public survey page needs it.
--
-- What changes, and why it is safe:
--   * anon and PUBLIC lose EXECUTE on every SECURITY DEFINER function in schema public except survey_is_open.
--   * signed-in users (authenticated) and the service role keep exactly what they have, so every row-level-security
--     policy that calls is_admin(), my_school_id() and the rest keeps working for signed-in people.
--   * trigger functions (handle_new_user, survey_items_single_active_version, rls_auto_enable) are run by Postgres when a
--     trigger fires, never by a caller, so nobody needs EXECUTE on them: they are closed to everyone.
--   * functions created later by this role no longer give anon (or PUBLIC) EXECUTE by default; a script that creates a
--     function for signed-in users grants it to `authenticated` itself, as 017 to 021 already do.
--
-- Only REMOVES access. Safe to run again. Ends with a self-test that raises an error if any function is still open.
-- Run in the Supabase SQL editor. Needs nothing else.

begin;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname, t.typname as returns
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_type t on t.oid = p.prorettype
     where n.nspname = 'public'
       and p.prosecdef
       and p.proname not in ('survey_is_open', 'submit_survey', 'survey_code_ok')
  loop
    if r.returns in ('trigger', 'event_trigger') then
      execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    else
      -- Grant before revoking from PUBLIC so a signed-in user never loses access that came through PUBLIC.
      execute format('grant execute on function %s to authenticated, service_role', r.sig);
      execute format('revoke execute on function %s from public, anon', r.sig);
    end if;
  end loop;
end $$;

-- New functions should not be open to anon by default (applies to functions created from now on by this role). Postgres gives
-- PUBLIC execute on every new function unless told otherwise, and that is how anon reaches them, so switch that default off.
-- Supabase's own default for schema public still gives signed-in users and the service role access to new functions.
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges revoke execute on functions from public;

-- ------------------------------------------------------------ self-test

do $$
declare open_fns text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into open_fns
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and p.proname not in ('survey_is_open', 'submit_survey', 'survey_code_ok')
     and (
       has_function_privilege('anon', p.oid, 'execute')
       or p.proacl is null                                   -- no ACL recorded means PUBLIC may execute
       or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')  -- grantee 0 = PUBLIC
     );
  if open_fns is not null then
    raise exception '022: still callable without signing in: %', open_fns;
  end if;
  raise notice '022: OK: no function except the survey ones can be called without signing in';
end $$;

commit;

notify pgrst, 'reload schema';
