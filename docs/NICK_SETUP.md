# Setting Mentorful up on your own project

Everything we built runs today on a Supabase project and a GitHub repo that belong to the Pursuit team. Nothing here has touched
your project or repo. This is the whole list of what it takes to move it, in order, so it is about an hour of copy and paste.
Eric's privacy work (one-time survey codes, results after close, the master key, anon-callable functions, the `/report` sign-in)
lands separately; see `docs/HANDOFF.md` for where each piece plugs in.

## 0. What you need

- A Supabase project with your data in it (your dump, restored; scripts `001` to `016` in `apps/web/scripts` already applied).
- The code: the `team-integration` branch of `Tatopapi3/mentorful-app` (or merge it into your repo).
- A place to host a Next.js app (Vercel works as is) and an email account for sign-in emails.

## 1. Database (Supabase, SQL editor)

1. Open `apps/web/scripts/apply_017_to_021.sql`, copy all of it, paste it into the SQL editor and click **Run**. If Supabase asks about
   row-level security on the new tables, choose **Run and enable RLS**. It adds the teacher tables, the Lookbook, the anonymous growth
   totals, the school headcount and the CTLE tables. It is safe to run twice, and each part ends with a check that stops with an
   error if a privacy rule is not in place.
2. Set the roster size the 60% participation rule measures against:
   `update public.schools set faculty_headcount = 50 where id = '<your school id>';` (use your real number).
3. Check it worked: `select count(*) from public.pair_messages;` returns `0` rather than an error.

## 2. Sign-in (Supabase, Authentication)

1. **URL Configuration:** set **Site URL** to your site's address, and under **Redirect URLs** add `https://<your site>/auth/callback`
   and `https://<your site>/**`.
2. **Emails, SMTP Settings:** switch on a custom sender. Supabase's built-in sender allows about two emails an hour. Use a sender on
   your own domain (for example `hello@mentorful.co` through Resend or Postmark) so the messages are not filed as spam. Then, under
   **Rate Limits**, raise emails per hour to fit the faculty.
3. Optional, **Emails, Templates, Magic link:** change the subject to "Your Mentorful sign-in link".

## 3. The app's settings (Vercel, Environment Variables)

| Name | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your project's URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the secret key, mark it **sensitive**. This is the master key. Rotate it now, as you said, and put the new one here. |
| `NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID` | the id of the survey row |
| `NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID` | the id of the school row |

Never set `SITE_ACCESS_KEY` in production. It exists only to keep a private test site closed.
Optional switches, all off unless set to `1`: `NEXT_PUBLIC_FEATURE_GAMES`, `NEXT_PUBLIC_FEATURE_VIDEO`, `NEXT_PUBLIC_FEATURE_CTLE`.

## 4. The first accounts

A person's sign-in email belongs to one profile. After someone signs in for the first time they see "No profile is linked yet".
Link them in the SQL editor:

```sql
update public.profiles
set auth_user_id = (select id from auth.users where lower(email) = lower('lead@yourschool.org'))
where id = '<their profile id>' and auth_user_id is null;
```

A school lead's profile has `role = 'admin'`; teachers' have `role = 'teacher'`. `docs/TEAMMATE_ACCESS.md` has a longer example that
creates admin profiles and links teachers in one go.

## 5. Check it

1. Sign in as the school lead. You should land on **Pulse**.
2. Open **Trust** (`/admin/privacy`). Every private row should read **0 · Private, as designed**.
3. Sign in as a teacher and write a note to yourself, log a conversation and send a chat message. Then, as the lead, reload Trust:
   the counts must still be **0**. That is the proof leadership cannot read them.
4. Run `npm test`, `npx tsc --noEmit` and `npm run build` in `apps/web`.

## 6. After testing

Delete the test rows before real teachers use it (chat messages, notes to self, practice entries, goals, Lookbook choices, time on
platform, test conversation logs and any test survey answers). Keep your real survey answers.
