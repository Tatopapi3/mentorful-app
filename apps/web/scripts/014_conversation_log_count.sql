-- 014_conversation_log_count.sql
--
-- Let leadership see HOW MANY conversations happened, without seeing any of
-- them. Same pattern as concern_domain_counts() from 009 §8: a SECURITY
-- DEFINER function that returns an aggregate, never rows.
--
-- WHY THIS IS NOT A WEAKENING OF 011
-- 011 closed an admin read leak on conversation_logs and left exactly one
-- SELECT policy: host or visitor only. That stays untouched. This function
-- does not grant SELECT to anyone; it runs as its owner, counts, and returns a
-- single integer. An admin still cannot read a vision statement, a strength
-- noted, or who said what. The promise is "we tell you that coaching is
-- happening, never what was said", and a count is the honest expression of it.
--
-- WHY THERE IS NO SMALL-CELL FLOOR HERE
-- concern_domain_counts() nulls any domain below 5, because a count of 2 in
-- one domain plus the pairing list identifies the pair. A school-wide total
-- does not: 32 conversations across 50 teachers points at nobody. If this is
-- ever narrowed to a department or a person, it needs a floor again.
--
-- COUNTS SUBMITTED LOGS ONLY, deliberately: it must agree with
-- concern_domain_counts(), which also counts only submitted. A metric strip
-- that disagrees with the bar chart beneath it is worse than either number
-- alone.
--
-- *** Adds a function. Changes no table, no policy, no row. ***

begin;

create or replace function public.conversation_log_count(p_cycle uuid default null)
  returns integer
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  n int;
begin
  if not public.is_school_admin() then
    raise exception 'conversation_log_count: admin only' using errcode = '42501';
  end if;

  select count(*)
    into n
    from public.conversation_logs cl
   where cl.school_id = public.my_school_id()   -- cannot count another school
     and cl.status = 'submitted'
     and (p_cycle is null or cl.cycle_id = p_cycle);

  return coalesce(n, 0);
end $$;

revoke execute on function public.conversation_log_count(uuid) from public, anon;
grant   execute on function public.conversation_log_count(uuid) to authenticated;

comment on function public.conversation_log_count(uuid) is
  'Admin-only count of submitted conversation logs for the caller''s school, '
  'optionally scoped to one cycle. Returns a number only. conversation_logs '
  'stays pair-private (011); this grants no read access to its content.';

commit;

-- ---------------------------------------------------------------------------
-- VERIFY (read-only, after the commit)
-- ---------------------------------------------------------------------------
-- -- a. As the admin: a real count, and still zero readable rows.
-- begin;
-- select set_config('request.jwt.claims',
--   '{"sub":"debf36dc-b98d-4d38-876b-6238af9eaf24","role":"authenticated"}', true);
-- set local role authenticated;
-- select public.conversation_log_count(null)                  as total;        -- expect 32
-- select public.conversation_log_count(
--   (select id from public.cycles order by ends_at desc limit 1)) as this_cycle; -- expect 32
-- select count(*) as rows_readable from public.conversation_logs;             -- MUST be 0
-- rollback;
--
-- -- b. A non-admin teacher is refused outright.
-- begin;
-- select set_config('request.jwt.claims', json_build_object(
--   'sub', (select auth_user_id from public.profiles
--            where role <> 'admin' and auth_user_id is not null limit 1),
--   'role','authenticated')::text, true);
-- set local role authenticated;
-- select public.conversation_log_count(null);   -- expect: ERROR 42501 admin only
-- rollback;
