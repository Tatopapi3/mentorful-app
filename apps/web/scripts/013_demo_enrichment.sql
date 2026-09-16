-- 013_demo_enrichment.sql
--
-- Populate the demo data the rebuilt dashboards need. Run AFTER 012.
--
-- SCOPE: a demo, not a full roster. Three teachers become loginable on auth
-- accounts you control; the other 47 get enough to make the admin aggregate
-- panels honest. Only nine people get written prose.
--
-- *** LIVE TABLES: profiles (54 rows), conversation_logs (32 rows). ***
-- No row is deleted except the 3 thin placeholder profiles being replaced.

begin;

-- ===========================================================================
-- 1. teaching_style for all 50 demo teachers.
--
--    Derived from strength domains rather than assigned at random, so the
--    admin distribution panel tells a coherent story instead of noise. The
--    tag -> domain lookup below is the SAME 16-entry mapping the app uses;
--    it is spelled out here so this migration is self-contained and so the
--    canonical list exists somewhere reviewable.
--
--    Resulting distribution: nurturer 22, activator 14, architect 14.
-- ===========================================================================

with tag_domain(tag, domain) as (values
  ('Classroom Presence','CLASSROOM'),      ('Discussion Craft','CLASSROOM'),
  ('Clear Explanations','CLASSROOM'),      ('Warm-Strict Culture','CLASSROOM'),
  ('Unit Architecture','PLANNING'),        ('Task Design','PLANNING'),
  ('Pacing and Sequencing','PLANNING'),    ('Differentiation Planning','PLANNING'),
  ('Rubric Clarity','ASSESSMENT'),         ('Feedback Efficiency','ASSESSMENT'),
  ('Mastery Checks','ASSESSMENT'),         ('Data-Informed Reteach','ASSESSMENT'),
  ('Family Communication','COMMUNICATION'),('Student Conferencing','COMMUNICATION'),
  ('Team Coordination','COMMUNICATION'),   ('De-escalation and Repair','COMMUNICATION')
),
teacher_domains as (
  select p.id,
         array_agg(distinct td.domain order by td.domain) as domains
    from public.profiles p
    cross join lateral jsonb_array_elements_text(p.strength_tags) as t(tag)
    join tag_domain td on td.tag = t.tag
   where p.is_demo
   group by p.id
)
update public.profiles p
   set teaching_style = case
         -- care/relationship domains lead -> Nurturer
         when d.domains @> array['CLASSROOM','COMMUNICATION']  then 'nurturer'
         when d.domains @> array['ASSESSMENT','COMMUNICATION'] then 'nurturer'
         -- design/mastery domains lead -> Architect
         when d.domains @> array['ASSESSMENT','PLANNING']      then 'architect'
         -- presence + momentum -> Activator
         else 'activator'
       end
  from teacher_domains d
 where d.id = p.id;

-- ===========================================================================
-- 2. archetype_id for all 50 — spread deterministically over the real 11.
--    Overridden for the nine demo-visible people in section 3, where the
--    choices are deliberate.
-- ===========================================================================

with numbered as (
  select id, (row_number() over (order by id)) - 1 as n
    from public.profiles where is_demo
)
update public.profiles p
   set archetype_id = (array[
         'puzzler','story-lover','fixer','mover-shaker','competitor','performer',
         'artist','collector','party-captain','prankster','novelty-seeker'
       ])[(n % 11) + 1]
  from numbered where numbered.id = p.id;

-- ===========================================================================
-- 3. The nine demo-visible profiles: archetype + inspiration.
--
--    Three claimable teachers and their six co-mentors. Archetypes are chosen
--    so each PAIR contrasts — see the note in section 5 about why the contrast
--    has to come from here rather than from strengths.
-- ===========================================================================

-- --- Liam Rivera (Math, activator) and his two co-mentors ------------------
update public.profiles set archetype_id = 'performer',
  inspiration = 'I had a teacher who ran class like a conversation you couldn''t wait to join. I''ve been chasing that room ever since.'
 where id = 'ec258a02-f6a6-581e-a3d0-c6e5fbbea5cc';   -- Liam Rivera

