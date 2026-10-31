-- 017_teacher_hub.sql
--
-- The tables behind the teacher hub on /dashboard/aurora: pair chat, the games hub, notes to your future self, time on
-- the platform, personal growth goals and a practice log.
--
-- WRITTEN, NOT YET APPLIED. Checked on a throwaway Postgres (PGlite) with stand-ins for 009's helpers; not yet run
-- against the real database.
--
-- Two kinds of table, and nobody else can read either:
--
--   PAIR tables (pair_messages, pair_game_sessions): readable and writable by the two teachers in an approved pairing,
--   the same rule as conversation_logs (011). Admins are NOT admitted: the pair's space is the pair's.
--
--   OWN tables (future_notes, platform_time, growth_goals, growth_entries): readable and writable only by the teacher
--   they belong to. Time on the platform in particular is for the teacher's own reflection; no school lead can read it,
--   because a usage meter that leadership can see is a surveillance tool, and Mentorful is developmental, not
--   evaluative.
--
-- Depends on 009's my_profile_id(). Defines is_pair_member() with `create or replace`, identical to the one in 016
-- (the visit screen's migration), so this file works with or without 016 applied, in either order.
--
-- The visit screen and shared files also need 016 (private realtime channel and the pair-files bucket).
--
-- *** Adds six tables, one function and their policies. Changes no existing table. ***

begin;

-- ------------------------------------------------------------------ helper

create or replace function public.is_pair_member(p_pairing uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pairings
     where id = p_pairing
       and status = 'approved'
       and (host_id = public.my_profile_id() or visitor_id = public.my_profile_id())
  );
$$;

revoke all on function public.is_pair_member(uuid) from anon, public;
grant execute on function public.is_pair_member(uuid) to authenticated;

-- ------------------------------------------------------ 1. pair chat

create table if not exists public.pair_messages (
  id          uuid primary key default gen_random_uuid(),
  pairing_id  uuid not null references public.pairings(id) on delete cascade,
  sender_id   uuid not null,
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists pair_messages_pair_time on public.pair_messages (pairing_id, created_at);

alter table public.pair_messages enable row level security;
alter table public.pair_messages force row level security;

drop policy if exists "pair reads its messages"  on public.pair_messages;
drop policy if exists "pair writes its messages" on public.pair_messages;

create policy "pair reads its messages"
  on public.pair_messages for select to authenticated
  using (public.is_pair_member(pairing_id));

-- You can only speak as yourself, into a pairing you are in.
create policy "pair writes its messages"
  on public.pair_messages for insert to authenticated
  with check (public.is_pair_member(pairing_id) and sender_id = public.my_profile_id());

revoke all on public.pair_messages from anon, public;
grant select, insert on public.pair_messages to authenticated;

-- ------------------------------------------------------ 2. games hub

-- One row per session the pair ran together. A module's status is derived: not started (no rows), in progress, or
-- complete (some session was marked as finishing it). No stored percentage, so nothing can drift out of date.
create table if not exists public.pair_game_sessions (
  id          uuid primary key default gen_random_uuid(),
  pairing_id  uuid not null references public.pairings(id) on delete cascade,
  module      text not null check (char_length(module) between 1 and 60),
  logged_by   uuid not null,
  minutes     integer check (minutes is null or minutes between 1 and 600),
  completed   boolean not null default false,
  note        text check (note is null or char_length(note) <= 500),
  -- What the pair produced while playing (the norms they agreed, the next steps they chose), as {prompt key: text}.
  -- Shared with the pair only, like the rest of the row.
  outputs     jsonb check (outputs is null or (jsonb_typeof(outputs) = 'object' and char_length(outputs::text) <= 6000)),
  created_at  timestamptz not null default now()
);
create index if not exists pair_game_sessions_pair on public.pair_game_sessions (pairing_id, module, created_at);

alter table public.pair_game_sessions enable row level security;
alter table public.pair_game_sessions force row level security;

drop policy if exists "pair reads its game sessions"  on public.pair_game_sessions;
drop policy if exists "pair writes its game sessions" on public.pair_game_sessions;

create policy "pair reads its game sessions"
  on public.pair_game_sessions for select to authenticated
  using (public.is_pair_member(pairing_id));

create policy "pair writes its game sessions"
  on public.pair_game_sessions for insert to authenticated
  with check (public.is_pair_member(pairing_id) and logged_by = public.my_profile_id());

revoke all on public.pair_game_sessions from anon, public;
grant select, insert on public.pair_game_sessions to authenticated;

-- ------------------------------------------------ 3. notes to future self

-- open_on null means "keep it with me": no delivery date. The seal is a courtesy in the page, not security; it is
-- the author's own note, and RLS keeps everyone else out of it.
create table if not exists public.future_notes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null,
  body        text not null check (char_length(btrim(body)) between 1 and 4000),
  open_on     date,
  opened_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists future_notes_owner on public.future_notes (profile_id, created_at);

-- --------------------------------------------- 4. time on the platform

-- One row per teacher per local day. The page adds to it every half minute while the tab is visible and the teacher
-- is active, so the number is time actually spent, not time a tab sat open.
create table if not exists public.platform_time (
  profile_id  uuid not null,
  day         date not null,
  seconds     integer not null default 0 check (seconds between 0 and 86400),
  updated_at  timestamptz not null default now(),
  primary key (profile_id, day)
);

-- ------------------------------------------- 5. personal growth goals

create table if not exists public.growth_goals (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null,
  title        text not null check (char_length(btrim(title)) between 1 and 160),
  area         text check (area is null or char_length(area) <= 40),
  why          text check (why is null or char_length(why) <= 600),
  target_date  date,
  status       text not null default 'active' check (status in ('active', 'done', 'dropped')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists growth_goals_owner on public.growth_goals (profile_id, created_at);

-- --------------------------------------------------- 6. practice log

-- A dated, optionally timed record of something the teacher did to grow: tried a strategy, read, watched a colleague,
-- reflected. Can hang off a goal.
create table if not exists public.growth_entries (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null,
  goal_id     uuid references public.growth_goals(id) on delete set null,
  kind        text not null check (kind in ('practice', 'learning', 'reflection', 'observation')),
  minutes     integer check (minutes is null or minutes between 1 and 600),
  body        text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists growth_entries_owner on public.growth_entries (profile_id, created_at);

-- ---------------------------------------------- policies for OWN tables

do $$
declare t text;
begin
  foreach t in array array['future_notes', 'platform_time', 'growth_goals', 'growth_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists "owner reads own rows" on public.%I', t);
    execute format('drop policy if exists "owner writes own rows" on public.%I', t);
    execute format('drop policy if exists "owner edits own rows" on public.%I', t);
    execute format('create policy "owner reads own rows" on public.%I for select to authenticated using (profile_id = public.my_profile_id())', t);
    execute format('create policy "owner writes own rows" on public.%I for insert to authenticated with check (profile_id = public.my_profile_id())', t);
    execute format('create policy "owner edits own rows" on public.%I for update to authenticated using (profile_id = public.my_profile_id()) with check (profile_id = public.my_profile_id())', t);
    execute format('revoke all on public.%I from anon, public', t);
  end loop;
end $$;

-- Nothing here is deleted by the app, so nothing may be: notes and goals are kept (a goal is closed by marking it done
-- or dropped), time and the practice log are a record.
grant select, insert, update         on public.future_notes  to authenticated;
grant select, insert, update         on public.growth_goals  to authenticated;
grant select, insert, update         on public.platform_time to authenticated;
grant select, insert                 on public.growth_entries to authenticated;

-- ------------------------------------------------------------ self-test

do $$
declare
  n_pair int; n_own int; leaky int; anon_grants int; no_rls int; admin_path int;
begin
  select count(*) into n_pair from pg_policies
   where schemaname = 'public' and tablename in ('pair_messages', 'pair_game_sessions');
  select count(*) into n_own from pg_policies
   where schemaname = 'public' and tablename in ('future_notes', 'platform_time', 'growth_goals', 'growth_entries');

  -- Every pair policy must go through the pair check; every own policy through my_profile_id().
  -- Only OUR six tables: the database may already hold other tables' policies for signed-out visitors (the survey form needs them).
  select count(*) into leaky from pg_policies
   where schemaname = 'public'
     and tablename in ('pair_messages', 'pair_game_sessions', 'future_notes', 'platform_time', 'growth_goals', 'growth_entries')
     and ((tablename in ('pair_messages', 'pair_game_sessions') and coalesce(qual, '') || coalesce(with_check, '') not like '%is_pair_member%')
       or (tablename in ('future_notes', 'platform_time', 'growth_goals', 'growth_entries') and coalesce(qual, '') || coalesce(with_check, '') not like '%my_profile_id%')
       or 'anon' = any(roles) or 'public' = any(roles));

  -- Nobody may reach these tables through is_school_admin(): no admin read path.
  select count(*) into admin_path from pg_policies
   where schemaname = 'public'
     and tablename in ('pair_messages', 'pair_game_sessions', 'future_notes', 'platform_time', 'growth_goals', 'growth_entries')
     and coalesce(qual, '') || coalesce(with_check, '') like '%is_school_admin%';

  select count(*) into anon_grants from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'PUBLIC')
     and table_name in ('pair_messages', 'pair_game_sessions', 'future_notes', 'platform_time', 'growth_goals', 'growth_entries');

  select count(*) into no_rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('pair_messages', 'pair_game_sessions', 'future_notes', 'platform_time', 'growth_goals', 'growth_entries')
     and not (c.relrowsecurity and c.relforcerowsecurity);

  -- 2 + 2 pair policies; own tables: read, write and edit on each of four = 12.
  if n_pair <> 4 or n_own <> 12 or leaky > 0 or admin_path > 0 or anon_grants > 0 or no_rls > 0 then
    raise exception '017: pair policies % (want 4), own policies % (want 12), not gated %, admin path %, anon grants %, without forced RLS %',
      n_pair, n_own, leaky, admin_path, anon_grants, no_rls;
  end if;

  raise notice '017: OK: chat and games are pair-only; notes, time, goals and practice are own-only; no admin read path';
end $$;

commit;

-- After applying: reload PostgREST's schema cache (see CLAUDE.md): notify pgrst, 'reload schema';
