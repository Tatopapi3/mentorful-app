-- 018_teacher_lookbook.sql
--
-- The teacher lookbook, inside the My pair tab on /dashboard/aurora: a card for each teacher who chooses to share one
-- (photo, headline, bio, experience, achievements, what they hope to get out of Mentorful, and, only if they choose,
-- what they are currently growing in), and a way for colleagues in the same school to browse them when looking for a
-- co-mentor.
--
-- WRITTEN, NOT YET APPLIED. Checked on a throwaway Postgres (PGlite) with stand-ins for 009's helpers and Supabase's
-- storage schema; not yet run against the real database.
--
-- Principles, enforced here and not by the page:
--   * OPT-IN. A card is private to its author until they publish it. Nothing is created for a teacher.
--   * SELF-AUTHORED. Only the teacher writes their card. No colleague and no admin writes or edits it. "Growing in" is
--     the teacher's own words about themselves, shown only if they turn it on (show_growth), and never an assessment by
--     anyone else: Mentorful is developmental, not evaluative.
--   * SAME SCHOOL, TEACHERS ONLY. Colleagues read published cards through lookbook_cards() (below), never the table.
--     School leadership (is_school_admin) gets no rows: this is a peer space, like the pair's.
--   * NOTHING NEW ON `profiles`. The few profile fields a card shows (name, department, years teaching, strengths,
--     teaching style, archetype, inspiration) are returned by the function, and only for published cards.
--
-- Depends on 009's my_profile_id(), my_school_id() and is_school_admin().
--
-- *** Adds one table, one function, one storage bucket and their policies. Changes no existing table. ***

begin;

-- ------------------------------------------------------------------ table

create table if not exists public.teacher_cards (
  profile_id    uuid primary key,
  school_id     uuid not null,
  headline      text check (headline is null or char_length(headline) <= 120),
  bio           text check (bio is null or char_length(bio) <= 600),
  photo_path    text check (photo_path is null or char_length(photo_path) <= 200),
  experience    jsonb not null default '[]'::jsonb  check (jsonb_typeof(experience)   = 'array' and jsonb_array_length(experience)   <= 6),
  achievements  jsonb not null default '[]'::jsonb  check (jsonb_typeof(achievements) = 'array' and jsonb_array_length(achievements) <= 8),
  growing_in    jsonb not null default '[]'::jsonb  check (jsonb_typeof(growing_in)    = 'array' and jsonb_array_length(growing_in)    <= 6),
  wants         jsonb not null default '[]'::jsonb  check (jsonb_typeof(wants)         = 'array' and jsonb_array_length(wants)         <= 8),
  wants_text    text check (wants_text is null or char_length(wants_text) <= 500),
  show_growth   boolean not null default false,
  published     boolean not null default false,
  updated_at    timestamptz not null default now()
);

alter table public.teacher_cards enable row level security;
alter table public.teacher_cards force row level security;

drop policy if exists "owner reads own card"   on public.teacher_cards;
drop policy if exists "owner writes own card"  on public.teacher_cards;
drop policy if exists "owner edits own card"   on public.teacher_cards;

create policy "owner reads own card"  on public.teacher_cards for select to authenticated
  using (profile_id = public.my_profile_id());
create policy "owner writes own card" on public.teacher_cards for insert to authenticated
  with check (profile_id = public.my_profile_id() and school_id = public.my_school_id());
create policy "owner edits own card"  on public.teacher_cards for update to authenticated
  using (profile_id = public.my_profile_id())
  with check (profile_id = public.my_profile_id() and school_id = public.my_school_id());

revoke all on public.teacher_cards from anon, public;
grant select, insert, update on public.teacher_cards to authenticated;   -- no delete: unpublish instead

-- ---------------------------------------------------------- the lookbook

