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

## Where we left off (2026-07-30)

### Open items — read these first

- **`006` is written but NOT applied.** Until it is, v2 and v3 items cannot coexist, so no v3 can be seeded. `005` is applied and confirmed firing.
- **The `pg_constraint` confirmation has not been run.** `006` is written against the inference that `survey_items_position_key` is a single-column unique on `position` — that name is PostgreSQL's default for `<table>_<column>_key`, and a composite would have been named `survey_items_instrument_version_position_key`. Strong, but unconfirmed. Run the query in the migrations list above before applying.
- **The Vercel deploy does not reflect `cc540bd`.** The branding, metadata, favicon and light-theme commit is on `main` but not live at `app.mentorful.co`. Anything demoed from the deployed URL still shows the old "Create Next App" titles and the scaffolded dark mode.
- **The participation floor is not really enforced.** `MIN_RESPONDENTS = 1` in `src/lib/report/data.ts`. The documented rule (>= 30 respondents or 60% of faculty, whichever is higher) is a TODO there — faculty headcount isn't modelled, so today the report opens as soon as any response exists.
- **`INCLUDE_SYNTHETIC = true`.** Every number on `/report` is generated. Flip it and wipe the synthetic rows before any real school sees the page.

### State

- Magic-link auth working end to end: `/login` → email → `/auth/callback` → `/dashboard`.
- **Culture Scan v1 → v2 complete.** The instrument is now the 4-dimension social-capital scan (structural / relational / cognitive / efficacy, 26 items, reverse on positions 5/11/21/25). `survey_items.instrument_version = 2`. `surveys` gained a `wave int` column for delta-readiness (baseline vs re-measure). `survey_responses` did **not** change — long format with anonymous respondent token was already correct.
- **Survey-taking flow works end to end.** `/dashboard` shows a Culture Scan card with status (Not started / In progress / Completed). `/survey` presents the 26 items across 4 sections in dimension order (no dimension header shown — biases answers), Back/Next gated on all items answered, submit writes 26 rows to `survey_responses` in one insert. The flow was verified by live submission during the v2 build, but **those rows no longer exist** — as of 2026-07-21 the only rows in `survey_responses` are the 50 synthetic respondents. Re-take the survey if you need a real row to test the `synthetic = false` path.
- **Report engine: synthetic data, validated math, and the deck are all built.** 50 synthetic respondents seeded; dimension means / Pearson / partial-correlation math verified. `/report` renders six 16:9 slides (intro, dimension means, network, efficacy–structure gap, start here, actions) with a PNG/PDF export toolbar. All aggregation runs server-side with the service key — the anon/authenticated role literally cannot read `survey_responses`.
- **The instrument is frozen and committed**, with a canonical definition and a hash to prove it hasn't drifted. See "The instrument is frozen" above. This is the prerequisite for a meaningful wave-2 delta.
- **Branding and theme done** (`cc540bd`): shared `SiteHeader` on `/`, `/login`, `/survey`, `/report`; real title/template/description replacing the create-next-app defaults; 256px logo favicon; the scaffolded dark-mode block removed and `color-scheme: light` declared, since the report palette and exported slides are authored for light surfaces. **Not yet live on Vercel** — see open items.
- **Next up:** apply `006`, get the Vercel deploy current, then implement the real participation floor (needs faculty headcount modelled) and flip `INCLUDE_SYNTHETIC` off with the synthetic rows wiped.

## Database

**Supabase is the live DB.** Project: `https://kxcjmsqjogaoaiazucsk.supabase.co`. All 8 tables exist with RLS on.

Schema changes are hand-run SQL, kept in `scripts/*.sql` and numbered. Applied so far:
- `001_add_synthetic_column.sql` — `survey_responses.synthetic boolean not null default false`, plus an index on `(survey_id, synthetic)`. **Every report query must filter on `synthetic`.**
- `002_fix_survey_item_resolution.sql` — drops the dead `surveys.item_ids` and adds `surveys.instrument_version`.
- `003_demo_open_access.sql` — **demo/pilot only.** Opens `anon` SELECT on `survey_items` and guarded `anon` INSERT on `survey_responses`. Must be reverted before real data (see the open-access warning at the top).
- `004_fix_anon_submit_guard.sql` — **required with 003.** Fixes a bug where 003's insert `WITH CHECK` read `surveys` (which anon can't SELECT), rejecting every anonymous submission. Replaces the check with a `SECURITY DEFINER` function `survey_is_open()`. Revert alongside 003.
- `005_instrument_version_invariant.sql` — **applied 2026-07-30.** A `DEFERRABLE INITIALLY DEFERRED` constraint trigger enforcing that every row with `active = true` shares one `instrument_version`. Confirmed firing with errcode `23514`. This is what makes `active = true` sufficient on its own everywhere — see "Item resolution" below. Adds no table and no new anon-readable surface.
- `006_position_unique_per_version.sql` — **WRITTEN, NOT YET APPLIED.** Replaces the global `unique (position)` (`survey_items_position_key`) with `unique (instrument_version, position)`. Until this is applied, v2 and v3 items **cannot coexist as rows**, so seeding a v3 fails on the first insert and 005's deferrable swap protects a state the schema can't reach. Apply 005 first. Before applying, confirm the existing constraint really is single-column:

```sql
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.survey_items'::regclass and contype in ('u','p');
```

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

`surveys.item_ids` used to look like it held the item set, but it was `integer[]` while `survey_items.id` is `uuid` — it could never have referenced an item. Dropped in `002`. If you find code reading it, that code is broken.

**Ignore the Prisma/Neon setup in this repo** (`prisma/`, `prisma.config.ts`, `@prisma/*` deps, `DATABASE_URL` in `.env`). Not in use. Do not run migrations or generate a Prisma client.

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

- **Culture Scan = 4 social-capital DIMENSIONS.** School-level, anonymized, admin product. Field name: `dimension` on `survey_items`. Values: `structural`, `relational`, `cognitive`, `efficacy`.
- **Domains of Concern = 4+1 activity DOMAINS.** Conversation-driven, private to the mentoring pair, individual-teacher product. Field name: `domain` on conversation logs (not yet built). Values: Classroom Culture, Lesson Planning, Communication, Assessment & Feedback, Celebrations.

If a single "domain" or "dimension" field is ever asked to hold both, that is the bug — split it.

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
