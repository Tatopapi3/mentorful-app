# Mentorful web app

Next.js 16 (App Router, Turbopack) + React 19 + TypeScript. Part of the `mentorful-app` monorepo; this app lives at `apps/web`.

## ⚠️ Demo/pilot open access — MUST be reverted before real school data goes live

Deployed to Vercel at `app.mentorful.co` for principal demos and friction-free pilot use. During this phase, access is **intentionally loosened**:

- **`/report` is PUBLIC** — the auth gate was removed so a principal can open the link and it just works. It currently renders **synthetic demo data** behind an amber banner.
- **`/survey` is PUBLIC and anonymously submittable** — pilot teachers take the scan with no login. RLS was opened so the `anon` role can read `survey_items` and insert `survey_responses` (guarded: must reference a valid, not-closed survey + an active item; anonymity preserved; one-submission-per-browser is a client-side `localStorage` guard only — bypassable).
- `/dashboard` and `/admin` remain gated.

**Before any real school's data goes live, ALL of the following are required:**
1. **Re-gate `/report`** — restore the `getUser()` gate (and add school/role scoping; it was auth-only, never authorization-scoped).
2. **Wipe the synthetic rows** — `npm run synthetic:clean`, and flip `INCLUDE_SYNTHETIC = false` in `src/lib/report/data.ts`.
3. **Tighten submission** — revoke or restrict the `anon` INSERT policy on `survey_responses` (back to authenticated, or add real rate-limiting/CAPTCHA; RLS cannot rate-limit, and the `localStorage` guard is trivially bypassed).

The open-access RLS changes are in `scripts/003_demo_open_access.sql`. Reverting them is part of the checklist above.

## Pre-pilot gate

Three values are hardcoded to keep the demo working. Each is wrong for a real school, and **none of them fails loudly** — the product renders normally with all three in place, which is precisely why they need a list. The warning above covers the RLS and auth surface; this covers hardcoded values. Both have to clear before a real school sees anything.

Verified against source 2026-08-27.

### 1. `MIN_RESPONDENTS` — `src/lib/report/data.ts:43`

- **Now:** `1`. The report opens as soon as a single response exists. It gates the `below-floor` branch at `data.ts:130`, so with a value of 1 that branch is effectively unreachable.
- **Needs to become:** `>= 30 respondents OR 60% of faculty, whichever is higher`. The `below-floor` branch already exists and renders — only the threshold is wrong. **Blocked on faculty headcount:** the 60% half has no denominator.
- **If shipped as-is:** a school reads dimension means off a handful of responses and small-n noise is presented as culture. It also quietly weakens the anonymity promise — an aggregate over three people is not anonymous in practice, whatever the schema guarantees.

### 2. `INCLUDE_SYNTHETIC` — `src/lib/report/data.ts:36`

- **Now:** `true`. Every number on `/report` comes from the 50 synthetic respondents. `data.ts:90` applies `.eq("synthetic", false)` *only* when the flag is off.
- **Needs to become:** `false`, **and** the synthetic rows wiped (`npm run synthetic:clean`). Flipping alone is not enough — the rows stay in the table, and any future query that forgets the `synthetic` filter picks them up again.
- **If shipped as-is:** demo data blends into a real school's numbers, marked only by the amber banner that `includesSynthetic` drives on `/report`.

### 3. `FACULTY_PROGRESS` — `src/app/survey/complete/page.tsx:65`

- **Now:** `{ finished: 32, total: 50, closes: "Friday" }`. Invented, identical for every teacher who finishes, and always claims the scan closes Friday.
- **Needs to become:** a real count of distinct respondents over a real faculty headcount, with the close date read off `surveys`. Two blockers: headcount isn't modelled (no denominator), and the numerator **cannot** be read from the browser — `survey_responses` has no SELECT policy, so a real count needs a server route using the service key that returns an aggregate only, never rows.
- **If shipped as-is:** a teacher is told 32 of 50 colleagues have finished when the true number might be 3. This is the screen immediately after she is asked to trust the privacy promise, so being caught inventing a number here costs more than the number is worth.

### Faculty headcount is the shared blocker — model it, stop routing around it

It now blocks **two of the three**: the 60% half of `MIN_RESPONDENTS`, and the denominator of `FACULTY_PROGRESS`. Each was routed around separately — the floor dropped to `1`, the progress bar hardcoded — and each workaround is now its own thing to remember, find, and undo.

Modelling it is small: a headcount on `schools`, or a real staff roster if the faculty map ends up needing one anyway. Doing it once retires both workarounds and switches the `below-floor` branch back on. Continuing to route around it means a third stub the next time something needs a denominator, and the stubs are individually cheap in a way that hides how they add up.

**The merge is about to supply this.** Step 3 lands 50 faculty rows in `profiles`, school-scoped, with `is_demo` separating generated identities from real ones — which is the staff roster, and therefore the denominator. Both workarounds become removable in the same pass. Do not let that pass end without removing them, or the roster arrives and the stubs stay anyway.

## Where we left off (2026-09-07)

### Open items — read these first

