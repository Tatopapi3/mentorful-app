# team-integration: what is on this branch

Built by Juan (with Claude) from Bernard's and Bertrand's visions for the teacher dashboard, plus the admin and teacher
work done on the `Juan*` branches. It is code only: **nothing here has been applied to a real database yet** (see
"Database scripts"), and nothing has gone to Nick's repo or `main`.

## The two dashboards, in two looks each

| | Aurora (new) | Nick's design |
|---|---|---|
| Teacher | `/dashboard/aurora` | `/dashboard/nick` |
| Leadership | `/admin/aurora/pulse` | `/admin/pulse` |

The teacher pages are the same pages in both looks (`src/app/dashboard/[look]/`); only the chrome and a theme differ
(`components/aurora/chrome.tsx` + `app/aurora.css` for Aurora; `components/teacher/nick-chrome.tsx` + `teacher-nick.css`
for Nick's, which reuses his `SiteHeader` and tab bar). Nick's original single page is still at `/dashboard`, untouched.
The brand badge (the spiked M in the Aurora gradient) is `components/aurora/mentorful-mark.tsx`.

## Teacher tabs

- **Home**: one next step, cycle steps, a strength a colleague noticed, partners, growth snapshot, notes to your future self.
- **My pair**: partnership (chat with file sharing, private partner-change request) and a **Lookbook** of colleagues: name,
  department and strengths only (search, filters, grid and list), with one switch to hide yourself. Video call is built but off.
- **Journal**: log a conversation (exact timestamps), **note to future self** (sealed until a chosen date), private notebook.
- **Growth**: time on Mentorful (private), suggested focus, goals (the six **pedagogy games** are built but off),
  practice log, an opt-in to anonymous school totals, Mentorful products.
- **Culture Scan**, a **pair chat** drawer on every tab (the **video call** that rings your co-mentor is built but off).

Logic is pure and tested: `src/lib/teacher/` (model, hub, lookbook, protocols). UI: `src/components/teacher/`.

## Database scripts (written, NOT applied)

Order matters. All are additive (new tables, functions, buckets; no existing table changes) and re-runnable.

| Script | What it adds | Privacy rule it enforces |
|---|---|---|
| `017_teacher_hub.sql` | pair chat, game sessions, notes to future self, time on platform, goals, practice log | pair tables: the two teachers only; own tables: the owner only; no admin read path |
| `018_teacher_lookbook.sql` | `lookbook_choices`, `lookbook_cards()` | the lookbook returns exactly name, department, strength tags (no email, photo or free text); one owner-only hide switch; admins get no rows. Rewritten on Oct 29 to Nick's fixed set; the earlier self-authored card (photo, bio, experience) was never applied and is gone |
| `019_growth_activity.sql` | `growth_sharing`, `growth_activity()` | consent; anonymous, rounded to 5, floor of 5 (10 for distributions), admin only |

Checked on a throwaway Postgres (PGlite) with stand-ins for Nick's helper functions (`my_profile_id`, `my_school_id`,
`is_school_admin`), not against his real schema. A read-only look at the real `mentorful-app` project confirmed those
helpers exist and none of the new names collide. Until a script is applied, its pages say "not switched on".

**Video calls and shared files also need Bertrand's `016_pair_live_channel_and_files.sql`** (private realtime channel and
the `pair-files` bucket), which is on `mentortrdash-bc`. His 015/016 file numbers clash with the existing
`015_participation_summary` and `016_conversation_activity`, so renumber his when merging. `live.ts` is ported from his
branch; keep one copy when it merges. Calls ring only while the other person has the app open (no push), and strict
school networks may need a TURN server (`NEXT_PUBLIC_TURN_URL`).

## Where Bernard's and Bertrand's work went

Rebuilt here, not merged (their branches are untouched): Bernard's calm home, privacy line, one next step, partner-change
request and mobile nav; Bertrand's real data model, five-field log, journal, games catalogue, pair chat, visit/video
screen and file sharing. **Not taken**: Bertrand's MCP pairing server (`apps/mcp-pairing`), allowlist sign-in and
localhost dev-login, and his `015_pairing_exclusion_rules.sql`. "Teacher news" had no source in his code.