update public.profiles set archetype_id = 'collector',
  inspiration = 'Math was the first subject where I felt genuinely smart, and only because someone slowed down for me. I keep the pace slow on purpose.'
 where id = '69d26c90-6a5e-5e2b-b105-a5c0dea9661a';   -- Ava Patel

update public.profiles set archetype_id = 'puzzler',
  inspiration = 'I like the moment a student stops asking whether they got it right and starts asking why it works.'
 where id = '1adc2310-24a8-5374-a253-aa7240245678';   -- Mia Kim

-- --- Avery Harris (Science, architect) and co-mentors ----------------------
update public.profiles set archetype_id = 'fixer',
  inspiration = 'I spent my first three years grading until midnight and calling it dedication. Now I''d rather design the unit so the feedback is fast and the kids actually read it.'
 where id = 'e80a0a92-6c69-53ff-87cc-74a75556a971';   -- Avery Harris

update public.profiles set archetype_id = 'novelty-seeker',
  inspiration = 'Nobody in my family had done a science degree. A teacher handed me a lab notebook and acted like it was obvious I''d use it.'
 where id = 'afdc7beb-c09b-54a7-8ecb-28534f521afc';   -- Noah Nguyen

update public.profiles set archetype_id = 'mover-shaker',
  inspiration = 'The best lesson I ever taught was one I scrapped halfway through, because the students had a better question than mine.'
 where id = 'efbda83e-cb1c-5732-812a-c20bf863e375';   -- Jack Martin

-- --- Harper Lopez (English, nurturer) and co-mentors -----------------------
update public.profiles set archetype_id = 'party-captain',
  inspiration = 'I teach the kid who has already decided they are not a reader. That decision gets made early and it is almost always wrong.'
 where id = '54d4354e-0f7d-534d-a1be-b10d4d45f6c1';   -- Harper Lopez

update public.profiles set archetype_id = 'story-lover',
  inspiration = 'Every family I call is braced for bad news. I try to make the first call the one that isn''t.'
 where id = 'f94d9ecf-1e5e-5cd7-bdf6-2feff865617c';   -- Mason Davis

update public.profiles set archetype_id = 'prankster',
  inspiration = 'A class that laughs together will argue about a book together. I have never found a shortcut around that order.'
 where id = '0bd955de-d9b2-526d-80e1-7e96269ec991';   -- Logan Wilson

-- ===========================================================================
-- 4. CLAIM the three demo teachers onto real auth accounts.
--
--    auth_user_id is UNIQUE, so the thin placeholder profile must release the
--    auth user BEFORE the demo profile takes it. Order is load-bearing.
--
--    The thin rows are then deleted. Verified 2026-09-14: none of the four is
--    referenced by pairings, conversation_logs, surveys.created_by, or
--    invites.invited_by, so the deletes are clean.
--
--      nkurian@gcschool.org       -> Liam Rivera   (Math,    activator, performer)
--      klebam@northshoreschools   -> Avery Harris  (Science, architect, fixer)
--      nicholasjkurian@gmail.com  -> Harper Lopez  (English, nurturer,  party-captain)
--      nick@kurianconsulting.com  -> stays ADMIN, repaired in section 6
--
--    NOTE: profiles.email keeps the @demo.mentorful.co address. The auth link
--    is auth_user_id, not email — so the roster stays internally coherent and
--    the login still works. Any future claim-on-login-by-email will simply not
--    match these three, which is correct: they are already claimed.
-- ===========================================================================

update public.profiles set auth_user_id = null
 where id in ('c0da7098-014a-4be0-b790-72a88091fd6a',
              '9ad5bafe-95a9-4764-94b1-f115dbd0148d',
              '3a159ad5-e6f7-453a-9bf5-2cff7bcf4a51');

update public.profiles set auth_user_id = 'c0da7098-014a-4be0-b790-72a88091fd6a'
 where id = 'ec258a02-f6a6-581e-a3d0-c6e5fbbea5cc';   -- Liam Rivera

update public.profiles set auth_user_id = '9ad5bafe-95a9-4764-94b1-f115dbd0148d'
 where id = 'e80a0a92-6c69-53ff-87cc-74a75556a971';   -- Avery Harris

update public.profiles set auth_user_id = '3a159ad5-e6f7-453a-9bf5-2cff7bcf4a51'
 where id = '54d4354e-0f7d-534d-a1be-b10d4d45f6c1';   -- Harper Lopez

