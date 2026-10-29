-- 020_school_headcount.sql
--
-- A faculty headcount on the school record, so the Culture Scan's participation gate has something to measure 60% of.
-- Nick, Oct 29: "Yes, add a faculty headcount to the school record. The 60% gate needs that denominator to mean anything."
--
-- WRITTEN, NOT YET APPLIED. Adds one nullable column; no existing row or policy changes. Until a school has a number the
-- report stays closed for that school once its data is all real (demo data is labelled demo and is not gated), and the
-- report page says exactly that. Set it once per school, from the SQL editor or the service role, for example:
--
--     update public.schools set faculty_headcount = 50 where id = '<school id>';
--
-- The report engine reads it on the service key it already uses; no new access path is opened.

begin;

alter table public.schools add column if not exists faculty_headcount integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'schools_faculty_headcount_positive') then
    alter table public.schools add constraint schools_faculty_headcount_positive check (faculty_headcount is null or faculty_headcount > 0);
  end if;
end $$;

comment on column public.schools.faculty_headcount is 'Number of teachers on the school roster. The Culture Scan opens when 60% of this many real responses are in.';

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'schools' and column_name = 'faculty_headcount') then
    raise exception '020: faculty_headcount was not added';
  end if;
  raise notice '020: OK: schools.faculty_headcount added';
end $$;

commit;

-- After applying: reload PostgREST's schema cache (see CLAUDE.md): notify pgrst, 'reload schema';
