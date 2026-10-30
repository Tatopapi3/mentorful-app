# Preview mode: click through Nick's app without his database

Nick's real pages, running on made-up data. For looking, not for shipping: this branch (`preview-mock-data`) must never be
merged into `main` or sent to Nick.

## Run it

```bash
cd apps/web
npm install        # first time only
npm run preview    # opens on http://localhost:3200
```

Then open **http://localhost:3200/preview**. It lists every page and lets you switch between the admin and a teacher.

## What you get
- 50 invented teachers across 7 departments, 32 approved pairings, 32 conversations, one draft conversation to submit, and 50
  synthetic survey respondents on his 26 real questions.
- The admin sees counts and patterns only; conversations stay private to the pair, as in his policies. A teacher sees only
  conversations they are part of.
- Everything is in memory. Logging a conversation or finishing the survey works, but nothing is saved. Restarting resets it.

## How it works
`src/lib/preview/` holds a small in-memory stand-in for the Supabase query builder plus the made-up data. Three files hook it in,
each only when `PREVIEW_MOCK=1`: `lib/supabase/server.ts`, `lib/supabase/client.ts` and `lib/report/data.ts`. It refuses to run in a
production build, and it never opens a connection to Supabase.

## What it is not
It is not his database. Row-level security, constraints and policies are not tested here: only a few of the visibility rules
(admins can't read conversation rows, teachers see their own) are imitated so the pages look right. The real rules need the dump.
