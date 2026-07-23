-- Fix stale surveys.item_ids and make a survey's item set explicit.
-- Run in the Supabase SQL editor.
--
-- Why: surveys.item_ids is integer[], but survey_items.id is uuid — the column
-- can never hold a valid item reference. It is a leftover from an earlier schema
-- where items had integer ids. Current contents: [0,1,2,3,4,5,6,7] (8 ints, while
-- 26 items exist). Nothing reads it; the taking flow and the report engine both
-- resolve items straight from survey_items.
--
-- survey_items is a global bank with no survey_id, scoped only by
-- instrument_version + active. So "which items belong to this survey" is
-- currently implicit ("all active ones"), which breaks as soon as a v3 instrument
-- is seeded: report aggregates would silently mix instrument versions.
-- Pinning the version on the survey makes that impossible.

alter table public.surveys
  drop column if exists item_ids;

alter table public.surveys
  add column if not exists instrument_version int not null default 2;

-- Existing Culture Scan survey runs the v2 social-capital instrument.
update public.surveys
   set instrument_version = 2
 where id = 'ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f';

-- From here on, item resolution is:
--   select * from survey_items
--    where active and instrument_version = <surveys.instrument_version>
--    order by position;

-- Not changed here, but note: surveys.status is still 'draft' even though the
-- survey is live and has been taken. Flip it when you decide what status should
-- gate (it currently gates nothing in code):
--   update public.surveys set status = 'open' where id = 'ec3b0a3a-...';