- **The Neon → Supabase merge is DONE** (Steps 1–5, 2026-09-06 → 09-12). **One database; Prisma and Neon are removed.** Only Step 6 remains — decommission the Neon instance and drop `DATABASE_URL` from Vercel — and that is post-soak cleanup, not urgent, since no code reads it. See "Neon → Supabase merge" below, which supersedes anything else in this file about Prisma, about `conversation_logs` not existing, or about `survey_responses` holding only synthetic rows.
- **The `invites` policy is broken and blocks roster work.** It errors instead of denying (`42501 permission denied for table users`) — a policy predicate reaches into `auth.users` as the calling role. Same class of bug as the one `004` fixed. Fix it in Step 2.
- **`006` is written but NOT applied.** Until it is, v2 and v3 items cannot coexist, so no v3 can be seeded. `005` is applied and confirmed firing.
- **The `pg_constraint` confirmation for `006`.** `006` is written against the inference that `survey_items_position_key` is a single-column unique on `position` — PostgreSQL's default name for `<table>_<column>_key`, where a composite would have been `survey_items_instrument_version_position_key`. Strong, but record the actual query output here once you have it rather than leaving this as an inference. (Query C in the Step 0 catalog covers it.)
- **The participation floor is not really enforced.** `MIN_RESPONDENTS = 1` in `src/lib/report/data.ts`. The documented rule (>= 30 respondents or 60% of faculty, whichever is higher) is a TODO there — faculty headcount isn't modelled, so today the report opens as soon as any response exists. **Merge Step 3 lands 50 faculty rows in `profiles`, which is the denominator this has been blocked on** — see the headcount section above.
- **`INCLUDE_SYNTHETIC = true`.** Every number on `/report` is generated. Flip it and wipe the synthetic rows before any real school sees the page. Note this is no longer an all-or-nothing choice: **52 real rows now exist** (2 respondents), so flipping the flag makes `/report` render off n=2 — which at `MIN_RESPONDENTS = 1` would be presented as a school's culture. The floor and the flag have to move together.

### State

- Magic-link auth working end to end: `/login` → email → `/auth/callback` → `/dashboard`.
- **Culture Scan v1 → v2 complete.** The instrument is now the 4-dimension social-capital scan (structural / relational / cognitive / efficacy, 26 items, reverse on positions 5/11/21/25). `survey_items.instrument_version = 2`. `surveys` gained a `wave int` column for delta-readiness (baseline vs re-measure). `survey_responses` did **not** change — long format with anonymous respondent token was already correct.
- **Survey-taking flow works end to end.** `/dashboard` shows a Culture Scan card with status (Not started / In progress / Completed). `/survey` presents the 26 items across 4 sections in dimension order (no dimension header shown — biases answers), Back/Next gated on all items answered, submit writes 26 rows to `survey_responses` in one insert. **Real submissions exist again.** As of 2026-09-06 `survey_responses` holds 1352 rows: 1300 synthetic (50 respondents) and **52 real (2 respondents, `synthetic = false`, submitted 2026-08-02 and 2026-09-01)**. An earlier note here said the only rows were synthetic; that stopped being true in August. The `synthetic = false` path is testable without re-taking the survey.
- **Report engine: synthetic data, validated math, and the deck are all built.** 50 synthetic respondents seeded; dimension means / Pearson / partial-correlation math verified. `/report` renders six 16:9 slides (intro, dimension means, network, efficacy–structure gap, start here, actions) with a PNG/PDF export toolbar. All aggregation runs server-side with the service key — the anon/authenticated role literally cannot read `survey_responses`.
- **The instrument is frozen and committed**, with a canonical definition and a hash to prove it hasn't drifted. See "The instrument is frozen" above. This is the prerequisite for a meaningful wave-2 delta.
- **Branding and theme done** (`cc540bd`): shared `SiteHeader` on `/`, `/login`, `/survey`, `/report`; real title/template/description replacing the create-next-app defaults; 256px logo favicon; the scaffolded dark-mode block removed and `color-scheme: light` declared, since the report palette and exported slides are authored for light surfaces.
- **Landing, login, and check-email screens ported** (`67d84d8`) from the `app-screens` prototype: navy hero with demo cards on `/`, two-column `/login` with the Culture Scan orientation panel, and a styled check-email state with resend and start-over. App typography is Lora / Public Sans / JetBrains Mono on a warm paper surface, matching mentorful.co. Live at `app.mentorful.co`.
- **Merge Step 1 done** (`007`, 2026-09-06): identity decoupled via `profiles.auth_user_id`, the three empty tables reshaped to receive Neon's data, `concern_domain` enum created, `surveys.item_ids` dropped, `002` retired. Login verified after.
- **Merge complete through Step 5** (2026-09-12). One database; Prisma and Neon removed.
- **Next up:** the pre-pilot gate at the top of this file — `MIN_RESPONDENTS`, `INCLUDE_SYNTHETIC`, `FACULTY_PROGRESS`. Step 3 supplied the faculty headcount all three were blocked on. `006` is also still open and independent of the merge.

## Database

**Supabase is the live DB.** Project: `https://kxcjmsqjogaoaiazucsk.supabase.co`. **Nine** tables: `schools`, `profiles`, `cycles`, `pairings`, `conversation_logs`, `invites`, `surveys`, `survey_items`, `survey_responses`. **RLS is on with policies everywhere** as of `009` (2026-09-07) — the survey tables, `profiles`/`schools`, and the four merged tables. None of them is empty any more: `profiles` holds 54 rows (50 migrated + 4 real), `cycles` 1, `pairings` 32, `conversation_logs` 32, `survey_responses` 1352.

