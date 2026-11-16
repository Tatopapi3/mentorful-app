# Mentorful

Mentorful pairs teachers across departments, gives each pair a private space to log what they talk about, and gives school
leaders anonymous evidence of how the staff is doing (the Culture Scan survey and activity counts). A school leader can see that
conversations happen and how the scan moved, but can never read what a teacher wrote.

Built by the Pursuit capstone team (Juan Fernandez, Eric Liu, Bernard Shepard, Bertrand Cius) for Nick Kurian and Mike Kleba.

**Status:** built and tested on a copy of the client's sandbox data (50 sample teachers, 32 pairs, invented conversations). It has
not yet been run on the client's own project or with a real school.

## Where things are

- **Default branch: `team-integration`.** This is the real product, and it runs on a live Supabase project.
- **`demo/day`.** The Demo Day build. It runs on made-up data in memory and is for showing only.
- **`roster-screen`.** The screen where a school leader adds teachers, with the database script it needs (`026_roster.sql`).
  Built and tested, not merged yet.
- **`future/after-nov-4`.** Work for later, such as photographing a handwritten page into a private note. See
  `docs/FUTURE_AFTER_NOV_4.md` on that branch.

### Live sites

Both sites are closed behind an access code, which is sent separately and is not kept in this repository.

| Site | What it is | Address |
|---|---|---|
| Demo Day sample | Made-up data, no sign-in | https://team-mentorful-demo.vercel.app/demo |
| Real build on our copy of the data | The `team-integration` branch. Switched off on **November 30, 2026**. | https://mentorful-staging.vercel.app |

After November 30 the real build is meant to run on your own Supabase and Vercel projects (see below).

## What it is built with

Next.js 16 (App Router, React 19, TypeScript) in `apps/web`, hosted on Vercel. Supabase provides the Postgres database, sign-in by
emailed link and row-level security. Leadership decks are built with pptxgenjs. Tests run with Vitest.

## Run it

1. Set it up on your own projects by following [`docs/NICK_SETUP.md`](docs/NICK_SETUP.md). It takes about an hour: database
   scripts, sign-in settings, Vercel settings, first accounts, then a 15-minute check.
2. To run it on your computer, from `apps/web`:

   ```
   npm install
   npm run dev
   ```

   It needs the settings listed in step 3 of the setup guide in a `.env.local` file in `apps/web`. That file is not in the
   repository and must never be committed.
3. Before changing code, all three of these must pass:

   ```
   npm test
   npx tsc --noEmit
   npm run build
   ```

Database changes are numbered SQL files in `apps/web/scripts`. Add the next number and run it in the Supabase SQL editor. Do not
edit a script that has already been run.

## Read next

- [`docs/NICK_SETUP.md`](docs/NICK_SETUP.md): moving Mentorful to your own Supabase and Vercel projects.
- [`docs/PRIVACY_RUNBOOK.md`](docs/PRIVACY_RUNBOOK.md): how privacy is enforced, and the queries that check it.
- [`docs/HANDOFF.md`](docs/HANDOFF.md) and [`docs/HANDOFF_CHECKLIST.md`](docs/HANDOFF_CHECKLIST.md): handoff notes and what is still open.
- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md): what the product does.

## What is next

The full list, with an owner and a date for every open item, is in the Client Handoff Document that came with the handoff email.
In short: a screen for school leaders to add teachers (built, on `roster-screen`), a signed-in click-through of every screen, confirming
the Low and Watch cutoffs on the scan averages, and running the database scripts on your own Supabase project.

Ideas for a later version: per-field Lookbook choices, comparing one school year with the next, the Partnership Pulse Check,
triads and a content-sharing feed, rate limiting on the survey page, and reading handwritten notes from a photo.

## Privacy rules to keep

- Groups smaller than 5 are never shown to school leaders. Zero counts as smaller than 5.
- School leaders see counts and anonymous totals, never a teacher's notes, goals, chat or conversations.
- Culture Scan results are released only after the survey closes.
- Never commit keys, access codes or `.env` files.

No license file has been added yet. The owner should choose a license.
