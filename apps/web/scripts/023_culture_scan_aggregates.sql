-- 023_culture_scan_aggregates.sql
--
-- The Culture Scan report needs four averages and a correlation table. Until now the app got them by reading every raw
-- answer with the service-role ("master") key and adding them up in the server. This script moves the adding-up into the
-- database, behind an admin-only function, so the report no longer needs the master key at all.
--
--   culture_scan_aggregates(survey) -> jsonb
--
-- It only answers a signed-in administrator of the school that owns the survey, and it enforces the release rules itself
-- (the app cannot skip them):
--   * "not-closed"  the survey is still open (or has no close date). Results are released after the survey closes. Nick, Oct 29.
--   * "no-data"     nobody has answered.
--   * "below-floor" fewer than 5 complete respondents, or (when every respondent is real) fewer than 60% of the school's
--                   faculty headcount, or no headcount recorded to measure 60% of. A survey that still contains demo
--                   rows is labelled as a demo by the app and is not held to the 60% rule, as before.
--   * "ok"          the answer: how many respondents, how many are demo, and per dimension the mean and standard deviation,
--                   plus the 4 by 4 correlation table. Nothing else. No row, no respondent id, ever leaves the function.
--
-- Also adds close_culture_scan(survey), an admin-only way to close the survey (sets the close date to now), so results
-- can be released from the app without typing SQL.
--
-- Only ADDS two functions. Safe to run again. Ends with a self-test. Needs 009's helpers (is_school_admin, my_school_id)
-- and 020 (schools.faculty_headcount). Run in the Supabase SQL editor.

begin;

create or replace function public.culture_scan_aggregates(p_survey uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  MIN_COMPLETE constant int := 5;          -- never describe fewer than 5 people
  PARTICIPATION constant numeric := 0.6;   -- 60% of the roster, when every respondent is real
  v_school uuid;
  v_closes timestamptz;
  v_headcount int;
  v_total int;
  v_demo int;
  v_n int;
  v_required int;
  v_means jsonb;
  v_sds jsonb;
  v_corr jsonb;
begin
  if not public.is_school_admin() then
    raise exception 'culture_scan_aggregates: admin only' using errcode = '42501';
  end if;

  select s.school_id, s.closes_at into v_school, v_closes from public.surveys s where s.id = p_survey;
  -- Unknown survey and another school's survey get the same answer, so the function reveals nothing about either.
  if v_school is null or v_school is distinct from public.my_school_id() then
    raise exception 'culture_scan_aggregates: not allowed' using errcode = '42501';
  end if;

  if v_closes is null or v_closes > now() then
    return jsonb_build_object('status', 'not-closed', 'closes_at', v_closes);
  end if;

  -- One row per respondent: the mean of their answers in each dimension (only active items count). Partial answers would
  -- bias the table, so only complete respondents (an answer in all four dimensions) go into the figures.
  with resp as (
    select r.respondent,
           bool_or(r.synthetic) as demo,
           avg(r.scored_value::float8) filter (where i.dimension::text = 'structural') as structural,
           avg(r.scored_value::float8) filter (where i.dimension::text = 'relational') as relational,
           avg(r.scored_value::float8) filter (where i.dimension::text = 'cognitive')  as cognitive,
           avg(r.scored_value::float8) filter (where i.dimension::text = 'efficacy')   as efficacy
      from public.survey_responses r
      join public.survey_items i on i.id = r.item_id and i.active
     where r.survey_id = p_survey
     group by r.respondent
  ),
  cmp as (
    select * from resp
     where structural is not null and relational is not null and cognitive is not null and efficacy is not null
  )
  select (select count(*) from resp),
         (select count(*) from resp where demo),
         (select count(*) from cmp),
         (select jsonb_build_object('structural', avg(structural), 'relational', avg(relational),
                                    'cognitive', avg(cognitive), 'efficacy', avg(efficacy)) from cmp),
         (select jsonb_build_object('structural', stddev_samp(structural), 'relational', stddev_samp(relational),
                                    'cognitive', stddev_samp(cognitive), 'efficacy', stddev_samp(efficacy)) from cmp),
         (select jsonb_build_array(
            jsonb_build_array(1, corr(structural, relational), corr(structural, cognitive), corr(structural, efficacy)),
            jsonb_build_array(corr(relational, structural), 1, corr(relational, cognitive), corr(relational, efficacy)),
            jsonb_build_array(corr(cognitive, structural), corr(cognitive, relational), 1, corr(cognitive, efficacy)),
            jsonb_build_array(corr(efficacy, structural), corr(efficacy, relational), corr(efficacy, cognitive), 1)) from cmp)
    into v_total, v_demo, v_n, v_means, v_sds, v_corr;

  if v_total = 0 then
    return jsonb_build_object('status', 'no-data');
  end if;

  if v_n < MIN_COMPLETE then
    return jsonb_build_object('status', 'below-floor', 'reason', 'floor', 'n', v_n, 'floor', MIN_COMPLETE);
  end if;

  if v_demo = 0 then
    select sc.faculty_headcount into v_headcount from public.schools sc where sc.id = v_school;
    if v_headcount is null or v_headcount < 1 then
      return jsonb_build_object('status', 'below-floor', 'reason', 'no-headcount', 'n', v_n, 'floor', 0);
    end if;
    v_required := ceil(v_headcount * PARTICIPATION)::int;
    if v_n < v_required then
      return jsonb_build_object('status', 'below-floor', 'reason', 'participation', 'n', v_n, 'floor', v_required);
    end if;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'n', v_n,
    'dropped', v_total - v_n,
    'demo_n', v_demo,
    'means', v_means,
    'sds', v_sds,
    'correlation', v_corr
  );
end;
$$;

revoke all on function public.culture_scan_aggregates(uuid) from public, anon;
grant execute on function public.culture_scan_aggregates(uuid) to authenticated;

-- Close the survey: from now on its results can be released. Admin of the survey's school only. Nothing is deleted.
create or replace function public.close_culture_scan(p_survey uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_school uuid;
  v_closes timestamptz;
begin
  if not public.is_school_admin() then
    raise exception 'close_culture_scan: admin only' using errcode = '42501';
  end if;
  select s.school_id, s.closes_at into v_school, v_closes from public.surveys s where s.id = p_survey;
  if v_school is null or v_school is distinct from public.my_school_id() then
    raise exception 'close_culture_scan: not allowed' using errcode = '42501';
  end if;
  if v_closes is not null and v_closes <= now() then
    return v_closes; -- already closed: keep the original close time
  end if;
  update public.surveys set closes_at = now() where id = p_survey returning closes_at into v_closes;
  return v_closes;
end;
$$;

revoke all on function public.close_culture_scan(uuid) from public, anon;
grant execute on function public.close_culture_scan(uuid) to authenticated;

-- ------------------------------------------------------------ self-test

do $$
declare anon_open int; not_definer int;
begin
  select count(*) into anon_open from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('culture_scan_aggregates', 'close_culture_scan')
     and (has_function_privilege('anon', p.oid, 'execute') or p.proacl is null);
  select count(*) into not_definer from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('culture_scan_aggregates', 'close_culture_scan') and not p.prosecdef;
  if anon_open > 0 or not_definer > 0 then
    raise exception '023: functions callable without signing in %, not security definer %', anon_open, not_definer;
  end if;
  raise notice '023: OK: only a signed-in administrator can read the aggregate, and it releases results only after close';
end $$;

commit;

notify pgrst, 'reload schema';
