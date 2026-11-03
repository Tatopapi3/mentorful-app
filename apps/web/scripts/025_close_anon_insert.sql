-- 025_close_anon_insert.sql
--
-- The lock. After this, nobody can write a survey answer except through submit_survey(code, answers) from 024, so no answer
-- can be added without a valid one-time code.
--
-- RUN THIS ONLY AFTER the new survey page (with the code step) is live on every site that serves /survey, Nick's pilot site
-- included. The old page writes answers directly, and it stops saving the moment this runs.
--
-- It drops the two INSERT policies on survey_responses (the open "demo anon submit survey responses" from 003/004 and
-- "insert_response" for signed-in users) and takes INSERT, UPDATE and DELETE on that table away from anon and authenticated.
-- Reading is untouched (there is still no read policy: only the aggregate function from 023 reads answers).
--
-- Refuses to run if 024 is not applied. Safe to run again. Ends with a self-test. Run in the Supabase SQL editor.

begin;

do $$
begin
  if to_regprocedure('public.submit_survey(text,jsonb)') is null then
    raise exception '025: run 024_survey_codes.sql first, otherwise nobody could submit the survey';
  end if;
end $$;

drop policy if exists "demo anon submit survey responses" on public.survey_responses;
drop policy if exists insert_response on public.survey_responses;

revoke insert, update, delete on public.survey_responses from anon, authenticated;

-- ------------------------------------------------------------ self-test

do $$
declare ins_pols int; table_grants int;
begin
  select count(*) into ins_pols from pg_policies
   where schemaname = 'public' and tablename = 'survey_responses' and cmd in ('INSERT', 'ALL')
     and (roles && array['anon', 'authenticated', 'public']::name[]);
  select count(*) into table_grants from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'survey_responses'
     and grantee in ('anon', 'authenticated', 'PUBLIC') and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
  if ins_pols > 0 or table_grants > 0 then
    raise exception '025: insert policies still open % (want 0), write grants still open % (want 0)', ins_pols, table_grants;
  end if;
  raise notice '025: OK: a survey answer can only be added with a valid one-time code';
end $$;

commit;

notify pgrst, 'reload schema';
