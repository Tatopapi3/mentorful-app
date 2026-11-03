-- smoke_test_privacy.sql
--
-- Proves the privacy scripts (022, 023, 024) work on THIS database, end to end, without leaving a trace. It runs the whole flow
-- on a throwaway survey inside one transaction and then ROLLS BACK, so nothing is saved: no survey, no code, no answer. Nick's
-- real survey and its 56 respondents are never touched, and nothing here can close it.
--
-- What it does, in order, as the real roles (the school lead, then a visitor who is not signed in):
--   1. makes a throwaway survey that is still open
--   2. the school lead asks for the results            -> must be held back ("not-closed")
--   3. the school lead makes two one-time codes        -> two codes, stored only scrambled
--   4. a visitor (not signed in) checks and uses a code -> saved under a random id, 26 answers
--   5. the same code again, and a made-up code         -> both refused with the same message
--   6. an incomplete answer sheet                      -> refused, the other code still usable
--   7. the school lead closes the throwaway survey and asks again -> held back for too few people (1 is below 5)
--   8. a visitor tries to call a helper function and the report function -> refused
--   9. reports whether the old open insert is still there (it goes away when 025 is run)
--
-- Paste the whole file into the Supabase SQL editor and run it. Success is the last message: "SMOKE TEST PASSED". Any failure
-- stops with a plain "FAIL: ..." line. Either way the transaction is rolled back.
-- Needs 022, 023 and 024 applied, and at least one administrator who has signed in once (that is the school lead it acts as).

begin;

do $$
declare
  v_admin uuid;
  v_school uuid;
  v_sid uuid := gen_random_uuid();
  v_codes text[];
  v_answers jsonb;
  v_partial jsonb;
  v_res jsonb;
  v_msg1 text;
  v_msg2 text;
  v_n int;
  v_ok boolean;
  v_hash_len int;
