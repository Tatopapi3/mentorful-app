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

## Where we left off (2026-07-21)

- Magic-link auth working end to end: `/login` → email → `/auth/callback` → `/dashboard`.
- **Culture Scan v1 → v2 complete.** The instrument is now the 4-dimension social-capital scan (structural / relational / cognitive / efficacy, 26 items, reverse on positions 5/11/21/25). `survey_items.instrument_version = 2`. `surveys` gained a `wave int` column for delta-readiness (baseline vs re-measure). `survey_responses` did **not** change — long format with anonymous respondent token was already correct.
- **Survey-taking flow works end to end.** `/dashboard` shows a Culture Scan card with status (Not started / In progress / Completed). `/survey` presents the 26 items across 4 sections in dimension order (no dimension header shown — biases answers), Back/Next gated on all items answered, submit writes 26 rows to `survey_responses` in one insert. The flow was verified by live submission during the v2 build, but **those rows no longer exist** — as of 2026-07-21 the only rows in `survey_responses` are the 50 synthetic respondents. Re-take the survey if you need a real row to test the `synthetic = false` path.
- **Report engine step 1 done: synthetic data + validated math.** 50 synthetic respondents seeded, and the dimension means / Pearson / partial-correlation math is verified. See "Report engine" below. No report UI exists yet.
- **Next up:** the report engine's **rendering** layer. Four-node partial-correlation network on the four dimensions, plus Tier 1 panels. Must be delta-ready from day one (uses `surveys.wave`). All aggregation runs server-side with the service key — the anon/authenticated role literally cannot read `survey_responses`.

## Database

**Supabase is the live DB.** Project: `https://kxcjmsqjogaoaiazucsk.supabase.co`. All 8 tables exist with RLS on.

Schema changes are hand-run SQL, kept in `scripts/*.sql` and numbered. Applied so far:
- `001_add_synthetic_column.sql` — `survey_responses.synthetic boolean not null default false`, plus an index on `(survey_id, synthetic)`. **Every report query must filter on `synthetic`.**
- `002_fix_survey_item_resolution.sql` — drops the dead `surveys.item_ids` and adds `surveys.instrument_version`.
- `003_demo_open_access.sql` — **demo/pilot only.** Opens `anon` SELECT on `survey_items` and guarded `anon` INSERT on `survey_responses`. Must be reverted before real data (see the open-access warning at the top).
- `004_fix_anon_submit_guard.sql` — **required with 003.** Fixes a bug where 003's insert `WITH CHECK` read `surveys` (which anon can't SELECT), rejecting every anonymous submission. Replaces the check with a `SECURITY DEFINER` function `survey_is_open()`. Revert alongside 003.

### Item resolution (read before writing report queries)

`survey_items` is a **global item bank**. It has no `survey_id` and no `school_id` — items are scoped only by `active` and `instrument_version`. A survey's item set is therefore *not* stored as a list; resolve it as:

```sql
select * from survey_items
 where active and instrument_version = <surveys.instrument_version>
 order by position;
```

`surveys.item_ids` used to look like it held this, but it was `integer[]` while `survey_items.id` is `uuid` — it could never have referenced an item. Dropped in `002`. If you find code reading it, that code is broken.

The reason this matters for the report engine: without pinning `instrument_version`, "all active items" silently spans instrument versions the moment a v3 is seeded, and cross-version aggregates look plausible while being wrong.

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

Rendering: four-node partial-correlation network + Tier 1 panels, delta-aware via `surveys.wave`. Report gating (>= 30 respondents or 60% of faculty, whichever is higher) is not implemented yet. All aggregation must run server-side with the service key and return dimension-level aggregates only.

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