Schema changes are hand-run SQL, kept in `scripts/*.sql` and numbered. Applied so far:
- `001_add_synthetic_column.sql` — `survey_responses.synthetic boolean not null default false`, plus an index on `(survey_id, synthetic)`. **Every report query must filter on `synthetic`.**
- `002_fix_survey_item_resolution.sql` — **RETIRED. Never applied — do not apply it.** The Step 0 reconciliation (2026-09-06) proved it never ran: `surveys.item_ids` was still present holding `[0,1,2,3,4,5,6,7]`, and `surveys.instrument_version` did not exist, even though this list claimed 002 was applied. Its `instrument_version` half was superseded by `005` (see "Item resolution" below — pinning the version on the survey is now redundant). Its one real effect, dropping the dead `item_ids`, was folded into `007`.
- `003_demo_open_access.sql` — **demo/pilot only.** Opens `anon` SELECT on `survey_items` and guarded `anon` INSERT on `survey_responses`. Must be reverted before real data (see the open-access warning at the top).
- `004_fix_anon_submit_guard.sql` — **required with 003.** Fixes a bug where 003's insert `WITH CHECK` read `surveys` (which anon can't SELECT), rejecting every anonymous submission. Replaces the check with a `SECURITY DEFINER` function `survey_is_open()`. Revert alongside 003.
- `005_instrument_version_invariant.sql` — **applied 2026-07-30.** A `DEFERRABLE INITIALLY DEFERRED` constraint trigger enforcing that every row with `active = true` shares one `instrument_version`. Confirmed firing with errcode `23514`. This is what makes `active = true` sufficient on its own everywhere — see "Item resolution" below. Adds no table and no new anon-readable surface.
- `006_position_unique_per_version.sql` — **WRITTEN, NOT YET APPLIED.** Replaces the global `unique (position)` (`survey_items_position_key`) with `unique (instrument_version, position)`. Until this is applied, v2 and v3 items **cannot coexist as rows**, so seeding a v3 fails on the first insert and 005's deferrable swap protects a state the schema can't reach. Apply 005 first. Before applying, confirm the existing constraint really is single-column:

```sql
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.survey_items'::regclass and contype in ('u','p');
```

- `007_merge_neon_schema.sql` — **applied 2026-09-06.** Step 1 of the Neon → Supabase merge. Schema only; no RLS, no data. ⚠️ Its `cycles_status_check` block was a **no-op** — see "Status vocabularies" below. See "Neon → Supabase merge" for the rest.
- `007_verify.sql` — read-only verification for 007. Not a migration.
- `008_dimension_enum.sql` — **applied 2026-09-07.** `survey_items.dimension` text → `culture_dimension` enum. Instrument hash unchanged.
- `009_rls_merged_tables.sql` — **applied 2026-09-07.** Step 2: RLS + policies on `cycles`/`pairings`/`conversation_logs`/`invites`, the `SECURITY DEFINER` helpers, the `invites` `auth.users` fix, and school/admin assignment for the 4 real profiles.
- `010_drop_profiles_id_fkey.sql` — **applied 2026-09-07.** Drops the `profiles.id` → `auth.users(id)` FK that 007 left behind, completing the identity decoupling.
- `011_conversation_logs_pair_private.sql` — **applied 2026-09-08.** Closes an admin read leak on `conversation_logs` and consolidates duplicate read policies on `profiles`/`cycles`/`pairings`. See "The conversation_logs leak" below. Verified: admin-visible logs went **32 → 0**.
- `scripts/migrate-neon-to-supabase.ts` — **run 2026-09-07, deleted 2026-09-12** (Step 5; it imported `pg`). Step 3 data migration. Recoverable from git history at `2810363~1` if ever needed.
- `scripts/step0_catalog.sql` is not in this repo — it was the read-only reconciliation used to establish what was actually live before 007. **Its lesson stands: this list is documentation, not truth.** 002 sat here marked applied for weeks while the database said otherwise. Verify against `pg_policies` / `pg_constraint` / `pg_trigger` before trusting any entry.

### Item resolution (read before writing report queries)

`survey_items` is a **global item bank**. It has no `survey_id` and no `school_id` — items are scoped only by `active` and `instrument_version`. A survey's item set is therefore *not* stored as a list; resolve it as:

```sql
select * from survey_items
 where active
 order by position;
```

**This supersedes the old rule.** Earlier guidance here said to pin `instrument_version` on every read, because "all active items" would silently span versions the moment a v3 was seeded. That is no longer true: `005` enforces at the database that all active rows share a single `instrument_version`, so `active = true` already identifies exactly one instrument. Pinning the version is now redundant, and the invariant holds even for a caller who forgets — which was the actual failure mode, since a filter every reader has to remember is a filter someone eventually doesn't.

Two consequences worth holding onto:

- `order by position` is a **total order** only because of `005`. `006` makes `position` unique per version rather than globally, so if the active set ever spanned two versions the positions would interleave. `005` is what prevents that. The two migrations are load-bearing as a pair.
- `position` is **presentation order, never identity**. Audited 2026-07-30: report scoring (`src/lib/report/stats.ts`) joins `survey_responses.item_id → survey_items.id` and reads `dimension`/`reverse` off the matched row; the survey flow keys answers by `item.id` and inserts `item_id`. `position` appears only in `ORDER BY` and in deriving section order from the dimension sequence. Keep it that way — anything that looks up an item *by position* breaks the moment a second version exists.

`surveys.item_ids` used to look like it held the item set, but it was `integer[]` while `survey_items.id` is `uuid` — it could never have referenced an item. **Dropped in `007`** (2026-09-06); `002`, which was supposed to drop it, never ran. If you find code reading it, that code is broken.

### Prisma and Neon are GONE (removed 2026-09-12, merge Step 5)

**There is one database. Every read and write in this app goes to Supabase.**

Nothing named `prisma` or `pg` remains: no `src/lib/prisma.ts`, no `prisma/` directory, no `prisma.config.ts`, no `@prisma/*` / `pg` / `@types/pg` packages, no `prisma generate` in `build`, **no `postinstall` script at all**, and no `DATABASE_URL` (the `.env` file that held it is deleted; `.env.local` keeps the Supabase vars). The `loadFromNeon()` rollback branch and the `FACULTY_MAP_SOURCE` flag are gone from `src/app/admin/map/page.tsx` — the map reads Supabase unconditionally.