-- What a colleague may see of a published card, and nothing else. SECURITY DEFINER so it can read across the school
-- without widening anyone's access to `profiles` or to the card table.
create or replace function public.lookbook_cards()
returns table (
  profile_id uuid, name text, department text, years_teaching integer, strength_tags jsonb, teaching_style text,
  archetype_id text, inspiration text, headline text, bio text, photo_path text, experience jsonb, achievements jsonb,
  growing_in jsonb, wants jsonb, wants_text text, updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.profile_id,
         nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
         p.department, p.years_teaching, p.strength_tags, p.teaching_style, p.archetype_id, p.inspiration,
         c.headline, c.bio, c.photo_path, c.experience, c.achievements,
         case when c.show_growth then c.growing_in else '[]'::jsonb end,
         c.wants, c.wants_text, c.updated_at
    from public.teacher_cards c
    join public.profiles p on p.id = c.profile_id
   where c.published
     and c.school_id = public.my_school_id()
     and coalesce(p.role, 'teacher') = 'teacher'
     and not public.is_school_admin()
   order by p.last_name, p.first_name, c.profile_id
$$;

revoke all on function public.lookbook_cards() from public;
grant execute on function public.lookbook_cards() to authenticated;

-- ------------------------------------------------------ photo storage

-- Objects live at <school_id>/<profile_id>.jpg. The author may write and remove their own; a colleague may read a photo
-- only when its card is published in their school (the function below answers that without exposing the table).
create or replace function public.can_read_card_photo(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.teacher_cards c
     where c.photo_path = p_path
       and (c.profile_id = public.my_profile_id()
            or (c.published and c.school_id = public.my_school_id() and not public.is_school_admin()))
  );
$$;

revoke all on function public.can_read_card_photo(text) from public;
grant execute on function public.can_read_card_photo(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('teacher-photos', 'teacher-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "colleagues read published card photos" on storage.objects;
drop policy if exists "owner adds own card photo"             on storage.objects;
drop policy if exists "owner replaces own card photo"         on storage.objects;
drop policy if exists "owner removes own card photo"          on storage.objects;

create policy "colleagues read published card photos" on storage.objects for select to authenticated
  using (bucket_id = 'teacher-photos' and public.can_read_card_photo(name));
create policy "owner adds own card photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'teacher-photos' and name = public.my_school_id()::text || '/' || public.my_profile_id()::text || '.jpg');
create policy "owner replaces own card photo" on storage.objects for update to authenticated
  using (bucket_id = 'teacher-photos' and name = public.my_school_id()::text || '/' || public.my_profile_id()::text || '.jpg')
  with check (bucket_id = 'teacher-photos' and name = public.my_school_id()::text || '/' || public.my_profile_id()::text || '.jpg');
create policy "owner removes own card photo" on storage.objects for delete to authenticated
  using (bucket_id = 'teacher-photos' and name = public.my_school_id()::text || '/' || public.my_profile_id()::text || '.jpg');

-- ------------------------------------------------------------ self-test

do $$
declare n_card int; n_obj int; leaky int; anon_grants int; admin_path int; bucket_public boolean; forced boolean;
begin
  select count(*) into n_card from pg_policies where schemaname = 'public' and tablename = 'teacher_cards';
  select count(*) into n_obj from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname in
     ('colleagues read published card photos', 'owner adds own card photo', 'owner replaces own card photo', 'owner removes own card photo');
  select count(*) into leaky from pg_policies
   where (schemaname = 'public' and tablename = 'teacher_cards' and coalesce(qual, '') || coalesce(with_check, '') not like '%my_profile_id%')
      or (policyname in ('colleagues read published card photos', 'owner adds own card photo', 'owner replaces own card photo', 'owner removes own card photo')
          and (coalesce(qual, '') || coalesce(with_check, '') not like '%teacher-photos%' or 'anon' = any(roles) or 'public' = any(roles)));
  select count(*) into admin_path from pg_policies
   where schemaname = 'public' and tablename = 'teacher_cards' and coalesce(qual, '') || coalesce(with_check, '') like '%is_school_admin%';
  select count(*) into anon_grants from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'teacher_cards' and grantee in ('anon', 'PUBLIC');
  select relforcerowsecurity into forced from pg_class where oid = 'public.teacher_cards'::regclass;
  select public into bucket_public from storage.buckets where id = 'teacher-photos';

  if n_card <> 3 or n_obj <> 4 or leaky > 0 or admin_path > 0 or anon_grants > 0 or forced is not true or bucket_public is distinct from false then
    raise exception '018: card policies % (want 3), photo policies % (want 4), not gated %, admin path %, anon grants %, forced RLS %, bucket public %',
      n_card, n_obj, leaky, admin_path, anon_grants, forced, bucket_public;
  end if;

  raise notice '018: OK: cards are opt-in and self-authored; colleagues read only published cards in their school; admins get none';
end $$;

commit;

-- After applying: reload PostgREST's schema cache (see CLAUDE.md): notify pgrst, 'reload schema';
