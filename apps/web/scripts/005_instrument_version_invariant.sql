-- 005_instrument_version_invariant.sql
--
-- Enforce: every survey_items row with active = true shares one instrument_version.
--
-- WHY THIS EXISTS
-- survey_items is a global bank with no survey_id and no school_id. A survey's
-- item set is resolved as "active and instrument_version = N". The survey flow
-- filters on active alone, derives its sections from the distinct dimensions it
-- gets back, and renders "Section X of N" from that count. So the moment a v3
-- is seeded before v2 is deactivated, active spans two versions, the section
-- count inflates, and a teacher is told "Section 4 of 6" and then hits the end
-- of the survey at 4. Aggregates would silently mix versions too.
--
-- WHY A CONSTRAINT TRIGGER AND NOT A PARTIAL UNIQUE INDEX
-- A unique index expresses "at most one row per key". The invariant here is
-- "at most one DISTINCT VALUE across a set of rows", which is a different
-- shape: v2 legitimately has 26 active rows. No index can say that.
--
-- WHY NOT A COMPANION TABLE
-- A one-row active_instrument table plus a foreign key would also work, and it
-- makes "which version is live" explicit. Rejected because it adds a table that
-- the app would eventually want to read, which means a new RLS policy and new
-- anon-readable surface. The whole point of this migration is that active = true
-- stays sufficient on its own. A trigger enforces the same rule while exposing
-- nothing new.
--
-- DEFERRABLE INITIALLY DEFERRED is the load-bearing detail: the legitimate v2
-- to v3 swap is two UPDATEs, and between them the table is momentarily invalid.
-- Deferring to COMMIT lets the swap be one atomic transaction in any order.
--
-- Existing rows are NOT validated by a trigger, so the DO block below rejects
-- an already-dirty table rather than locking in a violation.

do $$
declare
  active_versions int;
begin
  select count(distinct instrument_version)
    into active_versions
    from public.survey_items
   where active;

  if active_versions > 1 then
    raise exception
      'survey_items already violates the invariant: % distinct instrument_version values are active. Deactivate all but one, then re-run this migration.',
      active_versions;
  end if;
end;
$$;

create or replace function public.survey_items_single_active_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  active_versions int;
begin
  select count(distinct instrument_version)
    into active_versions
    from public.survey_items
   where active;

  if active_versions > 1 then
    raise exception
      'survey_items: % distinct instrument_version values are active; exactly one instrument version may be active at a time',
      active_versions
      using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke execute on function public.survey_items_single_active_version() from public;
revoke execute on function public.survey_items_single_active_version() from anon;
revoke execute on function public.survey_items_single_active_version() from authenticated;

drop trigger if exists survey_items_single_active_version on public.survey_items;

create constraint trigger survey_items_single_active_version
  after insert or update on public.survey_items
  deferrable initially deferred
  for each row
  execute function public.survey_items_single_active_version();
