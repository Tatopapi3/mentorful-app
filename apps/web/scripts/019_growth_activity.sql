-- 019_growth_activity.sql
--
-- What a school lead can learn about teachers' use of the growth tools (time on the platform, goals, the practice log,
-- the pedagogy games) WITHOUT any teacher being identifiable.
--
-- WRITTEN, NOT YET APPLIED. Depends on 017 (the tables it reads). Checked on a throwaway Postgres (PGlite).
--
-- The rules, enforced by the database and not by the page:
--   * CONSENT. Nothing counts unless the teacher turned on "count my activity in my school's anonymous totals"
--     (growth_sharing.share, off by default). Turning it off removes them from the next reading.
--   * NEVER PER PERSON. The function returns school-wide percentages and totals, and no name, id, department or
--     individual figure. There is no per-teacher output of any kind.
--   * A FLOOR. Fewer than 5 sharing teachers: no figures at all. Distributions and medians need 10. Any count under 5
--     (entries, game sessions, pairs) is withheld.
--   * ROUNDED. Percentages and the typical-minutes figure are rounded to the nearest 5, and the number of teachers
--     sharing is shown as "about N" rounded to 5, so a single person opting in or out can't be read off the change.
--   * ADMIN ONLY, own school. A teacher calling it gets nothing.
--
-- The tables themselves (platform_time, growth_goals, growth_entries, future_notes) stay owner-only, exactly as in 017.
-- This function is the only way anything about them reaches leadership, and it is an aggregate.
--
-- Time on the platform is an engagement signal, not a measure of growth: the page that shows this says so.
--
-- *** Adds one table and one function. Changes no existing table. ***

begin;

