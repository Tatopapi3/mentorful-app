# Mentorful

**Evidence for principals. Privacy for teachers.**

Mentorful is a web app for schools that pair teachers across departments so they coach each other. A short anonymous survey, the
**Culture Scan**, shows the principal whether the staff is getting stronger together, and the app does it without letting
leadership read a teacher's private notes or single anyone out.

Built by Team Mentorful (Juan Fernandez, Bernard Shepard, Bertrand Cius, Eric Liu) for a real client, Mentorful, a teacher-led
startup founded by Nick Kurian and Mike. Pursuit AI-Native Builders capstone; Demo Day is Nov 9, 2026.

## What you are looking at

This branch (`main`) is the **Demo Day build**. It runs entirely on **made-up data** for a sample school, "Lincoln High", so it needs
no database, no email and no internet. Its story: a year ago the school's Culture Scan scored 85%. This year it fell to 70%. The
principal finds out what fell, where, and what to focus on next year.

The **real product** (the same app reading and writing a live Supabase database, with real sign-in) is on the branch
[`team-integration`](../../tree/team-integration). That is the version handed to the client. The screens are the same; the difference
is where the data comes from.

## Run it in one minute

You need Node.js 20 or newer (tested on Node 24).

```bash
cd apps/web
npm install
npm run demo
```

Then open <http://localhost:3400/demo>, the first page of the presentation. The word-for-word script is in
[`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md). From there:

| Open | What it is |
| --- | --- |
| <http://localhost:3400/demo> | The audience-facing first page: the story, the cast, the three screens |
| <http://localhost:3400/demo/slides> | The five Demo Day slides (arrow keys to move, `F` for full screen) |
| <http://localhost:3400/preview/as/admin?next=/admin/pulse> | The principal's dashboard, signed in as the sample principal |
| <http://localhost:3400/preview/as/teacher?next=/dashboard> | A teacher's dashboard (Ms. Afiya, English) |
| <http://localhost:3400/preview/as/teacher?who=second&next=/dashboard> | The other teacher (Mr. Stefano, Science) |

The bar at the bottom of every screen switches who you are in one click, and **Reset** puts the sample school back to the start.
Use one browser tab: the role is shared by every tab in the browser. The first visit to each page compiles, so it is a little slower.

### A two-minute tour

1. **Pulse** (principal): this year's Culture Scan, 4.2 out of 6 (70%), with last year's score (85%) as an orange tick on each bar and "down 0.9 since last year".
2. **Constellation** (principal): the faculty map. The scan is anonymous, so it shows *what* fell; the map shows *where*: English and Science have no link at all.
3. **Pairing** (principal): click **Draft new round**. The map draws four new English-Science links. **Approve 4 pairs** saves them.
4. **Ms. Afiya** (teacher): her new partner is there. Log a conversation: pick a topic, write a line, **Save draft**, then **Submit this entry**.
5. **Mr. Stefano** (teacher): open **Chat** and message Ms. Afiya.
6. **Pulse** again (principal): logged conversations went from 9 to 10, and the text of the note is nowhere on the principal's side.
7. **Trust**: a live check of what leadership can and cannot read.
8. **Reports**: **Download PDF** (leadership deck, board summary, faculty connection) and **Excel**. The deck has counts and department totals only, no names.

## Privacy by design

- Any breakdown with fewer than **5** people is hidden from the principal, so no result can point at one teacher.
- The full Culture Scan report opens only once enough of the staff has answered (about 30 respondents or 60% of faculty).
- Teachers' journals, goals and pair chats are readable only by their owner (or the two people in the pair). The admin side reads
  **zero rows** of those tables, enforced in the database with row-level security, not only in the screens.
- Reports are department-level. The deck, the board summary and the Excel files contain no teacher names. The faculty map in
  Reports does show names, for the school lead only.

## Status and known gaps

The demo build is finished and tested. The real product is a working pilot, not yet cleared for real school data. These privacy items
from the client's requirements are still open on `team-integration` and are listed, with a design for each, in
`docs/PRIVACY_FALLBACK.md` on that branch:

1. One-time survey codes (today the survey link is open).
2. Release results only after the survey closes.
3. Move reports off the service-role ("master") key and rotate it.
4. Close database functions that can be called without signing in.
5. Put the public `/report` page behind sign-in.

## Tech stack

| | |
| --- | --- |
| App | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS 4 plus a hand-written design system ("Aurora") |
| Data | Supabase (Postgres, row-level security, magic-link sign-in) in the real product; an in-memory mock of it in this demo |
| Reports | jsPDF for real PDF files, JSZip for `.xlsx` workbooks, d3-force for the faculty map |
| Tests | Vitest: `cd apps/web && npm test` (about 200 tests: privacy floors, PDFs with no names, scan cutoffs, the script's timing) |
| Hosting | Vercel |

## How the demo build differs from the real product

`PREVIEW_MOCK=1` swaps the Supabase client for an in-memory fake loaded with the Lincoln High dataset (`apps/web/src/lib/preview`).
The same pages, components and report code run on top of it. Two things exist only in the demo, on purpose: the "down since last
year" comparison (the sample school's last-year score) and the `/demo` pages (slides and script).

## Repo layout

```
apps/web/          the Next.js app
  src/app/         pages: /admin (principal), /dashboard (teacher), /survey, /report, /demo, /preview
  src/lib/         privacy rules, report and PDF code, the demo mock and sample dataset
  tests/           Vitest suites
  db/              database handoff SQL for the real product
docs/              Demo Day run sheet and script, product spec, handoff notes for the client
landing/           the marketing page
```

More: [`docs/DEMO_DAY.md`](docs/DEMO_DAY.md) (run sheet), [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) (the five-minute script),
[`docs/HANDOFF.md`](docs/HANDOFF.md) (what the client gets and what is left), [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md).

## Live demo

A hosted copy of this same build runs on Vercel behind an access code so only invited reviewers open it. The link, with its code, is
sent along with the submission. It is the same app as `npm run demo`, with the same sample data.