delete from public.profiles
 where id in ('c0da7098-014a-4be0-b790-72a88091fd6a',
              '9ad5bafe-95a9-4764-94b1-f115dbd0148d',
              '3a159ad5-e6f7-453a-9bf5-2cff7bcf4a51');

-- ===========================================================================
-- 5. Rewrite the six conversation_logs the demo teachers appear in.
--
--    WHY: the Neon seeder wrote ONE block of prose per domain, so all nine
--    CLASSROOM logs are byte-identical, as are all nine PLANNING logs, and so
--    on. A journal panel would show two entries with the same words — which
--    reads as a bug, not as demo data.
--
--    Each log is rewritten from the VISITOR's point of view about the HOST's
--    practice, which is what a visit debrief actually is.
-- ===========================================================================

-- Liam observed Ava ---------------------------------------------------------
update public.conversation_logs set
  vision          = 'Ava wants the room to run on student talk, with her voice as the smallest one in it.',
  strength_noted  = 'Her cold-call is genuinely warm — she names the student, waits, and nobody flinches. The wait time is longer than mine by a mile.',
  more_frequently = 'Turn-and-talk before the whole-group share. Students arrived at the share with something already formed.',
  less_frequently = 'She re-explains after a correct answer, which quietly tells the class the answer needed her endorsement.',
  resources       = 'She is sending me her discussion-protocol one-pager. I owe her the unit map for the ratios arc.'
 where id = '65737eea-f445-5af1-b66d-796e5ada0150';

-- Mia observed Liam ---------------------------------------------------------
update public.conversation_logs set
  vision          = 'Liam is trying to get the energy of his best days to show up on the ordinary ones.',
  strength_noted  = 'He can restart a dead room in about ninety seconds. Students track him and the pace never sags.',
  more_frequently = 'Write the objective where students can see it. Twice I watched a kid get lost and have nothing to steer back toward.',
  less_frequently = 'Multi-step verbal directions during transitions. Three instructions at once and a third of the room is guessing.',
  resources       = 'I said I would share the checkpoint slide I use mid-lesson. He is going to try it Thursday.'
 where id = '46b27adc-553b-52c2-b870-5455ac54e7b6';

-- Avery observed Noah -------------------------------------------------------
update public.conversation_logs set
  vision          = 'Noah wants a unit where every day obviously earns its place in the arc.',
  strength_noted  = 'His daily objectives are written as questions students can actually answer by the bell. No fluff, no verbs like "explore".',
  more_frequently = 'The five-minute recap at the start that reconnects yesterday to today. It did more than any review day would have.',
  less_frequently = 'Two new representations in one lesson. The second one landed on students still holding the first.',
  resources       = 'Swapping unit maps. He wants my pacing calendar; I want his objective-writing frame.'
 where id = '7da6544c-0dfc-500b-a3bd-0b2858188b07';

-- Jack observed Avery -------------------------------------------------------
update public.conversation_logs set
  vision          = 'Avery is rebuilding the feedback loop so it closes in a day instead of a week.',
  strength_noted  = 'The exit ticket is three questions and she has the reteach list before she leaves the room. No weekend grading.',
  more_frequently = 'Showing students the rubric row she is actually scoring. They stopped guessing at what "developing" meant.',
  less_frequently = 'Written comments on work that will be revised anyway. She agreed most of it is never read.',
  resources       = 'She is giving me the exit-ticket template. I am walking her through how I do the revision cycle.'
 where id = '57b8c601-eec4-5632-8c31-e8ca7295068c';

-- Harper observed Mason -----------------------------------------------------
update public.conversation_logs set
  vision          = 'Mason wants the first contact home to be about something good, before anything has gone wrong.',
  strength_noted  = 'He keeps a two-line log of every family call. When a hard conversation comes, he has history to stand on.',
  more_frequently = 'Naming the specific thing the student did, not the trait. "She revised the whole second paragraph" travels better than "she is conscientious".',
  less_frequently = 'Apologising at the start of a call. It sets the family up to expect bad news before he has said anything.',
  resources       = 'He is sharing his call log format. I am sending him the repair conversation script we use after a conflict.'
 where id = '7a8b90ac-e899-5988-9bcb-28955ef48071';

