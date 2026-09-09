-- 007_merge_neon_schema.sql
--
-- Step 1 of the Neon -> Supabase merge. Schema only. NO RLS changes (Step 2),
-- NO data migration (Step 3).
--
-- Decisions locked after the Step 0 reconciliation:
--   1. Identity decouples: profiles.id stops being required to equal auth.users.id.
--      A nullable, unique auth_user_id carries the link explicitly, so a roster row
--      can exist for a teacher who has not signed up yet. The "update own profile"
--      policy is rewritten in THIS migration because it currently hard-codes the
--      old coupling -- splitting them would leave a window where the policy is wrong.
--   2. concern_domain becomes a real enum type. See the note above section 7.
--   3. Migration 002 is deleted; its one live effect (dropping the dead
--      surveys.item_ids) is folded in here as section 6.
--   4. Visit records migrate as 'submitted' -- that is Step 3, but the status
--      column and its CHECK are created here.
--
-- WHAT IS LIVE AND WHAT IS EMPTY
--   LIVE   profiles (4 rows)  -- sections 2,3,4,5   <-- all the risk is here
--   LIVE   surveys  (1 row)   -- section 6, destructive column drop
--   EMPTY  cycles, pairings, conversation_logs -- sections 7,8,9, free
--   UNTOUCHED  survey_items, survey_responses, schools, invites
--
-- Take a backup before running. Section 6 drops a column.

begin;

-- ---------------------------------------------------------------------------
-- 1. PRECONDITIONS. Abort before touching anything if the database is not in
--    the state Step 0 observed. Every one of these is a reason the migration
--    would otherwise do something subtly wrong rather than fail.
-- ---------------------------------------------------------------------------

do $$
declare
  n_cycles   int;
  n_pairings int;
  n_logs     int;
  n_profiles int;
  n_linkable int;
  bad_roles  text;
begin
  select count(*) into n_cycles   from public.cycles;
  select count(*) into n_pairings from public.pairings;
  select count(*) into n_logs     from public.conversation_logs;

  -- Sections 7-9 assume these are empty: they rename columns and change a
  -- column type with USING clauses that were never validated against real data.
  if n_cycles > 0 or n_pairings > 0 or n_logs > 0 then
    raise exception
      '007: expected cycles/pairings/conversation_logs to be empty, found %/%/%. '
      'Sections 7-9 are only safe on empty tables. Stop and re-plan.',
      n_cycles, n_pairings, n_logs;
  end if;

  select count(*) into n_profiles from public.profiles;
  select count(*) into n_linkable
    from public.profiles p join auth.users u on u.id = p.id;

  raise notice '007: profiles rows = %, of which % have id matching an auth.users id (these get backfilled)',
    n_profiles, n_linkable;

  if n_linkable = 0 then
    raise exception
      '007: no profiles row has an id matching auth.users. Step 0 found 4. '
      'The backfill in section 3 would silently link nobody. Stop and re-check.';
  end if;

  -- Section 4 adds a CHECK on role. Find violators now, with their values,
  -- rather than getting a bare constraint error.
  select string_agg(distinct coalesce(role, '<null>'), ', ') into bad_roles
    from public.profiles
   where role is not null and role not in ('admin', 'teacher');

  if bad_roles is not null then
    raise exception
      '007: profiles.role holds value(s) outside (admin, teacher): %. '
      'Normalise them first -- section 4 would reject the table.', bad_roles;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. profiles: new columns.            *** LIVE TABLE (4 rows) ***
--    All additive. Nullable or defaulted, so existing rows stay valid.
--
--    neon_id is TEMPORARY. Step 3 upserts on it so the data migration is
--    re-runnable; Step 5 drops it. It is deliberately not a foreign key --
--    it holds Neon cuids, which mean nothing to this database.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists auth_user_id     uuid,
  add column if not exists strength_tags    jsonb,
  add column if not exists personality_tags jsonb,
  add column if not exists fun_tags         jsonb,
  add column if not exists is_demo          boolean not null default false,
  add column if not exists neon_id          text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.profiles'::regclass
                    and conname  = 'profiles_auth_user_id_key') then
    alter table public.profiles
      add constraint profiles_auth_user_id_key unique (auth_user_id);
  end if;

  -- ON DELETE SET NULL, not CASCADE: deleting an auth user must orphan the
  -- profile, never delete a teacher's roster row and cascade into their
  -- pairings and conversation logs.
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.profiles'::regclass
                    and conname  = 'profiles_auth_user_id_fkey') then
    alter table public.profiles
      add constraint profiles_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.profiles'::regclass
                    and conname  = 'profiles_neon_id_key') then
    alter table public.profiles
      add constraint profiles_neon_id_key unique (neon_id);
  end if;
