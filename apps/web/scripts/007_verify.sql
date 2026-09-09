-- 007 verification. Run AFTER the migration commits. SELECT only.

-- 1. The 4 live profiles are linked, and nothing else changed.
select id, email, auth_user_id, (auth_user_id = id) as link_ok, role, is_demo
  from public.profiles order by email;
-- expect: 4 rows, link_ok = true on all, role = 'teacher', is_demo = false

-- 2. The UPDATE policy now keys on auth_user_id, and nothing else on profiles
--    still keys on id.
select policyname, cmd, roles::text, qual, with_check
  from pg_policies where schemaname='public' and tablename='profiles'
 order by cmd, policyname;

-- 3. item_ids is gone; the rest of surveys is intact.
select * from public.surveys;

-- 4. The enum exists with all five values, in order.
select enumlabel from pg_enum
 where enumtypid = 'public.concern_domain'::regtype order by enumsortorder;

-- 5. pairings renamed and retyped as intended.
select column_name, data_type, udt_name from information_schema.columns
 where table_schema='public' and table_name='pairings' order by ordinal_position;
-- expect host_id / visitor_id present, teacher_a / teacher_b absent,
--        domain with udt_name = 'concern_domain'

-- 6. conversation_logs has the full field map.
select column_name, data_type, udt_name from information_schema.columns
 where table_schema='public' and table_name='conversation_logs' order by ordinal_position;

-- 7. Nothing was done to the instrument.
select count(*) as items, count(*) filter (where active) as active,
       count(distinct instrument_version) as versions from public.survey_items;
-- expect 26 / 26 / 1