## Games: content owner is Juan

Bertrand's cards had only a name, focus, length and progress number. The flows in `src/lib/teacher/protocols.ts` are plain
data (title, minutes, who, instruction, prompts, notes). Edit them there; `npm test` checks the minutes add up and that
nothing asks anyone to rate or score.

## Running it

The offline preview layer (mock Supabase, made-up data) is **not** on this branch. It lives on `juan-preview`. To look
around locally: merge `juan-preview` into a scratch branch, then `npm run preview` (or `npm run preview:nick`).

```
cd apps/web
npm test          # 107 tests
npx tsc --noEmit
npx next build
```

## Nick's answers, Oct 29 (what changed, what is still open)

Done on this branch (`Juan-nick-answers`):

| Nick said | What was done |
|---|---|
| Game hub is a distraction before Demo Day; embedded video is "after" | Both are built but **off**. `src/lib/teacher/features.ts`; set `NEXT_PUBLIC_FEATURE_GAMES=1` / `NEXT_PUBLIC_FEATURE_VIDEO=1` at build time to bring either back. Off hides the Growth games panel, the "play a game" menu entry and suggestion link, the play route (404), every Video call button, and the call host. Pair chat and file sharing stay. |
| Floor of 5 on Overview too | Both looks of Overview: counts under 5 show "fewer than 5" (0 too), departments under 5 are left out or combined, **no teacher is named**, the faculty network and the list of who is paired with whom are gone (Constellation covers the network by department), pair crossing is shown only when both sides are 5+. `lib/admin/overview-floor.ts`, tested. |
| Label it "logged conversations" | Renamed on Pulse, Overview, Summary, Insights, the CSV and the deck. |
| 60% of the roster; network minimum 25; headcount on the school record; demo never called real | `scripts/020_school_headcount.sql` (not applied) adds `schools.faculty_headcount`. `lib/report/gates.ts` holds the rules. `loadReportStats` applies the 60% gate to real data (no headcount means the report stays closed and says why); data that includes demo rows is labelled demo and not gated. Respondents read "56 respondents (6 real, 50 demo)". The Insights bubbles and the report's network slide hide the ties below 25 respondents. |

Not done, and why:

- **Survey access by one-time codes** and **release results after the survey closes**: both change the survey/report pipeline (`survey_responses`, the service-key path). That is the privacy work Eric is picking up; this branch did not touch it.
- **Master key**: Nick is rotating it and restricting it. The "reports read from the database, not the master key" item goes on the hardening roadmap.
- **Profile visibility = name, department, strengths** (admins keep email for roster work): done. The lookbook shows exactly that, and the self-authored card, photo bucket and "growing in" are removed. One call to confirm with Nick: a teacher now appears by default and can hide themselves (opt-out), where the old card was opt-in. His site copy promises teachers choose what's shown; per-field toggles are the later enhancement.
- **"Archetype" panel**: Nick wants to discuss whether it should exist. It stays, with the floor applied.
- **Faculty map page and Pairing page** still show named teachers and pairs (the map, and pairing is roster work). Only Overview was in Nick's ask; worth confirming whether the map should go.
- **Triads**: after Demo Day (data-model change). **RSS feed**: reshape toward sharing Google Docs and PDFs between co-mentors; pair chat file sharing is the start. Not built.
- **Hour logging / CTLE**: keep on the list, "design the logging, don't promise the credit". Built and parked on local branch `Juan-ctle-idea`; its SQL is also numbered 020 and must be renumbered if both land.

## Next steps

1. Apply 017, 018, 019, 020 (and 016 only if video comes back) to a project that is not Nick's, then sign in real test teachers (only one profile is
   linked to a login today).
2. After Demo Day: try a video call between two real devices and review the game content (both are off).
4. Decide whether "count me in anonymous totals" stays off by default (it does today).