Verified by `rm -rf node_modules .next && npm ci && npm run build`, which is what Vercel runs and where the `postinstall` trap would have fired. Clean, plus `tsc --noEmit` clean and all 9 routes building.

**Do not reintroduce an ORM or a second database.** Data access is the Supabase client: `src/lib/supabase/server.ts` (session client — use this in server components so RLS applies) and `client.ts` (browser). Schema changes are hand-run SQL in `scripts/*.sql`, numbered, applied by hand. The service key is server-only and bypasses RLS; it belongs in the report engine and one-off scripts, never in a page.

Two references survive on purpose and are not stragglers: a comment in `scripts/007_merge_neon_schema.sql` explaining why a CHECK exists that Prisma could not express, and the historical notes in this file. Both are records of how the schema got here.

## Neon → Supabase merge (COMPLETE through Step 5)

Consolidated onto one database. Supabase is the only datastore; Prisma and Neon were removed on 2026-09-12. **Only Step 6 remains — decommissioning the dormant Neon instance — and nothing depends on it.**

Two things found during planning that contradicted this file: Supabase already had **nine** tables (not eight) — `cycles`, `pairings`, `conversation_logs`, and `invites` existed but were empty, so `conversation_logs` is *not* "not yet built" — and `survey_responses` holds **52 real rows** (2 respondents, submitted 2026-08-02 and 2026-09-01) on top of the 1300 synthetic, not zero.

### Step 1 — DONE (`007`, applied 2026-09-06, login verified after)

- **Identity decoupled.** `profiles.id` no longer has to equal `auth.users.id`. A nullable, unique `profiles.auth_user_id` → `auth.users(id)` (`on delete set null`) carries the link explicitly; the 4 existing rows were backfilled `auth_user_id = id`. This is what lets a roster row exist for a teacher who hasn't signed up yet. **RLS keys on `auth_user_id`, never on `id`** — the "update own profile" policy was rewritten in the same migration, since leaving it on `id` would have been silently wrong the moment a roster row appeared.
- `profiles` also gained `strength_tags` / `personality_tags` / `fun_tags` (jsonb), `is_demo`, `neon_id`, and a `role` CHECK of `(admin, teacher)`.
- **`cycles`, `pairings`, `conversation_logs` reshaped** to receive Neon's data. `pairings.teacher_a`/`teacher_b` became `host_id`/`visitor_id` — a pairing is directional, the host is observed and the visitor observes, and `a`/`b` threw that away. `conversation_logs` gained `vision`, `host_id`, `visitor_id`, `strategic_tag`, `status`, `submitted_at`.
- **`concern_domain` enum created** (see the two-axes rule below).
- **`surveys.item_ids` dropped.**

`neon_id` on the four migrated tables is **temporary** — Step 3 upserts on it for idempotency, Step 5 drops it.

### 008 — DONE (applied 2026-09-07)

`survey_items.dimension` is now the `culture_dimension` enum (`structural, relational, cognitive, efficacy`, in instrument order). `npm run items:verify` still prints **`d9ca364b…`**, and the retype was independently confirmed applied — so the unchanged hash means what it should: the instrument's content did not move, only its storage type. Wave-1 → wave-2 comparability is intact. Both axes are now distinct Postgres types.

### 009 — DONE (Step 2, applied 2026-09-07)

RLS enabled with policies on `cycles`, `pairings`, `conversation_logs`, `invites`. Helpers `my_profile_id()` / `my_school_id()` / `is_school_admin()` / `my_email()` are `SECURITY DEFINER` — a policy on `profiles` that queried `profiles` would recurse — and key on `auth_user_id`, never `id`.

- **`conversation_logs` has no admin SELECT policy, by design.** Pair-private only. Admin visibility is `concern_domain_counts(cycle)`: counts per domain, nulled below a cell floor of 5, never rows. Same shape as `survey_responses` + `survey_is_open()`. **Do not add an admin read policy to this table.**
- **`invites` fixed.** It used to error rather than deny (`42501 permission denied for table users`) because a policy predicate read `auth.users` as the calling role — the same bug `004` fixed for `surveys`. Now routed through `my_email()`; anon gets `200` and an empty result.
- The 4 real profiles are attached to the sandbox school; `nick@kurianconsulting.com` is `role = 'admin'`.
- `009` §4 also added a same-school SELECT on `profiles`, which Step 4 needs. It is row-level, so it exposes `email` / `why_teach` / `big_five` alongside the map fields. **Replace it with a column-restricted view before real teachers are in this table.**

### 010 — DONE (applied 2026-09-07)

Dropped `profiles_id_fkey`. **007's decoupling was half-done:** it added `auth_user_id` and rewrote the policy but left a foreign key from `profiles.id` to `auth.users(id)`, so `id` was still *required* to be a real auth user and every roster row was rejected. The link now lives in `auth_user_id` alone. For signup-created rows `id` still happens to equal it — that is a convention now, not a constraint.

### Step 3 — DONE (applied 2026-09-07)

`npm run migrate:neon` landed 50 profiles, 1 cycle, 32 pairings, 32 conversation logs. Verified independently against Neon rather than by the script's own report: counts, per-domain tallies, FK resolution, 1:1 log↔pairing, byte-identical prose across all five text fields, and a teacher's partner list matching end to end. `survey_responses` untouched at 1352; the 4 real profiles untouched and none flagged `is_demo`.

Decisions baked in: `Test School` dropped (created by the stray `api/test` route, not real); `Mentorful Demo School` → the existing `Mentorful Sandbox` row; the three duplicate `Fall 2025` cycles collapsed to the one carrying all 32 pairings (`prisma/seed.ts:78` hardcodes a create inside the loop, producing three identical rows); `clerkUserId` dropped; logs migrated as `submitted`; `approved_at` backfilled from `created_at` (Neon set `status = APPROVED` but never wrote a date); all 50 get `is_demo = true` and `auth_user_id = null`.

