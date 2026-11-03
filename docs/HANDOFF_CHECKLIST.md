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
4. **The named faculty map: decided.** In Reports, the faculty map draws every teacher as a dot **with their name**, and a line
   for who is paired with whom. Only the school lead sees it. Nick's request (Oct 29) was only that the Overview page not list
   every teacher, so the names stay on the map in Reports and Overview never shows them. Nothing to build; if Nick later wants
   departments only, that is a small change.
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
12. **The must-have list for Nick.** It is written (`docs/MUST_HAVE_NOV4_DRAFT.md`). Decision (Juan, Nov 2): no reply is being sent for now, and Nick does not need to review the two decks.

## C. Decisions and later features (not blockers)

13. **Lookbook default.** Teachers appear in the lookbook unless they hide themselves. Nick can ask for opt-in instead. Decision (Juan, Nov 2): per-field choices (item 17) stay a later enhancement; for now it is the fixed set of name, department and strengths with one hide switch.
14. **Archetype panel.** Kept, with an explanation. Decision (Juan, Nov 2): it stays.
15. **Switched off, but built.** Games, video calls and the CTLE hours tracker. Each comes back with one setting
    (`NEXT_PUBLIC_FEATURE_GAMES`, `_VIDEO`, `_CTLE`).
16. **Partnership Pulse Check.** Planned for after November 4.
17. **Per-field lookbook choices.** Nick named this as the later improvement (teachers choosing which of name, department and
    strengths show).

## D. Added Nov 2

18. **Culture Scan warning levels.** Insights and Pulse mark each average **Low** (below 3.5, the scale's middle), **Watch** (3.5 to
    4.5) or on track. These cutoffs are a first reading, in one place (`src/lib/admin/scan-level.ts`); Nick can confirm or change them.
19. **"Down since last year" is a stage-only demo.** The real product reads one survey with no link to a school year, so it cannot
    compare years. Making it real means tying the survey to a cycle, running the scan each year and letting Pulse compare the two.
20. **Named faculty map: confirmed (Juan, Nov 2).** The live map in Reports shows names to the school lead. The PDF, Excel and CSV
    versions are department totals only, with no names.
21. **Setting it up on Nick's project:** `docs/NICK_SETUP.md`.
22. **Private test site:** set `SITE_ACCESS_KEY` on a non-production deployment to close it to anyone without the key (`src/proxy.ts`).
23. **If Eric does not finish the privacy lane:** `docs/PRIVACY_FALLBACK.md` collects everything shared so far and has a step-by-step design for each of his five items, in the order to build them.
