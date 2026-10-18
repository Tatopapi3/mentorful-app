-- 015_participation_summary.sql
--
-- DRAFT, NOT APPLIED. Written before the database dump arrived, from the table and column names in
-- apps/web/CLAUDE.md and the queries in the app. Check every column against the real schema (pg_attribute,
-- pg_constraint, pg_policies) before applying, as CLAUDE.md insists, and replace anything that differs.
-- Assumed: pairings(id, school_id, cycle_id, host_id, visitor_id, status), conversation_logs(pairing_id,
-- school_id, cycle_id, status, submitted_at, is_visit_debrief), profiles(id, school_id, role, department).
--
-- Why this exists: conversation_logs is pair-private (011). A school admin reads zero rows by design, so the
-- leadership views can only get COUNTS, and only through SECURITY DEFINER functions like concern_domain_counts.
-- These two return counts and rates and never rows, and they hide any department smaller than MIN_CELL.
--
-- Terms. "Conversation" is a submitted log that is not a visit debrief; "debrief" is a submitted visit debrief;
-- "complete" is a pair with both. Hosted and visited are not split out until the schema says which log belongs
-- to which side.

begin;

create or replace function public.participation_summary(p_cycle uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  MIN_CELL constant int := 5;
  v_school uuid := public.my_school_id();
  v_pairs int;
  v_conv int;
  v_deb int;
  v_complete int;
  v_teachers int;
  v_active int;
  v_depts jsonb;
begin
  if not public.is_school_admin() then
    raise exception 'participation_summary: admin only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.cycles c where c.id = p_cycle and c.school_id = v_school) then
    return null;
  end if;

  with pr as (
    select id, host_id, visitor_id
      from public.pairings
     where school_id = v_school and cycle_id = p_cycle and status = 'approved'
  ),
  lg as (
    select pairing_id,
           bool_or(not coalesce(is_visit_debrief, false)) as conv,
           bool_or(coalesce(is_visit_debrief, false))     as deb
      from public.conversation_logs
     where school_id = v_school and cycle_id = p_cycle and status = 'submitted'
     group by pairing_id
  )
  select count(*),
         count(*) filter (where lg.conv),
         count(*) filter (where lg.deb),
         count(*) filter (where lg.conv and lg.deb)
    into v_pairs, v_conv, v_deb, v_complete
    from pr left join lg on lg.pairing_id = pr.id;

  select count(*) into v_teachers from public.profiles where school_id = v_school and role = 'teacher';

  with active_people as (
    select unnest(array[pr.host_id, pr.visitor_id]) as person
      from public.pairings pr
      join public.conversation_logs cl on cl.pairing_id = pr.id and cl.status = 'submitted'
     where pr.school_id = v_school and pr.cycle_id = p_cycle and pr.status = 'approved'
  )
  select count(distinct person) into v_active from active_people;

  select coalesce(jsonb_agg(jsonb_build_object('department', d.department, 'teachers', d.teachers, 'active', d.active) order by d.department), '[]'::jsonb)
    into v_depts
    from (
      select coalesce(p.department, 'Unassigned') as department,
             count(*) as teachers,
             count(*) filter (where p.id in (
               select unnest(array[pr.host_id, pr.visitor_id])
                 from public.pairings pr
                 join public.conversation_logs cl on cl.pairing_id = pr.id and cl.status = 'submitted'
                where pr.school_id = v_school and pr.cycle_id = p_cycle and pr.status = 'approved'
             )) as active
        from public.profiles p
       where p.school_id = v_school and p.role = 'teacher'
       group by coalesce(p.department, 'Unassigned')
      having count(*) >= MIN_CELL
    ) d;

  return jsonb_build_object(
    'pairs', v_pairs, 'with_conversation', v_conv, 'with_debrief', v_deb, 'complete', v_complete,
    'teachers', v_teachers, 'active_teachers', v_active, 'by_department', v_depts
  );
end $$;

-- How many approved pairs have logged nothing in the last p_days days. A number, never which pairs.
create or replace function public.quiet_pair_count(p_cycle uuid, p_days int default 30)
  returns int
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_school uuid := public.my_school_id();
begin
  if not public.is_school_admin() then
    raise exception 'quiet_pair_count: admin only' using errcode = '42501';
  end if;
  return (
    select count(*)::int
      from public.pairings pr
     where pr.school_id = v_school and pr.cycle_id = p_cycle and pr.status = 'approved'
       and not exists (
         select 1 from public.conversation_logs cl
          where cl.pairing_id = pr.id and cl.status = 'submitted'
            and cl.submitted_at >= now() - make_interval(days => p_days)
       )
  );
end $$;

revoke execute on function public.participation_summary(uuid) from public, anon;
revoke execute on function public.quiet_pair_count(uuid, int) from public, anon;
grant  execute on function public.participation_summary(uuid) to authenticated;
grant  execute on function public.quiet_pair_count(uuid, int) to authenticated;

commit;

-- A new function is invisible over the API until PostgREST reloads its schema cache:
notify pgrst, 'reload schema';

-- VERIFY (read-only), signed in as the admin, over the API, not just in SQL:
--   select public.participation_summary('<cycle id>');   -- expect rates, no rows, no names
--   select public.quiet_pair_count('<cycle id>', 30);    -- expect a number
-- and as a teacher: both must raise 42501.
