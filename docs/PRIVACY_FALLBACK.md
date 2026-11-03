# Privacy work: everything we need to finish it without Eric

Eric owns the privacy lane (`docs/HANDOFF_CHECKLIST.md`, section A). This page is the safety net: what we know, where it came
from, and a design for each open item detailed enough that Juan (with Claude) can finish it if no pull request has arrived.
Last checked Nov 2, 2026: no `eric/privacy` branch, no commits and no pull request from Eric on GitHub.

## What Eric and Bernard shared, and what is in it

| Source | What it contains for privacy |
|---|---|
| Slack team-lit, Oct 30 (Eric) | The demo's six "must have" steps. Step 4: "show that privacy is a priority here and that no teacher information gets leaked to the admins." Step 2: simulate the Culture Scan and "mention that it's anonymous." |
| Eric's Google doc "Mentorful Demo" | A user-flow outline only. The one privacy line: "Need to think about how to highlight privacy features." |
| Eric's Claude artifact (Slack, Oct 21) | Only the text "Slides." There is nothing to recover from it. |
| Eric's database and privacy slides | Presented at the Oct 23 midpoint with Nick and Mike. They are not saved anywhere we can read. Ask Eric for the file. |
| Bernard's DM to Juan, Oct 13 (feature tiers) | The "Track 0" invariants: administrators reading conversation logs get zero rows; users in school A can never read school B; survey tokens never link to the login and raw responses cannot be selected; survey dimensions and conversation domains stay separate types; user pages use the session client, never the service key. Also: cell suppression under 5, 60% completion gate, correlation floor of 25 to 30. |
| Bernard's Slack, Oct 28 | The problem statement: surveillance anxiety around evaluative software; "strict k-anonymity database protection." |
| Nick's emails, Oct 12 and Oct 29 (quoted below) | The actual requirements. |

## What Nick asked for (his words)

- Oct 12: "suppress any admin-visible breakdown below 5 people, the principle being that a group small enough to identify an individual is never shown." The full report needs "about 30 respondents (or 60% of faculty)."
- Oct 29, survey access: "One-time codes. It's the only option that keeps both anonymity and one-vote integrity. Sign-in ties answers to identity and kills candor, which defeats the instrument; the open link can be stuffed."
- Oct 29, small groups: "Hide groups under 5 ... our cell-suppression rule and it's non-negotiable once real data goes in."
- Oct 29, release: "Release results after the survey closes." Participation threshold 60% of the roster. Network minimum 25.
- Oct 29, master key: "Please restrict and rotate the key as the immediate step, and let's put 'reports read from the database instead of the master key' on the hardening roadmap as the real fix. That service-role bypass is the biggest hole."
- Oct 29, data: "Only the 6 non-synthetic responses are real ... never show 56 to a principal as 56 real teachers."

## Where we are today

Already in place and tested: the floor of 5 on every admin breakdown and on Overview; the 60% gate and the headcount (script 020); real versus demo labels; admins read zero rows of conversation logs, survey answers, notes, goals, practice entries and chat (the Trust page proves it live, and `apply_017_to_021.sql` ends with self-checks); lookbook shows only name, department and strengths; our new tables are owner-only or pair-only.

Open, in Eric's lane:

1. Survey codes. 2. Results released after close. 3. The master key. 4. Functions callable without signing in. 5. `/report` is public.

## How to finish each one without him

Do them in this order: 1, 4, 5, 3, 2 (cheapest and safest first).

### Release results after the survey closes (about an hour)
- `loadReportStats()` in `apps/web/src/lib/report/data.ts` already reads the survey. Add `closes_at` to that read. If it is null or in the future, return a new status `"not-closed"` before any aggregate is computed.
- Show a calm message wherever `status` is handled (Insights, Pulse, `/report`, the deck, the CSV, Excel and PDF routes): "Results are released when the survey closes."
- Closing is one statement: `update public.surveys set closes_at = now() where id = '<survey id>';` A button for the school lead can come later.
- Test in `tests/report-gates.test.ts`: open survey returns `not-closed`, closed survey with enough respondents returns `ok`.

