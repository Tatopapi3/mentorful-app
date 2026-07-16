# Mentorful web app

Next.js 16 (App Router, Turbopack) + React 19 + TypeScript. Part of the `mentorful-app` monorepo; this app lives at `apps/web`.

## Database

**Supabase is the live DB.** Project: `https://kxcjmsqjogaoaiazucsk.supabase.co`. All 8 tables exist with RLS on.

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

## Env

`.env.local` (gitignored) holds:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Conventions

- Path alias: `@/*` → `./src/*`
- App Router under `src/app/`
- Styling is intentionally unstyled inline for now; Tailwind v4 is wired via `@tailwindcss/postcss` for later polish