`scripts/migrate-neon-to-supabase.ts` derives every target id as **UUIDv5 of the Neon cuid**, so the cuid→uuid map is built in one pass before any write and re-runs converge byte-identically. `--dry-run` and `--clean` (deletes only rows with `neon_id not null`) are both supported.

### 011 — DONE (applied 2026-09-08): the `conversation_logs` leak

**An admin could read all 32 pair-private conversation logs.** Caught by testing RLS as the admin account before deploying Step 4, not by a report.

Two causes, and both matter:

1. **A pre-existing `"teachers can read own logs"` policy carried an `is_admin()` clause.** That is a deliberate admin-read grant from the original schema design, and it directly contradicts the pair-private model. Its *non-admin* branch was also broken — it compared `host_id = auth.uid()` when `host_id` references `profiles.id`, and since `010` those are different values — so it matched nothing and **the admin clause was doing 100% of the work**.
2. **`009` added policies without dropping pre-existing ones.** Postgres OR-s permissive policies, so the old grant survived alongside the new one. `009` §3 did drop-then-recreate for `invites`; §4–§7 did not.

Blast radius was `authenticated` only — `anon` saw 0 rows and no prose, verified the same day. Not public exposure.

`011` fixes it by **enumerating and dropping every SELECT/ALL policy** on the four tables, then recreating exactly the intended set — deterministic regardless of what was there, which is the property `009` lacked. It also adds `FORCE ROW LEVEL SECURITY` on `conversation_logs`, and **self-tests inside the transaction**: it aborts unless `conversation_logs` ends with exactly one read policy whose `qual` contains no `is_school_admin` / `my_school_id` / `is_admin`. That assertion is a permanent regression guard — re-adding an admin branch makes this migration fail.

Final policy set: `conversation_logs` 1 (pair only) · `profiles` 2 (read own + same school) · `cycles` 1 (same school) · `pairings` 1 (participant or admin).

**`profiles` has two, not one, deliberately.** A self-read path has to exist independently of the same-school one, or anyone whose `school_id` is null — the state every new signup starts in — cannot read their own row, and `/admin/map`'s `where auth_user_id = <me>` returns nothing.

⚠️ **The lesson, and it is the third instance of one root cause.** `007` guarded a constraint by *name* and silently no-op'd. `009` added policies without dropping and silently under-secured. `011` was needed because both assumed an object wasn't already there. **Assume it is. Enumerate, echo, replace — and assert the end state before committing.** A migration that reports success while changing nothing is worse than one that fails.

Open question this raises: the `is_admin()` clause was somebody's intentional design. **The same "does this table assume admin reads?" question may apply elsewhere in that schema** — worth auditing before any other table starts holding candid teacher writing.

### Step 4 — DONE (deployed and verified 2026-09-08)

**`/admin/map` reads Supabase. Verified in the browser: Nodes 50 / Edges 32, with the `(supabase)` label.** Matches what Neon rendered, which was the bar.

At the time, `src/app/admin/map/page.tsx` carried both `loadFromSupabase()` and `loadFromNeon()` behind a `FACULTY_MAP_SOURCE` flag, so rollback was an env var rather than a revert, and the header rendered the active source beside the counts — which is what made the verification above readable at a glance. **Step 5 removed both the flag and the Neon branch;** the function is now just `loadFacultyMap()`.

- The fetch runs on the **user's session client** (anon key + cookies via `@supabase/ssr`), never the service key — `009`/`011` policies are what scope the page to the reader's own school. **Do not "optimise" this to the service key**; it would bypass every policy and silently show one school's faculty to another.
- Cycle is picked by `ends_at desc`, **not** `status = 'active'` — the one migrated cycle is `complete`, and an `active` filter renders an empty graph.
- School comes from the reader's own profile, replacing the old "school with the most rows" heuristic that existed only to dodge a stray `Test School`.
- `FacultyMapClient` was **unchanged and needed no change**. The page adapts Supabase's shape to it: `first_name`+`last_name` → `name`, `strength_tags` → `strengthTags`.
- Nodes are filtered to `is_demo = true`. **Drop that filter when a real roster exists**, or real teachers will be invisible on the map.

### Step 5 — DONE (2026-09-12): Prisma removed, one database

**The rollback path is gone and the merge is effectively complete.** Prisma, `pg`, the `prisma/` directory, `prisma.config.ts`, `src/lib/prisma.ts`, the `migrate-neon-to-supabase.ts` script, the `loadFromNeon()` branch, the `FACULTY_MAP_SOURCE` flag, `DATABASE_URL`, and the `postinstall: prisma generate` line all went in one commit — they had to, since dropping the packages while `postinstall` survived would break every `npm ci` including Vercel's.

Also swept: the stray root `src/` (with `api/test/route.ts`, the GET handler that created a `Test School` row on every request), the three `prisma/seed.ts.bak*` files, and the `next` / `web@0.1.0` junk artifacts, now gitignored. `tsconfig.json`'s `exclude` no longer lists `prisma`.

Verified before commit: clean `npm ci` (where the trap would fire), `tsc --noEmit` clean, `next build` green across all 9 routes.

See "Prisma and Neon are GONE" above for what the data-access story is now.

### Remaining

**Step 6 — decommission Neon.** The only migration item left, and it is **post-soak cleanup, not urgent**: nothing reads Neon, so it costs nothing to leave sitting. `pg_dump` to somewhere durable first, leave the branch read-only for a couple of weeks, then delete. `DATABASE_URL` is still set in **Vercel** — harmless now that no code reads it; remove it **last**, after the database is actually gone. A stale build-time env var is harmless; a prematurely deleted database is not.