begin
  select p.auth_user_id, p.school_id into v_admin, v_school
    from public.profiles p
   where p.role = 'admin' and p.auth_user_id is not null and p.school_id is not null
   order by p.id
   limit 1;
  if v_admin is null then
    raise exception 'FAIL: no administrator has signed in yet, so there is nobody to act as. Sign in once as the school lead, then run this again.';
  end if;

  -- 1. a throwaway, still-open survey for the school lead's school
  insert into public.surveys (id, school_id, name, closes_at) values (v_sid, v_school, 'SMOKE TEST (rolled back)', null);

  select jsonb_object_agg(i.id::text, 1 + (i.position % 6)) into v_answers from public.survey_items i where i.active;
  v_partial := v_answers - (select i.id::text from public.survey_items i where i.active order by i.position limit 1);
  select count(*) into v_n from public.survey_items where active;
  raise notice 'info: % active questions', v_n;

  -- act as the school lead
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;

  -- 2. results are held while the survey is open
  v_res := public.culture_scan_aggregates(v_sid);
  if v_res ->> 'status' is distinct from 'not-closed' then
    raise exception 'FAIL: results were not held back on an open survey: %', v_res;
  end if;
  raise notice 'PASS 2: results are held back while the survey is open';

  -- 3. two codes
  v_codes := public.issue_survey_codes(v_sid, 2);
  if coalesce(array_length(v_codes, 1), 0) <> 2 or v_codes[1] !~ '^[0-9A-F]{4}(-[0-9A-F]{4}){3}$' then
    raise exception 'FAIL: expected two codes in the form XXXX-XXXX-XXXX-XXXX, got %', v_codes;
  end if;
  raise notice 'PASS 3: the school lead made two codes';

  -- 4. a visitor who is not signed in uses a code
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  select public.survey_code_ok(v_codes[1]) into v_ok;
  if not v_ok then raise exception 'FAIL: a fresh code was not accepted'; end if;
  perform public.submit_survey(v_codes[1], v_answers);
  select public.survey_code_ok(v_codes[1]) into v_ok;
  if v_ok then raise exception 'FAIL: a used code still looks usable'; end if;
  raise notice 'PASS 4: a visitor used a code and it is used up';

  -- 5. the same code again, and a made-up one, get the same refusal
  begin
    perform public.submit_survey(v_codes[1], v_answers);
    raise exception 'FAIL: a used code was accepted twice';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    v_msg1 := sqlerrm;
  end;
  begin
    perform public.submit_survey('FFFF-FFFF-FFFF-FFFF', v_answers);
    raise exception 'FAIL: a made-up code was accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    v_msg2 := sqlerrm;
  end;
  if v_msg1 is distinct from v_msg2 then
    raise exception 'FAIL: a used code and an unknown code get different answers (%, %)', v_msg1, v_msg2;
  end if;
  raise notice 'PASS 5: used and unknown codes are refused with the same message';

  -- 6. an incomplete sheet is refused and the second code is still good
  begin
    perform public.submit_survey(v_codes[2], v_partial);
    raise exception 'FAIL: an incomplete answer sheet was accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  select public.survey_code_ok(v_codes[2]) into v_ok;
  if not v_ok then raise exception 'FAIL: a refused sheet used up the code'; end if;
  raise notice 'PASS 6: an incomplete sheet is refused and the code stays usable';

  -- 8 (while still a visitor). helper functions and the report function are closed
  begin
    perform public.is_admin();
    raise exception 'FAIL: a visitor can still call is_admin()';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.culture_scan_aggregates(v_sid);
    raise exception 'FAIL: a visitor can call the report function';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 8: a visitor cannot call the helper functions or the report function';

  -- back to the owner to look at what was stored
  reset role;
  select count(*) into v_n from public.survey_responses where survey_id = v_sid;
  if v_n <> (select count(*) from public.survey_items where active) then
    raise exception 'FAIL: expected one answer per active question, found %', v_n;
  end if;
  if (select count(distinct respondent) from public.survey_responses where survey_id = v_sid) <> 1 then
    raise exception 'FAIL: one submission produced more than one respondent id';
  end if;
  if exists (select 1 from public.survey_responses where survey_id = v_sid and synthetic) then
    raise exception 'FAIL: a submitted answer was marked as demo data';
  end if;
  select min(length(code_hash)) into v_hash_len from public.survey_codes where survey_id = v_sid;
  if v_hash_len <> 64 or exists (select 1 from public.survey_codes c where c.survey_id = v_sid and (c.code_hash = any (v_codes) or c.code_hash = any (select replace(x, '-', '') from unnest(v_codes) x))) then
    raise exception 'FAIL: a code is stored in the clear';
  end if;
  raise notice 'PASS 4b: 26 answers under one random respondent id, none marked demo, codes stored only as 64-character hashes';

  -- 7. the school lead closes it and asks again: one respondent is below the floor of five
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  perform public.close_culture_scan(v_sid);
  v_res := public.culture_scan_aggregates(v_sid);
  if v_res ->> 'status' is distinct from 'below-floor' or (v_res ->> 'n')::int <> 1 then
    raise exception 'FAIL: expected "below-floor" with 1 respondent after closing, got %', v_res;
  end if;
  raise notice 'PASS 7: closing releases the decision, and 1 respondent is still below the floor of 5';

  reset role;
  perform set_config('request.jwt.claim.sub', '', true);

  -- 9. is the old open insert still there?
  select exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'survey_responses' and cmd in ('INSERT', 'ALL') and roles && array['anon', 'authenticated', 'public']::name[]
  ) into v_ok;
  if v_ok then
    raise notice 'info 9: the old open insert on survey_responses is STILL there (normal until 025_close_anon_insert.sql is run)';
  else
    raise notice 'PASS 9: no open insert on survey_responses: an answer needs a code';
  end if;

  raise notice 'SMOKE TEST PASSED. Nothing was saved: the transaction is rolled back below.';
end $$;

rollback;
