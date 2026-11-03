# Privacy: what is built, what to run, and how to check it

Nick's five privacy requirements (Oct 12 and Oct 29) are built in the code and in four database scripts. The code is on
`team-integration`. The scripts are **written and tested on a throwaway Postgres, and not yet run on a real database**: that is a
copy-and-paste step in the Supabase SQL editor, in the order below.

## What each requirement became

| Nick's requirement | What it is now | Where |
| --- | --- | --- |
| Close the functions anyone can call without signing in | Every helper that ran as its owner is closed to visitors who are not signed in, except `survey_is_open`, which the public survey needs. Trigger functions are closed to everyone. New functions are closed by default. | `scripts/022_close_anon_functions.sql` |
| Release results after the survey closes | The report numbers come from an admin-only database function that returns nothing until the survey's close date has passed. Pulse, Insights and the Culture Scan report say "Results are released when the survey closes" until then, and the downloads have nothing to export. The school lead closes the survey with one button (Reports, "Culture Scan access"). | `scripts/023_culture_scan_aggregates.sql`, `src/lib/report/data.ts` |
| Replace the master key | The same function does the adding-up inside the database, on the signed-in administrator's session, and returns only counts, averages and the correlation table. The app no longer needs `SUPABASE_SERVICE_ROLE_KEY` for the report. It only falls back to it if script 023 has not been run, and `tests/report-privacy.test.ts` checks that nothing else in the app reads it. | `scripts/023_culture_scan_aggregates.sql`, `src/lib/report/data.ts` |
| `/report` behind sign-in | `/report` sends a signed-out visitor to sign in and back, shows a plain "no access" page to anyone who is not a school lead, and refuses a lead of a different school. The database function checks the same thing again. The landing page no longer offers it to the public. | `src/app/report/page.tsx`, `src/lib/report/access.ts` |
| One-time survey codes | The school lead makes codes (Reports, "Culture Scan access") and hands one to each teacher. The survey asks for the code first. The database checks it, stores the answers against a fresh random id that is not derived from the code, and marks the code used. It keeps only a scrambled copy of each code and nothing that links a code to an answer, a person, a time or an address. | `scripts/024_survey_codes.sql`, `scripts/025_close_anon_insert.sql`, `src/app/survey/page.tsx` |

Also removed: the invented "32 of 50 teachers have finished, the scan closes Friday" on the thank-you page. With one-time codes
nobody can say who has finished, so there is no honest count to show.

## The order to run things

The code is written so it works **before and after** each script, so deploying and running can happen in either order for steps 1 to 3.

1. **Deploy the code** (staging first). Until script 023 is run, the report reads the old way, but it already waits for the survey to
   close and already needs sign-in.
2. **Run `scripts/apply_022_to_024.sql`.** Copy the whole file, paste it in the Supabase SQL editor, click **Run**. Each part ends
   with a self-test: a clean run means the rules hold. It only adds protection and deletes nothing. If Supabase asks about
   row-level security, choose **Run and enable RLS**.
3. **Prove it works on this database: run `scripts/smoke_test_privacy.sql`.** Paste it in the SQL editor and run it. It plays the whole flow
   (the school lead makes codes, a visitor who is not signed in uses one, results are held while the survey is open, closing releases the
   decision, the helper functions refuse a visitor) on a throwaway survey, then **rolls everything back**: nothing is saved, and Nick's real
   survey is never touched. The last message is "SMOKE TEST PASSED", or a plain "FAIL: ..." line saying which rule is missing.
   Then **check it** (below).
4. **Close the survey when enough teachers have answered.** Reports, "Culture Scan access", "Close the survey and release results".
   (Or in SQL: `update public.surveys set closes_at = now() where id = '<survey id>';`.) Until then results stay hidden on purpose.
5. **Make codes** (same panel) and hand them out so nobody can tell which code went to whom.
6. **Run `scripts/025_close_anon_insert.sql` last**, and only when the new survey page is live on **every** site that serves
   `/survey`, Nick's pilot site included. It stops the old page from saving, which is the point: after it, an answer can only be
   added with a valid code. It refuses to run if 024 has not been applied.
7. **Retire the master key.** After 023 is applied and Reports loads on the signed-in lead's session, delete `SUPABASE_SERVICE_ROLE_KEY`
   from the hosting settings and rotate it in Supabase (Settings, API Keys). The report keeps working; that is the check. Anything
   else that used the key (the `npm run synthetic` scripts) runs from a developer's laptop, not from the site.

## How to check it (read-only, safe to run any time)

```sql
-- 1. Functions a visitor who is not signed in can call. Want: submit_survey, survey_code_ok, survey_is_open, and nothing else.
select p.proname
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
 order by 1;

-- 2. Who can add a survey answer. After 025 want: no rows.
select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'survey_responses' and cmd in ('INSERT', 'ALL');

-- 3. What the code table holds. Want exactly: code_hash, survey_id, used.
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'survey_codes' order by 1;

-- 4. How many codes are made and used (counts only; nothing says whose).
select count(*) as made, count(*) filter (where used) as used from public.survey_codes;
```

Then in the app: **Trust** (`/admin/privacy`) still shows every private row at **0**; `/report` signed out sends you to sign in;
Pulse and Insights say "released when the survey closes" until you close it; Supabase's security advisor lists no function
callable without signing in except the survey ones.

## Where this is honest about its limits

- **Codes protect anonymity, not guessing.** A code is 64 random bits, far too many to guess, but Postgres cannot rate-limit a public
  function. If a school wants that too, put the survey behind a CAPTCHA or a rate limiter at the host.
- **Hand out codes well.** Nothing in the database can tell whose code is whose, and that includes us. If a school lead writes a
  list of "name, code" outside the system, that list is the only link. The panel says so.
- **A lost code is not recoverable.** Make a new one. (Nobody can look a code up, by design.)
- **The 60% rule still needs `schools.faculty_headcount`.** With no headcount, real results stay closed rather than guess.
- **Demo rows.** A survey that still contains demo respondents is labelled as demo on every figure and is not held to the 60%
  rule, as before. Remove the demo rows before a real school's data goes in (`npm run synthetic:clean`), and set
  `INCLUDE_SYNTHETIC = false` in `src/lib/report/data.ts`.
- **The network chart still needs 25 respondents.** That limit is enforced where the chart is drawn, as before.
- **Response timestamps.** An answer is stamped with the minute it was saved. A code has no timestamp, so the two cannot be matched.

## What was tested

`scripts/smoke_test_privacy.sql` does the same on a real database (it is also run by the tests below, including a run that must fail when 022 is
missing). `tests/sql-privacy.test.ts` runs the four scripts against an in-memory Postgres (PGlite) with stand-ins for Supabase's roles and
Nick's helper functions, using the real function bodies. It checks: who can call what; that signed-in users keep working; every
release rule (not closed, no data, fewer than five, under 60%, no headcount, demo rows); that another school's lead and a teacher
are refused with the same answer as an unknown survey; that the database's figures equal the app's own to nine decimals; that codes
work once, in any typing, and are stored only scrambled; that incomplete or out-of-range answers are refused and leave the code
usable; and that after 025 a direct insert is refused but a code still saves. `tests/report-privacy.test.ts` checks the app side.
Run both with `npm test`.

The scripts have **not** been run against Nick's real database yet: that is steps 2 and 3, and why each script ends with a self-test and the smoke test exists.