**Debts that outlive the merge:**

- **Retire the `neon_id` columns** on `profiles` / `cycles` / `pairings` / `conversation_logs` once Step 5 lands. They exist only for migration idempotency.
- **Replace the same-school `profiles` read with a column-restricted view** before real teacher data. The policy is row-level, so it exposes `email` / `why_teach` / `big_five` / `years_teaching`, not just the name, department and tags the map needs — RLS cannot restrict columns. `011` §3 carries the `create view` sketch; it also needs `page.tsx` repointed at the view.
- **Drop the `is_demo = true` filter** in `loadFromSupabase()` when a real roster exists, or real teachers will not appear on the map.
- **Audit the rest of the schema for `is_admin()` read grants.** The `conversation_logs` leak came from a deliberate admin-read clause in the original design. The same assumption may sit on other tables — check before anything else starts holding candid teacher writing.
- **The pre-pilot gate at the top of this file is still open**: `MIN_RESPONDENTS = 1`, `INCLUDE_SYNTHETIC = true`, `FACULTY_PROGRESS` hardcoded. Merge Step 3 supplied the faculty headcount those were blocked on — 50 school-scoped rows in `profiles` — so the denominator excuse is gone.

### Status vocabularies — use the schema's words, not the ones you'd pick

These are the **real** allowed values, read off `pg_constraint` on 2026-09-07. They predate the merge and are intentional (the same design that gave `profiles` its `disc_style` / `teaching_style` / `archetype_id` columns and a `superadmin` role). **Do not standardise them to something tidier** — the tables were designed this way on purpose.

| table | column | allowed values |
|---|---|---|
| `cycles` | `status` | `upcoming` · `active` · **`complete`** |
| `pairings` | `status` | `pending` · `approved` · `rejected` |
| `conversation_logs` | `status` | `draft` · `submitted` |

⚠️ **`007` claims to add `cycles_status_check` allowing `planned/active/closed`. That block was a no-op** and those values are wrong. A constraint of that name already existed, and 007's guard keyed on the constraint *name* rather than its definition, so the `ADD` was skipped while the migration reported success. The file carries a correction comment; it is applied history, so it was not rewritten.

**The lesson, which cost three failed runs:** PostgREST's OpenAPI document — what every probe in this repo reaches for first — reports columns, types, defaults, and foreign keys *within the exposed schema*. It does **not** report CHECK constraints, cross-schema foreign keys (anything pointing at `auth.*`), triggers, or RLS policies. Every merge defect so far lived in exactly that blind spot: `profiles_id_fkey` → `auth.users` (invisible), `cycles_status_check` (invisible), and `002`'s phantom application. **Before writing DDL against a table, query `pg_constraint` / `pg_trigger` / `pg_policies` directly.** Guard clauses should test a constraint's *definition*, not its name.

### A new RPC needs a PostgREST schema reload before the app can call it

Same family as the blind spot above, and it bit on `014`. A function can exist and work perfectly in the SQL editor while the app gets a 404, because **SQL talks to Postgres and the app talks to PostgREST, which serves functions from a cached schema.** Until that cache refreshes, the function is invisible over the API.

```
POST /rest/v1/rpc/<new_function>
  → 404  {"code":"PGRST202","details":"Searched for the function public.<name> ..."}
```

**`PGRST202` means "not in the API schema cache", not "does not exist".** It reads like a client bug — wrong name, wrong argument, wrong casing — and sends you to debug perfectly correct code. Distinguish it in one call: a function that *is* exposed returns its own error (`42501` for an admin-gated one), not a 404.

After any migration that adds or changes a function signature:

```sql
notify pgrst, 'reload schema';
```

If that doesn't take, force it from outside Postgres: Dashboard → Settings → API → **Reload schema cache**. Propagation is not always instant — re-probe rather than assuming, and note that the SQL editor will keep reporting success the whole time because it never goes through PostgREST.

Two practical consequences:
- **Verify a new RPC over the API, not just in SQL.** `curl` the `/rest/v1/rpc/` endpoint, or check that the app actually shows the value. A green SQL verification proves the function, not the route to it.
- **Give any RPC-backed UI a fallback** that degrades to something true. `/admin`'s conversation count falls back to the rows the caller can actually read, so a cold cache shows an undercount rather than a crash — but be aware that the fallback is also what makes the failure quiet.

### Identity: matching teachers to auth users

All 50 Neon emails are `@demo.mentorful.co`, generated by the seeder. **Zero overlap with the 4 real auth users** — email matching is the right mechanism, it just has nothing to match until a real roster is loaded. Claim-on-first-login sets `auth_user_id` by `lower(email)`; match on `lower()`, since Supabase Auth lowercases but a hand-entered roster won't.

Two existing-data notes: all 4 `profiles` rows have `school_id = null`, so any school-scoped policy returns nothing for them until they're attached; and the signup path writes `first_name` = the email local part with an empty `last_name`, which is worth repairing while there are only four rows to fix.

## Auth

Magic link (email OTP) via Supabase Auth, SMTP through Resend. **Not Google OAuth.** Working end to end: login → email link → callback → dashboard.

Files:
- `src/lib/supabase/client.ts` — browser client (`createBrowserClient`)
- `src/lib/supabase/server.ts` — server client (`createServerClient`, async `cookies()` for Next 16)
- `src/app/login/page.tsx` — email input → `signInWithOtp` → "check your email" state
- `src/app/auth/callback/route.ts` — `exchangeCodeForSession` → redirect to `/dashboard`
- `src/app/dashboard/page.tsx` — server-side `getUser()`, redirects to `/login` if unauthenticated

