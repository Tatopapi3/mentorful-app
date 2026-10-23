-- 015_pairing_exclusion_rules.sql
--
-- Do-not-pair rules for the teacher-pairing MCP server (apps/mcp-pairing),
-- which reads them as mcp://mentorful-db/school/{school_id}/exclusion_rules.
--
-- WRITTEN, NOT YET APPLIED.
--
-- A rule is an unordered pair of teachers at one school who must not be
-- paired, for a professional or personal conflict. The pairing server reads
-- only (teacher_a, teacher_b) for active rules: the reason never leaves this
-- table.
--
-- WHO CAN SEE A RULE: school admins only. A teacher must never learn that a
-- rule names them, so there is no teacher read path, and no self-read either.
-- The server reads with the service key, which bypasses RLS; that is why it
-- selects the two id columns and nothing else.
--
-- `reason` is optional, short, and for the admin who wrote it. Keep it to
-- something like "line manager" or "asked not to"; it is not a case file.
--
-- Following 011's lesson: this creates a new table, so there are no earlier
-- policies to collide with, but it still drops-then-creates by name and
-- asserts the end state before committing.
--
-- *** Adds one table, its policies and an index. Changes no existing table. ***

begin;

create table if not exists public.pairing_exclusion_rules (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  teacher_a   uuid not null references public.profiles(id) on delete cascade,
  teacher_b   uuid not null references public.profiles(id) on delete cascade,
  reason      text check (reason is null or char_length(reason) <= 120),
  active      boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint pairing_exclusion_rules_distinct check (teacher_a <> teacher_b)
);

-- One rule per unordered pair per school: (a, b) and (b, a) are the same rule.
create unique index if not exists pairing_exclusion_rules_pair_key
  on public.pairing_exclusion_rules (school_id, least(teacher_a, teacher_b), greatest(teacher_a, teacher_b));

alter table public.pairing_exclusion_rules enable row level security;
alter table public.pairing_exclusion_rules force row level security;

drop policy if exists "admins read exclusion rules"   on public.pairing_exclusion_rules;
drop policy if exists "admins write exclusion rules"  on public.pairing_exclusion_rules;

create policy "admins read exclusion rules"
  on public.pairing_exclusion_rules for select to authenticated
  using (public.is_school_admin() and school_id = public.my_school_id());

create policy "admins write exclusion rules"
  on public.pairing_exclusion_rules for all to authenticated
  using (public.is_school_admin() and school_id = public.my_school_id())
  with check (public.is_school_admin() and school_id = public.my_school_id());

-- Self-test: exactly the two policies above, and none that a non-admin can pass.
do $$
declare n int; leaky int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'pairing_exclusion_rules';
  select count(*) into leaky from pg_policies
   where schemaname = 'public' and tablename = 'pairing_exclusion_rules'
     and (coalesce(qual, '') not like '%is_school_admin%' or 'anon' = any(roles));
  if n <> 2 or leaky > 0 then
    raise exception '015: expected 2 admin-only policies on pairing_exclusion_rules, found % (% not admin-gated)', n, leaky;
  end if;
  raise notice '015: OK — pairing_exclusion_rules is admin-only';
end $$;

commit;

-- After applying, reload PostgREST's schema cache (see CLAUDE.md):
--   notify pgrst, 'reload schema';
