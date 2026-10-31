# Mentorful: handoff

What is on this branch, how to run it, what it enforces, and exactly where the last piece (Eric's privacy work) plugs in.
Written Oct 30, 2026. Nothing here has been applied to a real database yet, and nothing has gone to Nick's repo or `main`.

## Where things stand

- **One look, Aurora, for both dashboards.** Nick's own look and the blend were removed. Routes are plain: `/dashboard/...`
  for teachers and `/admin/...` for school leaders.
- **Built and checked on a sample school** (Nick's database file: 50 demo teachers, 32 pairs; invented conversations):
  144 unit tests pass, `tsc` and `next build` are clean, and every page was clicked through in a browser on desktop and
  phone, in Day and Night mode, with an accessibility scan (WCAG 2 A/AA) and no console or hydration errors.
- **Not yet done:** the five new database scripts have not been applied to any real project (see "Database"), so nothing
  has been tried against real sign-ins. Only one profile in the copy of Nick's data is linked to a login.

## The pages before sign-in

The landing page, sign-in, the Culture Scan survey and its thank-you page are in the Aurora look too, inside one shared frame,
`src/components/aurora/public-frame.tsx` (`AuroraPublic`), with styles in `src/app/aurora-public.css` (class names start with `ap-`).
Only the look changed: each page keeps its own logic, so **Eric can change how the survey works without touching how it looks**.
When you add a screen (a code-entry step, a closed-survey message), wrap it in `<AuroraPublic>` and use the `ap-card`, `ap-item`,
`ap-error` and `ev-btn` classes the existing screens use. Two things on the thank-you page to know about: the "32 of 50 teachers have
finished, the scan closes Friday" block is **invented placeholder data** (the code says so); replace it with a real aggregate or remove it
before a real school sees it. The standalone Culture Scan report at `/report` is in the Aurora look too (frame, buttons and slide palette); it is still open to anyone without signing in, which is the pilot setting and must be gated before a real school sees it (see the comment at the top of `src/app/report/page.tsx`). The 404, error and "no access" pages use `NoticePage` (`src/components/aurora/notice-page.tsx`).

Sign-in lands a school lead on `/admin` and everyone else on `/dashboard` (`src/lib/auth/landing.ts`, used by `/auth/callback`). A
link may name a page on this site with `?next=`; anything that is not a path on this site is ignored.

## Teacher dashboard (`/dashboard`)

| Tab | What is there |
|---|---|
| Home | one next step, cycle steps, a strength a colleague noticed, partners, growth snapshot, notes to your future self |
| My pair | your partnership (chat with file sharing, private partner-change request); **Lookbook**: colleagues by name, department and strengths only, with one switch to hide yourself |
| Journal | log a conversation (exact timestamps), note to your future self (sealed until a date), private notebook |
| Growth | time on Mentorful (private), suggested focus, goals, practice log, opt-in to anonymous school totals, Mentorful products |
| Culture Scan | the survey, anonymous |

Plus a pair-chat drawer on every tab. **Off, but built:** pedagogy games, video calls and the CTLE hours tracker
(`src/lib/teacher/features.ts`; build with `NEXT_PUBLIC_FEATURE_GAMES=1`, `NEXT_PUBLIC_FEATURE_VIDEO=1` or `NEXT_PUBLIC_FEATURE_CTLE=1` to bring one back;
video also needs Bertrand's `016_pair_live_channel_and_files.sql`).

**CTLE tracker (off, a later add-on; Juan, Oct 30).** With `NEXT_PUBLIC_FEATURE_CTLE` unset nothing shows on Growth, Insights, the
deck or the Trust page, and the app never reads the CTLE tables (they are in the database from 021, unused). New York asks certified teachers for 100 hours of Continuing Teacher and Leader Education every 5 years,
15% language acquisition, from an approved sponsor. The numbers are per-teacher settings (75 hours for a Level III teaching
assistant, other states). It is the teacher's own record, not NYSED's, nothing says Mentorful time earns credit, and hours
not from an approved sponsor are kept but never counted. Nick: "design the logging, don't promise the credit yet."
The pace rule exists twice (`src/lib/teacher/ctle.ts` and `ctle_progress()` in `021_ctle_hours.sql`); change both together.

## Leadership dashboard (`/admin`)

Pulse, Pairing, Overview, Constellation, Insights, Reports (plus Board summary and the Trust page).

- **Overview**: counts under 5 read "fewer than 5" (0 too), departments under 5 are left out or combined, **no teacher is
  named**, and the teaching-styles panel says what it is (Nurturer, Activator or Architect: the approach a teacher leans
  toward, from their profile; not a score). `src/lib/admin/overview-floor.ts`.
- **Reports**: the leadership deck (PowerPoint and PDF), the Culture Scan report, the board summary, the results CSV, and
  now the **faculty map** (live, named, for the school lead only) with the same figures as the deck's "Faculty connection"
  slide and a **faculty-connection CSV** (department totals, groups under 5 left out, no names). The deck gains a
  "Teacher growth" slide from the anonymous growth totals (and CTLE, when that tracker is on) when enough teachers have chosen to share.
- **Insights**: Culture Scan, trends, anonymous growth-tool totals (anonymous CTLE reading when the tracker is on).
- Labels say "Logged conversations" (a submitted log, not a mutually confirmed one).

## Database

Needs Nick's scripts up to 016 already applied (his database file does that). Then run **`apps/web/scripts/apply_017_to_021.sql`**
once in the Supabase SQL editor of the project you are setting up (not Nick's). It is the five scripts in order, each
additive (new tables, functions and policies, no existing table changed), safe to re-run, and each ends with a self-test
that raises an error if a privacy rule is not in place. Tested from scratch on a throwaway Postgres.

| Script | Adds | Rule it enforces |
|---|---|---|
| `017_teacher_hub.sql` | pair chat, game sessions, notes to future self, time on platform, goals, practice log | pair tables: the two teachers only; own tables: the owner only; no admin read path |
| `018_teacher_lookbook.sql` | `lookbook_choices`, `lookbook_cards()` | the directory returns exactly name, department, strength tags (no email, photo, free text); one owner-only hide switch; admins get no rows |
| `019_growth_activity.sql` | `growth_sharing`, `growth_activity()` | consent (off by default); anonymous, rounded to 5, floor of 5 (10 for distributions); admin only |
| `020_school_headcount.sql` | `schools.faculty_headcount` | the roster size the 60% participation gate measures against. **Set it per school:** `update public.schools set faculty_headcount = 50 where id = '<school id>';` |
| `021_ctle_hours.sql` | `ctle_settings`, `ctle_hours`, `ctle_progress()` | hours are owner-only; leadership gets only a rounded share (hours reached / on pace / behind) from teachers who opted in and set it up, floor of 5 |

Until a script is applied its pages say "not switched on" instead of failing.

## What the code enforces about privacy

- Groups under 5 are never shown to leadership (Overview, department tables, CSVs, deck). Zero counts as under 5.
- Survey answers are anonymous and only ever leave the report engine as school-wide aggregates.
- Pair chat, notes, goals, practice, time on the platform and CTLE hours are visible only to the people they belong to.
  Leadership gets anonymous, rounded totals, only from teachers who opted in, and nothing under 5 teachers.
- The Culture Scan report opens when **60% of the roster** has responded (`schools.faculty_headcount`); the network between
  dimensions needs **25 respondents**; demo and real responses are never mixed in one number ("56 respondents (6 real,
  50 demo)"). While demo rows are in the data the report is a demo and is not gated. `src/lib/report/gates.ts`,
  `src/lib/report/data.ts`.
- A teacher's profile, as colleagues see it, is name, department and strengths. Admins keep email for roster work; no
  teacher-facing page reads email.

## For Eric: where the privacy work plugs in

Nick's Oct 29 answers that are still open, and where each one goes:

1. **Survey access by one-time codes.** Today the survey is open: `src/app/survey/page.tsx` submits with an anonymous insert
   allowed by the policy "demo anon submit survey responses" (`003_demo_open_access.sql`, tightened in `004`). Codes need a
   table of single-use codes, a distribution step for the school lead, and an insert policy that requires a valid unused
   code and burns it, without storing which teacher used which code (that link would end the anonymity).
2. **Release results after the survey closes.** `loadReportStats()` in `src/lib/report/data.ts` returns "ok" as soon as
   responses exist (and passes the gates). Add a check that the survey is closed before it returns "ok" (`survey_is_open(sid)` in `004` is true while
   `surveys.closes_at` is empty or in the future; `surveys.status` is still `draft` in Nick's data, so `closes_at` is the field
   to use); every report, deck, CSV and the Insights
   Culture Scan read go through that one function.
3. **Master key.** `SUPABASE_SERVICE_ROLE_KEY` is read in exactly one place, `src/lib/report/data.ts`. Nick wants it
   restricted and rotated now (he holds it), and "reports read from the database instead of the master key" on the
   hardening roadmap: replace the service-key read with a security-definer function that returns only the aggregates.
4. **The named faculty map.** The map in Reports (and `/admin/map` and the Pairing page) shows named teachers to the
   school lead. Nick asked that Overview not list every teacher; the map lives in Reports at the lead's request. Decided (Juan, Oct 31, reading
   Nick's Oct 29 email): Nick only meant Overview, so **names stay on the map in Reports** and Overview never lists teachers.
   Everything downloadable (deck, CSVs) is aggregate only.
5. **Functions callable without signing in.** The Supabase security advisor lists Nick's `SECURITY DEFINER` helpers as
   executable by `anon`: `concern_domain_counts`, `is_admin`, `is_school_admin`, `my_email`, `my_profile_id`,
   `my_school_id`, `survey_is_open`, `rls_auto_enable`, `handle_new_user`, `survey_items_single_active_version`. Revoke
   `execute` from `anon` where the survey does not need it (`survey_is_open` is needed). Our scripts' functions are granted to
   `authenticated` only.
6. **Lookbook default.** Teachers appear by default and can hide themselves (the old self-authored card was opt-in). Per-field
   choices are the later enhancement Nick named.
7. **Email for sign-in links.** Sign-in is by emailed link, and Supabase's built-in sender only allows about two emails an hour per
   project ("email rate limit exceeded"). Fine for one person testing, not for a school. Before real use, set a real sender
   (Supabase: Authentication, then SMTP, with a provider such as Resend or Postmark) and raise the rate limit to match the faculty size.
8. **Archetype panel.** Kept, with the floor and an explanation; Nick asked whether it should exist at all.

## Running it

```
cd apps/web
npm install
npm test            # 144 tests
npx tsc --noEmit
npm run build
npm run dev
```

Environment (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only),
`NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID`, `NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID`. Optional: `NEXT_PUBLIC_FEATURE_GAMES=1`,
`NEXT_PUBLIC_FEATURE_VIDEO=1`, `NEXT_PUBLIC_FEATURE_CTLE=1`, `NEXT_PUBLIC_TURN_URL` (calls through strict school networks).

The offline preview layer (a mock Supabase with made-up data, used for the share link) is **not** on this branch. It lives on
`view/aurora`; never merge it.

## After Demo Day

Pedagogy games, video calls and the CTLE tracker (built, off), Partnership Pulse Check, triads, a content-sharing feed for Google Docs and PDFs
between co-mentors (file sharing in pair chat is the start; it needs Bertrand's 016 for the storage bucket), per-field profile
choices, reports reading from the database instead of the master key, Bertrand's pairing exclusion rules and MCP server
(not taken; see his branch).
