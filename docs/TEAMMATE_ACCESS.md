# Giving teammates both dashboards

One sign-in email can belong to **one** profile, so a person who needs the admin dashboard **and** a teacher dashboard uses **two
sign-in emails** that land in the same inbox. Gmail and Google Workspace both deliver `name+anything@domain` to `name@domain`.
This is how Juan has it today: `juan.fernandez@pursuit.org` is the admin, `juan.fernandez+layla@pursuit.org` is the teacher Layla Adams.

| Person | Admin sign-in | Teacher sign-in | Teacher profile they become |
| --- | --- | --- | --- |
| Juan | `juan.fernandez@pursuit.org` (done) | `juan.fernandez+layla@pursuit.org` (done) | Layla Adams, Arts |
| Bernard | `bernard.shepard+admin@pursuit.org` | `bernard.shepard+teacher@pursuit.org` | Henry White, English |
| Bertrand | `bertrand.cius+admin@pursuit.org` | `bertrand.cius+teacher@pursuit.org` | Owen Perez, Science |
| Eric | `ericliu93+admin@gmail.com` | `ericliu93+teacher@gmail.com` | Grace Clark, Science |

(Emails are the ones in the team Slack. If one is wrong, change it in the table and in the script below.)

## Steps

1. **Real email sender working first** (Supabase, Authentication, SMTP). Without it nobody can receive a sign-in link.
2. **Each person signs in twice** at the site the team uses (the staging address, once it exists; `localhost:3000/login` only works on
   Juan's laptop): once with the admin email, once with the teacher email, each from its own browser window (use a private window for
   the second). Each sign-in lands on "No profile is linked yet". That is expected: it creates the login.
3. **Juan pastes the script below** into Supabase, SQL Editor, and runs it. It stops with a clear message if any of the six
   logins hasn't signed in yet, and changes nothing in that case.
4. **Each person signs in again.** The admin email opens the principal's dashboard, the teacher email opens the teacher dashboard.

## The script

```sql
begin;

do $$
declare missing text;
begin
  select string_agg(e, ', ') into missing
  from unnest(array[
    'bernard.shepard+admin@pursuit.org','bernard.shepard+teacher@pursuit.org',
    'bertrand.cius+admin@pursuit.org','bertrand.cius+teacher@pursuit.org',
    'ericliu93+admin@gmail.com','ericliu93+teacher@gmail.com'
  ]) as e
  where not exists (select 1 from auth.users u where lower(u.email) = lower(e));
  if missing is not null then
    raise exception 'These have not signed in yet: %', missing;
  end if;
end $$;

-- Teacher logins: each takes over a sample teacher.
update public.profiles p set auth_user_id = u.id, email = u.email
from auth.users u
where lower(u.email) = 'bernard.shepard+teacher@pursuit.org' and p.first_name = 'Henry' and p.last_name = 'White' and p.auth_user_id is null;

update public.profiles p set auth_user_id = u.id, email = u.email
from auth.users u
where lower(u.email) = 'bertrand.cius+teacher@pursuit.org' and p.first_name = 'Owen' and p.last_name = 'Perez' and p.auth_user_id is null;

update public.profiles p set auth_user_id = u.id, email = u.email
from auth.users u
where lower(u.email) = 'ericliu93+teacher@gmail.com' and p.first_name = 'Grace' and p.last_name = 'Clark' and p.auth_user_id is null;

-- Admin logins: each gets a school-lead profile in the sandbox school, like Juan's.
insert into public.profiles (id, school_id, first_name, last_name, email, role, department, onboarding_complete, is_demo, auth_user_id)
select gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', v.first_name, v.last_name, u.email, 'admin', 'Leadership', true, false, u.id
from (values
  ('bernard.shepard+admin@pursuit.org', 'Bernard', 'Shepard'),
  ('bertrand.cius+admin@pursuit.org', 'Bertrand', 'Cius'),
  ('ericliu93+admin@gmail.com', 'Eric', 'Liu')
) as v(email, first_name, last_name)
join auth.users u on lower(u.email) = lower(v.email)
where not exists (select 1 from public.profiles p where p.auth_user_id = u.id);

-- What it did: three teachers linked, three admins added.
select p.role, p.first_name, p.last_name, u.email
from public.profiles p join auth.users u on u.id = p.auth_user_id
order by p.role, p.first_name;

commit;
```

## Undo (for one person)

```sql
-- Example for Bernard: free the teacher profile and remove the admin profile. Their logins stay, but link to nothing.
update public.profiles set auth_user_id = null where auth_user_id = (select id from auth.users where lower(email) = 'bernard.shepard+teacher@pursuit.org');
delete from public.profiles where auth_user_id = (select id from auth.users where lower(email) = 'bernard.shepard+admin@pursuit.org');
```

## Things to know

- The three teacher profiles are sample teachers who already have a partner, conversations and a notebook. Anything a teammate writes
  while testing is real rows in the database, so there is a cleanup list to run before the handoff to Nick (see `docs/HANDOFF_CHECKLIST.md`).
- Admins see counts only. Even with admin access, a teammate cannot read another person's notes, goals or conversations.
