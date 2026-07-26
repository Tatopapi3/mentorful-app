-- 004 — Fix the anon submit guard from 003. Run in the Supabase SQL editor.
--
-- Bug in 003: the INSERT policy's WITH CHECK contained
--     exists (select 1 from public.surveys s where s.id = survey_id ...)
-- That subquery runs AS THE ANON ROLE, and anon has no SELECT policy on
-- `surveys`, so it always returned false — rejecting EVERY anonymous insert,
-- valid or not. (survey_items works because 003 granted anon SELECT on it.)
--
-- Fix: check "the survey exists and is not closed" via a SECURITY DEFINER
-- function, which runs as its owner and bypasses RLS on `surveys` — so anon can
-- evaluate it without our having to expose the whole surveys table. This keeps
-- the "valid, active survey" guard intact.

-- 1. Owner-privileged check: does this survey exist and is it still open?
create or replace function public.survey_is_open(sid uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.surveys s
     where s.id = sid
       and (s.closes_at is null or s.closes_at > now())
  );
$$;

grant execute on function public.survey_is_open(uuid) to anon, authenticated;

-- 2. Replace the broken INSERT policy with one that uses the function.
--    survey_items is still checked inline (anon CAN read it via 003), and the
--    survey_id / item_id foreign keys independently reject any bogus ids.
drop policy if exists "demo anon submit survey responses" on public.survey_responses;

create policy "demo anon submit survey responses"
  on public.survey_responses
  for insert
  to anon
  with check (
    respondent is not null
    and (auth.uid() is null or respondent <> auth.uid())   -- anonymity preserved
    and synthetic = false                                  -- can't inject demo rows
    and public.survey_is_open(survey_id)                   -- valid, not-closed survey
    and exists (                                           -- valid, active item
      select 1 from public.survey_items i
       where i.id = item_id and i.active
    )
  );

-- ---------------------------------------------------------------------------
-- REVERT (run before real school data goes live, together with 003's revert)
-- ---------------------------------------------------------------------------
-- drop policy "demo anon submit survey responses" on public.survey_responses;
-- drop function if exists public.survey_is_open(uuid);
