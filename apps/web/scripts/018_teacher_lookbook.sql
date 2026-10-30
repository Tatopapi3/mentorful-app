-- 018_teacher_lookbook.sql
--
-- The teacher lookbook, inside the My pair tab: a directory colleagues in the same school browse when looking for a
-- co-mentor. It shows a FIXED, minimal set about each teacher: name, department and strengths. Nothing else.
--
-- Nick's decision (Oct 29): "Go with the fixed minimal set, name, department, strengths, with admins keeping email for
-- roster work only. One flag: our site copy promises teachers choose what's shown, so let's treat per-field toggles as a
-- known later enhancement rather than drop that promise quietly."
--
-- WRITTEN, NOT YET APPLIED. Checked on a throwaway Postgres (PGlite) with stand-ins for 009's helpers; not yet run
-- against the real database. (An earlier draft of this script had self-authored cards with a photo, biography,
-- experience and so on; it was never applied, and is replaced by this one.)
--
-- Principles, enforced here and not by the page:
--   * FIXED SET. lookbook_cards() returns exactly four columns: profile_id, name, department, strength_tags. No email,
--     no photo, no years, no style or archetype, no free text. Adding a field means changing this function, on purpose.
--   * ONE CHOICE. A teacher can hide themselves from the lookbook (lookbook_choices.hidden). That is the only thing
--     they choose today; per-field choices come later.
--   * SAME SCHOOL, TEACHERS ONLY. Colleagues read the directory through lookbook_cards(), never a table. School
--     leadership (is_school_admin) gets no rows: this is a peer space, like the pair's. Admins keep email for the
--     roster, and the roster is read elsewhere.
--   * NOTHING NEW ON `profiles`. Only a small owner-only table for the hide choice.
--
-- Depends on 009's my_profile_id(), my_school_id() and is_school_admin().
--
-- *** Adds one table and one function. Changes no existing table. ***

begin;

-- ------------------------------------------------------------------ the one choice

create table if not exists public.lookbook_choices (
  profile_id  uuid primary key,
  school_id   uuid not null,
  hidden      boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.lookbook_choices enable row level security;
alter table public.lookbook_choices force row level security;

drop policy if exists "owner reads own lookbook choice"  on public.lookbook_choices;
drop policy if exists "owner writes own lookbook choice" on public.lookbook_choices;
drop policy if exists "owner edits own lookbook choice"  on public.lookbook_choices;

create policy "owner reads own lookbook choice"  on public.lookbook_choices for select to authenticated
  using (profile_id = public.my_profile_id());
create policy "owner writes own lookbook choice" on public.lookbook_choices for insert to authenticated
  with check (profile_id = public.my_profile_id() and school_id = public.my_school_id());
create policy "owner edits own lookbook choice"  on public.lookbook_choices for update to authenticated
  using (profile_id = public.my_profile_id())
  with check (profile_id = public.my_profile_id() and school_id = public.my_school_id());

revoke all on public.lookbook_choices from anon, public;
grant select, insert, update on public.lookbook_choices to authenticated;

-- ------------------------------------------------------------------ the directory

create or replace function public.lookbook_cards()
returns table (profile_id uuid, name text, department text, strength_tags jsonb)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
         p.department,
         p.strength_tags
    from public.profiles p
    left join public.lookbook_choices c on c.profile_id = p.id
   where p.school_id = public.my_school_id()
     and coalesce(p.role, 'teacher') = 'teacher'
     and coalesce(c.hidden, false) = false
     and not public.is_school_admin()
   order by p.last_name, p.first_name, p.id
$$;

revoke all on function public.lookbook_cards() from anon, public;
grant execute on function public.lookbook_cards() to authenticated;

-- ------------------------------------------------------------ self-test

do $$
declare n_pol int; leaky int; anon_grants int; admin_path int; forced boolean; n_cols int;
begin
  select count(*) into n_pol from pg_policies where schemaname = 'public' and tablename = 'lookbook_choices';
  select count(*) into leaky from pg_policies
   where schemaname = 'public' and tablename = 'lookbook_choices' and (coalesce(qual, '') || coalesce(with_check, '') not like '%my_profile_id%' or 'anon' = any(roles));
  select count(*) into admin_path from pg_policies
   where schemaname = 'public' and tablename = 'lookbook_choices' and coalesce(qual, '') || coalesce(with_check, '') like '%is_school_admin%';
  select count(*) into anon_grants from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'lookbook_choices' and grantee in ('anon', 'PUBLIC');
  select relforcerowsecurity into forced from pg_class where oid = 'public.lookbook_choices'::regclass;
  select count(*) into n_cols from information_schema.parameters
   where specific_schema = 'public' and specific_name like 'lookbook_cards%' and parameter_mode = 'OUT';

  if n_pol <> 3 or leaky > 0 or admin_path > 0 or anon_grants > 0 or forced is not true or n_cols <> 4 then
    raise exception '018: policies % (want 3), not owner-gated %, admin path %, anon grants %, forced RLS %, lookbook_cards columns % (want exactly 4)',
      n_pol, leaky, admin_path, anon_grants, forced, n_cols;
  end if;

  raise notice '018: OK: the lookbook shows name, department and strengths only; a teacher can hide; admins get none';
end $$;

commit;

-- After applying: reload PostgREST's schema cache (see CLAUDE.md): notify pgrst, 'reload schema';