Supabase Auth → URL Configuration must include `http://localhost:3000/auth/callback` in Redirect URLs (already configured).

## School Culture Scan

Seeded in Supabase (v2, social-capital instrument). Items are data, not hardcoded — the taking flow reads them from the DB and derives section ordering from `position`.

- `survey_items` — 26 items across 4 dimensions: `structural` (6), `relational` (9), `cognitive` (6), `efficacy` (5). The split is uneven — do not assume equal counts; always compute per-dimension scores as a mean, never a sum. Section order in the UI is the order dimensions first appear by position (structural → relational → cognitive → efficacy). Reverse-scored items: positions **5, 11, 21, 25** — apply `scored_value = 7 - raw_value` before any analysis. Column `instrument_version = 2` marks the v2 seed; the CHECK constraint on `dimension` was updated accordingly.
- `surveys` — has a `wave int` column so the same instrument can be re-run for baseline vs delta measurements without collision.
- `survey_responses` — **long format**, one row per (respondent, item). `respondent` is a random per-submission uuid, never `auth.uid()`. RLS is **insert-only for authenticated**, with `WITH CHECK (respondent <> auth.uid())` enforcing anonymity at the database. **No SELECT policy** — only the `service_role` key can read responses, so any leadership dashboard must run in a server route using the service key and return dimension-level aggregates only.
- Report gating: participation floor is >= 30 respondents OR 60% of faculty, whichever is higher.

### The instrument is frozen — canonical definition and hash

The instrument used to exist only as 26 rows in one Supabase project: nothing to review, nothing to diff, nothing to rebuild from. It now has a committed canonical definition, and the DB is downstream of it.

`scripts/seed-culture-scan-items.ts` holds all 26 items as a literal array — position, dimension, framing, reverse, text, scale_min, scale_max, and the **real uuids**, so re-seeding is a rebuild rather than a fork and `survey_responses.item_id` keeps resolving. `active` and `instrument_version` are applied as constants, so the seed structurally cannot emit a mixed-version or half-active bank. Idempotent: rows upsert on primary key.

```
npm run items          # upsert, then verify
npm run items:dry      # print the instrument + hash, no DB access
npm run items:verify   # read-only drift check; exits non-zero on mismatch
```

**Frozen as of 2026-07-30:**

| | |
|---|---|
| instrument_version | `2` |
| items | 26 (structural 6, relational 9, cognitive 6, efficacy 5) |
| reverse positions | 5, 11, 21, 25 |
| canonical form | `mentorful.culture-scan.canonical.v1` |
| instrument hash | `d9ca364b4feae67af90ab764bd5ed1ef5cfb71f3618dad5a3797eb28b517843d` |

The hash is SHA-256 over every field that determines what a respondent is asked and how it scores: position, dimension, framing, reverse, scale_min, scale_max, text. It excludes `id` (a storage detail) and `active`/`instrument_version` (deployment state, enforced by 005). The exact canonical encoding is documented in the script's `instrumentHash` docstring and was cross-checked against an independent implementation.

**Run `npm run items:verify` before wave 2.** If the hash still reads `d9ca364b…`, the instrument is unchanged and a wave-1 → wave-2 delta measures the school. **If the hash has changed, the instrument drifted and the wave comparison is invalid** — a delta then conflates a change in the school with a change in the questions, and there is no way to separate them after the fact. Record the canonical form alongside the hash; a bare digest means nothing without the recipe that produced it. `CANONICAL_FORM` is itself hashed, so a future change to the recipe moves the number *and* announces itself rather than silently looking like instrument drift.

### Survey-taking flow (built)

- `src/app/dashboard/page.tsx` — server-rendered, gates on `getUser()`, renders `<CultureScanCard />`.
- `src/app/dashboard/CultureScanCard.tsx` — client component, reads `localStorage` for status. Uses namespace `mentorful:culture-scan-v2:*`. Also runs a one-time cleanup that removes the deprecated v1 keys.
- `src/app/survey/page.tsx` — client component. Fetches items, groups into 4 sections by dimension in position order, "Section X of 4" header (no dimension name — biases answers), 6-point forced-choice per item, Back/Next disabled until every item on the screen is answered. On submit, computes `scored_value = reverse ? 7 - raw : raw` from the DB flag, then inserts all 26 rows in one `insert()` call. Progress persisted in `localStorage` for same-device resume; cleared on successful submit and replaced with a `completed` timestamp.
- Respondent uuid is `crypto.randomUUID()` generated client-side per submission, distinct from `auth.uid()`.

## Report engine

### Synthetic demo data

`scripts/seed-synthetic-culture-scan.ts` generates 50 synthetic respondents for the wave-1 Culture Scan and prints the full stats. Node runs it directly (type-stripping, no tsx needed):

- `npm run synthetic:dry` — generate + print stats in memory, no DB access. Add `-- --n=5000` to see the generator's population structure with sampling noise averaged out.
- `npm run synthetic` — insert, then print stats **read back from Supabase**. Refuses to run if synthetic rows already exist (`--force` to override).
- `npm run synthetic:clean` — delete all synthetic rows for the survey.

How it works, and why it's built this way:

- Answers come from a **latent path model**, not from noise: `structural → relational → cognitive`, and `relational → efficacy ← cognitive`. Structural has *no* direct path to cognitive or efficacy. That produces the intended "fragile efficacy" demo story — structural is low-scoring and its apparent link to efficacy exists only through relational, so it survives raw correlation and vanishes under partialling.
- It writes both `raw_value` and `scored_value`, deriving `raw` by inverting the live flow's rule (`scored = reverse ? 7 - raw : raw`), and asserts the invariant on every row before inserting.
- `SEED` is **deliberately chosen**, not arbitrary. At n = 50 the sampling error on a partial correlation is roughly ±0.14, and many draws from this model land with a *negative* structural–efficacy edge, which would tell the viewer that structural suppresses efficacy — an artifact, not the model. Seed 2568 was picked from a 4000-seed scan as a draw close to the model's population values (~4% qualify). Nothing is injected that the path model doesn't already imply; `--n=5000` shows the underlying structure.
- Respondent tokens are per-submission `crypto.randomUUID()`, never `auth.uid()`, matching the real flow's anonymity guarantee.

