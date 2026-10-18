# Track 1 plan: harden the prototype

Written from reading the code and `apps/web/CLAUDE.md`, before the database dump arrived. Everything marked **verify** needs the
real schema to confirm. One branch per piece, in this order. Each piece starts with its Track 0 test failing, then makes it pass.

Reference implementations of most pieces exist in our earlier prototype (`mentorful-engine`); they are patterns to redo against
this schema, not code to copy.

| # | Branch | Closes | Track 0 test that flips |
|---|---|---|---|
| 1 | `track-1-report-gate` | Report is public, unscoped to a school, and runs on synthetic data with a floor of 1 | report requires a leader; report is school-scoped; floor ≥ 30; synthetic excluded |
| 2 | `track-1-survey-tenancy` | The survey's school comes from an env var the browser controls | school consistency; scored_value check |
| 3 | `track-1-profiles-view` | Colleagues read whole `profiles` rows | restricted view |
| 4 | `track-1-claim-on-login` | Nothing attaches an account to a roster row | claim |
| 5 | `track-1-domains-and-log` | Code lists four domains, enum has five | CELEBRATIONS |
| 6 | `track-1-matching` | Pairings are proposed and approved, with no engine | none yet |
| 7 | `track-1-admin-dashboard` | CTE headline, gates, network rules, PowerPoint and PDF | none yet |

## Status (Oct 18, before the dump)

Each branch is off `track-0-invariant-tests` unless noted, pushed to the private repo, with tests passing. None has been run against
a real database. Merge order: Track 0, then the rest.

| Branch | State |
|---|---|
| `track-1-report-gate` | Built. Admin-only, school-scoped, gates, CTE headline, sample route. Check the headcount query and `is_demo` against the dump |
| `track-1-domains` | Built. Five domains, PLC routing, strength rollups kept at four |
| `track-1-matching` | Pure engine built (randomized, cross-department, host and visitor). Database side (exclusions, avoid requests) waits for the dump |
| `track-1-network-rules` | Built, off `track-1-report-gate`. Dashed under 0.1, node size by mean, sampling caveat |
| `track-1-pptx-export` | Built, off `track-1-network-rules`. Six-slide editable deck. Not yet opened in PowerPoint or Keynote |
| survey tenancy, profiles view, claim on login | Need the dump |

## 1. Report gate (`src/app/report/page.tsx`, `src/lib/report/data.ts`)
- Add the `getUser()` check and a leader check, like `/admin/page.tsx` already does. Pass the leader's `school_id` into
  `loadReportStats(schoolId)` and filter `survey_responses` on it (the column already exists: the survey insert sets it).
- Three gates, kept separate: the whole report at 60% of faculty (denominator: approved, non-demo rows in `profiles`); the network
  at its own floor of 25 respondents; any breakdown under 5 hidden. Today a single `MIN_RESPONDENTS = 1` stands in for all of it.
- Headline score is the Efficacy mean (the CTE score), not an average of the four.
- Keep a public sample at a separate route (for example `/sample-report`) fed only by synthetic rows, so the demo card on the
  landing page still works and the real report never blends demo data in.
- `INCLUDE_SYNTHETIC` becomes an explicit argument, false by default.

## 2. Survey tenancy (`src/app/survey/page.tsx`, SQL 015)
- Today `survey_id` and `school_id` are read from `NEXT_PUBLIC_*` variables and posted by the browser. Nothing in the database
  stops a response being filed against a school its survey doesn't belong to. **verify** in the dump.
- Fix in the database: a check or trigger that rejects a response whose `school_id` differs from its survey's `school_id`.
- Fix in the app: resolve the survey from a per-school link (for example `/survey/[token]`), not from an environment variable, so a
  second school can run a scan at all.
- Move reverse scoring into the database: the stored `scored_value` must equal `7 - raw_value` on reverse items (positions 5, 11,
  21, 25). Today the browser computes it and the server trusts it.

## 3. Profiles view (SQL 016, `src/app/admin/map/page.tsx`)
- The same-school read policy exposes `email`, `why_teach`, `big_five`, `years_teaching`. Create a view of only what a colleague
  needs (name, department, tags) and point the faculty map at it. The sketch is in 011 section 3, commented out.
- Column-level grants are an alternative if the app reads explicit columns; the view matches Nick's own note. **verify** which
  fits once the real column list is visible.
- Keep a self-read path on the base table (his notes explain why).

## 4. Claim on login (`src/app/auth/callback/route.ts`, SQL 017)
- His design is already there: `profiles.auth_user_id` is nullable and unique, and a roster row exists before the teacher signs up.
  The missing piece is the claim, matched on `lower(email)`.
- A `security definer` function `claim_profile()` called from the callback: attach the signed-in user to the one unclaimed roster
  row whose email matches, once; do nothing if there is none; never guess if the address is on two schools' rosters.
- The same function pattern proved out in our earlier prototype. Roster upload and admin approval are separate, and sign-in links
  can go out by email from the approval action.

## 5. Domains and the log form (`src/lib/domains.ts`, `src/app/dashboard/LogConversationForm.tsx`)
- Add CELEBRATIONS to `CONCERN_DOMAINS` and its label. The form already takes a domain; confirm all five show.
- Domains route to PLC types: Classroom to Clinic, Planning to Toolbox, Communication to Task Force, Assessment to Data Dive,
  Celebrations to Celebrations. Nick's Track 2 suggests building Data Dive only.
- Free-text notes stay private to the pair; admins see counts by domain only, hidden under 5 (already in `concern_domain_counts`).

## 6. Matching
- He has pairings with `pending`, `approved`, `rejected`, and teachers can propose. There is no engine.
- Port: randomized pairing that crosses departments and avoids earlier partners; a private "don't pair me with" list reaching only
  the admin; exclusions enforced in the database so no path can create an excluded pair. Admin keeps the final say.
- Note the directional model here (host is observed, visitor observes), unlike our earlier symmetric pairs.

## 7. Admin dashboard (`src/app/admin/page.tsx`, `src/app/report/*`)
- Four-dimension network as the headline, with the 26-question network marked exploratory: dashed under 0.1, node size by mean,
  a sampling caveat of about ±0.14 at n = 30 to 60, confidence bands that widen as n shrinks.
- Export: PowerPoint to edit and PDF to share. He has PNG and PDF today; add PowerPoint with `pptxgenjs`.
- A visible "report unlocked / locked" indicator driven by the gates in piece 1.

## Conventions
- New SQL goes in `apps/web/scripts/` numbered from 015, hand-run like the rest. Before writing DDL, read the real state from
  `pg_constraint`, `pg_policies` and `pg_trigger`, as his notes insist. Guard clauses test a definition, never just a name, and end
  with an assertion of the final state.
- After adding or changing a function, run `notify pgrst, 'reload schema';` and check it over the API.
- Never point `.env.local` at Nick's live project (named in his CLAUDE.md). Use our own.
- No commits to `main`. Work on branches in the private repo.