-- Logan observed Harper -----------------------------------------------------
update public.conversation_logs set
  vision          = 'Harper wants the class norms to hold without her having to enforce them out loud.',
  strength_noted  = 'She repairs fast. A student pushed back hard and they were fine four minutes later, with no audience to the reset.',
  more_frequently = 'The private check-in at the door. Two kids walked in already regulated because of a ten-second conversation.',
  less_frequently = 'Addressing one student''s behaviour to the whole room. The other twenty-nine pay for it and the one it is aimed at digs in.',
  resources       = 'I am borrowing her door check-in. She wants the norms-setting activity I run in September.'
 where id = 'ee5c452f-1861-58a6-9192-4ac6336aaee3';

-- ===========================================================================
-- 6. Repair the admin account so /admin is demoable.
--    The signup path wrote first_name = the email local part and left
--    last_name empty. This is the only real account remaining after section 4.
-- ===========================================================================

update public.profiles set
  first_name     = 'Nicholas',
  last_name      = 'Kurian',
  department     = 'Leadership',
  teaching_style = 'architect',
  archetype_id   = 'collector',
  inspiration    = 'I stopped teaching and immediately missed the only part that mattered: watching somebody get better at something hard.'
 where auth_user_id = 'debf36dc-b98d-4d38-876b-6238af9eaf24';

-- ===========================================================================
-- 7. Self-test before committing.
-- ===========================================================================

do $$
declare
  n_style int; n_arch int; n_claimed int; n_insp int; n_dupe int; n_profiles int;
begin
  select count(*) into n_style from public.profiles where is_demo and teaching_style is null;
  select count(*) into n_arch  from public.profiles where is_demo and archetype_id   is null;
  if n_style > 0 or n_arch > 0 then
    raise exception '013: % demo profiles missing teaching_style, % missing archetype_id', n_style, n_arch;
  end if;

  select count(*) into n_claimed from public.profiles where is_demo and auth_user_id is not null;
  if n_claimed <> 3 then
    raise exception '013: expected exactly 3 claimed demo profiles, found %', n_claimed;
  end if;

  select count(*) into n_profiles from public.profiles;
  if n_profiles <> 51 then
    raise exception '013: expected 51 profiles after cleanup (50 demo + 1 admin), found %', n_profiles;
  end if;

  select count(*) into n_insp from public.profiles where inspiration is not null;
  if n_insp < 10 then
    raise exception '013: expected at least 10 inspiration quotes (9 demo + admin), found %', n_insp;
  end if;

  -- The journal must not show duplicate prose for any claimed teacher.
  select count(*) into n_dupe from (
    select vision from public.conversation_logs
     where host_id in (select id from public.profiles where auth_user_id is not null and is_demo)
        or visitor_id in (select id from public.profiles where auth_user_id is not null and is_demo)
     group by vision having count(*) > 1
  ) d;
  if n_dupe > 0 then
    raise exception '013: % duplicated vision text among the demo teachers'' logs', n_dupe;
  end if;

  raise notice '013: OK — 50 styled/archetyped, 3 claimed, % profiles total, no duplicate journal prose', n_profiles;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- VERIFY (read-only, after the commit)
-- ---------------------------------------------------------------------------
-- -- a. The three logins and what they will see.
-- select p.first_name, p.last_name, p.department, p.teaching_style, p.archetype_id,
--        u.email as login_email,
--        (select count(*) from public.conversation_logs c
--          where c.host_id = p.id or c.visitor_id = p.id) as journal_entries
--   from public.profiles p join auth.users u on u.id = p.auth_user_id
--  where p.is_demo order by p.last_name;
-- -- expect 3 rows, 2 journal entries each
--
-- -- b. Admin distribution panel source.
-- select teaching_style, count(*) from public.profiles where is_demo group by 1 order by 2 desc;
-- -- expect nurturer 22, activator 14, architect 14
--
-- select archetype_id, count(*) from public.profiles where is_demo group by 1 order by 2 desc;
--
-- -- c. Nothing orphaned.
-- select count(*) from public.profiles;                       -- expect 51
-- select count(*) from public.profiles where auth_user_id is not null;  -- expect 4
