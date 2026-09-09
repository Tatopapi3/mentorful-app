-- 008_dimension_enum.sql
--
-- Convert survey_items.dimension from text to a culture_dimension enum.
--
-- WHY THIS IS ITS OWN MIGRATION
-- 007 created concern_domain (axis B) on tables that were empty. This is axis A
-- on a LIVE 26-row table that also carries the 005 constraint trigger and an
-- existing CHECK constraint. Nothing here is difficult, but it is the only
-- change in the file, so a failure is unambiguous.
--
-- WHY AN ENUM AT ALL
-- Both measurement axes now live in one database. Four values each,
-- near-synonymous English names, both previously text. A CHECK catches a bad
-- VALUE; a distinct TYPE catches a bad COLUMN. After this migration,
-- `set dimension = 'CLASSROOM'` is a type error at the point of the mistake,
-- and a query that UNIONs the two axes fails outright rather than returning a
-- plausible-looking blend.
--
-- *** LIVE TABLE: survey_items, 26 rows ***
-- Current values (verified 2026-09-06): structural 6, relational 9,
-- cognitive 6, efficacy 5. All 26 active, all instrument_version 2.
--
-- THE 005 TRIGGER
-- ALTER COLUMN ... TYPE rewrites the table but does NOT fire user-defined row
-- triggers, so survey_items_single_active_version should not run at all. Even
-- if it did, it is DEFERRABLE INITIALLY DEFERRED and the invariant holds
-- throughout (one distinct instrument_version across the active set), so it
-- would pass at COMMIT. Both paths are safe; this note exists so that if it
-- DOES fire, you know it was expected to be harmless rather than a surprise.
--
-- AFTER RUNNING: `npm run items:verify` must still print
--   d9ca364b4feae67af90ab764bd5ed1ef5cfb71f3618dad5a3797eb28b517843d
-- The hash covers dimension as a VALUE, not as a column type, and PostgREST
-- returns an enum as a plain string -- so the digest should be unchanged.
-- That is a prediction. Check it; do not assume it.

begin;

-- ---------------------------------------------------------------------------
-- 1. PRECONDITIONS.
-- ---------------------------------------------------------------------------

do $$
declare
  n_items    int;
  n_bad      int;
  bad_values text;
  blockers   text;
begin
  select count(*) into n_items from public.survey_items;
  if n_items <> 26 then
    raise notice '008: survey_items has % rows, expected 26. Not fatal, but confirm this is intended.', n_items;
  end if;

  -- Any value outside the four would abort the USING cast mid-rewrite.
  -- Name them now instead of reading a bare cast error.
  select count(*), string_agg(distinct dimension, ', ')
    into n_bad, bad_values
    from public.survey_items
   where dimension is null
      or dimension not in ('structural', 'relational', 'cognitive', 'efficacy');

  if n_bad > 0 then
    raise exception
      '008: % survey_items row(s) hold a dimension outside the four: %. '
      'The enum cast would fail. Fix the data first.', n_bad, coalesce(bad_values, '<null>');
  end if;

  -- An RLS policy or view referencing the column blocks ALTER COLUMN TYPE.
  -- The known policy ("demo anon read active survey items", from 003) filters
  -- on `active` only, so this should come back empty.
  select string_agg(policyname, ', ') into blockers
    from pg_policies
   where schemaname = 'public' and tablename = 'survey_items'
     and (coalesce(qual, '') like '%dimension%' or coalesce(with_check, '') like '%dimension%');

  if blockers is not null then
    raise exception
      '008: RLS policy(ies) reference survey_items.dimension: %. '
      'Drop and recreate them around this migration.', blockers;
  end if;

  raise notice '008: preconditions OK -- % rows, all four dimension values valid', n_items;
end $$;

-- ---------------------------------------------------------------------------
-- 2. The type. Mirrors concern_domain from 007.
--    Value order matters for ORDER BY on the enum: this is the instrument's
--    own dimension order (structural -> relational -> cognitive -> efficacy),
--    which is also the section order the survey renders. Sorting by the enum
--    now yields the presentation order for free.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'culture_dimension') then
    create type public.culture_dimension as enum (
      'structural', 'relational', 'cognitive', 'efficacy'
    );
  end if;
end $$;

comment on type public.culture_dimension is
  'Axis A: the four social-capital dimensions of the Culture Scan. School-level, '
  'anonymized, admin product, lagging indicator. NEVER conflate with '
  'concern_domain (axis B: Domains of Concern, pair-private, leading). Distinct '
  'types exist so a mix-up is a type error. Keep the value sets disjoint.';

-- ---------------------------------------------------------------------------
-- 3. Drop the superseded CHECK, then retype.
--    The CHECK's name was never recorded, so find it rather than guess: any
--    CHECK on this table whose definition mentions the column. Each one is
--    echoed before it goes, so the old rule is in the run log if you need it.
-- ---------------------------------------------------------------------------

do $$
declare
  con record;
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'survey_items'
                and column_name = 'dimension' and data_type = 'text') then

    for con in
      select conname, pg_get_constraintdef(oid) as def
        from pg_constraint
       where conrelid = 'public.survey_items'::regclass
         and contype  = 'c'
         and pg_get_constraintdef(oid) ilike '%dimension%'
    loop
      raise notice '008: dropping superseded CHECK % -- was: %', con.conname, con.def;
      execute format('alter table public.survey_items drop constraint %I', con.conname);
    end loop;

    alter table public.survey_items
      alter column dimension type public.culture_dimension
      using dimension::public.culture_dimension;

    raise notice '008: survey_items.dimension is now public.culture_dimension';
  else
    raise notice '008: survey_items.dimension is already non-text; nothing to do';
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- VERIFY (read-only; run after the commit)
-- ---------------------------------------------------------------------------
-- select enumlabel from pg_enum
--  where enumtypid = 'public.culture_dimension'::regtype order by enumsortorder;
-- -- expect: structural, relational, cognitive, efficacy
--
-- select column_name, data_type, udt_name from information_schema.columns
--  where table_schema='public' and table_name='survey_items' and column_name='dimension';
-- -- expect: USER-DEFINED / culture_dimension
--
-- select dimension, count(*) from public.survey_items group by 1 order by 1;
-- -- expect: cognitive 6, efficacy 5, relational 9, structural 6
--
-- select count(*) as items, count(*) filter (where active) as active,
--        count(distinct instrument_version) as versions from public.survey_items;
-- -- expect: 26 / 26 / 1
--
-- THEN, in the shell:
--   npm run items:verify
-- -- expect hash d9ca364b4feae67af90ab764bd5ed1ef5cfb71f3618dad5a3797eb28b517843d
-- -- If it differs, STOP: either the retype altered a value, or the canonical
-- -- encoding treats the enum differently than text. A wave-1 -> wave-2 delta
-- -- is invalid until this reads d9ca364b again.