end $$;

comment on column public.profiles.auth_user_id is
  'Link to auth.users. NULL = roster row for someone who has not signed up yet. '
  'Claimed on first login by matching lower(email). RLS keys on THIS, not on id.';
comment on column public.profiles.is_demo is
  'True for generated demo identities (@demo.mentorful.co). Same discipline as '
  'survey_responses.synthetic: never distinguish demo from real by parsing an email.';
comment on column public.profiles.neon_id is
  'TEMPORARY. Neon UserProfile.id (cuid), for idempotent migration. Drop in Step 5.';

-- ---------------------------------------------------------------------------
-- 3. profiles: backfill the link.      *** LIVE TABLE -- WRITES 4 ROWS ***
--
--    Until now profiles.id WAS the auth id. Writing that fact into
--    auth_user_id changes nothing semantically -- it makes the existing
--    convention explicit so the column can stop being load-bearing.
--
--    Guarded by the join: only rows whose id is genuinely present in
--    auth.users are linked. A row whose id happens to be some other uuid is
--    left NULL rather than pointed at a user who does not exist.
-- ---------------------------------------------------------------------------

update public.profiles p
   set auth_user_id = p.id
  from auth.users u
 where u.id = p.id
   and p.auth_user_id is distinct from p.id;

do $$
declare
  linked   int;
  unlinked int;
begin
  select count(*) into linked   from public.profiles where auth_user_id is not null;
  select count(*) into unlinked from public.profiles where auth_user_id is null;
  raise notice '007: profiles linked to auth.users = %, unlinked = % (expect 4 and 0)',
    linked, unlinked;
end $$;