create table if not exists public.growth_sharing (
  profile_id  uuid primary key,
  school_id   uuid not null,
  share       boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.growth_sharing enable row level security;
alter table public.growth_sharing force row level security;

drop policy if exists "owner reads own sharing choice"  on public.growth_sharing;
drop policy if exists "owner writes own sharing choice" on public.growth_sharing;
drop policy if exists "owner edits own sharing choice"  on public.growth_sharing;

create policy "owner reads own sharing choice"  on public.growth_sharing for select to authenticated
  using (profile_id = public.my_profile_id());
create policy "owner writes own sharing choice" on public.growth_sharing for insert to authenticated
  with check (profile_id = public.my_profile_id() and school_id = public.my_school_id());
create policy "owner edits own sharing choice"  on public.growth_sharing for update to authenticated
  using (profile_id = public.my_profile_id())
  with check (profile_id = public.my_profile_id() and school_id = public.my_school_id());

revoke all on public.growth_sharing from anon, public;
grant select, insert, update on public.growth_sharing to authenticated;

-- ---------------------------------------------------------------- the function

create or replace function public.growth_activity(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_school   uuid := public.my_school_id();
  v_days     integer := least(90, greatest(7, coalesce(p_days, 30)));
  v_from     date := current_date - (least(90, greatest(7, coalesce(p_days, 30))) - 1);
  v_week     date := current_date - 6;
  v_teachers integer;
  v_n        integer;
  v_out      jsonb;
begin
  if v_school is null or not public.is_school_admin() then
    return null;
  end if;

  select count(*) into v_teachers from public.profiles where school_id = v_school and coalesce(role, 'teacher') = 'teacher';

  select count(*) into v_n
    from public.growth_sharing gs join public.profiles p on p.id = gs.profile_id
   where gs.share and gs.school_id = v_school and p.school_id = v_school and coalesce(p.role, 'teacher') = 'teacher';

  -- Under the floor: say only that there is not enough to show.
  if v_n < 5 then
    return jsonb_build_object('teachers', v_teachers, 'window_days', v_days, 'enough', false);
  end if;

  with sharers as (
    select gs.profile_id
      from public.growth_sharing gs join public.profiles p on p.id = gs.profile_id
     where gs.share and gs.school_id = v_school and p.school_id = v_school and coalesce(p.role, 'teacher') = 'teacher'
  ),
  per as (
    select s.profile_id,
           count(*) filter (where pt.day >= v_from and pt.seconds >= 60)::int           as active_days,
           coalesce(sum(pt.seconds) filter (where pt.day >= v_week), 0)::numeric        as week_seconds,
           coalesce(bool_or(pt.day >= v_week and pt.seconds >= 60), false)              as active_week
      from sharers s left join public.platform_time pt on pt.profile_id = s.profile_id
     group by s.profile_id
  ),
  prac as (
    select s.profile_id, count(ge.id) filter (where ge.created_at >= v_from::timestamptz)::int as entries
      from sharers s left join public.growth_entries ge on ge.profile_id = s.profile_id
     group by s.profile_id
  ),
  goals as (
    select g.profile_id, g.status from public.growth_goals g join sharers s on s.profile_id = g.profile_id
  ),
  games as (
    select gs2.pairing_id, gs2.module, gs2.completed
      from public.pair_game_sessions gs2 join public.pairings pr on pr.id = gs2.pairing_id
     where pr.school_id = v_school and gs2.created_at >= v_from::timestamptz
       and (pr.host_id in (select profile_id from sharers) or pr.visitor_id in (select profile_id from sharers))
  ),
  weeks as (
    select w::date as wk,
           (select count(*) from sharers s where exists (
              select 1 from public.platform_time pt
               where pt.profile_id = s.profile_id and pt.day >= w::date and pt.day < w::date + 7 and pt.seconds >= 60))::int as active
      from generate_series(date_trunc('week', current_date)::date - 49, date_trunc('week', current_date)::date, interval '7 days') w
  )
  select jsonb_build_object(
    'teachers', v_teachers,
    'window_days', v_days,
    'enough', true,
    -- "about N", to the nearest 5, never the exact figure
    'contributors', (5 * round(v_n / 5.0))::int,
    'share_pct',    least(100, (5 * round(100.0 * v_n / greatest(v_teachers, 1) / 5))::int),
    'active_week_pct', (5 * round(100.0 * (select count(*) filter (where active_week) from per) / v_n / 5))::int,
    -- distributions and the median need 10 sharing teachers
    'typical_week_minutes', case when v_n >= 10 then (5 * round((select percentile_cont(0.5) within group (order by week_seconds) from per) / 60.0 / 5))::int end,
    'days_buckets', case when v_n >= 10 then jsonb_build_array(
        jsonb_build_object('label', 'Not at all',    'pct', (5 * round(100.0 * (select count(*) from per where active_days = 0) / v_n / 5))::int),
        jsonb_build_object('label', '1 to 3 days',   'pct', (5 * round(100.0 * (select count(*) from per where active_days between 1 and 3) / v_n / 5))::int),
        jsonb_build_object('label', '4 to 9 days',   'pct', (5 * round(100.0 * (select count(*) from per where active_days between 4 and 9) / v_n / 5))::int),
        jsonb_build_object('label', '10 or more',    'pct', (5 * round(100.0 * (select count(*) from per where active_days >= 10) / v_n / 5))::int)) end,
    'has_goal_pct',  (5 * round(100.0 * (select count(distinct profile_id) from goals) / v_n / 5))::int,
    'goals_done_pct', case when (select count(*) from goals) >= 5 then (5 * round(100.0 * (select count(*) filter (where status = 'done') from goals) / (select count(*) from goals) / 5))::int end,
    'practiced_pct', (5 * round(100.0 * (select count(*) filter (where entries > 0) from prac) / v_n / 5))::int,
    'practice_entries', case when (select coalesce(sum(entries), 0) from prac) >= 5 then (select sum(entries) from prac)::int end,
    'game_sessions', case when (select count(*) from games) >= 5 then (select count(*) from games)::int end,
    'game_modules_done', case when (select count(distinct (pairing_id, module)) filter (where completed) from games) >= 5 then (select count(distinct (pairing_id, module)) filter (where completed) from games)::int end,
    'pairs_playing', case when (select count(distinct pairing_id) from games) >= 5 then (select count(distinct pairing_id) from games)::int end,
    'weekly', (select jsonb_agg(jsonb_build_object('week', wk, 'pct', (5 * round(100.0 * active / v_n / 5))::int) order by wk) from weeks)
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.growth_activity(integer) from public;
grant execute on function public.growth_activity(integer) to authenticated;

-- ------------------------------------------------------------ self-test

do $$
declare anon_grants int; forced boolean; n_pol int; leaky int;
begin
  select count(*) into n_pol from pg_policies where schemaname = 'public' and tablename = 'growth_sharing';
  select count(*) into leaky from pg_policies
   where schemaname = 'public' and tablename = 'growth_sharing' and (coalesce(qual, '') || coalesce(with_check, '') not like '%my_profile_id%' or 'anon' = any(roles));
  select count(*) into anon_grants from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'growth_sharing' and grantee in ('anon', 'PUBLIC');
  select relforcerowsecurity into forced from pg_class where oid = 'public.growth_sharing'::regclass;
  if n_pol <> 3 or leaky > 0 or anon_grants > 0 or forced is not true then
    raise exception '019: sharing policies % (want 3), not owner-gated %, anon grants %, forced RLS %', n_pol, leaky, anon_grants, forced;
  end if;
  raise notice '019: OK: growth totals are opt-in, anonymous, rounded, floored and admin-only';
end $$;

commit;

-- After applying: reload PostgREST's schema cache (see CLAUDE.md): notify pgrst, 'reload schema';
