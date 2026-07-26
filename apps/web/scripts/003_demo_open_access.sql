-- 003 — DEMO/PILOT open access. Run in the Supabase SQL editor.
--
-- Opens two RLS holes so principals can view /report and pilot teachers can take
-- /survey with no login. This is deliberate, temporary, and MUST be reverted
-- before any real school's data goes live (see CLAUDE.md "Demo/pilot open access"
-- and the REVERT block at the bottom of this file).

-- ---------------------------------------------------------------------------
-- 1. Let the anon role READ the survey questions.
--    The questions are not sensitive. An RLS denial returns an empty result
--    (not an error), which is exactly what made /survey hang on "Loading…".
-- ---------------------------------------------------------------------------

create policy "demo anon read active survey items"
  on public.survey_items
  for select
  to anon
  using (active);

-- ---------------------------------------------------------------------------
-- 2. Let the anon role SUBMIT responses, with guards — NOT an open write.
--
--    Guards baked into the WITH CHECK:
--      - anonymity preserved: for anon there is no auth.uid(); for a signed-in
--        user the respondent token still may not equal their auth.uid().
--      - must reference a REAL survey that is not closed (blocks garbage
--        survey_ids and submissions to a closed scan).
--      - must reference a REAL, active survey_item (blocks garbage item_ids).
--
--    Not enforceable in RLS (know the limits): row VOLUME. RLS cannot rate-limit,
--    so a determined script could still spam valid rows. The one-submission-per-
--    browser guard is client-side localStorage only and is trivially bypassed.
--    Acceptable for a pilot; tighten (auth, CAPTCHA, or a rate limiter) before
--    real data — see CLAUDE.md.
--
--    If a prior authenticated-only INSERT policy exists, find and drop it first:
--      select policyname from pg_policies
--       where schemaname = 'public' and tablename = 'survey_responses' and cmd = 'INSERT';
--      -- drop policy "<that name>" on public.survey_responses;
-- ---------------------------------------------------------------------------

create policy "demo anon submit survey responses"
  on public.survey_responses
  for insert
  to anon
  with check (
    respondent is not null
    and (auth.uid() is null or respondent <> auth.uid())
    -- a public submitter can never mark rows as synthetic demo data
    and synthetic = false
    and exists (
      select 1 from public.surveys s
       where s.id = survey_id
         and (s.closes_at is null or s.closes_at > now())
    )
    and exists (
      select 1 from public.survey_items i
       where i.id = item_id
         and i.active
    )
  );

-- ---------------------------------------------------------------------------
-- REVERT (run this before real school data goes live)
-- ---------------------------------------------------------------------------
-- drop policy "demo anon read active survey items"   on public.survey_items;
-- drop policy "demo anon submit survey responses"    on public.survey_responses;