### Validated math

The three quantities the report engine needs are implemented and checked in that script:

1. **Dimension means** — mean of `scored_value` per dimension, per respondent, then across respondents.
2. **Pearson correlation matrix** (4×4) between dimension scores across respondents.
3. **Partial correlation matrix** — invert the correlation matrix to the precision matrix `P`, then `partial(i,j) = -P(i,j) / sqrt(P(i,i) · P(j,j))`. These are the network edges.

The partial-correlation path was cross-checked against an independent method (OLS-regress each pair on the other two dimensions, correlate the residuals); the two agree to ~2e-16, and `R · R⁻¹ = I` to the same precision. If you refactor the matrix code, re-run that check — a wrong inversion produces plausible-looking numbers rather than an obvious failure.

Respondents missing an entire dimension are listwise-dropped before the covariance is computed, and the count is logged.

Reference output on the current synthetic set (50 respondents):

```
means:    structural 3.10   relational 4.61   cognitive 4.52   efficacy 4.54
raw:      s-r .412   s-c .312   s-e .260   r-c .603   r-e .644   c-e .575
partial:  s-r .280   s-c .094   s-e -.036  r-c .329   r-e .447   c-e .308
```

The headline: structural–efficacy goes **.260 → -.036** under partialling.

### Still to build

The deck is built — six 16:9 slides in `src/app/report/slides/`, shared shell in `SlideShell.tsx`, layout constants in `src/lib/report/deck.ts`, export in `DeckExport.tsx`. What remains:

- **The real participation floor.** `MIN_RESPONDENTS = 1` today. The rule is >= 30 respondents or 60% of faculty, whichever is higher, and the second half needs faculty headcount modelled first. The `below-floor` branch exists and renders; only the threshold is wrong.
- **Turning off synthetic data.** `INCLUDE_SYNTHETIC = true` in `src/lib/report/data.ts`; run `npm run synthetic:clean` and flip it.
- **Delta / wave 2.** The slides are single-wave. `surveys.wave` exists and the instrument hash is in place to prove comparability, but nothing renders a baseline-vs-remeasure comparison yet.

All aggregation must keep running server-side with the service key and return dimension-level aggregates only.

### The two-axes rule (never merge)

Mentorful has two separate measurement axes. They meet only on the admin dashboard as lagging vs leading indicators. **Never store them in one shared field.**

- **Culture Scan = 4 social-capital DIMENSIONS.** School-level, anonymized, admin product. Lagging indicator. Field name: `dimension` on `survey_items`. Values: `structural`, `relational`, `cognitive`, `efficacy`. Still `text` + CHECK; becomes the `culture_dimension` enum in `008`.
- **Domains of Concern = 4+1 activity DOMAINS.** Conversation-driven, private to the mentoring pair, individual-teacher product. Leading indicator. Field name: `domain` on `pairings` and `conversation_logs`. Type: the **`concern_domain` enum**, created in `007`. Values: `CLASSROOM`, `PLANNING`, `COMMUNICATION`, `ASSESSMENT`, `CELEBRATIONS`.

If a single "domain" or "dimension" field is ever asked to hold both, that is the bug — split it.

**Both axes now live in one database**, which is exactly when they get easy to confuse: four values each, near-synonymous English names. The guards are structural, not conventional:

- **Distinct enum types, deliberately against this schema's `text` + CHECK convention.** A CHECK catches a bad *value*; a distinct type catches a bad *column*. Assigning a dimension into a domain is a type error at the point of the mistake, and a query that UNIONs the two axes fails outright instead of returning a plausible-looking blend.
- **Never let the column names cross.** No `domain` on a survey table, no `dimension` on a pairing or log table.
- **Keep the value sets textually disjoint.** They are (`structural` vs `CLASSROOM`, different casing too). Never rename a concern domain to something like "Structural Planning" — disjointness is what makes a mix-up visible in a result set rather than merely wrong.
- **No shared lookup table.** Don't build `taxonomies` or `categories` with a `kind` discriminator. That table is how these two collapse into one field, and it will look like normalization when it happens.

`CELEBRATIONS` — the "+1" — exists in the enum but has no Neon source; Neon only ever had four. It was added while every consuming table was empty, because later it means `ALTER TYPE … ADD VALUE`, which can't share a transaction with other DDL.

## Env

`.env.local` (gitignored) holds:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID` — target `surveys.id` for Culture Scan submissions
- `NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID` — target `schools.id` for Culture Scan submissions
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, bypasses RLS entirely

`SUPABASE_SERVICE_ROLE_KEY` must never be given a `NEXT_PUBLIC_` prefix and must never be imported into client code — it can read every row of `survey_responses` and would break the anonymity guarantee the whole instrument rests on. It's used by `scripts/seed-synthetic-culture-scan.ts` today, and will be used by the report engine's server routes.

The two `CULTURE_SCAN_*` vars are a stopgap until the app can resolve survey/school from routing or user membership. They're `NEXT_PUBLIC_` because the browser client reads them at submit time.

## Conventions

- Path alias: `@/*` → `./src/*`
- App Router under `src/app/`
- Styling is intentionally unstyled inline for now; Tailwind v4 is wired via `@tailwindcss/postcss` for later polish
