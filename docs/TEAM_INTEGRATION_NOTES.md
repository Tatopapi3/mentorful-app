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
- **My pair**: partnership (chat, video call, private partner-change request), **Lookbook** of colleagues' cards (search,
  filters, grid and list, detail view), **My card** editor (opt-in, self-authored).
- **Journal**: log a conversation (exact timestamps), **note to future self** (sealed until a chosen date), private notebook.
- **Growth**: time on Mentorful (private), suggested focus, six **pedagogy games** you play with your co-mentor, goals,
  practice log, an opt-in to anonymous school totals, Mentorful products.
- **Culture Scan**, a **pair chat** drawer and a **video call** (rings your co-mentor) on every tab.

Logic is pure and tested: `src/lib/teacher/` (model, hub, lookbook, protocols). UI: `src/components/teacher/`.

## Database scripts (written, NOT applied)

Order matters. All are additive (new tables, functions, buckets; no existing table changes) and re-runnable.

| Script | What it adds | Privacy rule it enforces |
|---|---|---|
| `017_teacher_hub.sql` | pair chat, game sessions, notes to future self, time on platform, goals, practice log | pair tables: the two teachers only; own tables: the owner only; no admin read path |
| `018_teacher_lookbook.sql` | `teacher_cards`, `lookbook_cards()`, private `teacher-photos` bucket | opt-in; only the teacher writes; "growing in" hidden unless they switch it on; admins get nothing |
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

## Next steps

1. Apply 017, 018, 019 (and 016) to a project that is not Nick's, then sign in real test teachers (only one profile is
   linked to a login today).
2. Try a video call between two real devices.
3. Review the game content and the lookbook fields with Nick.
4. Decide whether "count me in anonymous totals" stays off by default (it does today).
