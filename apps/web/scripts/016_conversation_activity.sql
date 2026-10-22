-- 016_conversation_activity.sql
--
-- Written before the database dump arrived, then checked against mentorful_handoff.sql (Oct 20): every column used here
-- exists with the type assumed. Apply it with scripts/restore-handoff.sh after the dump is restored.
--
-- Why: conversation_logs is pair-private (011), so a school admin reads zero rows by design. The Trends page needs
-- conversations by month and by department, so this returns COUNTS and never rows, and it hides any number under
-- MIN_CELL and any department under MIN_CELL teachers, the same floor the other functions use.
--
-- A conversation is counted under the department of each partner in its pair (once, if both are in the same
-- department), so "activity in Math" means conversations a Math teacher took part in. Every submitted log counts, a visit
-- debrief included (in Nick's demo data every log is a debrief, and all are dated March 2026).

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
  v_weeks jsonb;
  v_heat_weeks jsonb;
begin
  if not public.is_school_admin() then
    raise exception 'conversation_activity: admin only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.cycles c where c.id = p_cycle and c.school_id = v_school) then
    return null;
  end if;

  -- One CTE feeds both aggregates; nothing is written, so the function can stay STABLE.
  with logs as (
    select cl.id, pr.host_id, pr.visitor_id, to_char(date_trunc('month', cl.submitted_at), 'YYYY-MM') as month,
           to_char(date_trunc('week', cl.submitted_at), 'YYYY-MM-DD') as week
      from public.conversation_logs cl
      join public.pairings pr on pr.id = cl.pairing_id
     where cl.school_id = v_school and cl.cycle_id = p_cycle and cl.status = 'submitted'
       and cl.submitted_at is not null
  ),
  big as (
    select coalesce(p.department, 'Unassigned') as department
      from public.profiles p
     where p.school_id = v_school and p.role = 'teacher'
     group by coalesce(p.department, 'Unassigned')
    having count(*) >= MIN_CELL
  ),
  by_month as (
    select month, count(*)::int as n from logs group by month
  ),
  by_week as (
    select week, count(*)::int as n from logs group by week
  ),
  by_dept as (
    select d.department, l.month, l.week, count(*)::int as n
      from logs l
      cross join lateral (
        select distinct coalesce(p.department, 'Unassigned') as department
          from public.profiles p
         where p.id in (l.host_id, l.visitor_id)
      ) d
     where d.department in (select department from big)
     group by d.department, l.month, l.week
  ),
  dept_month as (
    select department, month, sum(n)::int as n from by_dept group by department, month
  )
  select coalesce((select jsonb_agg(jsonb_build_object('month', m.month, 'n', case when m.n >= MIN_CELL then m.n end) order by m.month) from by_month m), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('department', h.department, 'month', h.month, 'n', case when h.n >= MIN_CELL then h.n end) order by h.department, h.month) from dept_month h), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('week', w.week, 'n', case when w.n >= MIN_CELL then w.n end) order by w.week) from by_week w), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('department', h.department, 'week', h.week, 'n', case when h.n >= MIN_CELL then h.n end) order by h.department, h.week) from by_dept h), '[]'::jsonb)
    into v_months, v_heat, v_weeks, v_heat_weeks;

  return jsonb_build_object('months', v_months, 'heat', v_heat, 'weeks', v_weeks, 'heat_weeks', v_heat_weeks);
end $$;

revoke execute on function public.conversation_activity(uuid) from public, anon;
grant  execute on function public.conversation_activity(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

-- VERIFY (read-only), signed in as the admin, over the API:
--   select public.conversation_activity('<cycle id>');  -- expect months and heat, no rows, no names, nothing under 5
-- and as a teacher: must raise 42501.
