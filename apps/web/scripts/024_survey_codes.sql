-- 024_survey_codes.sql
--
-- One-time survey codes (Nick, Oct 29: "the only option that keeps both anonymity and one-vote integrity").
--
-- The school lead makes a batch of codes and hands one to each teacher (printed, or by a message that is not tied to the
-- survey). A teacher types the code, answers, and submits. The database then, in one step:
--   1. checks the code is real, unused and belongs to an open survey, and marks it used;
--   2. stores the answers against a FRESH random id that is not derived from the code or from the person.
-- So nothing stored links a code to a respondent, a login, a time or an address. The only record of a code is a scrambled
-- (SHA-256) copy plus "used or not". Nobody, including the school lead and us, can say who gave which answers, and nobody
-- can vote twice or without a code.
--
--   issue_survey_codes(survey, count)   admin only: make 1 to 200 codes, shown once, never stored in the clear
--   survey_code_ok(code)                anyone: is this code usable right now? (lets the page say so before the 26 questions)
--   submit_survey(code, answers)        anyone with a code: the only way to submit an answer once 025 is applied
--
-- 024 only ADDS. The old open survey link keeps working until 025_close_anon_insert.sql is run, and that should happen only
-- after the new survey page is deployed everywhere (Nick's pilot site included), or the old page will stop saving.
-- Safe to run again. Ends with a self-test. Needs survey_is_open (004), surveys and survey_items; 022 and 023 are not required.
-- Run in the Supabase SQL editor.

begin;

create table if not exists public.survey_codes (
  code_hash text primary key,
  survey_id uuid not null references public.surveys (id) on delete cascade,
  used boolean not null default false
);

alter table public.survey_codes enable row level security;
-- No policy and no grant: nobody reads or writes this table directly, only the three functions below (they run as the owner).
revoke all on public.survey_codes from public, anon, authenticated;

-- ------------------------------------------------------------ make codes (admin only)

create or replace function public.issue_survey_codes(p_survey uuid, p_count int)
returns text[]
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_school uuid;
  v_closes timestamptz;
  v_codes text[] := '{}';
  v_code text;
  v_hash text;
  v_h text;
  i int;
begin
  if not public.is_school_admin() then
    raise exception 'issue_survey_codes: admin only' using errcode = '42501';
  end if;
  select s.school_id, s.closes_at into v_school, v_closes from public.surveys s where s.id = p_survey;
  if v_school is null or v_school is distinct from public.my_school_id() then
    raise exception 'issue_survey_codes: not allowed' using errcode = '42501';
  end if;
  if p_count is null or p_count < 1 or p_count > 200 then
    raise exception 'issue_survey_codes: ask for between 1 and 200 codes' using errcode = '22023';
  end if;
  if v_closes is not null and v_closes <= now() then
    raise exception 'issue_survey_codes: the survey is closed' using errcode = '22023';
  end if;

  for i in 1 .. p_count loop
    loop
      -- 16 random hex characters (64 bits) from a v4 uuid, skipping its two fixed positions (version and variant).
      v_h := replace(gen_random_uuid()::text, '-', '');
      v_code := upper(substr(v_h, 1, 12) || substr(v_h, 21, 4));
      v_hash := encode(sha256(convert_to(v_code, 'UTF8')), 'hex');
      exit when not exists (select 1 from public.survey_codes c where c.code_hash = v_hash);
    end loop;
    insert into public.survey_codes (code_hash, survey_id) values (v_hash, p_survey);
    v_codes := v_codes || (substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4) || '-' || substr(v_code, 9, 4) || '-' || substr(v_code, 13, 4));
  end loop;
  return v_codes;
end;
$$;

revoke all on function public.issue_survey_codes(uuid, int) from public, anon;
grant execute on function public.issue_survey_codes(uuid, int) to authenticated;

-- ------------------------------------------------------------ is this code usable? (public)

create or replace function public.survey_code_ok(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.survey_codes c
     where c.code_hash = encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g')), 'UTF8')), 'hex')
       and not c.used
       and public.survey_is_open(c.survey_id)
  );