-- ---------------------------------------------------------------------------
-- 4. profiles: role CHECK.             *** LIVE TABLE (validates 4 rows) ***
--    role is free text today. Step 3 maps Neon's TEACHER/ADMIN to lowercase.
--    NULL is permitted: CHECK passes on NULL, and an un-onboarded roster row
--    legitimately has no role yet.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.profiles'::regclass
                    and conname  = 'profiles_role_check') then
    alter table public.profiles
      add constraint profiles_role_check
      check (role is null or role in ('admin', 'teacher'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. profiles: rewrite the UPDATE policy.   *** LIVE, AUTH-FACING ***
--    *** THE HIGHEST-RISK STATEMENT IN THIS FILE ***
--
--    The existing policy reads (id = auth.uid()). That is the coupling this
--    migration removes, so it must be rewritten in the SAME transaction --
--    otherwise there is a window where profiles.id is no longer guaranteed to
--    be the auth id but the policy still assumes it is.
--
--    This block PRESERVES the policy's existing name and role list and
--    replaces only the predicate. It aborts if it cannot find the policy,
--    rather than guessing at a name.
-- ---------------------------------------------------------------------------

do $$
declare
  pol_name  text;
  pol_qual  text;
  pol_check text;
  pol_roles name[];
  roles_sql text;
  leftovers text;
begin
  select policyname, qual, with_check, roles
    into pol_name, pol_qual, pol_check, pol_roles
    from pg_policies
   where schemaname = 'public'
     and tablename  = 'profiles'
     and cmd        = 'UPDATE'
     and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
   limit 1;

  if pol_name is null then
    raise exception
      '007: no UPDATE policy on public.profiles referencing auth.uid() was found. '
      'Step 0 established one exists. Re-run the pg_policies query and correct '
      'this section before proceeding -- do NOT skip it.';
  end if;

  raise notice '007: rewriting UPDATE policy % on profiles', quote_literal(pol_name);
  raise notice '007:   old USING      : %', coalesce(pol_qual, '<none>');
  raise notice '007:   old WITH CHECK : %', coalesce(pol_check, '<none>');
  raise notice '007:   roles preserved: %', pol_roles::text;

  select string_agg(quote_ident(r), ', ') into roles_sql from unnest(pol_roles) r;

  execute format('drop policy %I on public.profiles', pol_name);

  execute format(
    'create policy %I on public.profiles for update to %s '
    'using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid())',
    pol_name, roles_sql);

  raise notice '007:   new predicate  : auth_user_id = auth.uid()';

  -- Surface, but do NOT touch, any other profiles policy still keyed on id.
  -- Those are Step 2's scope. They keep working for the 4 existing rows
  -- (auth_user_id = id there) and will silently fail for roster rows.
  select string_agg(format('%s/%s', cmd, policyname), '; ') into leftovers
    from pg_policies
   where schemaname = 'public' and tablename = 'profiles'
     and (qual like '%id = auth.uid()%' or with_check like '%id = auth.uid()%')
     and policyname <> pol_name;

  if leftovers is not null then
    raise notice
      '007: HEADS UP -- other profiles policies still key on id = auth.uid(): %. '
      'They work for the 4 linked rows and will fail for unlinked roster rows. '
      'Repoint them in Step 2.', leftovers;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. surveys: drop the dead item_ids column.   *** LIVE TABLE, DESTRUCTIVE ***
--
--    integer[] holding [0,1,2,3,4,5,6,7] while survey_items.id is uuid -- it
--    could never have referenced an item. This was migration 002's one real
--    effect; 002 is deleted, so it lands here.
--
--    Item resolution is "active = true", enforced by 005. Nothing reads this.
--    IRREVERSIBLE without your backup.
-- ---------------------------------------------------------------------------

alter table public.surveys drop column if exists item_ids;

-- ---------------------------------------------------------------------------
-- 7. The Domains of Concern enum.
--
--    A real enum type, not text + CHECK, and deliberately against this
--    schema's convention. Both measurement axes now live in ONE database:
--      axis A  survey_items.dimension  structural/relational/cognitive/efficacy
--      axis B  .domain                 CLASSROOM/PLANNING/...
--    Four values each, near-synonymous English names, both previously text.
--    A CHECK catches a bad VALUE; a distinct TYPE catches a bad COLUMN --
--    assigning a dimension into a domain becomes a type error at the point of
--    the mistake instead of a constraint violation at commit, and a query that
--    UNIONs the two axes fails outright instead of returning a plausible blend.
--
--    CELEBRATIONS is included now. Neon has only four; the documented model is
--    4+1. Adding it while every consuming table is empty is free -- later it
--    means ALTER TYPE ... ADD VALUE, which cannot share a transaction with
--    other DDL.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'concern_domain') then
    create type public.concern_domain as enum (
      'CLASSROOM', 'PLANNING', 'COMMUNICATION', 'ASSESSMENT', 'CELEBRATIONS'
    );
  end if;
end $$;

comment on type public.concern_domain is
  'Axis B: Domains of Concern. Pair-private, conversation-driven, leading '
  'indicator. NEVER conflate with survey_items.dimension (axis A: the four '
  'social-capital dimensions, school-level, anonymized, lagging). Distinct '
  'types exist so a mix-up is a type error. Keep the value sets disjoint.';

-- ---------------------------------------------------------------------------
-- 8. cycles: reshape.                  *** EMPTY TABLE -- free ***
--
--    strategic_priority is per-cycle in Neon and per-school in Supabase.
--    Cycle is the correct granularity -- a strategic priority is a property of
--    a cycle by definition -- so the finer one wins. schools.strategic_priority
--    stays as the current-cycle default; it is not dropped here.
-- ---------------------------------------------------------------------------

alter table public.cycles
  add column if not exists strategic_priority text,
  add column if not exists neon_id            text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.cycles'::regclass
                    and conname  = 'cycles_neon_id_key') then
    alter table public.cycles add constraint cycles_neon_id_key unique (neon_id);
  end if;

  -- NOTE added 2026-09-07, after the fact: this branch was a NO-OP. A
  -- cycles_status_check already existed, allowing upcoming | active | complete,
  -- so the guard below (which keys on the constraint NAME, not its definition)
  -- skipped the ADD and 007 reported success while changing nothing. The
  -- table's real vocabulary is the pre-existing one, and it is intentional --
  -- see CLAUDE.md "Status vocabularies". The Step 3 migration writes
  -- 'complete', not 'closed'. Left as-is because 007 is applied history;
  -- do not "fix" it by re-running.
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.cycles'::regclass
                    and conname  = 'cycles_status_check') then
    alter table public.cycles
      add constraint cycles_status_check
      check (status is null or status in ('planned', 'active', 'closed'));
  end if;
