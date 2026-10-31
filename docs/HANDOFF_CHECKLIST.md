# Handoff checklist: what is left before Nick gets it

The product is built: teacher dashboard, admin dashboard, sign-in, survey, reports, all in the Aurora look, on `team-integration`.
This is the short list of what stands between "built" and "ready to hand to Nick", in plain words. `docs/HANDOFF.md` has the
technical detail for each item.

## A. Eric's privacy lane (before any real school's data goes in)

1. **One-time survey codes.** Today the survey link is open: anyone who has it can answer, and can answer more than once. Codes
   give each teacher one answer without recording who used which code. (If we stored that link, anonymity would be gone.)
2. **Release results after the survey closes.** Reports open as soon as enough people have answered. Waiting until the survey
   closes means nobody can work out a person's answer by watching the totals change as responses arrive.
3. **The master key.** One place in the code (`src/lib/report/data.ts`) reads every survey answer with a key that skips the
   database's protections. Nick wants that key restricted and replaced with a database function that only ever returns totals.
4. **The named faculty map.** In Reports, the faculty map draws every teacher as a dot **with their name**, and a line for who
   is paired with whom. Only the school lead sees it. Nick asked that the Overview page not list every teacher, so the question
   is whether the map should show names either. Options: keep names (a principal can see who is isolated), or show only
   departments, with groups under 5 hidden, like the rest of the dashboard. Nothing the map shows is private from a school
   lead today, since they approve the pairs, but a name next to "no partner" can feel like a judgement. This is Nick's call.
5. **Functions anyone can call without signing in.** Some of Nick's database helper functions can be run by a visitor who isn't
   signed in. Most should be closed; `survey_is_open` has to stay open for the survey.
6. **The Culture Scan report page (`/report`) is public.** It was left open for the pilot so a principal could open it in a demo.
   Before a real school, it needs a sign-in and school scoping (the comment at the top of `src/app/report/page.tsx` says so).

## B. Ours (Juan and the team)

7. **A full run-through on the real database.** Teacher side is tested (note, goal, practice entry, lookbook, chat, logging).
   Still to do as the admin: Reports (map and PDF), Insights, Trust page, and Present. Then delete our test rows (about a dozen
   across the notes, goals, practice, lookbook, time and chat tables, plus the two logged conversations) so Nick starts clean.
8. **A real email sender.** Sign-in links go out by email, and the built-in sender allows about two emails an hour. That is why we
   hit "rate limit exceeded". Before a school uses it, connect a real sender (Supabase, Authentication, SMTP).
9. **Run the database scripts on Nick's project.** `scripts/apply_017_to_021.sql` adds the teacher tables. Also set each school's
   `faculty_headcount` (the roster size that the 60% rule measures against).
10. **The invented numbers on the thank-you page.** "32 of 50 teachers have finished, the scan closes Friday" is placeholder text.
    Replace it with a real figure or remove it.
11. **12 lint errors.** The checker (`npx eslint .`) reports 12 errors. They are code-style and safety warnings, not bugs, and
    the app builds and runs fine. Eleven are "uses `any`" in Nick's faculty map file (`FacultyMapClient.tsx`, where the map's
    drawing library doesn't have types), and one is in the survey page (it sets state inside an effect). Fixing means giving
    those pieces proper types; it is tidy-up, and Nick's files, so best done together.
12. **Send Nick the must-have list.** It is written (`docs/MUST_HAVE_NOV4_DRAFT.md`) and not sent, on purpose, until after Demo Day.

## C. Decisions and later features (not blockers)

13. **Lookbook default.** Teachers appear in the lookbook unless they hide themselves. Nick can ask for opt-in instead.
14. **Archetype panel.** Kept, with an explanation. Nick asked whether it should exist at all.
15. **Switched off, but built.** Games, video calls and the CTLE hours tracker. Each comes back with one setting
    (`NEXT_PUBLIC_FEATURE_GAMES`, `_VIDEO`, `_CTLE`).
16. **Partnership Pulse Check.** Planned for after November 4.
17. **Per-field lookbook choices.** Nick named this as the later improvement (teachers choosing which of name, department and
    strengths show).
