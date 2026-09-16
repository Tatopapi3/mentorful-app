-- 012_profile_schema_for_dashboards.sql
--
-- Schema for the rebuilt admin + teacher dashboards. Structure only; 013 writes
-- the data.
--
-- LOCKED DESIGN THIS ENCODES
--   CUT      disc_style, big_five        — both 0/50, never populated. Free to drop.
--            fun_tags                    — populated, but only 4 placeholder combos
--                                          (Coach/Artist/Builder/Explorer). NOT the
--                                          real archetype system; superseded by
--                                          archetype_id below.
--   KEEP     archetype_id                — the real 11-archetype Kurian Consulting
--                                          set, for in-person PD. NOT a dashboard
--                                          grouping axis.
--            teaching_style              — light accent: nurturer/activator/architect
--   RENAME   why_teach -> inspiration    — rendered as a bare quote on the profile
--                                          card, with no header.
--   PRIMARY  domain strength stays DERIVED from strength_tags via the 16-tag ->
--            4-domain lookup. No score column, no fabricated magnitudes.
--
-- *** LIVE TABLE: profiles, 54 rows. Drops 3 columns; renames 1. ***
-- The 3 dropped columns hold no data worth keeping (disc_style and big_five are
-- entirely null; fun_tags is 4 repeated placeholder pairs).

begin;

-- ---------------------------------------------------------------------------
-- 1. PRECONDITIONS. Refuse to drop a column that turns out to hold real data.
-- ---------------------------------------------------------------------------

do $$
declare
  n_disc int;
  n_big  int;
begin
  select count(*) into n_disc from public.profiles where disc_style is not null;
  select count(*) into n_big  from public.profiles where big_five   is not null;

  if n_disc > 0 or n_big > 0 then
    raise exception
      '012: disc_style has % non-null value(s) and big_five has %. Both were '
      'expected to be entirely empty. Export them before dropping.', n_disc, n_big;
  end if;

  raise notice '012: disc_style and big_five confirmed empty; safe to drop';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Drop the cut columns.
--    fun_tags IS populated, deliberately dropped anyway: 4 repeated combos of
--    Coach/Artist/Builder/Explorer across 50 people is not a signal, and it is
--    a different vocabulary from the real 11 archetypes. Keeping both would
--    leave two competing "archetype" fields, which is how the one that matters
--    gets ignored.
-- ---------------------------------------------------------------------------

alter table public.profiles
  drop column if exists disc_style,
  drop column if exists big_five,
  drop column if exists fun_tags;

-- ---------------------------------------------------------------------------
-- 3. why_teach -> inspiration.
--    The field is rendered as a plain quote with no label, so the column name
--    should not imply a heading the UI never shows.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='profiles'
                and column_name='why_teach')
     and not exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='profiles'
                and column_name='inspiration') then
    alter table public.profiles rename column why_teach to inspiration;
  end if;
end $$;

comment on column public.profiles.inspiration is
  'First-person sentence about why this teacher teaches. Rendered as a bare '
  'quote on the profile card — no "Your Why" header, no label. Was why_teach.';

-- ---------------------------------------------------------------------------
-- 4. Constrain the two retained vocabularies.
--
--    Values come from the April prototype at ~/mentorful-app/app/onboarding/
--    data.js, which is the canonical source. Do not invent new ones here — the
--    taglines and blurbs that go with them are already written there, and the
--    dashboards reuse that copy verbatim.
--
--    NULL is allowed: the 4 real staff accounts legitimately have neither yet.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid='public.profiles'::regclass
                    and conname='profiles_teaching_style_check') then
    alter table public.profiles
      add constraint profiles_teaching_style_check
      check (teaching_style is null
             or teaching_style in ('nurturer', 'activator', 'architect'));
  end if;

  if not exists (select 1 from pg_constraint
                  where conrelid='public.profiles'::regclass
                    and conname='profiles_archetype_id_check') then
    alter table public.profiles
      add constraint profiles_archetype_id_check
      check (archetype_id is null or archetype_id in (
        'puzzler', 'story-lover', 'fixer', 'mover-shaker', 'competitor',
        'performer', 'artist', 'collector', 'party-captain', 'prankster',
        'novelty-seeker'));
  end if;
end $$;

comment on column public.profiles.teaching_style is
  'Hargreaves style: nurturer | activator | architect. LIGHT ACCENT — flavours '
  'pairing copy and the admin distribution panel. Taglines in data.js.';
comment on column public.profiles.archetype_id is
  'One of the 11 Kurian Consulting archetypes (data.js ARCHETYPES). Retained for '
  'in-person PD and for co-mentor contrast copy. NOT a dashboard grouping axis.';

commit;

-- ---------------------------------------------------------------------------
-- VERIFY (read-only, after the commit)
-- ---------------------------------------------------------------------------
-- select column_name, data_type from information_schema.columns
--  where table_schema='public' and table_name='profiles' order by ordinal_position;
-- -- expect: inspiration present; disc_style / big_five / fun_tags / why_teach absent
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid='public.profiles'::regclass and contype='c';
