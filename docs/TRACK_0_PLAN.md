# Track 0: invariant test suite

Nick's rule for week 1: the automated tests come before any other change. This is the plan and the current state.
Run everything with `cd apps/web && npm test`.

## What runs today (no database needed)

| File | What it checks | State |
|---|---|---|
| `tests/instrument.test.ts` | 26 items, split 6 / 9 / 6 / 5; reverse items at 5, 11, 21, 25; the frozen instrument hash | passes |
| `tests/scoring.test.ts` | Dimension scores are means; a respondent missing a dimension is dropped and counted; correlation and partial-correlation matrices; R times its inverse is the identity; structural to efficacy is linked raw but not once the others are held constant | passes |
| `tests/source-invariants.test.ts` | Service key read in one place only; never `NEXT_PUBLIC_`; the faculty map uses the session client; the two axes are disjoint and never share a table; `conversation_logs` has no admin or school read policy; `survey_responses` has no SELECT policy; invites don't read `auth.users` | passes |
| `tests/source-invariants.test.ts`, "Known gaps" | The things that are wrong today, written as the correct behaviour with `it.fails` | 9 open gaps |

`it.fails` keeps the suite green while a gap is open, and turns it red the moment someone fixes the gap, which is the cue to
delete the `.fails`. The list may only shrink. The nine open gaps:

1. The code lists four conversation domains; the enum has five (CELEBRATIONS is missing).
2. `/report` is public. It needs a signed-in leader.
3. The report has no school filter.
4. `MIN_RESPONDENTS` is 1. It should be at least 30, plus the 60%-of-faculty gate.
5. `INCLUDE_SYNTHETIC` is true.
6. The completion screen shows an invented count (`finished: 32`).
7. Colleagues read whole `profiles` rows (email, why_teach, big_five). It needs a restricted view.
8. Nothing claims a profile on first sign-in by email.
9. `scored_value` is computed in the browser and trusted. The database should check it against the raw answer.

## What waits for the database dump

`tests/db/invariants.db.test.ts` holds 27 titled `it.todo` tests in eight groups, skipped unless `TEST_DATABASE_URL` is set.
They cover the invariants that can only be proven against real policies: pair privacy, anonymous responses, School A / School B
isolation, cell suppression, the profiles columns, claim on login, and demo flags.

How they will run once `mentorful_handoff.sql` arrives:
1. Restore the dump into a scratch database (a local Postgres or a Supabase branch). Never Nick's live project.
2. Seed two schools and a small cast (two admins, paired teachers, an unpaired teacher, a few survey responses).
3. Run each test as one signed-in user at a time: `set local role authenticated`, set `auth.uid()`, roll back.
4. Port the tests in the order above. The failures are the fix list for Track 1.

## Findings from reading the code (to confirm against the dump)

- Nick's notes say the `invites` policy is broken (`42501`). Migration 009 already routes it through `my_email()`, and a test confirms
  the script no longer reads `auth.users`. The open-items line is probably stale; confirm against the live policy.
- `/report` and `survey/complete` call the report engine with the service key and no school argument.
- The survey page computes `scored_value = reverse ? 7 - raw : raw` in the browser and inserts it. Nothing server-side checks it.
- Baseline before any change: `tsc --noEmit` is clean; `eslint` reports 13 errors and 1 warning (React hooks, `set-state-in-effect`),
  all already there.
