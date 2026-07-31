-- 006_position_unique_per_version.sql
--
-- Replace the global UNIQUE(position) on survey_items with UNIQUE(instrument_version, position).
--
-- WHY THIS EXISTS
-- survey_items ships with survey_items_position_key, a unique constraint on
-- position alone. position is presentation order within one instrument, not an
-- identity: v2 has positions 1..26, and a v3 would too. A global unique means
-- two instrument versions can never coexist as rows, so seeding v3 fails on the
-- first insert.
--
-- That makes 005 guard a state the schema cannot reach. 005 enforces "at most
-- one active instrument_version" and is DEFERRABLE precisely so the v2-to-v3
-- swap can be one transaction — but the swap needs both versions present at the
-- same time, which this constraint forbids. 006 is what makes 005's deferral
-- mean something.
--
-- WHY THE PAIR IS SAFE
-- Relaxing to (instrument_version, position) does NOT make ordering ambiguous.
-- Every reader filters active = true first, and 005 guarantees the active set is
-- a single instrument_version, so position stays unique within it and
-- "order by position" remains a total order. Applying 006 without 005 would
-- reintroduce exactly the interleaving 005 exists to prevent. Apply 005 first.
--
-- NOTHING KEYS OFF POSITION
-- Audited before writing this: report scoring (src/lib/report/stats.ts) joins
-- survey_responses.item_id to survey_items.id and reads dimension/reverse off
-- the matched row. The survey flow (src/app/survey/page.tsx) keys answers by
-- item.id and inserts item_id. position is used only for ORDER BY and for
-- deriving section order from the dimension sequence. No lookup treats it as an
-- identifier.
--
-- If DROP CONSTRAINT fails with a dependency error, something references this
-- constraint by name -- most likely a foreign key. Resolve that first; do not
-- force it.

do $$
declare
  dupes int;
begin
  select count(*)
    into dupes
    from (
      select instrument_version, position
        from public.survey_items
       group by instrument_version, position
      having count(*) > 1
    ) d;

  if dupes > 0 then
    raise exception
      'survey_items has % (instrument_version, position) pair(s) already duplicated; resolve them before narrowing the constraint',
      dupes;
  end if;
end;
$$;

alter table public.survey_items
  drop constraint if exists survey_items_position_key;

drop index if exists public.survey_items_position_key;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.survey_items'::regclass
       and conname = 'survey_items_instrument_version_position_key'
  ) then
    alter table public.survey_items
      add constraint survey_items_instrument_version_position_key
      unique (instrument_version, position);
  end if;
end;
$$;
