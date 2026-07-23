-- Culture Scan report engine: separate synthetic demo rows from real submissions.
-- Run in the Supabase SQL editor.

alter table public.survey_responses
  add column if not exists synthetic boolean not null default false;

-- Report queries always filter on (survey_id, synthetic).
create index if not exists survey_responses_survey_synthetic_idx
  on public.survey_responses (survey_id, synthetic);

-- Optional hardening: stop real (authenticated) submissions from ever marking
-- themselves synthetic. Only service_role should be able to write synthetic = true.
-- Replace <policy_name> with the existing insert policy on survey_responses:
--
--   alter policy "<policy_name>" on public.survey_responses
--     with check (respondent <> auth.uid() and synthetic = false);