### Functions callable without signing in (about an hour)
- The Supabase security advisor (`get_advisors`, type security) lists Nick's `SECURITY DEFINER` helpers as executable by `anon`: `concern_domain_counts`, `is_admin`, `is_school_admin`, `my_email`, `my_profile_id`, `my_school_id`, `rls_auto_enable`, `handle_new_user`, `survey_items_single_active_version`, and `survey_is_open`.
- New script `022_close_anon_functions.sql`: `revoke execute on function public.<name>(...) from anon, public;` for every one except `survey_is_open` (and, once codes exist, the submit function). Supabase grants execute to anon by default on new functions, so also add `revoke execute ... from anon` right after any function a new script creates (our 017 to 021 already do).
- Verify by re-running the advisor: only the survey functions should remain.

### Put `/report` behind sign-in (about two hours)
- `src/app/report/page.tsx` is a server component. At the top call `requireAdmin()` (`src/lib/admin/require.ts`); if it returns null, redirect to `/login?next=/report`. Compare `admin.schoolId` with `NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID` so one school cannot read another's report.
- Remove the "Scan report" card from the open cards on the landing page (`src/app/page.tsx`, `OPEN`), and update `tests/auth-landing.test.ts`.
- The Reports and Insights buttons that link to `/report` keep working because they are for signed-in leads.

### Replace the master key (about half a day)
- Today `SUPABASE_SERVICE_ROLE_KEY` is read only in `data.ts`, because `survey_responses` has no select policy.
- Write `023_culture_scan_aggregates.sql`: a `SECURITY DEFINER` function `culture_scan_aggregates(sid uuid)` that checks the caller is an admin of the survey's school (`is_school_admin`), enforces the 60% gate and the 25 floor, requires the survey to be closed, and returns only: `n`, per-dimension mean and standard deviation, and the 4 by 4 correlation matrix (Postgres has `avg`, `stddev_samp` and `corr`; first collapse each respondent's answers into four dimension scores in a CTE). Grant execute to `authenticated` only.
- `computeReportStats` (`src/lib/report/stats.ts`) is pure, so feed it those aggregates instead of response rows. Check its inputs first; if it needs item-level means, add them to the function.
- Then delete the service-key read, set the app to use the signed-in client, and have Nick rotate the key. Tests: the function returns no rows for a non-admin, for another school's admin, below the floor, and while the survey is open.

### One-time survey codes (about a day)
- Table `survey_codes(code_hash text primary key, survey_id uuid, school_id uuid, used boolean not null default false)`. No teacher column, no timestamp, no IP: the only thing recorded is that a code was used, never by whom or when.
- `issue_survey_codes(sid uuid, n int)`: admin-only `SECURITY DEFINER`; generates `n` random codes, stores their SHA-256 hashes, returns the plain codes once. The school lead prints or emails them (a small Reports panel).
- `submit_survey(code text, answers jsonb)`: `SECURITY DEFINER`, one transaction: find the unused hash for an open survey, mark it used, insert the answers with a **fresh random respondent id** that is not derived from the code. Then `revoke insert on public.survey_responses from anon` and drop the "demo anon submit survey responses" policy (`004`), so the only way in is a valid code.
- `src/app/survey/page.tsx` adds a code step first and calls the function instead of inserting directly. Wrap the new screen in `<AuroraPublic>`.
- Tests: a code works once; a second use fails; an unknown code fails; nothing in any table links a code to a respondent id.

## Checks that prove it is done

1. Trust page (`/admin/privacy`): every private row reads 0.
2. A signed-out visitor gets sent to sign-in from `/report`.
3. The survey refuses an answer without a valid code.
4. Insights says "released when the survey closes" until `closes_at` passes.
5. `get_advisors` (security) lists no anon-executable function except the survey ones.
6. `npm test`, `npx tsc --noEmit`, `npm run build`.

## Decision points

- Tue Nov 3: ask Eric for status and for his slide file.
- Thu Nov 5: if there is still no pull request, tell Claude "take over the privacy work" and start with the first three items above.
- Nothing here is needed for the Demo Day stage, which runs on made-up data.
