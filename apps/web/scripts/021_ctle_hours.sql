-- 021_ctle_hours.sql
--
-- A teacher's own record of Continuing Teacher and Leader Education (CTLE) hours, and an anonymous "how many are on
-- pace" reading for the school lead.
--
-- WRITTEN, NOT YET APPLIED. Depends on 019 (growth_sharing, the teacher's consent). Checked on a throwaway Postgres
-- (PGlite). The rules the app is built around:
--
--   * New York asks certified teachers for 100 hours per 5-year registration period, at least 15% of them language
--     acquisition, from an approved sponsor. The numbers are per-teacher SETTINGS (ctle_settings), because a Level III
--     teaching assistant needs 75 and other states differ.
--   * Mentorful is a personal record, NOT NYSED's system of record. An hour is marked "approved sponsor" or not by the
--     teacher; only approved hours count toward the requirement. Nothing here certifies anything.
--   * OWNER-ONLY. ctle_settings and ctle_hours are readable and writable only by the teacher they belong to, exactly like
--     the other hub tables in 017. No school lead can read a teacher's hours, so nobody can be named as "behind".
--   * The only thing leadership gets is ctle_progress(): school-wide percentages of teachers who are complete, on pace
--     or behind pace, counting ONLY teachers who turned on "count my activity in anonymous school totals" (019), only
--     those who have set the tracker up, never a name or a figure per person, rounded to the nearest 5, and nothing at
--     all under 5 teachers.
--   * Nothing is deleted. A mistaken entry is marked removed (voided_at) and stops counting.
--
-- The pace rule matches src/lib/teacher/ctle.ts: expected hours = required x share of the period gone; a teacher is
-- on pace when approved hours AND language-acquisition hours are both at or above that; complete when both reach the
-- requirement. Change one, change the other.
--
-- *** Adds two tables and one function. Changes no existing table. ***

begin;

create table if not exists public.ctle_settings (
  profile_id      uuid primary key,
  period_start    date not null,
  period_years    smallint not null default 5 check (period_years between 1 and 5),
  required_hours  integer not null default 100 check (required_hours between 1 and 300),
  language_pct    smallint not null default 15 check (language_pct between 0 and 100),
  updated_at      timestamptz not null default now()
);

create table if not exists public.ctle_hours (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null,
  taken_on      date not null,
  hours         numeric(5,2) not null check (hours >= 0.25 and hours <= 100 and (hours * 4) = round(hours * 4)),
  title         text not null check (char_length(btrim(title)) between 1 and 200),
  sponsor       text check (sponsor is null or char_length(sponsor) <= 120),
  language      boolean not null default false,
  approved      boolean not null default true,
  certificate   boolean not null default false,
  voided_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists ctle_hours_owner on public.ctle_hours (profile_id, taken_on);

do $$
declare t text;
begin
  foreach t in array array['ctle_settings', 'ctle_hours'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists "owner reads own rows" on public.%I', t);
    execute format('drop policy if exists "owner writes own rows" on public.%I', t);
    execute format('drop policy if exists "owner edits own rows" on public.%I', t);
    execute format('create policy "owner reads own rows" on public.%I for select to authenticated using (profile_id = public.my_profile_id())', t);
    execute format('create policy "owner writes own rows" on public.%I for insert to authenticated with check (profile_id = public.my_profile_id())', t);
    execute format('create policy "owner edits own rows" on public.%I for update to authenticated using (profile_id = public.my_profile_id()) with check (profile_id = public.my_profile_id())', t);
    execute format('revoke all on public.%I from anon, public', t);
  end loop;
end $$;

grant select, insert, update on public.ctle_settings to authenticated;
grant select, insert, update on public.ctle_hours    to authenticated;

-- ---------------------------------------------------------------- the function

create or replace function public.ctle_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_school   uuid := public.my_school_id();
  v_teachers integer;
  v_n        integer;
  v_out      jsonb;
begin
  if v_school is null or not public.is_school_admin() then
    return null;
  end if;

  select count(*) into v_teachers from public.profiles where school_id = v_school and coalesce(role, 'teacher') = 'teacher';

  -- Teachers who consented to anonymous totals AND set the tracker up.
  select count(*) into v_n
    from public.growth_sharing gs
    join public.profiles p on p.id = gs.profile_id
    join public.ctle_settings cs on cs.profile_id = gs.profile_id
   where gs.share and gs.school_id = v_school and p.school_id = v_school and coalesce(p.role, 'teacher') = 'teacher';

  if v_n < 5 then
    return jsonb_build_object('teachers', v_teachers, 'enough', false);
  end if;

  with per as (
    select cs.profile_id,
           cs.required_hours as req,
           (cs.required_hours * cs.language_pct / 100.0) as lang_req,
           least(1.0, greatest(0.0, (current_date - cs.period_start)::numeric
                 / nullif(((cs.period_start + make_interval(years => cs.period_years))::date - cs.period_start), 0))) as elapsed,
           coalesce(sum(h.hours) filter (where h.approved), 0)                   as counted,
           coalesce(sum(h.hours) filter (where h.approved and h.language), 0)    as lang
      from public.growth_sharing gs
      join public.profiles p on p.id = gs.profile_id
      join public.ctle_settings cs on cs.profile_id = gs.profile_id
      left join public.ctle_hours h
             on h.profile_id = cs.profile_id and h.voided_at is null
            and h.taken_on >= cs.period_start
            and h.taken_on < (cs.period_start + make_interval(years => cs.period_years))::date
     where gs.share and gs.school_id = v_school and p.school_id = v_school and coalesce(p.role, 'teacher') = 'teacher'
     group by cs.profile_id, cs.required_hours, cs.language_pct, cs.period_start, cs.period_years
  ),
  st as (
    select case
             when counted >= req and lang >= lang_req then 'complete'
             when counted >= req * elapsed and lang >= lang_req * elapsed then 'on-pace'
             else 'behind' end as s
      from per
  )
  select jsonb_build_object(
    'teachers', v_teachers,
    'enough', true,
    'contributors', (5 * round(v_n / 5.0))::int,
    'tracking_pct', least(100, (5 * round(100.0 * v_n / greatest(v_teachers, 1) / 5))::int),
    'complete_pct', (5 * round(100.0 * (select count(*) filter (where s = 'complete') from st) / v_n / 5))::int,
    'on_pace_pct',  (5 * round(100.0 * (select count(*) filter (where s = 'on-pace')  from st) / v_n / 5))::int,
    'behind_pct',   (5 * round(100.0 * (select count(*) filter (where s = 'behind')   from st) / v_n / 5))::int
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.ctle_progress() from public;
grant execute on function public.ctle_progress() to authenticated;

-- ------------------------------------------------------------ self-test

do $$
declare anon_grants int; n_pol int; leaky int; unforced int;
begin
  select count(*) into n_pol from pg_policies where schemaname = 'public' and tablename in ('ctle_settings', 'ctle_hours');
  select count(*) into leaky from pg_policies
   where schemaname = 'public' and tablename in ('ctle_settings', 'ctle_hours')
     and (coalesce(qual, '') || coalesce(with_check, '') not like '%my_profile_id%' or 'anon' = any(roles));
  select count(*) into anon_grants from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('ctle_settings', 'ctle_hours') and grantee in ('anon', 'PUBLIC');
  select count(*) into unforced from pg_class where oid in ('public.ctle_settings'::regclass, 'public.ctle_hours'::regclass) and relforcerowsecurity is not true;
  if n_pol <> 6 or leaky > 0 or anon_grants > 0 or unforced > 0 then
    raise exception '021: policies % (want 6), not owner-gated %, anon grants %, tables without forced RLS %', n_pol, leaky, anon_grants, unforced;
  end if;
  raise notice '021: OK: CTLE hours are owner-only; leadership gets only an anonymous, rounded, floored reading';
end $$;

commit;

-- After applying: reload PostgREST's schema cache (see CLAUDE.md): notify pgrst, 'reload schema';