end $$;

comment on column public.cycles.neon_id is
  'TEMPORARY. Neon Cycle.id (cuid). Drop in Step 5.';

-- ---------------------------------------------------------------------------
-- 9. pairings: reshape.                *** EMPTY TABLE -- free ***
--
--    teacher_a/teacher_b -> host_id/visitor_id. A pairing is NOT symmetric:
--    the host is observed, the visitor observes. teacher_a/teacher_b discards
--    that and names nothing. The table is empty, so the rename costs nothing
--    now and would cost a data migration later.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='pairings'
                and column_name='teacher_a')
     and not exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='pairings'
                and column_name='host_id') then
    alter table public.pairings rename column teacher_a to host_id;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='pairings'
                and column_name='teacher_b')
     and not exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='pairings'
                and column_name='visitor_id') then
    alter table public.pairings rename column teacher_b to visitor_id;
  end if;

  -- A column rename does not rename the constraints that reference it.
  -- Left alone these stay called pairings_teacher_a_fkey, which is how a
  -- schema starts lying about itself.
  if exists (select 1 from pg_constraint
              where conrelid='public.pairings'::regclass
                and conname='pairings_teacher_a_fkey') then
    alter table public.pairings
      rename constraint pairings_teacher_a_fkey to pairings_host_id_fkey;
  end if;

  if exists (select 1 from pg_constraint
              where conrelid='public.pairings'::regclass
                and conname='pairings_teacher_b_fkey') then
    alter table public.pairings
      rename constraint pairings_teacher_b_fkey to pairings_visitor_id_fkey;
  end if;
end $$;

alter table public.pairings
  add column if not exists domain        public.concern_domain,
  add column if not exists strategic_tag text,
  add column if not exists neon_id       text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid='public.pairings'::regclass
                    and conname='pairings_neon_id_key') then
    alter table public.pairings add constraint pairings_neon_id_key unique (neon_id);
  end if;

  if not exists (select 1 from pg_constraint
                  where conrelid='public.pairings'::regclass
                    and conname='pairings_status_check') then
    alter table public.pairings
      add constraint pairings_status_check
      check (status is null or status in ('pending', 'approved', 'rejected'));
  end if;

  -- Mirrors Neon's UNIQUE(cycleId, hostId, visitorId).
  if not exists (select 1 from pg_constraint
                  where conrelid='public.pairings'::regclass
                    and conname='pairings_cycle_host_visitor_key') then
    alter table public.pairings
      add constraint pairings_cycle_host_visitor_key
      unique (cycle_id, host_id, visitor_id);
  end if;

  -- Not expressible in Prisma, so Neon never had it. Nobody observes themselves.
  if not exists (select 1 from pg_constraint
                  where conrelid='public.pairings'::regclass
                    and conname='pairings_host_ne_visitor_check') then
    alter table public.pairings
      add constraint pairings_host_ne_visitor_check
      check (host_id is null or visitor_id is null or host_id <> visitor_id);
  end if;
end $$;

comment on column public.pairings.host_id    is 'The observed teacher. Directional -- not interchangeable with visitor_id.';
comment on column public.pairings.visitor_id is 'The observing teacher. Directional -- not interchangeable with host_id.';
comment on column public.pairings.neon_id    is 'TEMPORARY. Neon Pairing.id (cuid). Drop in Step 5.';

