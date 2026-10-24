-- 016_pair_live_channel_and_files.sql
--
-- The visit screen on /dashboard/v2: two-way video, shared files and drafts
-- that appear on the partner's screen as soon as they are saved.
--
-- WRITTEN, NOT YET APPLIED.
--
-- Three things, each scoped to the two teachers in one pairing and nobody else:
--
--   1. REALTIME CHANNEL  `pair:<pairing_id>`, private. Carries the WebRTC
--      handshake (offers, answers, ICE candidates), presence ("Ava is here"),
--      the shared YouTube link and "files changed" pings. The video itself
--      goes browser to browser and never touches Supabase. Policies on
--      realtime.messages admit a member of that pairing only. Admins are NOT
--      admitted: same rule as conversation_logs (011), the pair's space is
--      the pair's.
--
--   2. STORAGE BUCKET  `pair-files`, private. Objects live under
--      `<pairing_id>/...`; a member of that pairing can list, upload, read and
--      delete them, nobody else. No admin read path, for the same reason.
--
--   3. DRAFTS IN REALTIME  conversation_logs joins the supabase_realtime
--      publication, so the partner's dashboard hears a new or submitted log
--      and refreshes. postgres_changes applies RLS, so the existing pair-only
--      SELECT policy from 011 decides who hears what. Nothing new is exposed.
--
-- Lesson from 007/009/011, applied: drop policies by name before creating
-- them, guard the publication change on the catalogue rather than assuming,
-- and assert the end state before committing.
--
-- *** Adds one function, one bucket, policies on realtime.messages and
--     storage.objects, and one table to a publication. Changes no table. ***

begin;

-- ------------------------------------------------------------------ helper

-- Is the caller the host or the visitor of this pairing? SECURITY DEFINER so
-- a policy can ask without tripping over pairings' own RLS, and so the answer
-- is the same from realtime and storage. Keys on my_profile_id() (009), i.e.
-- auth_user_id, never profiles.id.
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

-- The same question asked from text: a channel topic `pair:<uuid>` or a
-- storage path whose first folder is the uuid. Anything that is not a
-- well-formed uuid is simply "no", rather than a cast error.
create or replace function public.is_pair_member_text(p_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_pair_member(p_id::uuid)
    else false
  end;
$$;

revoke all on function public.is_pair_member(uuid)      from public;
revoke all on function public.is_pair_member_text(text) from public;
grant execute on function public.is_pair_member(uuid)      to authenticated;
grant execute on function public.is_pair_member_text(text) to authenticated;

-- ------------------------------------------------ 1. realtime channel

drop policy if exists "pair members read their pair channel"  on realtime.messages;
drop policy if exists "pair members write their pair channel" on realtime.messages;

create policy "pair members read their pair channel"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() like 'pair:%'
    and public.is_pair_member_text(substr(realtime.topic(), 6))
  );

create policy "pair members write their pair channel"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() like 'pair:%'
    and public.is_pair_member_text(substr(realtime.topic(), 6))
  );

-- --------------------------------------------------- 2. storage bucket

insert into storage.buckets (id, name, public, file_size_limit)
values ('pair-files', 'pair-files', false, 209715200)  -- 200 MB, as the page says
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "pair members read pair files"   on storage.objects;
drop policy if exists "pair members add pair files"    on storage.objects;
drop policy if exists "pair members remove pair files" on storage.objects;

create policy "pair members read pair files"
  on storage.objects for select to authenticated
  using (bucket_id = 'pair-files' and public.is_pair_member_text((storage.foldername(name))[1]));

create policy "pair members add pair files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'pair-files' and public.is_pair_member_text((storage.foldername(name))[1]));

create policy "pair members remove pair files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'pair-files' and public.is_pair_member_text((storage.foldername(name))[1]));

-- ------------------------------------------------ 3. drafts in realtime

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_logs'
  ) then
    execute 'alter publication supabase_realtime add table public.conversation_logs';
  end if;
end $$;

-- ------------------------------------------------------------ self-test

do $$
declare n_rt int; n_st int; leaky int; pub int; bucket_public boolean;
begin
  select count(*) into n_rt from pg_policies
   where schemaname = 'realtime' and tablename = 'messages' and policyname like 'pair members %';
  select count(*) into n_st from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'pair members %';
  -- Every policy this migration made must go through the pair check and none
  -- may be granted to anon.
  select count(*) into leaky from pg_policies
   where policyname like 'pair members %'
     and (coalesce(qual, '') || coalesce(with_check, '') not like '%is_pair_member_text%' or 'anon' = any(roles));
  select count(*) into pub from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_logs';
  select public into bucket_public from storage.buckets where id = 'pair-files';

  if n_rt <> 2 or n_st <> 3 or leaky > 0 or pub <> 1 or bucket_public is distinct from false then
    raise exception '016: realtime % (want 2), storage % (want 3), not pair-gated %, publication %, bucket public %',
      n_rt, n_st, leaky, pub, bucket_public;
  end if;

  -- conversation_logs must still have exactly 011's one pair-only read policy:
  -- joining the publication must not have come with a wider grant.
  if (select count(*) from pg_policies
       where schemaname = 'public' and tablename = 'conversation_logs' and cmd in ('SELECT', 'ALL')) <> 1 then
    raise exception '016: conversation_logs no longer has exactly one read policy';
  end if;

  raise notice '016: OK — pair channel, pair-files bucket and draft events are pair-only';
end $$;

commit;

-- After applying:
--   1. Supabase Dashboard -> Realtime -> Settings: turn OFF "Allow public access"
--      so channels must be private and these policies are enforced.
--   2. Reload PostgREST's schema cache (see CLAUDE.md): notify pgrst, 'reload schema';
