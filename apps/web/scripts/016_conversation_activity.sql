-- 016_conversation_activity.sql
--
-- DRAFT, NOT APPLIED. Written before the database dump arrived. Same caution as 015: check every column against the
-- real schema before applying. Assumed: pairings(id, school_id, cycle_id, host_id, visitor_id, status),
-- conversation_logs(id, pairing_id, school_id, cycle_id, status, submitted_at, is_visit_debrief),
-- profiles(id, school_id, role, department).
--
-- Why: conversation_logs is pair-private (011), so a school admin reads zero rows by design. The Trends page needs
-- conversations by month and by department, so this returns COUNTS and never rows, and it hides any number under
-- MIN_CELL and any department under MIN_CELL teachers, the same floor the other functions use.
--
-- A conversation is counted under the department of each partner in its pair (once, if both are in the same
-- department), so "activity in Math" means conversations a Math teacher took part in. Visit debriefs are not counted.

begin;

create or replace function public.conversation_activity(p_cycle uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  MIN_CELL constant int := 5;
  v_school uuid := public.my_school_id();
  v_months jsonb;
  v_heat jsonb;
begin
  if not public.is_school_admin() then
    raise exception 'conversation_activity: admin only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.cycles c where c.id = p_cycle and c.school_id = v_school) then
    return null;
  end if;

  create temporary table if not exists _ca_logs (id uuid, host_id uuid, visitor_id uuid, month text) on commit drop;
  truncate _ca_logs;
  insert into _ca_logs
    select cl.id, pr.host_id, pr.visitor_id, to_char(date_trunc('month', cl.submitted_at), 'YYYY-MM')
      from public.conversation_logs cl
      join public.pairings pr on pr.id = cl.pairing_id
     where cl.school_id = v_school and cl.cycle_id = p_cycle and cl.status = 'submitted'
       and not coalesce(cl.is_visit_debrief, false) and cl.submitted_at is not null;

  select coalesce(jsonb_agg(jsonb_build_object('month', m.month, 'n', case when m.n >= MIN_CELL then m.n end) order by m.month), '[]'::jsonb)
    into v_months
    from (select month, count(*)::int as n from _ca_logs group by month) m;

  select coalesce(jsonb_agg(jsonb_build_object('department', h.department, 'month', h.month, 'n', case when h.n >= MIN_CELL then h.n end) order by h.department, h.month), '[]'::jsonb)
    into v_heat
    from (
      select cd.department, cd.month, count(*)::int as n
        from (
          select l.id, l.month, d.department
            from _ca_logs l
            cross join lateral (
              select distinct coalesce(p.department, 'Unassigned') as department
                from public.profiles p
               where p.id in (l.host_id, l.visitor_id)
            ) d
        ) cd
       where cd.department in (
         select coalesce(p.department, 'Unassigned') from public.profiles p
          where p.school_id = v_school and p.role = 'teacher'
          group by coalesce(p.department, 'Unassigned') having count(*) >= MIN_CELL
       )
       group by cd.department, cd.month
    ) h;

  return jsonb_build_object('months', v_months, 'heat', v_heat);
end $$;

revoke execute on function public.conversation_activity(uuid) from public, anon;
grant  execute on function public.conversation_activity(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

-- VERIFY (read-only), signed in as the admin, over the API:
--   select public.conversation_activity('<cycle id>');  -- expect months and heat, no rows, no names, nothing under 5
-- and as a teacher: must raise 42501.