$$;

revoke all on function public.survey_code_ok(text) from public;
grant execute on function public.survey_code_ok(text) to anon, authenticated;

-- ------------------------------------------------------------ submit (public, needs a code)

create or replace function public.submit_survey(p_code text, p_answers jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text := encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g')), 'UTF8')), 'hex');
  v_sid uuid;
  v_school uuid;
  v_respondent uuid := gen_random_uuid();  -- fresh and random: not derived from the code, the login or anything else
  v_active int;
  v_given int;
  v_bad int;
begin
  -- Lock the code row so two submissions with the same code cannot both pass.
  select c.survey_id into v_sid from public.survey_codes c where c.code_hash = v_hash and not c.used for update;
  if not found then
    -- Unknown and already-used codes get the same answer on purpose.
    raise exception 'That code is not valid, or it has already been used.' using errcode = 'P0001';
  end if;
  if not public.survey_is_open(v_sid) then
    raise exception 'This survey is closed.' using errcode = 'P0001';
  end if;
  select s.school_id into v_school from public.surveys s where s.id = v_sid;
  if v_school is null then
    raise exception 'This survey has no school.' using errcode = 'P0001';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Every question needs an answer.' using errcode = '22023';
  end if;
  select count(*) into v_active from public.survey_items i where i.active;
  select count(*) into v_given from jsonb_object_keys(p_answers);
  select count(*) into v_bad
    from public.survey_items i
   where i.active
     and not (
       coalesce(p_answers ->> i.id::text, '') ~ '^[0-9]{1,2}$'
       and (case when coalesce(p_answers ->> i.id::text, '') ~ '^[0-9]{1,2}$' then (p_answers ->> i.id::text)::int else -1 end)
           between i.scale_min and i.scale_max
     );
  if v_bad > 0 or v_given <> v_active then
    raise exception 'Every question needs an answer.' using errcode = '22023';
  end if;

  insert into public.survey_responses (survey_id, school_id, respondent, item_id, raw_value, scored_value, synthetic)
  select v_sid, v_school, v_respondent, a.id, a.raw,
         case when a.reverse then a.scale_min + a.scale_max - a.raw else a.raw end,
         false
    from (
      select i.id, i.reverse, i.scale_min, i.scale_max, (p_answers ->> i.id::text)::int as raw
        from public.survey_items i
       where i.active
    ) a;

  update public.survey_codes set used = true where code_hash = v_hash;
end;
$$;

revoke all on function public.submit_survey(text, jsonb) from public;
grant execute on function public.submit_survey(text, jsonb) to anon, authenticated;

-- ------------------------------------------------------------ self-test

do $$
declare cols text; grants int; pols int; admin_open int; public_ok int;
begin
  select string_agg(column_name, ',' order by column_name) into cols
    from information_schema.columns where table_schema = 'public' and table_name = 'survey_codes';
  select count(*) into grants from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'survey_codes' and grantee in ('anon', 'authenticated', 'PUBLIC');
  select count(*) into pols from pg_policies where schemaname = 'public' and tablename = 'survey_codes';
  select count(*) into admin_open from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'issue_survey_codes'
     and (has_function_privilege('anon', p.oid, 'execute') or p.proacl is null);
  select count(*) into public_ok from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('submit_survey', 'survey_code_ok')
     and p.prosecdef and has_function_privilege('anon', p.oid, 'execute');
  if cols <> 'code_hash,survey_id,used' then
    raise exception '024: survey_codes must hold only code_hash, survey_id and used, found %', cols;
  end if;
  if grants > 0 or pols > 0 or admin_open > 0 or public_ok <> 2 then
    raise exception '024: table grants % (want 0), policies % (want 0), issue_survey_codes open to anon % (want 0), public survey functions % (want 2)',
      grants, pols, admin_open, public_ok;
  end if;
  raise notice '024: OK: codes are stored scrambled, never linked to an answer, a person or a time; only the three functions can touch them';
end $$;

commit;

notify pgrst, 'reload schema';