-- ---------------------------------------------------------------------------
-- 10. conversation_logs: reshape.      *** EMPTY TABLE -- free ***
--
--     Neon VisitRecord -> conversation_logs field mapping:
--       strengthsText -> strength_noted     (existing)
--       moreText      -> more_frequently    (existing)
--       lessText      -> less_frequently    (existing)
--       supportText   -> resources          (existing)
--       domain        -> domain             (existing, retyped below)
--       visionText    -> vision             NEW. 'concern' is the wrong home --
--                                           a vision is an aspiration, a concern
--                                           is a problem. Collapsing them loses
--                                           the distinction permanently.
--       hostId        -> host_id            NEW
--       visitorId     -> visitor_id         NEW
--       strategicTag  -> strategic_tag      NEW
--       status        -> status             NEW
--       submittedAt   -> submitted_at       NEW
--
--     host_id/visitor_id are REAL COLUMNS, not visit_data jsonb: Step 2's
--     pair-visibility policy filters on them, and an RLS predicate reaching
--     into jsonb is both slow and easy to get subtly wrong.
--
--     concern and obstacles stay NULL -- no Neon source. visit_data is left
--     for future unstructured payloads.
-- ---------------------------------------------------------------------------

alter table public.conversation_logs
  add column if not exists vision        text,
  add column if not exists host_id       uuid,
  add column if not exists visitor_id    uuid,
  add column if not exists strategic_tag text,
  add column if not exists status        text not null default 'draft',
  add column if not exists submitted_at  timestamptz,
  add column if not exists neon_id       text;

-- Retype domain text -> concern_domain. Safe only because the table is empty:
-- the USING clause is never evaluated. Preconditions (section 1) enforce that.
do $$
declare
  con record;
begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='conversation_logs'
                and column_name='domain' and data_type='text') then

    -- A CHECK on the old text column would block the retype. Drop any that
    -- mention it; the enum supersedes them.
    for con in
      select conname from pg_constraint
       where conrelid='public.conversation_logs'::regclass
         and contype='c'
         and pg_get_constraintdef(oid) ilike '%domain%'
    loop
      raise notice '007: dropping superseded CHECK % on conversation_logs.domain', con.conname;
      execute format('alter table public.conversation_logs drop constraint %I', con.conname);
    end loop;

    alter table public.conversation_logs
      alter column domain type public.concern_domain
      using domain::public.concern_domain;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid='public.conversation_logs'::regclass
                    and conname='conversation_logs_host_id_fkey') then
    alter table public.conversation_logs
      add constraint conversation_logs_host_id_fkey
      foreign key (host_id) references public.profiles(id);
  end if;

  if not exists (select 1 from pg_constraint
                  where conrelid='public.conversation_logs'::regclass
                    and conname='conversation_logs_visitor_id_fkey') then
    alter table public.conversation_logs
      add constraint conversation_logs_visitor_id_fkey
      foreign key (visitor_id) references public.profiles(id);
  end if;

  if not exists (select 1 from pg_constraint
                  where conrelid='public.conversation_logs'::regclass
                    and conname='conversation_logs_neon_id_key') then
    alter table public.conversation_logs
      add constraint conversation_logs_neon_id_key unique (neon_id);
  end if;

  if not exists (select 1 from pg_constraint
                  where conrelid='public.conversation_logs'::regclass
                    and conname='conversation_logs_status_check') then
    alter table public.conversation_logs
      add constraint conversation_logs_status_check
      check (status in ('draft', 'submitted'));
  end if;

  -- submitted_at and status must agree.
  if not exists (select 1 from pg_constraint
                  where conrelid='public.conversation_logs'::regclass
                    and conname='conversation_logs_submitted_at_check') then
    alter table public.conversation_logs
      add constraint conversation_logs_submitted_at_check
      check ((status = 'submitted') = (submitted_at is not null));
  end if;

  if not exists (select 1 from pg_constraint
                  where conrelid='public.conversation_logs'::regclass
                    and conname='conversation_logs_host_ne_visitor_check') then
    alter table public.conversation_logs
      add constraint conversation_logs_host_ne_visitor_check
      check (host_id is null or visitor_id is null or host_id <> visitor_id);
  end if;
end $$;

create index if not exists conversation_logs_host_id_idx    on public.conversation_logs (host_id);
create index if not exists conversation_logs_visitor_id_idx on public.conversation_logs (visitor_id);

comment on column public.conversation_logs.vision  is
  'Neon VisitRecord.visionText. Aspiration, distinct from "concern" (a problem).';
comment on column public.conversation_logs.host_id is
  'Observed teacher. A real column, not visit_data, because Step 2 RLS filters on it.';
comment on column public.conversation_logs.neon_id is
  'TEMPORARY. Neon VisitRecord.id (cuid). Drop in Step 5.';

commit;
