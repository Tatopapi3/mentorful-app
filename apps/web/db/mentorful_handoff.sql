--
-- PostgreSQL database dump
--

\restrict 0rk9ewbKSpivNZYgMjuefFV8lzH6xLXQSZPw2EyzFCqbPTd7OwJbHAHuKnccqbt

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: concern_domain; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.concern_domain AS ENUM (
    'CLASSROOM',
    'PLANNING',
    'COMMUNICATION',
    'ASSESSMENT',
    'CELEBRATIONS'
);


--
-- Name: TYPE concern_domain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.concern_domain IS 'Axis B: Domains of Concern. Pair-private, conversation-driven, leading indicator. NEVER conflate with survey_items.dimension (axis A: the four social-capital dimensions, school-level, anonymized, lagging). Distinct types exist so a mix-up is a type error. Keep the value sets disjoint.';


--
-- Name: culture_dimension; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.culture_dimension AS ENUM (
    'structural',
    'relational',
    'cognitive',
    'efficacy'
);


--
-- Name: TYPE culture_dimension; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.culture_dimension IS 'Axis A: the four social-capital dimensions of the Culture Scan. School-level, anonymized, admin product, lagging indicator. NEVER conflate with concern_domain (axis B: Domains of Concern, pair-private, leading). Distinct types exist so a mix-up is a type error. Keep the value sets disjoint.';


--
-- Name: concern_domain_counts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.concern_domain_counts(p_cycle uuid) RETURNS TABLE(domain public.concern_domain, n integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  MIN_CELL constant int := 5;
begin
  if not public.is_school_admin() then
    raise exception 'concern_domain_counts: admin only' using errcode = '42501';
  end if;

  return query
    select cl.domain,
           case when count(*) >= MIN_CELL then count(*)::int else null end
      from public.conversation_logs cl
      join public.cycles c on c.id = cl.cycle_id
     where cl.cycle_id = p_cycle
       and c.school_id = public.my_school_id()   -- cannot read another school
       and cl.status   = 'submitted'
     group by cl.domain;
end $$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', split_part(new.email, '.', 1)),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  );
  return new;
end;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','superadmin')
  )
$$;


--
-- Name: is_school_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_school_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
      from public.profiles
     where auth_user_id = auth.uid()
       and role = 'admin'
  );
$$;


--
-- Name: my_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_email() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select lower(email)
    from auth.users
   where id = auth.uid()
   limit 1;
$$;


--
-- Name: my_profile_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_profile_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select id
    from public.profiles
   where auth_user_id = auth.uid()
   limit 1;
$$;


--
-- Name: my_school_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_school_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select school_id
    from public.profiles
   where auth_user_id = auth.uid()
   limit 1;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: survey_is_open(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.survey_is_open(sid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.surveys s
     where s.id = sid
       and (s.closes_at is null or s.closes_at > now())
  );
$$;


--
-- Name: survey_items_single_active_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.survey_items_single_active_version() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  active_versions int;
begin
  select count(distinct instrument_version)
    into active_versions
    from public.survey_items
   where active;

  if active_versions > 1 then
    raise exception
      'survey_items: % distinct instrument_version values are active; exactly one instrument version may be active at a time',
      active_versions
      using errcode = '23514';
  end if;

  return null;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: conversation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid,
    pairing_id uuid,
    cycle_id uuid,
    logged_by uuid,
    domain public.concern_domain,
    concern text,
    strength_noted text,
    more_frequently text,
    less_frequently text,
    resources text,
    obstacles text,
    is_visit_debrief boolean DEFAULT false,
    visit_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    vision text,
    host_id uuid,
    visitor_id uuid,
    strategic_tag text,
    status text DEFAULT 'draft'::text NOT NULL,
    submitted_at timestamp with time zone,
    neon_id text,
    CONSTRAINT conversation_logs_host_ne_visitor_check CHECK (((host_id IS NULL) OR (visitor_id IS NULL) OR (host_id <> visitor_id))),
    CONSTRAINT conversation_logs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text]))),
    CONSTRAINT conversation_logs_submitted_at_check CHECK (((status = 'submitted'::text) = (submitted_at IS NOT NULL)))
);

ALTER TABLE ONLY public.conversation_logs FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN conversation_logs.vision; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversation_logs.vision IS 'Neon VisitRecord.visionText. Aspiration, distinct from "concern" (a problem).';


--
-- Name: COLUMN conversation_logs.host_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversation_logs.host_id IS 'Observed teacher. A real column, not visit_data, because Step 2 RLS filters on it.';


--
-- Name: COLUMN conversation_logs.neon_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversation_logs.neon_id IS 'TEMPORARY. Neon VisitRecord.id (cuid). Drop in Step 5.';


--
-- Name: cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid,
    name text NOT NULL,
    academic_year text,
    starts_at date,
    ends_at date,
    status text DEFAULT 'upcoming'::text,
    created_at timestamp with time zone DEFAULT now(),
    strategic_priority text,
    neon_id text,
    CONSTRAINT cycles_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'active'::text, 'complete'::text])))
);


--
-- Name: COLUMN cycles.neon_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cycles.neon_id IS 'TEMPORARY. Neon Cycle.id (cuid). Drop in Step 5.';


--
-- Name: invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid,
    email text NOT NULL,
    role text DEFAULT 'teacher'::text,
    department text,
    invited_by uuid,
    token text DEFAULT (gen_random_uuid())::text,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pairings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pairings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid,
    cycle_id uuid,
    host_id uuid,
    visitor_id uuid,
    status text DEFAULT 'pending'::text,
    requested_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    domain public.concern_domain,
    strategic_tag text,
    neon_id text,
    CONSTRAINT pairings_host_ne_visitor_check CHECK (((host_id IS NULL) OR (visitor_id IS NULL) OR (host_id <> visitor_id))),
    CONSTRAINT pairings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: COLUMN pairings.host_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pairings.host_id IS 'The observed teacher. Directional -- not interchangeable with visitor_id.';


--
-- Name: COLUMN pairings.visitor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pairings.visitor_id IS 'The observing teacher. Directional -- not interchangeable with host_id.';


--
-- Name: COLUMN pairings.neon_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pairings.neon_id IS 'TEMPORARY. Neon Pairing.id (cuid). Drop in Step 5.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    school_id uuid,
    first_name text,
    last_name text,
    email text,
    role text DEFAULT 'teacher'::text,
    department text,
    years_teaching integer,
    archetype_id text,
    teaching_style text,
    inspiration text,
    onboarding_complete boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    auth_user_id uuid,
    strength_tags jsonb,
    personality_tags jsonb,
    is_demo boolean DEFAULT false NOT NULL,
    neon_id text,
    CONSTRAINT profiles_archetype_id_check CHECK (((archetype_id IS NULL) OR (archetype_id = ANY (ARRAY['puzzler'::text, 'story-lover'::text, 'fixer'::text, 'mover-shaker'::text, 'competitor'::text, 'performer'::text, 'artist'::text, 'collector'::text, 'party-captain'::text, 'prankster'::text, 'novelty-seeker'::text])))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['teacher'::text, 'admin'::text, 'superadmin'::text]))),
    CONSTRAINT profiles_teaching_style_check CHECK ((teaching_style = ANY (ARRAY['nurturer'::text, 'activator'::text, 'architect'::text])))
);


--
-- Name: COLUMN profiles.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.id IS 'Ordinary uuid primary key. NOT the auth user id -- that link lives in auth_user_id alone (see 007, 010). For rows created at signup the two happen to be equal; that is a convention, not a constraint, and roster rows migrated from Neon have a UUIDv5 derived from their old cuid instead.';


--
-- Name: COLUMN profiles.archetype_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.archetype_id IS 'One of the 11 Kurian Consulting archetypes (data.js ARCHETYPES). Retained for in-person PD and for co-mentor contrast copy. NOT a dashboard grouping axis.';


--
-- Name: COLUMN profiles.teaching_style; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.teaching_style IS 'Hargreaves style: nurturer | activator | architect. LIGHT ACCENT — flavours pairing copy and the admin distribution panel. Taglines in data.js.';


--
-- Name: COLUMN profiles.inspiration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.inspiration IS 'First-person sentence about why this teacher teaches. Rendered as a bare quote on the profile card — no "Your Why" header, no label. Was why_teach.';


--
-- Name: COLUMN profiles.auth_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.auth_user_id IS 'Link to auth.users. NULL = roster row for someone who has not signed up yet. Claimed on first login by matching lower(email). RLS keys on THIS, not on id.';


--
-- Name: COLUMN profiles.is_demo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.is_demo IS 'True for generated demo identities (@demo.mentorful.co). Same discipline as survey_responses.synthetic: never distinguish demo from real by parsing an email.';


--
-- Name: COLUMN profiles.neon_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.neon_id IS 'TEMPORARY. Neon UserProfile.id (cuid), for idempotent migration. Drop in Step 5.';


--
-- Name: schools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    district text,
    city text,
    state text,
    timezone text DEFAULT 'America/New_York'::text,
    strategic_priority text,
    academic_year text DEFAULT '2025-26'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: survey_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "position" integer NOT NULL,
    dimension public.culture_dimension NOT NULL,
    framing text NOT NULL,
    reverse boolean DEFAULT false NOT NULL,
    text text NOT NULL,
    scale_min integer DEFAULT 1 NOT NULL,
    scale_max integer DEFAULT 6 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    instrument_version integer DEFAULT 2 NOT NULL,
    CONSTRAINT survey_items_framing_check CHECK ((framing = ANY (ARRAY['we'::text, 'I'::text])))
);


--
-- Name: survey_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    school_id uuid NOT NULL,
    respondent uuid NOT NULL,
    item_id uuid NOT NULL,
    raw_value integer NOT NULL,
    scored_value integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    synthetic boolean DEFAULT false NOT NULL,
    CONSTRAINT survey_responses_raw_value_check CHECK (((raw_value >= 1) AND (raw_value <= 6))),
    CONSTRAINT survey_responses_scored_value_check CHECK (((scored_value >= 1) AND (scored_value <= 6)))
);


--
-- Name: surveys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surveys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid,
    cycle_id uuid,
    name text NOT NULL,
    opens_at timestamp with time zone,
    closes_at timestamp with time zone,
    anonymity text DEFAULT 'anonymous'::text,
    status text DEFAULT 'draft'::text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    wave integer,
    CONSTRAINT surveys_anonymity_check CHECK ((anonymity = ANY (ARRAY['anonymous'::text, 'identified'::text]))),
    CONSTRAINT surveys_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'closed'::text])))
);


--
-- Data for Name: conversation_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conversation_logs (id, school_id, pairing_id, cycle_id, logged_by, domain, concern, strength_noted, more_frequently, less_frequently, resources, obstacles, is_visit_debrief, visit_data, created_at, vision, host_id, visitor_id, strategic_tag, status, submitted_at, neon_id) FROM stdin;
75f40371-1dcb-55b1-93fa-e8629a962af3	a0000000-0000-0000-0000-000000000001	8476bbeb-3195-5e9f-afd7-60ce2393a306	16ddcc27-4ccf-5879-8ede-2d13f22376a1	a302bbb6-378d-59c5-8038-cfa194e92a5a	PLANNING	\N	Strengths: strong unit architecture, smart pacing, effective task design.	More: 10-minute 'exit ticket first' planning; more intentional scaffolds.	Less: overstuffed lessons; fewer activities that do not build toward the end goal.	Support: co-plan one lesson and build a simple exemplar + success criteria.	\N	t	\N	2026-03-01 08:45:15.509+00	Vision: units that feel inevitable: clear arc, clean daily objectives, and tasks that build toward mastery.	42b6b7ad-e241-54bc-bae6-041e34ea308e	a302bbb6-378d-59c5-8038-cfa194e92a5a	AI Adoption	submitted	2026-03-01 08:45:15.509+00	cmm77ipyt001or30e0v2rcbll
31836fda-b040-534a-bac3-7f04da653ffa	a0000000-0000-0000-0000-000000000001	94374a27-b0ad-5f6b-9d59-ba5cd2331da5	16ddcc27-4ccf-5879-8ede-2d13f22376a1	f95e4ba1-6cfc-55f4-bc69-39711c7e2330	PLANNING	\N	Strengths: strong unit architecture, smart pacing, effective task design.	More: 10-minute 'exit ticket first' planning; more intentional scaffolds.	Less: overstuffed lessons; fewer activities that do not build toward the end goal.	Support: co-plan one lesson and build a simple exemplar + success criteria.	\N	t	\N	2026-03-01 08:45:15.543+00	Vision: units that feel inevitable: clear arc, clean daily objectives, and tasks that build toward mastery.	a302bbb6-378d-59c5-8038-cfa194e92a5a	f95e4ba1-6cfc-55f4-bc69-39711c7e2330	AI Adoption	submitted	2026-03-01 08:45:15.543+00	cmm77ipzr001pr30etk5os9kl
e86a0c8f-9f55-5751-b14e-90c0546f51af	a0000000-0000-0000-0000-000000000001	9674843c-86d0-541f-88e1-6a957eb4d3b6	16ddcc27-4ccf-5879-8ede-2d13f22376a1	2ae85386-ec4c-5c24-91a4-3761325d74af	ASSESSMENT	\N	Strengths: clear criteria, efficient feedback habits, good use of mastery checks.	More: short rubrics + exemplars; more quick reteach cycles.	Less: grading without feedback; fewer surprises on summatives.	Support: draft a 4-level rubric and set a 48-hour feedback routine.	\N	t	\N	2026-03-01 08:45:15.776+00	Vision: assessment as a coaching loop: fast feedback, visible criteria, and fewer surprises.	a1f4145c-6325-58d6-a5d0-fcf7aa671899	2ae85386-ec4c-5c24-91a4-3761325d74af	Assessment Literacy	submitted	2026-03-01 08:45:15.776+00	cmm77iq68001sr30exg8emtc3
17330dc3-5714-5a70-958b-efc87a7374fe	a0000000-0000-0000-0000-000000000001	59a5f683-441b-5eef-a878-2dfabcaf5e92	16ddcc27-4ccf-5879-8ede-2d13f22376a1	8e59691b-4042-584f-becc-e04ed37574bd	ASSESSMENT	\N	Strengths: clear criteria, efficient feedback habits, good use of mastery checks.	More: short rubrics + exemplars; more quick reteach cycles.	Less: grading without feedback; fewer surprises on summatives.	Support: draft a 4-level rubric and set a 48-hour feedback routine.	\N	t	\N	2026-03-01 08:45:15.81+00	Vision: assessment as a coaching loop: fast feedback, visible criteria, and fewer surprises.	2ae85386-ec4c-5c24-91a4-3761325d74af	8e59691b-4042-584f-becc-e04ed37574bd	Assessment Literacy	submitted	2026-03-01 08:45:15.81+00	cmm77iq76001tr30ez3qf9du5
3539e3b6-7545-5a33-8ee2-010d90fb18c0	a0000000-0000-0000-0000-000000000001	bff72135-5087-51af-b9e1-48b5a7c041d5	16ddcc27-4ccf-5879-8ede-2d13f22376a1	d9c4137a-5193-5d36-a32b-b62738ee50e3	CLASSROOM	\N	Strengths: strong presence, clear routines, warm-strict tone.	More: one extra check-for-understanding mid-lesson; more cold-call equity moves.	Less: teacher talk during practice; fewer multi-step directions without a checkpoint.	Support: share one discussion protocol and a CFU checklist.	\N	t	\N	2026-03-01 08:45:16.31+00	Vision: tighter pacing, more student talk, and a predictable rhythm of checks for understanding.	282a0489-00b7-5d7a-b0dc-42a23525e415	d9c4137a-5193-5d36-a32b-b62738ee50e3	Curriculum Update	submitted	2026-03-01 08:45:16.31+00	cmm77iql20020r30esq619ttq
c306d236-ed29-549f-8a79-c768c4e625d5	a0000000-0000-0000-0000-000000000001	592b6a98-5f6b-5614-9827-cca4a71c8b15	16ddcc27-4ccf-5879-8ede-2d13f22376a1	b168e8ba-e08d-5d86-9bd5-ebc56967997c	CLASSROOM	\N	Strengths: strong presence, clear routines, warm-strict tone.	More: one extra check-for-understanding mid-lesson; more cold-call equity moves.	Less: teacher talk during practice; fewer multi-step directions without a checkpoint.	Support: share one discussion protocol and a CFU checklist.	\N	t	\N	2026-03-01 08:45:16.347+00	Vision: tighter pacing, more student talk, and a predictable rhythm of checks for understanding.	d9c4137a-5193-5d36-a32b-b62738ee50e3	b168e8ba-e08d-5d86-9bd5-ebc56967997c	Curriculum Update	submitted	2026-03-01 08:45:16.347+00	cmm77iqm30021r30epivp2psl
a3feb5be-c815-592e-9488-6b990be31957	a0000000-0000-0000-0000-000000000001	b996d2dd-723a-5a73-8d37-7c2826143dbd	16ddcc27-4ccf-5879-8ede-2d13f22376a1	78854f62-1924-55ff-a10a-81376a5b4d3c	ASSESSMENT	\N	Strengths: clear criteria, efficient feedback habits, good use of mastery checks.	More: short rubrics + exemplars; more quick reteach cycles.	Less: grading without feedback; fewer surprises on summatives.	Support: draft a 4-level rubric and set a 48-hour feedback routine.	\N	t	\N	2026-03-01 08:45:16.846+00	Vision: assessment as a coaching loop: fast feedback, visible criteria, and fewer surprises.	e87acd38-2535-59d3-84c2-40c907abdaa2	78854f62-1924-55ff-a10a-81376a5b4d3c	Assessment Literacy	submitted	2026-03-01 08:45:16.846+00	cmm77iqzy0028r30ed1zrw21r
3f691118-18e5-5076-b54c-443ab854c01f	a0000000-0000-0000-0000-000000000001	289b8a7b-cefb-5a6f-aa03-e18449d7e89c	16ddcc27-4ccf-5879-8ede-2d13f22376a1	37d07ace-a1eb-53a8-8c9e-a21fff80c226	ASSESSMENT	\N	Strengths: clear criteria, efficient feedback habits, good use of mastery checks.	More: short rubrics + exemplars; more quick reteach cycles.	Less: grading without feedback; fewer surprises on summatives.	Support: draft a 4-level rubric and set a 48-hour feedback routine.	\N	t	\N	2026-03-01 08:45:16.886+00	Vision: assessment as a coaching loop: fast feedback, visible criteria, and fewer surprises.	78854f62-1924-55ff-a10a-81376a5b4d3c	37d07ace-a1eb-53a8-8c9e-a21fff80c226	Assessment Literacy	submitted	2026-03-01 08:45:16.886+00	cmm77ir120029r30ey5vvcdgs
7b519422-031e-5ef3-bb08-d965fd68672a	a0000000-0000-0000-0000-000000000001	d2596d0a-783a-595f-958b-d8b02495ed39	16ddcc27-4ccf-5879-8ede-2d13f22376a1	580d4475-12d0-5e91-9c65-2a622a314b71	COMMUNICATION	\N	Strengths: calm de-escalation, clear expectations, strong family and team communication.	More: proactive outreach; more short, positive messages to families/students.	Less: reactive messaging; fewer long threads without clear next steps.	Support: create two reusable templates and a weekly communication cadence.	\N	t	\N	2026-03-01 08:45:17.141+00	Vision: communication that reduces friction: clearer norms, faster repair, and stronger alignment.	571d6fb4-072a-59d0-95db-fe955f995f4a	580d4475-12d0-5e91-9c65-2a622a314b71	Belonging	submitted	2026-03-01 08:45:17.141+00	cmm77ir85002cr30edobrkwhg
e46ff5ea-9a91-5731-a6bf-68e5e0f7440e	a0000000-0000-0000-0000-000000000001	d2e228da-4a56-5f5b-9ff7-9eacd98aa5eb	16ddcc27-4ccf-5879-8ede-2d13f22376a1	2cbfe0db-d349-53c3-8a2c-79becbe7cea7	COMMUNICATION	\N	Strengths: calm de-escalation, clear expectations, strong family and team communication.	More: proactive outreach; more short, positive messages to families/students.	Less: reactive messaging; fewer long threads without clear next steps.	Support: create two reusable templates and a weekly communication cadence.	\N	t	\N	2026-03-01 08:45:17.184+00	Vision: communication that reduces friction: clearer norms, faster repair, and stronger alignment.	580d4475-12d0-5e91-9c65-2a622a314b71	2cbfe0db-d349-53c3-8a2c-79becbe7cea7	Belonging	submitted	2026-03-01 08:45:17.184+00	cmm77ir9c002dr30e3ew2464i
acc620f8-2066-538f-9bc7-8aa9ab421cd5	a0000000-0000-0000-0000-000000000001	a450934c-a40d-5461-9989-b0efaec65703	16ddcc27-4ccf-5879-8ede-2d13f22376a1	fb351a01-3757-5ff8-8d75-295ca2958f73	CLASSROOM	\N	Strengths: strong presence, clear routines, warm-strict tone.	More: one extra check-for-understanding mid-lesson; more cold-call equity moves.	Less: teacher talk during practice; fewer multi-step directions without a checkpoint.	Support: share one discussion protocol and a CFU checklist.	\N	t	\N	2026-03-01 08:45:17.412+00	Vision: tighter pacing, more student talk, and a predictable rhythm of checks for understanding.	eaaae6d2-aa33-56da-ae2a-e49814a50d78	fb351a01-3757-5ff8-8d75-295ca2958f73	Curriculum Update	submitted	2026-03-01 08:45:17.412+00	cmm77irfo002gr30eoyf2ewif
fff853d5-83af-5deb-bfc7-166b2ec2bdd8	a0000000-0000-0000-0000-000000000001	75248505-00b6-58f3-84b2-09feab35db80	16ddcc27-4ccf-5879-8ede-2d13f22376a1	fa178c55-cb37-53a1-827e-1f6fa6d2275c	CLASSROOM	\N	Strengths: strong presence, clear routines, warm-strict tone.	More: one extra check-for-understanding mid-lesson; more cold-call equity moves.	Less: teacher talk during practice; fewer multi-step directions without a checkpoint.	Support: share one discussion protocol and a CFU checklist.	\N	t	\N	2026-03-01 08:45:17.449+00	Vision: tighter pacing, more student talk, and a predictable rhythm of checks for understanding.	fb351a01-3757-5ff8-8d75-295ca2958f73	fa178c55-cb37-53a1-827e-1f6fa6d2275c	Curriculum Update	submitted	2026-03-01 08:45:17.449+00	cmm77irgq002hr30el5chffz5
5ac67ad3-73d1-595b-ad1f-ee67f7c1420c	a0000000-0000-0000-0000-000000000001	0b7bafe5-5a10-595a-884c-b42b1e37a06a	16ddcc27-4ccf-5879-8ede-2d13f22376a1	f5c950dd-6e98-5a82-9975-fbbc653efc90	PLANNING	\N	Strengths: strong unit architecture, smart pacing, effective task design.	More: 10-minute 'exit ticket first' planning; more intentional scaffolds.	Less: overstuffed lessons; fewer activities that do not build toward the end goal.	Support: co-plan one lesson and build a simple exemplar + success criteria.	\N	t	\N	2026-03-01 08:45:17.668+00	Vision: units that feel inevitable: clear arc, clean daily objectives, and tasks that build toward mastery.	bb732b9e-d258-522f-89c5-e812fe1a3c40	f5c950dd-6e98-5a82-9975-fbbc653efc90	AI Adoption	submitted	2026-03-01 08:45:17.668+00	cmm77irms002kr30egweens0b
edf68748-ffad-50fb-9be7-3c1015fab3df	a0000000-0000-0000-0000-000000000001	7c0550e6-f5b4-5308-861b-8b9ab8d8ff93	16ddcc27-4ccf-5879-8ede-2d13f22376a1	3eb3220d-8f66-59f7-9ac1-f39e534172f0	PLANNING	\N	Strengths: strong unit architecture, smart pacing, effective task design.	More: 10-minute 'exit ticket first' planning; more intentional scaffolds.	Less: overstuffed lessons; fewer activities that do not build toward the end goal.	Support: co-plan one lesson and build a simple exemplar + success criteria.	\N	t	\N	2026-03-01 08:45:17.708+00	Vision: units that feel inevitable: clear arc, clean daily objectives, and tasks that build toward mastery.	f5c950dd-6e98-5a82-9975-fbbc653efc90	3eb3220d-8f66-59f7-9ac1-f39e534172f0	AI Adoption	submitted	2026-03-01 08:45:17.708+00	cmm77irnw002lr30e4db9mase
2085e225-0adc-5375-8077-b3abbe3521d1	a0000000-0000-0000-0000-000000000001	156dc325-428b-50a2-89fa-c3a7da7af346	16ddcc27-4ccf-5879-8ede-2d13f22376a1	bfaa2bea-9624-53bf-bf20-f75ecbebb7cb	ASSESSMENT	\N	Strengths: clear criteria, efficient feedback habits, good use of mastery checks.	More: short rubrics + exemplars; more quick reteach cycles.	Less: grading without feedback; fewer surprises on summatives.	Support: draft a 4-level rubric and set a 48-hour feedback routine.	\N	t	\N	2026-03-01 08:45:17.938+00	Vision: assessment as a coaching loop: fast feedback, visible criteria, and fewer surprises.	42fdd57e-a332-5f8d-81c6-9c2410e4ae5d	bfaa2bea-9624-53bf-bf20-f75ecbebb7cb	Assessment Literacy	submitted	2026-03-01 08:45:17.938+00	cmm77irua002or30e3dljepux
43e48bb7-c180-5dbc-bad4-0ad61707ed22	a0000000-0000-0000-0000-000000000001	2627ac42-11f5-51ef-b8c1-ccf3a2053238	16ddcc27-4ccf-5879-8ede-2d13f22376a1	ca2cb262-5b04-5535-8ee4-81f5fb8ae75b	ASSESSMENT	\N	Strengths: clear criteria, efficient feedback habits, good use of mastery checks.	More: short rubrics + exemplars; more quick reteach cycles.	Less: grading without feedback; fewer surprises on summatives.	Support: draft a 4-level rubric and set a 48-hour feedback routine.	\N	t	\N	2026-03-01 08:45:17.972+00	Vision: assessment as a coaching loop: fast feedback, visible criteria, and fewer surprises.	bfaa2bea-9624-53bf-bf20-f75ecbebb7cb	ca2cb262-5b04-5535-8ee4-81f5fb8ae75b	Assessment Literacy	submitted	2026-03-01 08:45:17.972+00	cmm77irv8002pr30ehb90uyyq
8780b95a-9345-5d3d-881c-184522264186	a0000000-0000-0000-0000-000000000001	c4a73538-67d1-5698-bc4d-f8fbc59612a4	16ddcc27-4ccf-5879-8ede-2d13f22376a1	1d8c1576-f4b8-5dbd-bcf2-f75aea8fdcc6	COMMUNICATION	\N	Strengths: calm de-escalation, clear expectations, strong family and team communication.	More: proactive outreach; more short, positive messages to families/students.	Less: reactive messaging; fewer long threads without clear next steps.	Support: create two reusable templates and a weekly communication cadence.	\N	t	\N	2026-03-01 08:45:18.195+00	Vision: communication that reduces friction: clearer norms, faster repair, and stronger alignment.	47cacdf4-13e3-5148-a47e-3f304a21fcb6	1d8c1576-f4b8-5dbd-bcf2-f75aea8fdcc6	Belonging	submitted	2026-03-01 08:45:18.195+00	cmm77is1f002sr30ekhu7esmm
b2329818-d921-5c45-9fc1-3bc1d86e955d	a0000000-0000-0000-0000-000000000001	0ef76bd6-e00f-564f-bdd7-732800f5c512	16ddcc27-4ccf-5879-8ede-2d13f22376a1	aa1660c9-3657-5316-9bd2-9462450509ed	COMMUNICATION	\N	Strengths: calm de-escalation, clear expectations, strong family and team communication.	More: proactive outreach; more short, positive messages to families/students.	Less: reactive messaging; fewer long threads without clear next steps.	Support: create two reusable templates and a weekly communication cadence.	\N	t	\N	2026-03-01 08:45:18.237+00	Vision: communication that reduces friction: clearer norms, faster repair, and stronger alignment.	1d8c1576-f4b8-5dbd-bcf2-f75aea8fdcc6	aa1660c9-3657-5316-9bd2-9462450509ed	Belonging	submitted	2026-03-01 08:45:18.237+00	cmm77is2l002tr30ejfqe3q6v
d41535c9-c578-5389-ab71-2f7f5e44158b	a0000000-0000-0000-0000-000000000001	cce32be4-0f2a-598d-8f3e-2acd24bd5cb5	16ddcc27-4ccf-5879-8ede-2d13f22376a1	776a9403-cf93-57e1-83bd-2d9615be3d4e	CLASSROOM	\N	Strengths: strong presence, clear routines, warm-strict tone.	More: one extra check-for-understanding mid-lesson; more cold-call equity moves.	Less: teacher talk during practice; fewer multi-step directions without a checkpoint.	Support: share one discussion protocol and a CFU checklist.	\N	t	\N	2026-03-01 08:45:18.462+00	Vision: tighter pacing, more student talk, and a predictable rhythm of checks for understanding.	b76edea4-a5dc-5c72-9171-9d81991965f7	776a9403-cf93-57e1-83bd-2d9615be3d4e	Curriculum Update	submitted	2026-03-01 08:45:18.462+00	cmm77is8u002wr30euwa601aq
2bb5cb01-d5cd-5623-a65e-ee5457027c05	a0000000-0000-0000-0000-000000000001	e7657119-7aa7-5e4e-9c0b-5cd0376a3e00	16ddcc27-4ccf-5879-8ede-2d13f22376a1	4e4b6e39-c3e1-5e3d-87ad-fcd5744ae1bf	CLASSROOM	\N	Strengths: strong presence, clear routines, warm-strict tone.	More: one extra check-for-understanding mid-lesson; more cold-call equity moves.	Less: teacher talk during practice; fewer multi-step directions without a checkpoint.	Support: share one discussion protocol and a CFU checklist.	\N	t	\N	2026-03-01 08:45:18.5+00	Vision: tighter pacing, more student talk, and a predictable rhythm of checks for understanding.	776a9403-cf93-57e1-83bd-2d9615be3d4e	4e4b6e39-c3e1-5e3d-87ad-fcd5744ae1bf	Curriculum Update	submitted	2026-03-01 08:45:18.5+00	cmm77is9w002xr30e3zgyvf2h
a811a543-ab22-5b35-be6a-314ca7e72bf0	a0000000-0000-0000-0000-000000000001	b9a97b4e-d1c2-5b91-89bd-d6a1537e0361	16ddcc27-4ccf-5879-8ede-2d13f22376a1	155e108a-4bc4-5651-9c08-4ab9dc008ac6	PLANNING	\N	Strengths: strong unit architecture, smart pacing, effective task design.	More: 10-minute 'exit ticket first' planning; more intentional scaffolds.	Less: overstuffed lessons; fewer activities that do not build toward the end goal.	Support: co-plan one lesson and build a simple exemplar + success criteria.	\N	t	\N	2026-03-01 08:45:18.74+00	Vision: units that feel inevitable: clear arc, clean daily objectives, and tasks that build toward mastery.	a116a0ab-d0a8-5da4-819d-bfcb68150480	155e108a-4bc4-5651-9c08-4ab9dc008ac6	AI Adoption	submitted	2026-03-01 08:45:18.74+00	cmm77isgk0030r30epbte63vf
5c892628-1d91-5158-96d6-16ac27d227a7	a0000000-0000-0000-0000-000000000001	0dcc94cb-4123-5221-98eb-ea309c566446	16ddcc27-4ccf-5879-8ede-2d13f22376a1	bb90b03b-764b-54ee-ba79-2828edfb53fe	PLANNING	\N	Strengths: strong unit architecture, smart pacing, effective task design.	More: 10-minute 'exit ticket first' planning; more intentional scaffolds.	Less: overstuffed lessons; fewer activities that do not build toward the end goal.	Support: co-plan one lesson and build a simple exemplar + success criteria.	\N	t	\N	2026-03-01 08:45:18.778+00	Vision: units that feel inevitable: clear arc, clean daily objectives, and tasks that build toward mastery.	155e108a-4bc4-5651-9c08-4ab9dc008ac6	bb90b03b-764b-54ee-ba79-2828edfb53fe	AI Adoption	submitted	2026-03-01 08:45:18.778+00	cmm77ishm0031r30e88vdhwky
30479c3d-767d-5b83-b893-192fb7cbb4ae	a0000000-0000-0000-0000-000000000001	c0d5afb9-4721-5a4b-a203-79fec7796071	16ddcc27-4ccf-5879-8ede-2d13f22376a1	86094eba-45f5-5a9e-a0bc-52bd698b8312	ASSESSMENT	\N	Strengths: efficient feedback habits.	More: add a short exit ticket and track misconceptions for reteach.	Less: grading without actionable feedback.	Support: build a rubric + 48-hour feedback routine.	\N	t	\N	2026-03-01 08:45:18.928+00	Vision: assessment as a coaching loop: fast feedback, visible criteria, and fewer surprises.	d4ca0da0-e18c-5945-8236-bac42467990a	86094eba-45f5-5a9e-a0bc-52bd698b8312	Assessment Literacy	submitted	2026-03-01 08:45:18.928+00	cmm77isls0033r30e3qcpkmsk
a4c39069-7c2f-5ea6-a041-0ebd049e7123	a0000000-0000-0000-0000-000000000001	e901bb74-32ad-5169-a3ac-c90ee99c5532	16ddcc27-4ccf-5879-8ede-2d13f22376a1	2562b46a-7ec9-5fdf-8967-254e6a4060b0	COMMUNICATION	\N	Strengths: strong conferencing and steady communication.	More: create a reusable message template and predictable cadence.	Less: reactive messaging without a next step.	Support: build two templates and a weekly cadence.	\N	t	\N	2026-03-01 08:45:19.076+00	Vision: communication that reduces friction: clearer norms, faster repair, and stronger alignment.	61cde6f8-9224-5e92-bdbc-a8194ba3505e	2562b46a-7ec9-5fdf-8967-254e6a4060b0	Belonging	submitted	2026-03-01 08:45:19.076+00	cmm77ispw0035r30en1fe4aap
13a2e59d-67d3-554c-9cd4-ab46cd627e2a	a0000000-0000-0000-0000-000000000001	a5e88af5-b37c-511f-9bde-866d62dd2455	16ddcc27-4ccf-5879-8ede-2d13f22376a1	1962a5e9-6b1b-51f0-8b2a-5e967827c547	CLASSROOM	\N	Strengths: clear explanations and calm culture.	More: increase student-to-student talk with one structured protocol.	Less: unstructured whole-class discussion.	Support: share one protocol and model it once.	\N	t	\N	2026-03-01 08:45:19.227+00	Vision: tighter pacing, more student talk, and a predictable rhythm of checks for understanding.	2ace94a4-3b66-5477-a9b4-f9dd7bc65aac	1962a5e9-6b1b-51f0-8b2a-5e967827c547	Curriculum Update	submitted	2026-03-01 08:45:19.227+00	cmm77isu30037r30e9mxpqs5b
059ca31b-a67f-53de-b0f1-724adc5b9092	a0000000-0000-0000-0000-000000000001	368badae-22d6-5132-a364-e4fc27ff93a0	16ddcc27-4ccf-5879-8ede-2d13f22376a1	24722a6a-e57e-5119-977d-9f2a0ae41444	PLANNING	\N	Strengths: pacing and sequencing are sharp.	More: add one differentiation branch and clearer success criteria.	Less: extra tasks that do not build toward mastery.	Support: co-plan one lesson and draft exemplars.	\N	t	\N	2026-03-01 08:45:19.378+00	Vision: units that feel inevitable: clear arc, clean daily objectives, and tasks that build toward mastery.	ec5c0f17-1231-50f7-9d9c-7ea756f7d91a	24722a6a-e57e-5119-977d-9f2a0ae41444	AI Adoption	submitted	2026-03-01 08:45:19.378+00	cmm77isya0039r30efd29wsu3
65737eea-f445-5af1-b66d-796e5ada0150	a0000000-0000-0000-0000-000000000001	0a5c2f12-bf62-5705-b1d8-2749f5ce60a3	16ddcc27-4ccf-5879-8ede-2d13f22376a1	ec258a02-f6a6-581e-a3d0-c6e5fbbea5cc	CLASSROOM	\N	Her cold-call is genuinely warm — she names the student, waits, and nobody flinches. The wait time is longer than mine by a mile.	Turn-and-talk before the whole-group share. Students arrived at the share with something already formed.	She re-explains after a correct answer, which quietly tells the class the answer needed her endorsement.	She is sending me her discussion-protocol one-pager. I owe her the unit map for the ratios arc.	\N	t	\N	2026-03-01 08:45:15.244+00	Ava wants the room to run on student talk, with her voice as the smallest one in it.	69d26c90-6a5e-5e2b-b105-a5c0dea9661a	ec258a02-f6a6-581e-a3d0-c6e5fbbea5cc	Curriculum Update	submitted	2026-03-01 08:45:15.244+00	cmm77iprg001kr30eensfyxel
46b27adc-553b-52c2-b870-5455ac54e7b6	a0000000-0000-0000-0000-000000000001	b2357e55-70e8-5170-a55b-0e8728f044ed	16ddcc27-4ccf-5879-8ede-2d13f22376a1	1adc2310-24a8-5374-a253-aa7240245678	CLASSROOM	\N	He can restart a dead room in about ninety seconds. Students track him and the pace never sags.	Write the objective where students can see it. Twice I watched a kid get lost and have nothing to steer back toward.	Multi-step verbal directions during transitions. Three instructions at once and a third of the room is guessing.	I said I would share the checkpoint slide I use mid-lesson. He is going to try it Thursday.	\N	t	\N	2026-03-01 08:45:15.284+00	Liam is trying to get the energy of his best days to show up on the ordinary ones.	ec258a02-f6a6-581e-a3d0-c6e5fbbea5cc	1adc2310-24a8-5374-a253-aa7240245678	Curriculum Update	submitted	2026-03-01 08:45:15.284+00	cmm77ipsk001lr30ezuv56cvv
7da6544c-0dfc-500b-a3bd-0b2858188b07	a0000000-0000-0000-0000-000000000001	357a3b14-6ea3-5bdd-a529-f74494a864e0	16ddcc27-4ccf-5879-8ede-2d13f22376a1	e80a0a92-6c69-53ff-87cc-74a75556a971	PLANNING	\N	His daily objectives are written as questions students can actually answer by the bell. No fluff, no verbs like "explore".	The five-minute recap at the start that reconnects yesterday to today. It did more than any review day would have.	Two new representations in one lesson. The second one landed on students still holding the first.	Swapping unit maps. He wants my pacing calendar; I want his objective-writing frame.	\N	t	\N	2026-03-01 08:45:16.581+00	Noah wants a unit where every day obviously earns its place in the arc.	afdc7beb-c09b-54a7-8ecb-28534f521afc	e80a0a92-6c69-53ff-87cc-74a75556a971	AI Adoption	submitted	2026-03-01 08:45:16.581+00	cmm77iqsl0024r30e11kvkcns
57b8c601-eec4-5632-8c31-e8ca7295068c	a0000000-0000-0000-0000-000000000001	41a50ab0-2d7d-5716-b948-f31a8beb3be3	16ddcc27-4ccf-5879-8ede-2d13f22376a1	efbda83e-cb1c-5732-812a-c20bf863e375	PLANNING	\N	The exit ticket is three questions and she has the reteach list before she leaves the room. No weekend grading.	Showing students the rubric row she is actually scoring. They stopped guessing at what "developing" meant.	Written comments on work that will be revised anyway. She agreed most of it is never read.	She is giving me the exit-ticket template. I am walking her through how I do the revision cycle.	\N	t	\N	2026-03-01 08:45:16.618+00	Avery is rebuilding the feedback loop so it closes in a day instead of a week.	e80a0a92-6c69-53ff-87cc-74a75556a971	efbda83e-cb1c-5732-812a-c20bf863e375	AI Adoption	submitted	2026-03-01 08:45:16.618+00	cmm77iqtm0025r30eyboefhu3
7a8b90ac-e899-5988-9bcb-28955ef48071	a0000000-0000-0000-0000-000000000001	5df07b97-bc48-5dca-a0fd-da938670f98b	16ddcc27-4ccf-5879-8ede-2d13f22376a1	54d4354e-0f7d-534d-a1be-b10d4d45f6c1	COMMUNICATION	\N	He keeps a two-line log of every family call. When a hard conversation comes, he has history to stand on.	Naming the specific thing the student did, not the trait. "She revised the whole second paragraph" travels better than "she is conscientious".	Apologising at the start of a call. It sets the family up to expect bad news before he has said anything.	He is sharing his call log format. I am sending him the repair conversation script we use after a conflict.	\N	t	\N	2026-03-01 08:45:16.038+00	Mason wants the first contact home to be about something good, before anything has gone wrong.	f94d9ecf-1e5e-5cd7-bdf6-2feff865617c	54d4354e-0f7d-534d-a1be-b10d4d45f6c1	Belonging	submitted	2026-03-01 08:45:16.038+00	cmm77iqdi001wr30eocr8s2ef
ee5c452f-1861-58a6-9192-4ac6336aaee3	a0000000-0000-0000-0000-000000000001	d2f61f7d-da13-5760-a595-8824ad901899	16ddcc27-4ccf-5879-8ede-2d13f22376a1	0bd955de-d9b2-526d-80e1-7e96269ec991	COMMUNICATION	\N	She repairs fast. A student pushed back hard and they were fine four minutes later, with no audience to the reset.	The private check-in at the door. Two kids walked in already regulated because of a ten-second conversation.	Addressing one student's behaviour to the whole room. The other twenty-nine pay for it and the one it is aimed at digs in.	I am borrowing her door check-in. She wants the norms-setting activity I run in September.	\N	t	\N	2026-03-01 08:45:16.069+00	Harper wants the class norms to hold without her having to enforce them out loud.	54d4354e-0f7d-534d-a1be-b10d4d45f6c1	0bd955de-d9b2-526d-80e1-7e96269ec991	Belonging	submitted	2026-03-01 08:45:16.069+00	cmm77iqed001xr30etk126x7t
\.


--
-- Data for Name: cycles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cycles (id, school_id, name, academic_year, starts_at, ends_at, status, created_at, strategic_priority, neon_id) FROM stdin;
16ddcc27-4ccf-5879-8ede-2d13f22376a1	a0000000-0000-0000-0000-000000000001	Fall 2025	2025-26	2025-09-01	2025-12-20	complete	2026-09-07 18:06:27.852119+00	AI Adoption	cmm77inur0001r30es4f5j85l
\.


--
-- Data for Name: invites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invites (id, school_id, email, role, department, invited_by, token, accepted_at, created_at) FROM stdin;
\.


--
-- Data for Name: pairings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pairings (id, school_id, cycle_id, host_id, visitor_id, status, requested_by, approved_by, approved_at, created_at, domain, strategic_tag, neon_id) FROM stdin;
0a5c2f12-bf62-5705-b1d8-2749f5ce60a3	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	69d26c90-6a5e-5e2b-b105-a5c0dea9661a	ec258a02-f6a6-581e-a3d0-c6e5fbbea5cc	approved	\N	\N	2026-03-01 08:45:15.164+00	2026-03-01 08:45:15.164+00	CLASSROOM	Curriculum Update	cmm77ipp8001ir30ea89sco3x
b2357e55-70e8-5170-a55b-0e8728f044ed	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	ec258a02-f6a6-581e-a3d0-c6e5fbbea5cc	1adc2310-24a8-5374-a253-aa7240245678	approved	\N	\N	2026-03-01 08:45:15.203+00	2026-03-01 08:45:15.203+00	CLASSROOM	Curriculum Update	cmm77ipqb001jr30ec4l75boq
8476bbeb-3195-5e9f-afd7-60ce2393a306	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	42b6b7ad-e241-54bc-bae6-041e34ea308e	a302bbb6-378d-59c5-8038-cfa194e92a5a	approved	\N	\N	2026-03-01 08:45:15.436+00	2026-03-01 08:45:15.436+00	PLANNING	AI Adoption	cmm77ipws001mr30ek8lncigw
94374a27-b0ad-5f6b-9d59-ba5cd2331da5	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	a302bbb6-378d-59c5-8038-cfa194e92a5a	f95e4ba1-6cfc-55f4-bc69-39711c7e2330	approved	\N	\N	2026-03-01 08:45:15.47+00	2026-03-01 08:45:15.47+00	PLANNING	AI Adoption	cmm77ipxq001nr30eofn79qj4
9674843c-86d0-541f-88e1-6a957eb4d3b6	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	a1f4145c-6325-58d6-a5d0-fcf7aa671899	2ae85386-ec4c-5c24-91a4-3761325d74af	approved	\N	\N	2026-03-01 08:45:15.695+00	2026-03-01 08:45:15.695+00	ASSESSMENT	Assessment Literacy	cmm77iq3z001qr30eurfgm1oy
59a5f683-441b-5eef-a878-2dfabcaf5e92	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	2ae85386-ec4c-5c24-91a4-3761325d74af	8e59691b-4042-584f-becc-e04ed37574bd	approved	\N	\N	2026-03-01 08:45:15.732+00	2026-03-01 08:45:15.732+00	ASSESSMENT	Assessment Literacy	cmm77iq51001rr30eta10rreh
5df07b97-bc48-5dca-a0fd-da938670f98b	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	f94d9ecf-1e5e-5cd7-bdf6-2feff865617c	54d4354e-0f7d-534d-a1be-b10d4d45f6c1	approved	\N	\N	2026-03-01 08:45:15.959+00	2026-03-01 08:45:15.959+00	COMMUNICATION	Belonging	cmm77iqbb001ur30ele0n3a5e
d2f61f7d-da13-5760-a595-8824ad901899	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	54d4354e-0f7d-534d-a1be-b10d4d45f6c1	0bd955de-d9b2-526d-80e1-7e96269ec991	approved	\N	\N	2026-03-01 08:45:15.995+00	2026-03-01 08:45:15.995+00	COMMUNICATION	Belonging	cmm77iqcb001vr30exkxprgju
bff72135-5087-51af-b9e1-48b5a7c041d5	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	282a0489-00b7-5d7a-b0dc-42a23525e415	d9c4137a-5193-5d36-a32b-b62738ee50e3	approved	\N	\N	2026-03-01 08:45:16.237+00	2026-03-01 08:45:16.237+00	CLASSROOM	Curriculum Update	cmm77iqj1001yr30eemk3zqme
592b6a98-5f6b-5614-9827-cca4a71c8b15	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	d9c4137a-5193-5d36-a32b-b62738ee50e3	b168e8ba-e08d-5d86-9bd5-ebc56967997c	approved	\N	\N	2026-03-01 08:45:16.273+00	2026-03-01 08:45:16.273+00	CLASSROOM	Curriculum Update	cmm77iqk1001zr30eduxvu1de
357a3b14-6ea3-5bdd-a529-f74494a864e0	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	afdc7beb-c09b-54a7-8ecb-28534f521afc	e80a0a92-6c69-53ff-87cc-74a75556a971	approved	\N	\N	2026-03-01 08:45:16.5+00	2026-03-01 08:45:16.5+00	PLANNING	AI Adoption	cmm77iqqc0022r30eksysfc2z
41a50ab0-2d7d-5716-b948-f31a8beb3be3	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	e80a0a92-6c69-53ff-87cc-74a75556a971	efbda83e-cb1c-5732-812a-c20bf863e375	approved	\N	\N	2026-03-01 08:45:16.54+00	2026-03-01 08:45:16.54+00	PLANNING	AI Adoption	cmm77iqrg0023r30elfesxoxi
b996d2dd-723a-5a73-8d37-7c2826143dbd	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	e87acd38-2535-59d3-84c2-40c907abdaa2	78854f62-1924-55ff-a10a-81376a5b4d3c	approved	\N	\N	2026-03-01 08:45:16.767+00	2026-03-01 08:45:16.767+00	ASSESSMENT	Assessment Literacy	cmm77iqxr0026r30et5lnwjkx
289b8a7b-cefb-5a6f-aa03-e18449d7e89c	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	78854f62-1924-55ff-a10a-81376a5b4d3c	37d07ace-a1eb-53a8-8c9e-a21fff80c226	approved	\N	\N	2026-03-01 08:45:16.806+00	2026-03-01 08:45:16.806+00	ASSESSMENT	Assessment Literacy	cmm77iqyu0027r30e4iy0oyk1
d2596d0a-783a-595f-958b-d8b02495ed39	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	571d6fb4-072a-59d0-95db-fe955f995f4a	580d4475-12d0-5e91-9c65-2a622a314b71	approved	\N	\N	2026-03-01 08:45:17.054+00	2026-03-01 08:45:17.054+00	COMMUNICATION	Belonging	cmm77ir5r002ar30en4ez51br
d2e228da-4a56-5f5b-9ff7-9eacd98aa5eb	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	580d4475-12d0-5e91-9c65-2a622a314b71	2cbfe0db-d349-53c3-8a2c-79becbe7cea7	approved	\N	\N	2026-03-01 08:45:17.094+00	2026-03-01 08:45:17.094+00	COMMUNICATION	Belonging	cmm77ir6u002br30e8g38t1ez
a450934c-a40d-5461-9989-b0efaec65703	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	eaaae6d2-aa33-56da-ae2a-e49814a50d78	fb351a01-3757-5ff8-8d75-295ca2958f73	approved	\N	\N	2026-03-01 08:45:17.335+00	2026-03-01 08:45:17.335+00	CLASSROOM	Curriculum Update	cmm77irdj002er30e60m2s7hj
75248505-00b6-58f3-84b2-09feab35db80	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	fb351a01-3757-5ff8-8d75-295ca2958f73	fa178c55-cb37-53a1-827e-1f6fa6d2275c	approved	\N	\N	2026-03-01 08:45:17.373+00	2026-03-01 08:45:17.373+00	CLASSROOM	Curriculum Update	cmm77irel002fr30e5svyvvd5
0b7bafe5-5a10-595a-884c-b42b1e37a06a	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	bb732b9e-d258-522f-89c5-e812fe1a3c40	f5c950dd-6e98-5a82-9975-fbbc653efc90	approved	\N	\N	2026-03-01 08:45:17.594+00	2026-03-01 08:45:17.594+00	PLANNING	AI Adoption	cmm77irkq002ir30ektys8pvf
7c0550e6-f5b4-5308-861b-8b9ab8d8ff93	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	f5c950dd-6e98-5a82-9975-fbbc653efc90	3eb3220d-8f66-59f7-9ac1-f39e534172f0	approved	\N	\N	2026-03-01 08:45:17.63+00	2026-03-01 08:45:17.63+00	PLANNING	AI Adoption	cmm77irlq002jr30emhpci4zu
156dc325-428b-50a2-89fa-c3a7da7af346	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	42fdd57e-a332-5f8d-81c6-9c2410e4ae5d	bfaa2bea-9624-53bf-bf20-f75ecbebb7cb	approved	\N	\N	2026-03-01 08:45:17.86+00	2026-03-01 08:45:17.86+00	ASSESSMENT	Assessment Literacy	cmm77irs4002mr30emuzbrk0u
2627ac42-11f5-51ef-b8c1-ccf3a2053238	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	bfaa2bea-9624-53bf-bf20-f75ecbebb7cb	ca2cb262-5b04-5535-8ee4-81f5fb8ae75b	approved	\N	\N	2026-03-01 08:45:17.898+00	2026-03-01 08:45:17.898+00	ASSESSMENT	Assessment Literacy	cmm77irt6002nr30eqqnj5dyb
c4a73538-67d1-5698-bc4d-f8fbc59612a4	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	47cacdf4-13e3-5148-a47e-3f304a21fcb6	1d8c1576-f4b8-5dbd-bcf2-f75aea8fdcc6	approved	\N	\N	2026-03-01 08:45:18.124+00	2026-03-01 08:45:18.124+00	COMMUNICATION	Belonging	cmm77irzg002qr30e834ayizu
0ef76bd6-e00f-564f-bdd7-732800f5c512	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	1d8c1576-f4b8-5dbd-bcf2-f75aea8fdcc6	aa1660c9-3657-5316-9bd2-9462450509ed	approved	\N	\N	2026-03-01 08:45:18.165+00	2026-03-01 08:45:18.165+00	COMMUNICATION	Belonging	cmm77is0l002rr30ehlgrovcr
cce32be4-0f2a-598d-8f3e-2acd24bd5cb5	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	b76edea4-a5dc-5c72-9171-9d81991965f7	776a9403-cf93-57e1-83bd-2d9615be3d4e	approved	\N	\N	2026-03-01 08:45:18.392+00	2026-03-01 08:45:18.392+00	CLASSROOM	Curriculum Update	cmm77is6w002ur30e2tx8w8c4
e7657119-7aa7-5e4e-9c0b-5cd0376a3e00	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	776a9403-cf93-57e1-83bd-2d9615be3d4e	4e4b6e39-c3e1-5e3d-87ad-fcd5744ae1bf	approved	\N	\N	2026-03-01 08:45:18.425+00	2026-03-01 08:45:18.425+00	CLASSROOM	Curriculum Update	cmm77is7u002vr30eyhkhxmvy
b9a97b4e-d1c2-5b91-89bd-d6a1537e0361	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	a116a0ab-d0a8-5da4-819d-bfcb68150480	155e108a-4bc4-5651-9c08-4ab9dc008ac6	approved	\N	\N	2026-03-01 08:45:18.661+00	2026-03-01 08:45:18.661+00	PLANNING	AI Adoption	cmm77ised002yr30ebv0xzdzm
0dcc94cb-4123-5221-98eb-ea309c566446	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	155e108a-4bc4-5651-9c08-4ab9dc008ac6	bb90b03b-764b-54ee-ba79-2828edfb53fe	approved	\N	\N	2026-03-01 08:45:18.698+00	2026-03-01 08:45:18.698+00	PLANNING	AI Adoption	cmm77isfe002zr30epguzw255
c0d5afb9-4721-5a4b-a203-79fec7796071	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	d4ca0da0-e18c-5945-8236-bac42467990a	86094eba-45f5-5a9e-a0bc-52bd698b8312	approved	\N	\N	2026-03-01 08:45:18.886+00	2026-03-01 08:45:18.886+00	ASSESSMENT	Assessment Literacy	cmm77iskm0032r30e5x52wgz7
e901bb74-32ad-5169-a3ac-c90ee99c5532	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	61cde6f8-9224-5e92-bdbc-a8194ba3505e	2562b46a-7ec9-5fdf-8967-254e6a4060b0	approved	\N	\N	2026-03-01 08:45:19.041+00	2026-03-01 08:45:19.041+00	COMMUNICATION	Belonging	cmm77isox0034r30e4l3qlakx
a5e88af5-b37c-511f-9bde-866d62dd2455	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	2ace94a4-3b66-5477-a9b4-f9dd7bc65aac	1962a5e9-6b1b-51f0-8b2a-5e967827c547	approved	\N	\N	2026-03-01 08:45:19.194+00	2026-03-01 08:45:19.194+00	CLASSROOM	Curriculum Update	cmm77ist60036r30ewbcruy4s
368badae-22d6-5132-a364-e4fc27ff93a0	a0000000-0000-0000-0000-000000000001	16ddcc27-4ccf-5879-8ede-2d13f22376a1	ec5c0f17-1231-50f7-9d9c-7ea756f7d91a	24722a6a-e57e-5119-977d-9f2a0ae41444	approved	\N	\N	2026-03-01 08:45:19.339+00	2026-03-01 08:45:19.339+00	PLANNING	AI Adoption	cmm77isx70038r30eh4wh35xw
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (id, school_id, first_name, last_name, email, role, department, years_teaching, archetype_id, teaching_style, inspiration, onboarding_complete, created_at, updated_at, auth_user_id, strength_tags, personality_tags, is_demo, neon_id) FROM stdin;
debf36dc-b98d-4d38-876b-6238af9eaf24	a0000000-0000-0000-0000-000000000001	Nicholas	Kurian	nick@kurianconsulting.com	admin	Leadership	\N	collector	architect	I stopped teaching and immediately missed the only part that mattered: watching somebody get better at something hard.	t	2026-04-24 21:27:13.406819+00	2026-04-24 21:27:13.406819+00	debf36dc-b98d-4d38-876b-6238af9eaf24	\N	\N	f	\N
61cde6f8-9224-5e92-bdbc-a8194ba3505e	a0000000-0000-0000-0000-000000000001	Audrey	Garcia	audrey.garcia@demo.mentorful.co	teacher	Learning Support	\N	prankster	nurturer	\N	f	2026-03-01 08:45:14.825+00	2026-09-07 17:57:24.816929+00	\N	["De-escalation and Repair", "Clear Explanations"]	["Driver", "Nurturer"]	t	cmm77ipft001cr30e3gcybf7z
8e59691b-4042-584f-becc-e04ed37574bd	a0000000-0000-0000-0000-000000000001	Amelia	Chen	amelia.chen@demo.mentorful.co	teacher	English	\N	mover-shaker	nurturer	\N	f	2026-03-01 08:45:13.471+00	2026-09-07 17:57:24.816929+00	\N	["Rubric Clarity", "De-escalation and Repair"]	["Driver", "Nurturer"]	t	cmm77ioe7000cr30e6wrhvu7f
aa1660c9-3657-5316-9bd2-9462450509ed	a0000000-0000-0000-0000-000000000001	Anthony	Nelson	anthony.nelson@demo.mentorful.co	teacher	Arts	\N	collector	nurturer	\N	f	2026-03-01 08:45:14.477+00	2026-09-07 17:57:24.816929+00	\N	["Student Conferencing", "Classroom Presence"]	["Analyst", "Driver"]	t	cmm77ip660013r30eofsb8y8i
b76edea4-a5dc-5c72-9171-9d81991965f7	a0000000-0000-0000-0000-000000000001	Aria	Hill	aria.hill@demo.mentorful.co	teacher	Arts	\N	novelty-seeker	activator	\N	f	2026-03-01 08:45:14.519+00	2026-09-07 17:57:24.816929+00	\N	["Classroom Presence", "Differentiation Planning"]	["Driver", "Nurturer"]	t	cmm77ip7b0014r30efyza62cu
155e108a-4bc4-5651-9c08-4ab9dc008ac6	a0000000-0000-0000-0000-000000000001	Naomi	Patel	naomi.patel@demo.mentorful.co	teacher	PE/Health	\N	story-lover	architect	\N	f	2026-03-01 08:45:14.673+00	2026-09-07 17:57:24.816929+00	\N	["Pacing and Sequencing", "Feedback Efficiency"]	["Driver", "Nurturer"]	t	cmm77ipbl0018r30e4k3lyl26
1962a5e9-6b1b-51f0-8b2a-5e967827c547	a0000000-0000-0000-0000-000000000001	Thomas	Brown	thomas.brown@demo.mentorful.co	teacher	Technology	\N	fixer	activator	\N	f	2026-03-01 08:45:14.932+00	2026-09-07 17:57:24.816929+00	\N	["Discussion Craft", "Unit Architecture"]	["Analyst", "Driver"]	t	cmm77ipis001fr30es43adruy
1d8c1576-f4b8-5dbd-bcf2-f75aea8fdcc6	a0000000-0000-0000-0000-000000000001	Layla	Adams	layla.adams@demo.mentorful.co	teacher	Arts	\N	competitor	nurturer	\N	f	2026-03-01 08:45:14.439+00	2026-09-07 17:57:24.816929+00	\N	["Family Communication", "Warm-Strict Culture"]	["Entertainer", "Analyst"]	t	cmm77ip530012r30ehzs4ba58
24722a6a-e57e-5119-977d-9f2a0ae41444	a0000000-0000-0000-0000-000000000001	Samuel	Davis	samuel.davis@demo.mentorful.co	teacher	Technology	\N	performer	architect	\N	f	2026-03-01 08:45:15.007+00	2026-09-07 17:57:24.816929+00	\N	["Pacing and Sequencing", "Feedback Efficiency"]	["Nurturer", "Entertainer"]	t	cmm77ipkv001hr30ethpljzpb
2562b46a-7ec9-5fdf-8967-254e6a4060b0	a0000000-0000-0000-0000-000000000001	Ryan	Johnson	ryan.johnson@demo.mentorful.co	teacher	Learning Support	\N	artist	nurturer	\N	f	2026-03-01 08:45:14.862+00	2026-09-07 17:57:24.816929+00	\N	["Family Communication", "Warm-Strict Culture"]	["Nurturer", "Entertainer"]	t	cmm77ipgu001dr30egccq5ez8
282a0489-00b7-5d7a-b0dc-42a23525e415	a0000000-0000-0000-0000-000000000001	Evelyn	Anderson	evelyn.anderson@demo.mentorful.co	teacher	English	\N	collector	activator	\N	f	2026-03-01 08:45:13.618+00	2026-09-07 17:57:24.816929+00	\N	["Classroom Presence", "Differentiation Planning"]	["Driver", "Nurturer"]	t	cmm77ioia000gr30e6csnc4xa
2ace94a4-3b66-5477-a9b4-f9dd7bc65aac	a0000000-0000-0000-0000-000000000001	Claire	Martinez	claire.martinez@demo.mentorful.co	teacher	Learning Support	\N	party-captain	activator	\N	f	2026-03-01 08:45:14.898+00	2026-09-07 17:57:24.816929+00	\N	["Classroom Presence", "Differentiation Planning"]	["Entertainer", "Analyst"]	t	cmm77iphu001er30eqjxwl86t
2ae85386-ec4c-5c24-91a4-3761325d74af	a0000000-0000-0000-0000-000000000001	Lucas	Brown	lucas.brown@demo.mentorful.co	teacher	Math	\N	prankster	nurturer	\N	f	2026-03-01 08:45:13.434+00	2026-09-07 17:57:24.816929+00	\N	["Data-Informed Reteach", "Team Coordination"]	["Analyst", "Driver"]	t	cmm77iod6000br30ekft5wn8j
2cbfe0db-d349-53c3-8a2c-79becbe7cea7	a0000000-0000-0000-0000-000000000001	Wyatt	Lewis	wyatt.lewis@demo.mentorful.co	teacher	History	\N	novelty-seeker	nurturer	\N	f	2026-03-01 08:45:14.016+00	2026-09-07 17:57:24.816929+00	\N	["Student Conferencing", "Classroom Presence"]	["Analyst", "Driver"]	t	cmm77iotc000rr30epxs4prbp
37d07ace-a1eb-53a8-8c9e-a21fff80c226	a0000000-0000-0000-0000-000000000001	Scarlett	Lee	scarlett.lee@demo.mentorful.co	teacher	Science	\N	puzzler	nurturer	\N	f	2026-03-01 08:45:13.907+00	2026-09-07 17:57:24.816929+00	\N	["Rubric Clarity", "De-escalation and Repair"]	["Driver", "Nurturer"]	t	cmm77ioqb000or30es6gg42am
3eb3220d-8f66-59f7-9ac1-f39e534172f0	a0000000-0000-0000-0000-000000000001	Mateo	Wright	mateo.wright@demo.mentorful.co	teacher	World Languages	\N	story-lover	architect	\N	f	2026-03-01 08:45:14.247+00	2026-09-07 17:57:24.816929+00	\N	["Differentiation Planning", "Mastery Checks"]	["Nurturer", "Entertainer"]	t	cmm77iozr000xr30eot90wb90
42b6b7ad-e241-54bc-bae6-041e34ea308e	a0000000-0000-0000-0000-000000000001	Henry	White	henry.white@demo.mentorful.co	teacher	English	\N	fixer	architect	\N	f	2026-03-01 08:45:13.722+00	2026-09-07 17:57:24.816929+00	\N	["Task Design", "Rubric Clarity"]	["Analyst", "Driver"]	t	cmm77iol6000jr30ehb57v0x6
42fdd57e-a332-5f8d-81c6-9c2410e4ae5d	a0000000-0000-0000-0000-000000000001	Isabella	Martinez	isabella.martinez@demo.mentorful.co	teacher	Math	\N	mover-shaker	nurturer	\N	f	2026-03-01 08:45:13.399+00	2026-09-07 17:57:24.816929+00	\N	["Mastery Checks", "Student Conferencing"]	["Entertainer", "Analyst"]	t	cmm77ioc7000ar30ej3ty58r0
47cacdf4-13e3-5148-a47e-3f304a21fcb6	a0000000-0000-0000-0000-000000000001	Gabriel	Baker	gabriel.baker@demo.mentorful.co	teacher	Arts	\N	competitor	nurturer	\N	f	2026-03-01 08:45:14.402+00	2026-09-07 17:57:24.816929+00	\N	["De-escalation and Repair", "Clear Explanations"]	["Nurturer", "Entertainer"]	t	cmm77ip420011r30e7nu7tjfk
4e4b6e39-c3e1-5e3d-87ad-fcd5744ae1bf	a0000000-0000-0000-0000-000000000001	Stella	Mitchell	stella.mitchell@demo.mentorful.co	teacher	PE/Health	\N	performer	activator	\N	f	2026-03-01 08:45:14.595+00	2026-09-07 17:57:24.816929+00	\N	["Clear Explanations", "Task Design"]	["Entertainer", "Analyst"]	t	cmm77ip9f0016r30ewtrh0seu
571d6fb4-072a-59d0-95db-fe955f995f4a	a0000000-0000-0000-0000-000000000001	Owen	Perez	owen.perez@demo.mentorful.co	teacher	Science	\N	collector	nurturer	\N	f	2026-03-01 08:45:13.941+00	2026-09-07 17:57:24.816929+00	\N	["De-escalation and Repair", "Clear Explanations"]	["Nurturer", "Entertainer"]	t	cmm77ior9000pr30ebx5eyfg3
580d4475-12d0-5e91-9c65-2a622a314b71	a0000000-0000-0000-0000-000000000001	Grace	Clark	grace.clark@demo.mentorful.co	teacher	Science	\N	party-captain	nurturer	\N	f	2026-03-01 08:45:13.979+00	2026-09-07 17:57:24.816929+00	\N	["Family Communication", "Warm-Strict Culture"]	["Entertainer", "Analyst"]	t	cmm77iosb000qr30e0jdvlbck
776a9403-cf93-57e1-83bd-2d9615be3d4e	a0000000-0000-0000-0000-000000000001	Lincoln	Campbell	lincoln.campbell@demo.mentorful.co	teacher	Arts	\N	puzzler	activator	\N	f	2026-03-01 08:45:14.557+00	2026-09-07 17:57:24.816929+00	\N	["Discussion Craft", "Unit Architecture"]	["Nurturer", "Entertainer"]	t	cmm77ip8d0015r30e0qs6cnuy
78854f62-1924-55ff-a10a-81376a5b4d3c	a0000000-0000-0000-0000-000000000001	Leo	Moore	leo.moore@demo.mentorful.co	teacher	Science	\N	story-lover	nurturer	\N	f	2026-03-01 08:45:13.869+00	2026-09-07 17:57:24.816929+00	\N	["Data-Informed Reteach", "Team Coordination"]	["Analyst", "Driver"]	t	cmm77iop9000nr30e20gxbhdm
86094eba-45f5-5a9e-a0bc-52bd698b8312	a0000000-0000-0000-0000-000000000001	Caleb	Nguyen	caleb.nguyen@demo.mentorful.co	teacher	Learning Support	\N	fixer	nurturer	\N	f	2026-03-01 08:45:14.786+00	2026-09-07 17:57:24.816929+00	\N	["Data-Informed Reteach", "Team Coordination"]	["Analyst", "Driver"]	t	cmm77ipeq001br30ef7rmr8zt
a116a0ab-d0a8-5da4-819d-bfcb68150480	a0000000-0000-0000-0000-000000000001	Daniel	Roberts	daniel.roberts@demo.mentorful.co	teacher	PE/Health	\N	competitor	architect	\N	f	2026-03-01 08:45:14.634+00	2026-09-07 17:57:24.816929+00	\N	["Task Design", "Rubric Clarity"]	["Analyst", "Driver"]	t	cmm77ipai0017r30e7mi5m1m1
a1f4145c-6325-58d6-a5d0-fcf7aa671899	a0000000-0000-0000-0000-000000000001	Hannah	King	hannah.king@demo.mentorful.co	teacher	World Languages	\N	performer	nurturer	\N	f	2026-03-01 08:45:14.285+00	2026-09-07 17:57:24.816929+00	\N	["Mastery Checks", "Student Conferencing"]	["Entertainer", "Analyst"]	t	cmm77ip0t000yr30ebo4iajiz
a302bbb6-378d-59c5-8038-cfa194e92a5a	a0000000-0000-0000-0000-000000000001	Sophia	Garcia	sophia.garcia@demo.mentorful.co	teacher	Math	\N	artist	architect	\N	f	2026-03-01 08:45:13.326+00	2026-09-07 17:57:24.816929+00	\N	["Pacing and Sequencing", "Feedback Efficiency"]	["Driver", "Nurturer"]	t	cmm77ioa60008r30e0jkrcidr
b168e8ba-e08d-5d86-9bd5-ebc56967997c	a0000000-0000-0000-0000-000000000001	Ella	Jackson	ella.jackson@demo.mentorful.co	teacher	English	\N	prankster	activator	\N	f	2026-03-01 08:45:13.684+00	2026-09-07 17:57:24.816929+00	\N	["Clear Explanations", "Task Design"]	["Entertainer", "Analyst"]	t	cmm77iok4000ir30e5t12rw3f
bb732b9e-d258-522f-89c5-e812fe1a3c40	a0000000-0000-0000-0000-000000000001	Carter	Allen	carter.allen@demo.mentorful.co	teacher	History	\N	puzzler	architect	\N	f	2026-03-01 08:45:14.172+00	2026-09-07 17:57:24.816929+00	\N	["Task Design", "Rubric Clarity"]	["Analyst", "Driver"]	t	cmm77ioxo000vr30eurbub6ox
bb90b03b-764b-54ee-ba79-2828edfb53fe	a0000000-0000-0000-0000-000000000001	Elijah	Rivera	elijah.rivera@demo.mentorful.co	teacher	PE/Health	\N	story-lover	architect	\N	f	2026-03-01 08:45:14.712+00	2026-09-07 17:57:24.816929+00	\N	["Differentiation Planning", "Mastery Checks"]	["Nurturer", "Entertainer"]	t	cmm77ipco0019r30e6oqi8zow
bfaa2bea-9624-53bf-bf20-f75ecbebb7cb	a0000000-0000-0000-0000-000000000001	Isaac	Scott	isaac.scott@demo.mentorful.co	teacher	World Languages	\N	fixer	nurturer	\N	f	2026-03-01 08:45:14.326+00	2026-09-07 17:57:24.816929+00	\N	["Data-Informed Reteach", "Team Coordination"]	["Analyst", "Driver"]	t	cmm77ip1y000zr30emrhnscx1
ca2cb262-5b04-5535-8ee4-81f5fb8ae75b	a0000000-0000-0000-0000-000000000001	Nora	Green	nora.green@demo.mentorful.co	teacher	World Languages	\N	mover-shaker	nurturer	\N	f	2026-03-01 08:45:14.368+00	2026-09-07 17:57:24.816929+00	\N	["Rubric Clarity", "De-escalation and Repair"]	["Driver", "Nurturer"]	t	cmm77ip340010r30ed2poijjw
d4ca0da0-e18c-5945-8236-bac42467990a	a0000000-0000-0000-0000-000000000001	Violet	Kim	violet.kim@demo.mentorful.co	teacher	Learning Support	\N	competitor	nurturer	\N	f	2026-03-01 08:45:14.752+00	2026-09-07 17:57:24.816929+00	\N	["Mastery Checks", "Student Conferencing"]	["Entertainer", "Analyst"]	t	cmm77ipds001ar30ei852s09o
d9c4137a-5193-5d36-a32b-b62738ee50e3	a0000000-0000-0000-0000-000000000001	James	Thomas	james.thomas@demo.mentorful.co	teacher	English	\N	performer	activator	\N	f	2026-03-01 08:45:13.655+00	2026-09-07 17:57:24.816929+00	\N	["Discussion Craft", "Unit Architecture"]	["Nurturer", "Entertainer"]	t	cmm77iojb000hr30e5ltc4mds
e87acd38-2535-59d3-84c2-40c907abdaa2	a0000000-0000-0000-0000-000000000001	Sofia	Thompson	sofia.thompson@demo.mentorful.co	teacher	Science	\N	collector	nurturer	\N	f	2026-03-01 08:45:13.834+00	2026-09-07 17:57:24.816929+00	\N	["Mastery Checks", "Student Conferencing"]	["Entertainer", "Analyst"]	t	cmm77ioob000mr30ene2sf9z9
eaaae6d2-aa33-56da-ae2a-e49814a50d78	a0000000-0000-0000-0000-000000000001	Chloe	Walker	chloe.walker@demo.mentorful.co	teacher	History	\N	party-captain	activator	\N	f	2026-03-01 08:45:14.055+00	2026-09-07 17:57:24.816929+00	\N	["Classroom Presence", "Differentiation Planning"]	["Driver", "Nurturer"]	t	cmm77iouf000sr30eraw68z06
ec5c0f17-1231-50f7-9d9c-7ea756f7d91a	a0000000-0000-0000-0000-000000000001	Elena	Chen	elena.chen@demo.mentorful.co	teacher	Technology	\N	novelty-seeker	architect	\N	f	2026-03-01 08:45:14.969+00	2026-09-07 17:57:24.816929+00	\N	["Task Design", "Rubric Clarity"]	["Driver", "Nurturer"]	t	cmm77ipjt001gr30ekpfr1ivm
f5c950dd-6e98-5a82-9975-fbbc653efc90	a0000000-0000-0000-0000-000000000001	Zoe	Sanchez	zoe.sanchez@demo.mentorful.co	teacher	World Languages	\N	story-lover	architect	\N	f	2026-03-01 08:45:14.211+00	2026-09-07 17:57:24.816929+00	\N	["Pacing and Sequencing", "Feedback Efficiency"]	["Driver", "Nurturer"]	t	cmm77ioyr000wr30e1cvcn0js
f95e4ba1-6cfc-55f4-bc69-39711c7e2330	a0000000-0000-0000-0000-000000000001	Ethan	Johnson	ethan.johnson@demo.mentorful.co	teacher	Math	\N	mover-shaker	architect	\N	f	2026-03-01 08:45:13.363+00	2026-09-07 17:57:24.816929+00	\N	["Differentiation Planning", "Mastery Checks"]	["Nurturer", "Entertainer"]	t	cmm77iob70009r30ewk4us7sb
fa178c55-cb37-53a1-827e-1f6fa6d2275c	a0000000-0000-0000-0000-000000000001	Lily	Young	lily.young@demo.mentorful.co	teacher	History	\N	competitor	activator	\N	f	2026-03-01 08:45:14.134+00	2026-09-07 17:57:24.816929+00	\N	["Clear Explanations", "Task Design"]	["Entertainer", "Analyst"]	t	cmm77iowm000ur30esccocjxp
fb351a01-3757-5ff8-8d75-295ca2958f73	a0000000-0000-0000-0000-000000000001	Julian	Hall	julian.hall@demo.mentorful.co	teacher	History	\N	performer	activator	\N	f	2026-03-01 08:45:14.091+00	2026-09-07 17:57:24.816929+00	\N	["Discussion Craft", "Unit Architecture"]	["Nurturer", "Entertainer"]	t	cmm77iovf000tr30ekiq1pv8j
69d26c90-6a5e-5e2b-b105-a5c0dea9661a	a0000000-0000-0000-0000-000000000001	Ava	Patel	ava.patel@demo.mentorful.co	teacher	Math	\N	collector	activator	Math was the first subject where I felt genuinely smart, and only because someone slowed down for me. I keep the pace slow on purpose.	f	2026-03-01 08:45:13.163+00	2026-09-07 17:57:24.816929+00	\N	["Classroom Presence", "Differentiation Planning"]	["Driver", "Nurturer"]	t	cmm77io5n0004r30ezmj5zqok
1adc2310-24a8-5374-a253-aa7240245678	a0000000-0000-0000-0000-000000000001	Mia	Kim	mia.kim@demo.mentorful.co	teacher	Math	\N	puzzler	activator	I like the moment a student stops asking whether they got it right and starts asking why it works.	f	2026-03-01 08:45:13.237+00	2026-09-07 17:57:24.816929+00	\N	["Clear Explanations", "Task Design"]	["Entertainer", "Analyst"]	t	cmm77io7p0006r30evmxd6wuq
afdc7beb-c09b-54a7-8ecb-28534f521afc	a0000000-0000-0000-0000-000000000001	Noah	Nguyen	noah.nguyen@demo.mentorful.co	teacher	Math	\N	novelty-seeker	architect	Nobody in my family had done a science degree. A teacher handed me a lab notebook and acted like it was obvious I'd use it.	f	2026-03-01 08:45:13.275+00	2026-09-07 17:57:24.816929+00	\N	["Task Design", "Rubric Clarity"]	["Analyst", "Driver"]	t	cmm77io8r0007r30espe8crxb
efbda83e-cb1c-5732-812a-c20bf863e375	a0000000-0000-0000-0000-000000000001	Jack	Martin	jack.martin@demo.mentorful.co	teacher	Science	\N	mover-shaker	architect	The best lesson I ever taught was one I scrapped halfway through, because the students had a better question than mine.	f	2026-03-01 08:45:13.794+00	2026-09-07 17:57:24.816929+00	\N	["Differentiation Planning", "Mastery Checks"]	["Nurturer", "Entertainer"]	t	cmm77ion6000lr30ew6xdt8av
f94d9ecf-1e5e-5cd7-bdf6-2feff865617c	a0000000-0000-0000-0000-000000000001	Mason	Davis	mason.davis@demo.mentorful.co	teacher	English	\N	story-lover	nurturer	Every family I call is braced for bad news. I try to make the first call the one that isn't.	f	2026-03-01 08:45:13.505+00	2026-09-07 17:57:24.816929+00	\N	["De-escalation and Repair", "Clear Explanations"]	["Nurturer", "Entertainer"]	t	cmm77iof6000dr30eueqtr92b
0bd955de-d9b2-526d-80e1-7e96269ec991	a0000000-0000-0000-0000-000000000001	Logan	Wilson	logan.wilson@demo.mentorful.co	teacher	English	\N	prankster	nurturer	A class that laughs together will argue about a book together. I have never found a shortcut around that order.	f	2026-03-01 08:45:13.58+00	2026-09-07 17:57:24.816929+00	\N	["Student Conferencing", "Classroom Presence"]	["Analyst", "Driver"]	t	cmm77ioh8000fr30eedkkymp5
ec258a02-f6a6-581e-a3d0-c6e5fbbea5cc	a0000000-0000-0000-0000-000000000001	Liam	Rivera	liam.rivera@demo.mentorful.co	teacher	Math	\N	performer	activator	I had a teacher who ran class like a conversation you couldn't wait to join. I've been chasing that room ever since.	f	2026-03-01 08:45:13.201+00	2026-09-07 17:57:24.816929+00	c0da7098-014a-4be0-b790-72a88091fd6a	["Discussion Craft", "Unit Architecture"]	["Nurturer", "Entertainer"]	t	cmm77io6p0005r30ew3rfdyas
e80a0a92-6c69-53ff-87cc-74a75556a971	a0000000-0000-0000-0000-000000000001	Avery	Harris	avery.harris@demo.mentorful.co	teacher	Science	\N	fixer	architect	I spent my first three years grading until midnight and calling it dedication. Now I'd rather design the unit so the feedback is fast and the kids actually read it.	f	2026-03-01 08:45:13.759+00	2026-09-07 17:57:24.816929+00	9ad5bafe-95a9-4764-94b1-f115dbd0148d	["Pacing and Sequencing", "Feedback Efficiency"]	["Driver", "Nurturer"]	t	cmm77iom7000kr30envd1y4i8
54d4354e-0f7d-534d-a1be-b10d4d45f6c1	a0000000-0000-0000-0000-000000000001	Harper	Lopez	harper.lopez@demo.mentorful.co	teacher	English	\N	party-captain	nurturer	I teach the kid who has already decided they are not a reader. That decision gets made early and it is almost always wrong.	f	2026-03-01 08:45:13.545+00	2026-09-07 17:57:24.816929+00	3a159ad5-e6f7-453a-9bf5-2cff7bcf4a51	["Family Communication", "Warm-Strict Culture"]	["Entertainer", "Analyst"]	t	cmm77iog9000er30e459zqmq7
\.


--
-- Data for Name: schools; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schools (id, name, district, city, state, timezone, strategic_priority, academic_year, created_at) FROM stdin;
a0000000-0000-0000-0000-000000000001	Mentorful Sandbox	Mentorful Team	New York	NY	America/New_York	AI and Academic Integrity: Building a shared classroom response	2025-26	2026-04-01 12:21:05.1871+00
\.


--
-- Data for Name: survey_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.survey_items (id, "position", dimension, framing, reverse, text, scale_min, scale_max, active, created_at, instrument_version) FROM stdin;
6719968f-41c7-4905-874c-11747c7ab5e3	1	structural	I	f	When a lesson isn't working, there's a specific colleague I can go to.	1	6	t	2026-07-19 18:30:37.662517+00	2
932e3d51-820e-48d5-90c3-b0934171be3d	2	structural	I	f	In the past month, at least one colleague has come to me for help with their teaching.	1	6	t	2026-07-19 18:30:37.662517+00	2
0f65a05a-8b99-47a2-be89-97d1fa3e31d0	3	structural	I	f	The people I turn to for help teach different subjects or grades than I do.	1	6	t	2026-07-19 18:30:37.662517+00	2
31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	structural	I	f	I regularly talk with colleagues about the actual work of teaching, not just logistics.	1	6	t	2026-07-19 18:30:37.662517+00	2
692c0cf4-a1cd-4655-8603-791e5900ef43	5	structural	I	t	When I have a hard teaching problem, I mostly work it out on my own.	1	6	t	2026-07-19 18:30:37.662517+00	2
54b58e4f-69dc-44b9-993f-6acdaa84b56c	6	structural	I	f	I've built a new working relationship with a colleague this year.	1	6	t	2026-07-19 18:30:37.662517+00	2
704411e7-e372-41cf-9797-8333554dba60	7	relational	I	f	I feel like a full member of this faculty, not a guest in it.	1	6	t	2026-07-19 18:30:37.662517+00	2
8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	8	relational	I	f	There are people here who would notice and care if I left.	1	6	t	2026-07-19 18:30:37.662517+00	2
cde36b5a-9ba6-4068-bacc-48e73422a43c	9	relational	I	f	I can tell a colleague that a lesson failed without it being held against me.	1	6	t	2026-07-19 18:30:37.662517+00	2
12aed47e-7498-4c49-87fe-86a96d2f6b4b	10	relational	I	f	When I've tried something new and it flopped, I've felt supported, not judged.	1	6	t	2026-07-19 18:30:37.662517+00	2
0beac4db-206d-498b-852e-ced7a137074b	11	relational	I	t	There are colleagues I'd never be fully honest with about my teaching.	1	6	t	2026-07-19 18:30:37.662517+00	2
50dbae72-9a1d-4fd9-928b-301e852cad68	12	relational	I	f	When I've raised a real concern, I've seen it lead to something.	1	6	t	2026-07-19 18:30:37.662517+00	2
6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	13	relational	I	f	My expertise gets used in decisions here, not just my compliance.	1	6	t	2026-07-19 18:30:37.662517+00	2
fb9d8599-17df-4d90-bae1-f4c19a597ac3	14	relational	I	f	The work I do here connects to something I actually believe in.	1	6	t	2026-07-19 18:30:37.662517+00	2
f9f07677-fb34-4877-85d1-a883dfab8025	15	relational	I	f	I share a sense of mission with the colleagues I work most closely with.	1	6	t	2026-07-19 18:30:37.662517+00	2
0e549040-6265-402f-951a-d0aab6b09263	16	cognitive	we	f	The teachers I work with and I share a common language for what good teaching looks like.	1	6	t	2026-07-19 18:30:37.662517+00	2
15850608-0316-4548-88ab-9489a5118f61	17	cognitive	we	f	If we compared, my colleagues and I would largely agree on what makes a lesson excellent.	1	6	t	2026-07-19 18:30:37.662517+00	2
9ca78e45-60fb-40ae-9375-4637946e2405	18	cognitive	we	f	When we look at student work together, we're using the same standards.	1	6	t	2026-07-19 18:30:37.662517+00	2
fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	19	cognitive	we	f	I could name what this school is trying to accomplish this year.	1	6	t	2026-07-19 18:30:37.662517+00	2
2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	20	cognitive	we	f	The goals leadership talks about and the goals I care about are the same goals.	1	6	t	2026-07-19 18:30:37.662517+00	2
9159ad92-33f2-4324-a469-462295b10cde	21	cognitive	we	t	Good practice here stays private; we each just figure it out alone.	1	6	t	2026-07-19 18:30:37.662517+00	2
de32f83f-df9f-4a2c-8c9c-df9d48792e6b	22	efficacy	we	f	I've seen this staff solve a problem together that none of us could have solved alone.	1	6	t	2026-07-19 18:30:37.662517+00	2
d0886045-cca4-42bb-8796-1a24c7fe8023	23	efficacy	we	f	Working together, the teachers here can reach even our most disengaged students.	1	6	t	2026-07-19 18:30:37.662517+00	2
072e52b6-eacc-46e6-8fa4-a6ff04242c1b	24	efficacy	we	f	When a student is struggling, we're good at changing course as a group.	1	6	t	2026-07-19 18:30:37.662517+00	2
edd88ef1-c137-4c93-b824-783b445be228	25	efficacy	we	t	Whether a kid succeeds here comes down to which teacher they got, not us as a staff.	1	6	t	2026-07-19 18:30:37.662517+00	2
fe3f810e-a1fb-4830-8d96-ea5850a61cbc	26	efficacy	we	f	I'm confident this faculty can improve outcomes for our hardest-to-teach students.	1	6	t	2026-07-19 18:30:37.662517+00	2
\.


--
-- Data for Name: survey_responses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.survey_responses (id, survey_id, school_id, respondent, item_id, raw_value, scored_value, created_at, synthetic) FROM stdin;
451f697d-de0f-4932-b840-100d2b53aa70	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	6719968f-41c7-4905-874c-11747c7ab5e3	2	2	2026-07-21 15:55:45.516889+00	t
2c373857-8382-458f-968f-2284bbdfbd66	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	932e3d51-820e-48d5-90c3-b0934171be3d	4	4	2026-07-21 15:55:45.516889+00	t
611c23f2-5445-47e5-b53d-4c8f3a043188	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	3	3	2026-07-21 15:55:45.516889+00	t
90419677-7687-4ae9-a46d-416c495ab005	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	2	2	2026-07-21 15:55:45.516889+00	t
20f10456-571e-4303-8177-c1b411801971	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	692c0cf4-a1cd-4655-8603-791e5900ef43	5	2	2026-07-21 15:55:45.516889+00	t
1b279c9d-8d55-4eb5-8a6c-17e2e9c00f62	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	54b58e4f-69dc-44b9-993f-6acdaa84b56c	2	2	2026-07-21 15:55:45.516889+00	t
468175ba-640c-4e12-a51a-f6192241bc7c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	704411e7-e372-41cf-9797-8333554dba60	4	4	2026-07-21 15:55:45.516889+00	t
9b45e872-2de1-4e80-9ab5-c9c67fee3b76	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-07-21 15:55:45.516889+00	t
f56bc316-f3a9-4235-8fd0-2e93615404cc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	cde36b5a-9ba6-4068-bacc-48e73422a43c	4	4	2026-07-21 15:55:45.516889+00	t
caf99c4a-0e24-4dea-8530-854d603e4911	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:45.516889+00	t
ee4ba2ad-94a4-4c28-84a7-42f2adc8c3a9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:45.516889+00	t
bbb0de30-619a-4fab-ba2f-1006744b9eb2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	50dbae72-9a1d-4fd9-928b-301e852cad68	3	3	2026-07-21 15:55:45.516889+00	t
276634d3-1644-4682-b8f6-8d0bac285973	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:45.516889+00	t
75f97ebf-30d2-4ab8-9c34-ebc98895ce56	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-07-21 15:55:45.516889+00	t
e82d55cd-10f3-4c2c-a63c-3c7a311282f6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:45.516889+00	t
f65eef00-bf5f-4349-b8aa-287819dff553	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:45.516889+00	t
034bac85-d35b-4619-85ce-252b95d104f0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-07-21 15:55:45.516889+00	t
98829dd8-d3a3-411e-930a-8bfd09c5eb01	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	9ca78e45-60fb-40ae-9375-4637946e2405	6	6	2026-07-21 15:55:45.516889+00	t
4f02d949-acdd-4439-9773-4e69d48a3068	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:45.516889+00	t
72b3285b-6c5e-489d-b092-8d7eabb40091	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:45.516889+00	t
20be6d8a-2832-4da2-9373-66edb82924d2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	9159ad92-33f2-4324-a469-462295b10cde	2	5	2026-07-21 15:55:45.516889+00	t
7eefaadd-ad25-4758-833a-fbed882807ad	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:45.516889+00	t
5a2ecfd8-9f81-4a97-810b-2e0b37ff8fbf	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:45.516889+00	t
90065076-51dc-42b3-b4f5-98b9a5cfec21	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	5	5	2026-07-21 15:55:45.516889+00	t
84afb645-46dc-46e3-a619-5b443cdf02de	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	edd88ef1-c137-4c93-b824-783b445be228	1	6	2026-07-21 15:55:45.516889+00	t
6aed5e66-5e9b-498e-93da-9fbc80ebda44	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	94928e09-8d6e-4a1f-9bcc-5a755e705856	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:45.516889+00	t
041776ae-0d72-4254-a2eb-ae83d854ee75	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	6719968f-41c7-4905-874c-11747c7ab5e3	3	3	2026-07-21 15:55:45.516889+00	t
8785b17f-904e-4670-866f-ec0f42508154	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	932e3d51-820e-48d5-90c3-b0934171be3d	5	5	2026-07-21 15:55:45.516889+00	t
f6cc08b6-af55-4b55-9d34-40ecc3d9af6e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	4	4	2026-07-21 15:55:45.516889+00	t
8e1a66c3-1e31-4326-bf3a-32cb0c1ff34e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-07-21 15:55:45.516889+00	t
0bcffc2e-837a-49b9-b822-b10637137c0e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	692c0cf4-a1cd-4655-8603-791e5900ef43	2	5	2026-07-21 15:55:45.516889+00	t
62e9ade3-73c5-4e18-948b-27402d3617fe	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-07-21 15:55:45.516889+00	t
ebe62264-6216-4d14-82e6-077380bc0d4f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:45.516889+00	t
513abb60-577f-467e-873a-cf92828fb165	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	4	4	2026-07-21 15:55:45.516889+00	t
19f93ae9-73a9-47cb-9fb8-50e739f89577	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	cde36b5a-9ba6-4068-bacc-48e73422a43c	3	3	2026-07-21 15:55:45.516889+00	t
4b1c6df6-d9d7-4960-b35e-d43f5d2afd9e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:45.516889+00	t
37ec7ee9-6239-469c-b8c6-747f26985647	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	0beac4db-206d-498b-852e-ced7a137074b	3	4	2026-07-21 15:55:45.516889+00	t
4bd0d597-ea72-4b74-a0f6-9a4e17f6a775	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-07-21 15:55:45.516889+00	t
4a1b7d5c-361a-46fe-846d-42dbeb2c3801	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:45.516889+00	t
461a7ab9-2b52-4b57-81a1-8158273eff18	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:45.516889+00	t
af710790-27c2-4a32-a204-0fdcdf2e7eae	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:45.516889+00	t
2663a71b-c96f-483d-b2a0-e1241d6dcb12	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:45.516889+00	t
60d81eda-afd8-4de2-b411-b75af6ac04e1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	15850608-0316-4548-88ab-9489a5118f61	6	6	2026-07-21 15:55:45.516889+00	t
8d4261ea-2909-4616-8905-a7e2cccf8cce	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	9ca78e45-60fb-40ae-9375-4637946e2405	5	5	2026-07-21 15:55:45.516889+00	t
876bbad6-6f17-4291-8b2c-5237d647655a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	5	5	2026-07-21 15:55:45.516889+00	t
818145d3-f275-4bae-a123-bc2d4d4fea6d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	3	3	2026-07-21 15:55:45.516889+00	t
51fa672d-142e-4249-8665-e0ca8baee254	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	9159ad92-33f2-4324-a469-462295b10cde	2	5	2026-07-21 15:55:45.516889+00	t
d726f263-34aa-437c-bedf-8ccb6605e153	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:45.516889+00	t
f0b15538-c701-4393-a8f6-400e25564f41	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:45.516889+00	t
c6e186de-fb54-4cff-acd7-74b740e44419	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:45.516889+00	t
a2d0f06b-737f-440b-b93a-fbfacb4de611	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	edd88ef1-c137-4c93-b824-783b445be228	4	3	2026-07-21 15:55:45.516889+00	t
27c3f084-d857-42a0-b4b3-27903daf8118	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	88115623-dc96-45d8-83f3-668dff5d609a	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:45.516889+00	t
b9266638-bd6e-4621-973c-4c28158949f5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	6719968f-41c7-4905-874c-11747c7ab5e3	2	2	2026-07-21 15:55:45.516889+00	t
860d998b-fbc8-4efb-be96-11d3a105bdf2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	932e3d51-820e-48d5-90c3-b0934171be3d	4	4	2026-07-21 15:55:45.516889+00	t
e3482ea7-90d4-47ee-8d59-ed4f40e7feca	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	2	2	2026-07-21 15:55:45.516889+00	t
5999ee0c-b954-464d-beb5-bf8d633216d1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-07-21 15:55:45.516889+00	t
4be45e92-400a-453e-80e8-80280a98a161	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	692c0cf4-a1cd-4655-8603-791e5900ef43	5	2	2026-07-21 15:55:45.516889+00	t
401e476d-88b9-48ee-9409-678364d8244a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:45.516889+00	t
231cd02a-72f3-4fdb-bb27-703482aec59b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:45.516889+00	t
3bc86a11-8d06-4fbd-9e71-08b9fc7b8619	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-07-21 15:55:45.516889+00	t
042da51a-0d03-4dfb-874d-94812306ecf7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:45.516889+00	t
ce04202c-ebd3-45d0-802c-3d4faea68d30	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:45.516889+00	t
897a3449-22eb-40c1-b86f-44344c8ca5a4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:45.516889+00	t
569f8431-5448-40a5-9c9c-0070571142e8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:45.516889+00	t
5b8102be-2dea-4b93-a174-6155fc1d06b3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:45.516889+00	t
981e26f0-b7f3-41c1-b138-b338698ba313	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-07-21 15:55:45.516889+00	t
1479ef8a-9994-4d70-8fe2-170053706de1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	f9f07677-fb34-4877-85d1-a883dfab8025	6	6	2026-07-21 15:55:45.516889+00	t
492a5fc2-74e9-47f7-98f4-a4c0878f5a24	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:45.516889+00	t
f6c27663-6302-4316-8eb3-8435ba611d66	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	15850608-0316-4548-88ab-9489a5118f61	6	6	2026-07-21 15:55:45.516889+00	t
aa2cb3fd-2efe-499d-80cd-92a2546645d7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	9ca78e45-60fb-40ae-9375-4637946e2405	6	6	2026-07-21 15:55:45.516889+00	t
f286f225-f6f2-42b4-9206-67abcbf0901c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:45.516889+00	t
13939537-2739-4cdc-a180-53b222698129	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:45.516889+00	t
1bab2b25-7baf-4469-afff-8da84e31ccbf	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	9159ad92-33f2-4324-a469-462295b10cde	1	6	2026-07-21 15:55:45.516889+00	t
28af3988-2943-4f26-a4a9-41c09769a13a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:45.516889+00	t
5164e0bb-d8d6-486b-a931-e7abb25fa000	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:45.516889+00	t
7d622c9c-a072-4fd8-91d9-532350f40f1c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:45.516889+00	t
c75eddae-c0c4-4058-ad93-faaa985b06ca	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:45.516889+00	t
735a55dd-adbb-4684-82c9-b1c07895d7d9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	5b8315f1-fb93-45bd-9705-62cc7648c9ec	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:45.516889+00	t
5645f434-5e1d-4230-a63f-ba93e5870e45	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	6719968f-41c7-4905-874c-11747c7ab5e3	2	2	2026-07-21 15:55:45.516889+00	t
944e010e-4366-4f3a-98b7-e28dcb3891fc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:45.516889+00	t
dad31225-78da-4832-a910-27817daa1237	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	1	1	2026-07-21 15:55:45.516889+00	t
bfb401ac-c7e9-48f2-83b2-3f2a82a44133	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:45.516889+00	t
0a16e008-91a4-4dc5-948a-546b8231a58a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	692c0cf4-a1cd-4655-8603-791e5900ef43	3	4	2026-07-21 15:55:45.516889+00	t
4bf16d37-25d4-49c2-b421-4a8b8ca9a0a6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	54b58e4f-69dc-44b9-993f-6acdaa84b56c	1	1	2026-07-21 15:55:45.516889+00	t
a704a40b-23ca-4fca-8426-1113501fa39b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:45.516889+00	t
6bce34b0-48dc-4e40-a881-ec8c1a4d5586	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	5	5	2026-07-21 15:55:45.516889+00	t
963e0565-2a14-4eeb-86b2-0ebed86a05d3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	cde36b5a-9ba6-4068-bacc-48e73422a43c	4	4	2026-07-21 15:55:45.516889+00	t
5eb06780-310a-4503-8f4a-3a0dacea721a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:45.516889+00	t
55f5b478-21b0-441f-b285-625444becdbf	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:45.516889+00	t
27f741fd-fb79-47e9-8c46-edd9970555ba	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:45.516889+00	t
827ef550-3e9d-4cf0-ab02-c02adf18ca94	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:45.516889+00	t
5e9fa2a7-c912-49c4-9c9b-eeef203ad765	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:45.516889+00	t
56b40923-5054-45ec-bce8-888368672a58	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:45.516889+00	t
00b554a8-d914-462b-aa5f-aad1d569bdcb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:45.516889+00	t
b2b50ec7-62f3-46bb-8e93-a24a43dc2be9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:45.516889+00	t
065f54e9-8346-400d-8660-9334d56eaa6b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-07-21 15:55:45.516889+00	t
e11804ae-06b5-492e-bbf1-cc7eeb64bb6b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	5	5	2026-07-21 15:55:45.516889+00	t
62bc463a-08b5-4987-a933-492b9c37aa76	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:45.516889+00	t
0ab2a253-a672-4523-baa0-442cec2bc31c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-07-21 15:55:45.516889+00	t
95589089-e920-4d62-8848-b763dc93c2f1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:45.516889+00	t
6743be0a-0903-4393-b747-f5fa5e267aa5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	d0886045-cca4-42bb-8796-1a24c7fe8023	5	5	2026-07-21 15:55:45.516889+00	t
68619d46-2899-41bd-b846-afd0c8e3d5cb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-07-21 15:55:45.516889+00	t
8bec2565-6dd1-4c97-b445-0822257c1e43	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:45.516889+00	t
448f218a-56fe-4029-99d5-ff6753c380d7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4fdacde4-a120-4d8d-9e42-64d4d9c3db64	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:45.516889+00	t
e17876ec-00e9-426d-bd55-5b057fc5c061	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	6719968f-41c7-4905-874c-11747c7ab5e3	1	1	2026-07-21 15:55:45.516889+00	t
3e8fd3e1-a6d1-4426-bab8-4080acc1a41e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	932e3d51-820e-48d5-90c3-b0934171be3d	2	2	2026-07-21 15:55:45.516889+00	t
1269810a-f19e-4d46-8034-e6da39a9864d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	1	1	2026-07-21 15:55:45.516889+00	t
a89b66ae-a6d8-427f-8321-65ae76b1cbec	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:45.516889+00	t
d1a8f2b4-4521-4597-b62a-e5f99443bc3a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	692c0cf4-a1cd-4655-8603-791e5900ef43	6	1	2026-07-21 15:55:45.516889+00	t
d123c271-5e95-4342-856b-c8912a73ea1c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	54b58e4f-69dc-44b9-993f-6acdaa84b56c	2	2	2026-07-21 15:55:45.516889+00	t
9494e4cc-05f8-4077-9778-400d056b00bb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:45.516889+00	t
5e4dbef2-c53f-4f05-9d2b-786824ea7c7a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	5	5	2026-07-21 15:55:45.516889+00	t
95f1fc22-88dc-4279-9db2-868664e302de	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:45.516889+00	t
31e86a29-66fc-406c-a1a7-a3f367cf27e3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:45.516889+00	t
4c156196-1ed0-461d-b899-6e743f0ee914	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:45.516889+00	t
a756af68-13ab-4d3c-8d5f-c714d6502fce	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:45.516889+00	t
a0259f16-f965-4a82-93fd-0988f67a4c2a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:45.516889+00	t
3c47dde0-b4dd-41a8-bb05-d168a5f50c5e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-07-21 15:55:45.516889+00	t
2bf6e8eb-55c4-4298-8ecd-b1effdbeb023	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:45.516889+00	t
ec6e8aa2-11ca-4f21-9064-5b5576a81763	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	0e549040-6265-402f-951a-d0aab6b09263	3	3	2026-07-21 15:55:45.516889+00	t
1bd53f00-e5be-4ffe-8732-0961793eff56	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:45.516889+00	t
3a470bf3-000d-4bf3-a825-b62497ee3d11	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-07-21 15:55:45.516889+00	t
907cc819-b109-40fd-a3e7-8a78dd7b72af	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:45.516889+00	t
5d53aed8-a239-4879-b13a-2fba92541ab0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:45.516889+00	t
70b8a943-03ed-44fa-8de6-0a18987184f2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	9159ad92-33f2-4324-a469-462295b10cde	1	6	2026-07-21 15:55:45.516889+00	t
2169f015-4663-4fab-aaf4-709ae292b721	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:45.516889+00	t
c7751b78-470e-4fa1-ad6f-11a86d41611b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	d0886045-cca4-42bb-8796-1a24c7fe8023	3	3	2026-07-21 15:55:45.516889+00	t
09de9fef-41f0-4894-8f5f-7ded9dbff1be	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:45.516889+00	t
84eb3c87-ce99-4922-9f00-8222dca1334d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	edd88ef1-c137-4c93-b824-783b445be228	1	6	2026-07-21 15:55:45.516889+00	t
65d72f4c-16dd-4f86-8ca1-cf1668101923	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	569e45ed-55a5-498b-802b-f72c9e6371ee	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:45.516889+00	t
45c73805-7a74-4fa1-8daf-984240634c26	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	6719968f-41c7-4905-874c-11747c7ab5e3	2	2	2026-07-21 15:55:45.516889+00	t
45102a34-f969-4687-98bb-50938767991d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	932e3d51-820e-48d5-90c3-b0934171be3d	2	2	2026-07-21 15:55:45.516889+00	t
49de4ba5-9aad-4003-8345-a53541bdfc94	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	1	1	2026-07-21 15:55:45.516889+00	t
dce38147-30c6-447e-9624-6deb29900996	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	1	1	2026-07-21 15:55:45.516889+00	t
3834cf7f-18e1-4782-ac35-eea86bc8b1e1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-07-21 15:55:45.516889+00	t
06653927-a15d-4169-8a9e-284d5b2679bc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	54b58e4f-69dc-44b9-993f-6acdaa84b56c	1	1	2026-07-21 15:55:45.516889+00	t
cffea2df-37d3-40ca-9d66-466dd1308fbe	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:45.516889+00	t
0895d5c2-9d4f-4aa4-8cfb-b6f7b9385d9b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	3	3	2026-07-21 15:55:45.516889+00	t
02fbc64f-b223-4a5d-baee-257b694b8284	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	cde36b5a-9ba6-4068-bacc-48e73422a43c	4	4	2026-07-21 15:55:45.516889+00	t
019f002c-a454-41a7-a9a0-f377f9584d35	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:45.516889+00	t
28f0946c-6cad-42fb-ac20-2fb3d283914c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:45.516889+00	t
9df93a1b-faf7-4994-b719-92377c179b7e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-07-21 15:55:45.516889+00	t
7b2557d9-2155-4e0a-bf76-b9c8f2a7eb83	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	5	5	2026-07-21 15:55:45.516889+00	t
e4ec244d-4f3d-4bdd-b065-bd64f8658da3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:45.516889+00	t
50cf8d32-06bc-4e3b-9a5b-36e58d730daf	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:45.516889+00	t
d645d62a-cbac-4ed3-86ca-1413cd0281e6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:45.516889+00	t
eaf88467-b12a-40bf-8e5b-d7d8af108720	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:45.516889+00	t
d44231da-a997-41e5-a40f-344a3fa1da9f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-07-21 15:55:45.516889+00	t
37f7be34-47e1-4f7e-bb31-dea3123a6a00	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	5	5	2026-07-21 15:55:45.516889+00	t
b5736982-93b7-4c5c-9a0d-9201ca8e53f3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-07-21 15:55:45.516889+00	t
5cf73517-f976-4479-93d6-f8c6aa1ebbb3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-07-21 15:55:45.516889+00	t
9e890fe6-a3e4-43b9-bf6a-fb42f8032539	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:45.516889+00	t
41a3f080-92b0-4427-a9a1-50dc908a94fe	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	d0886045-cca4-42bb-8796-1a24c7fe8023	5	5	2026-07-21 15:55:45.516889+00	t
43b5d92a-ae9d-4c2f-a94b-da86de508a18	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-07-21 15:55:45.516889+00	t
c2ff3c9d-7b31-420a-86e1-37f17e7dbb74	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	edd88ef1-c137-4c93-b824-783b445be228	4	3	2026-07-21 15:55:45.516889+00	t
bc464a36-b3f7-4429-8b61-ea6bd6795eac	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	66e5dc2f-4452-4c9e-b199-74c579965dd7	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:45.516889+00	t
e148ab35-2d17-42bb-8be8-470d5e24674f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	6719968f-41c7-4905-874c-11747c7ab5e3	1	1	2026-07-21 15:55:45.516889+00	t
bfcdf801-2ce5-4621-b829-04fb1ce12c14	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	932e3d51-820e-48d5-90c3-b0934171be3d	2	2	2026-07-21 15:55:45.516889+00	t
aa8d2667-5e3a-447b-a7a4-a1a6472118ff	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	1	1	2026-07-21 15:55:45.516889+00	t
836af73f-8623-451f-b20a-a7b8eaf040d3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	1	1	2026-07-21 15:55:45.516889+00	t
df9c5157-06b2-48ae-a6f9-5a67b2254c5e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	692c0cf4-a1cd-4655-8603-791e5900ef43	6	1	2026-07-21 15:55:45.516889+00	t
d3c9e32a-17da-4901-aa38-824304034094	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	54b58e4f-69dc-44b9-993f-6acdaa84b56c	1	1	2026-07-21 15:55:45.516889+00	t
94bb76a3-e2ec-496a-8fac-a904eb8f5268	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	704411e7-e372-41cf-9797-8333554dba60	4	4	2026-07-21 15:55:45.516889+00	t
710fc1ec-1f23-42f4-a5d8-442629c57d94	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	4	4	2026-07-21 15:55:45.516889+00	t
bcfb36ab-dd3d-45a3-8be7-a5178281e02e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	cde36b5a-9ba6-4068-bacc-48e73422a43c	4	4	2026-07-21 15:55:45.516889+00	t
7bd6dc17-6253-4dc3-8875-b7abd8a751dd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:45.516889+00	t
d1db6d3c-b790-474c-a5b6-da1b067f444f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	0beac4db-206d-498b-852e-ced7a137074b	4	3	2026-07-21 15:55:45.516889+00	t
bcc9e62f-eebb-48b0-bc6e-c864f0c3a79a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-07-21 15:55:45.516889+00	t
04666b4a-605b-4161-a21a-2b7e0a2c6ff1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:45.516889+00	t
32e923f5-26d4-42b3-b259-fcdf0ef05e36	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:45.516889+00	t
04757c34-9b87-4aba-ae06-5e29e519604e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	f9f07677-fb34-4877-85d1-a883dfab8025	2	2	2026-07-21 15:55:45.516889+00	t
a7d45fcd-348d-44a6-a72f-fbf4a5d9da70	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	0e549040-6265-402f-951a-d0aab6b09263	2	2	2026-07-21 15:55:45.516889+00	t
6f704c23-61db-40b4-82ee-2bc55af8486b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:45.516889+00	t
85294ed3-a33e-4713-b1dd-fd4816934698	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	9ca78e45-60fb-40ae-9375-4637946e2405	5	5	2026-07-21 15:55:45.516889+00	t
3dcc9061-457e-4f41-8885-4e5dc298f2e1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	3	3	2026-07-21 15:55:45.516889+00	t
5df545cf-ec34-4f6a-be5e-2336a06782bc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:45.516889+00	t
770b5518-a2e1-477b-8c62-a7409f74c8d5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	9159ad92-33f2-4324-a469-462295b10cde	2	5	2026-07-21 15:55:45.516889+00	t
dd7fbfad-b9b8-43a3-a0ae-63ee995e3e00	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	3	3	2026-07-21 15:55:45.516889+00	t
f1907ff7-b92c-44e3-8787-8474a8288c74	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	d0886045-cca4-42bb-8796-1a24c7fe8023	3	3	2026-07-21 15:55:45.516889+00	t
added6a9-abd8-4d44-987b-b844b1350e1c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:45.516889+00	t
ba2cdb92-66b0-4a09-bc52-d22b7b33e631	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	edd88ef1-c137-4c93-b824-783b445be228	3	4	2026-07-21 15:55:45.516889+00	t
dfbcc3f1-031b-4c02-9a60-2bbe308ab933	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	87cc30d6-69cb-4dbf-9cc9-516282827531	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	3	3	2026-07-21 15:55:45.516889+00	t
1766a1ea-7444-40e5-b90c-2971dd774bd1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	6719968f-41c7-4905-874c-11747c7ab5e3	3	3	2026-07-21 15:55:45.516889+00	t
7159bd64-b586-41aa-a587-e587507b322b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	932e3d51-820e-48d5-90c3-b0934171be3d	5	5	2026-07-21 15:55:45.516889+00	t
9b5422d3-8210-4b8d-a07e-07497530c9e2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	3	3	2026-07-21 15:55:45.516889+00	t
413dceae-b164-4c34-a96f-69e31aac9d09	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-07-21 15:55:45.516889+00	t
89c32f6b-225a-43af-bb04-40f3918754fb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-07-21 15:55:45.516889+00	t
d8c376f0-e635-4d4c-bf71-d818f91885a5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:45.516889+00	t
23a56c17-7460-4b3f-bc11-dbedd6fcb9e1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:45.516889+00	t
5d07c2fa-0a93-48e2-86a9-c59f5601dd02	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-07-21 15:55:45.516889+00	t
4b20aeb0-f276-4202-b82f-3827bcecbce3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:45.516889+00	t
d6589d1c-bf72-4aa1-98b2-3bfb599f7238	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:45.516889+00	t
6aba19d7-6698-4fd7-b2d9-aaea23d2c93e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:45.516889+00	t
55fdb3ec-c546-43f9-b04d-7afecac73794	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:45.516889+00	t
f6b0da00-2964-410e-a40c-5cd2ece40d92	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:45.516889+00	t
fdadbf9d-d6b9-4c9a-8f0e-9e92b9032654	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-07-21 15:55:45.516889+00	t
9ef5d82e-a783-4acc-a825-9992130f1aec	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:45.516889+00	t
30f3011d-8b73-4703-87ab-8a8c3bd356c6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:45.516889+00	t
e4847fcb-c61e-48fb-ad85-a4a8d3c34e87	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	15850608-0316-4548-88ab-9489a5118f61	6	6	2026-07-21 15:55:45.516889+00	t
cd25c6a6-9f73-458d-840c-610d17586360	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	9ca78e45-60fb-40ae-9375-4637946e2405	6	6	2026-07-21 15:55:45.516889+00	t
54ae8597-4532-4ca5-9bde-c6a039f35b20	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:45.516889+00	t
2ca1d240-fbe5-41ed-a8e5-75a1b8875d8b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:45.516889+00	t
fcd46af7-dc59-41a5-8175-dc80a8aeb5ae	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	9159ad92-33f2-4324-a469-462295b10cde	1	6	2026-07-21 15:55:45.516889+00	t
fef48854-7203-40f6-8dd0-4b765d102d99	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	5	5	2026-07-21 15:55:45.516889+00	t
11582411-7178-439e-bf90-a7ec56b6d5a9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:45.516889+00	t
592141ee-ef29-476e-8c7a-ffb05ac1391d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	3	3	2026-07-21 15:55:45.516889+00	t
59a9d705-1020-4ef4-8210-ad3405c66455	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	edd88ef1-c137-4c93-b824-783b445be228	5	2	2026-07-21 15:55:45.516889+00	t
84ff092e-b058-42aa-8313-a34f9f303ca8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	1f9830b4-24e5-4163-8dae-3be7559ca891	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:45.516889+00	t
3f48c482-4b67-4b32-b6a1-2d117cb8fa66	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	6719968f-41c7-4905-874c-11747c7ab5e3	2	2	2026-07-21 15:55:45.516889+00	t
d04cd236-62dc-4d2f-b37f-324090fe3663	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:45.516889+00	t
d881b940-3417-4066-ac39-f5837ac1bac5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	2	2	2026-07-21 15:55:45.516889+00	t
3c4e87a8-1421-4bc8-9949-896cff631d18	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	2	2	2026-07-21 15:55:45.516889+00	t
cc6e16f8-754e-467f-8706-7b4f0320b2e3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-07-21 15:55:45.516889+00	t
3322d510-1935-4bc3-b550-ef09f04982d1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:45.516889+00	t
42a7cdb7-ff9b-4e21-bb97-448bbefe1396	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	704411e7-e372-41cf-9797-8333554dba60	4	4	2026-07-21 15:55:45.516889+00	t
3c5be9a9-740e-408a-8bdc-2e81bac1ced5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-07-21 15:55:45.516889+00	t
4476527e-bdc3-4082-ad87-6843dc4f3f4c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-07-21 15:55:45.516889+00	t
d279cfed-e285-4639-8c27-990a3cde724c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:45.516889+00	t
5626cdfb-82ab-4439-bf66-a7c40fc5b760	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:45.516889+00	t
f0e57611-bd00-4404-87f0-c70fee3d74f7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-07-21 15:55:45.516889+00	t
144652af-eb94-4a30-9977-da77bdf942f4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	5	5	2026-07-21 15:55:45.516889+00	t
c76748a3-4389-4ffc-999c-632cd98076dd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:45.516889+00	t
25e2324f-25cf-4593-83fb-a26697c7a947	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:45.516889+00	t
f50c701a-b5b0-41f5-a929-02ace64e27b4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:45.516889+00	t
f9ae2d85-9e83-47f5-85af-eb2178df572c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	15850608-0316-4548-88ab-9489a5118f61	6	6	2026-07-21 15:55:45.516889+00	t
2de4d89a-dada-43c6-90c2-7b8f6d34cc91	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	9ca78e45-60fb-40ae-9375-4637946e2405	6	6	2026-07-21 15:55:45.516889+00	t
c58a0640-7ded-4451-80aa-4010fa23f089	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	5	5	2026-07-21 15:55:45.516889+00	t
1a8cc3f8-f0e3-4133-9097-18e4f4513fe8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:45.516889+00	t
b8bb9b1a-cfe8-4466-9ecb-1cdcf62e3d79	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	9159ad92-33f2-4324-a469-462295b10cde	2	5	2026-07-21 15:55:45.516889+00	t
a7f81ff7-9aea-4b2f-9c0f-c09788e66e09	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:45.516889+00	t
7fa77526-e180-4b3b-9515-e51659db9548	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:45.516889+00	t
1930906d-a541-4f5f-8a33-10fc5731e5e3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:45.516889+00	t
28c5e9d4-3918-4c40-8cb1-bab958ee1d0e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:45.516889+00	t
5fc059a8-70be-4e29-a4b9-083956fd9990	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9a01148d-d0cf-45f0-8c28-4f65235124e3	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-07-21 15:55:45.516889+00	t
5007db19-fa37-4a5b-b9f8-de5021e27f6b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	6719968f-41c7-4905-874c-11747c7ab5e3	3	3	2026-07-21 15:55:45.516889+00	t
cbc04c38-1597-4635-b3e3-77022ff7ca6e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	932e3d51-820e-48d5-90c3-b0934171be3d	5	5	2026-07-21 15:55:45.516889+00	t
011788da-059b-46d0-b5eb-f5674bc694eb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	2	2	2026-07-21 15:55:45.516889+00	t
bcbb35c3-ec87-436e-98e6-eed1648bc6b5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	6	6	2026-07-21 15:55:45.516889+00	t
20cf65fa-3f4e-4ae8-a7ae-1319d7527187	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	692c0cf4-a1cd-4655-8603-791e5900ef43	3	4	2026-07-21 15:55:45.516889+00	t
d338b3dc-8dae-4564-a8e7-77073e4d3f2a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-07-21 15:55:45.516889+00	t
e501033a-d7e8-4851-892d-661d911d60a2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:45.516889+00	t
28a2e31d-b9e7-488a-8412-71f81e50f649	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-07-21 15:55:45.516889+00	t
8da60bf7-dc73-44cb-95e6-5a3a3a8a5854	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-07-21 15:55:45.516889+00	t
b4cc9f94-2b71-459f-855b-ae5030903e6c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:45.516889+00	t
27bf0c5e-aaa2-4d79-9d7e-14bc94c0dcae	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:45.516889+00	t
74d50f33-4917-4163-abe6-a9f8c5500848	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:45.516889+00	t
5e85b8bc-cd47-4d3d-a5fb-710b61de6d8b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:45.516889+00	t
1a8bb9a7-caab-43a6-ad78-ac6d9771f283	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:45.516889+00	t
ebc04c5b-a527-4c3d-b596-102638aeecd6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:45.516889+00	t
3b899c90-4bfe-4e63-8818-d9d1639b5c8e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:45.516889+00	t
6974b921-0b57-4f2f-8a18-3fe065ff5691	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	15850608-0316-4548-88ab-9489a5118f61	6	6	2026-07-21 15:55:45.516889+00	t
4bb73356-2bcb-4414-8230-5f1386c7feb2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	9ca78e45-60fb-40ae-9375-4637946e2405	6	6	2026-07-21 15:55:45.516889+00	t
83e00795-b05e-4e9f-bdc0-22d38a30bc5f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:45.516889+00	t
19898e4c-4fc6-4bb1-b58e-25cd54c06c0f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:45.516889+00	t
4c369145-9f0a-46ed-9127-cc4068d9f5c4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	9159ad92-33f2-4324-a469-462295b10cde	2	5	2026-07-21 15:55:45.516889+00	t
584a6323-b191-4372-a763-86cc63e09525	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:45.516889+00	t
2fe91fe7-adb4-47c8-9152-eb2be48379cd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:45.516889+00	t
64f8b507-d5f4-4253-b491-fde928a382c9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	5	5	2026-07-21 15:55:45.516889+00	t
b2f7d619-7bc1-4657-8c00-914b435597f8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	edd88ef1-c137-4c93-b824-783b445be228	1	6	2026-07-21 15:55:45.516889+00	t
0fdd526c-57c3-4882-a5a3-bf169437bba2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	840cc0ac-4a60-41c5-9d5b-72233e23156c	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:45.516889+00	t
889a1bfa-f4ac-456a-a92a-496186aa1cf3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:45.516889+00	t
83cce0b8-b0f1-4399-aa5f-a9d98e196d63	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	932e3d51-820e-48d5-90c3-b0934171be3d	2	2	2026-07-21 15:55:45.516889+00	t
0dbc7024-88f3-4536-b041-d78d73a156b3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	3	3	2026-07-21 15:55:45.516889+00	t
8a4ec2c6-eebc-4513-971b-22283b3419a6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:45.516889+00	t
960763bf-8f38-438d-a50a-988ef1d63890	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-07-21 15:55:45.516889+00	t
11ca7549-dd44-4512-bded-227bf7242a2c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-07-21 15:55:45.516889+00	t
35ef1490-fe44-4beb-816b-71f1648f8cdd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:45.516889+00	t
53689734-f140-47b4-9d99-c05e41170b9e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	3	3	2026-07-21 15:55:45.516889+00	t
4f70a1dd-efc9-4528-ba25-fa3db76ac6ac	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-07-21 15:55:45.516889+00	t
7c9ca107-41e2-4984-8f06-1a3fbe2f4ea9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:45.516889+00	t
4e532b90-928d-4e36-a692-aa1a5fe22356	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	0beac4db-206d-498b-852e-ced7a137074b	3	4	2026-07-21 15:55:45.516889+00	t
adc05473-5a05-4345-b046-a373fa4a1195	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-07-21 15:55:45.516889+00	t
d41b2d71-e341-4e61-a488-89c57b4e3fd4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	2	2	2026-07-21 15:55:45.516889+00	t
53d36119-4611-4d30-a0af-f466e63e43b8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:45.516889+00	t
fbc41692-9980-4660-80c0-8a81190263c8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:45.516889+00	t
c2f5b750-8117-4634-826a-84a9e1c4f4c3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-07-21 15:55:45.516889+00	t
61470f8e-c3b9-499c-b965-f0daa6dc8e0a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-07-21 15:55:45.516889+00	t
a8d80720-ce95-4f2d-92f4-c76b4ddf934c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-07-21 15:55:45.516889+00	t
a3444d1c-e074-4385-b428-a18ed4eda50a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	3	3	2026-07-21 15:55:45.516889+00	t
100d7e4c-7181-43ff-9a4a-f9d970ed9cae	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-07-21 15:55:45.516889+00	t
efdf189e-2dbf-4447-8714-a73d98991084	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	9159ad92-33f2-4324-a469-462295b10cde	4	3	2026-07-21 15:55:45.516889+00	t
3004aa3b-e25a-4207-8b60-b3546f0bbbd5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	4	4	2026-07-21 15:55:45.516889+00	t
7d63ffea-2ced-4807-9036-47b7ec1b9238	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:45.516889+00	t
8558cad0-b6a1-4a35-a212-ed4ab41b655b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	2	2	2026-07-21 15:55:45.516889+00	t
2adb38ef-c6f9-4dbe-8ecb-f97e8eb12acb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	edd88ef1-c137-4c93-b824-783b445be228	3	4	2026-07-21 15:55:45.516889+00	t
fca4d8ae-e01e-426c-bf53-4db0049fc7ed	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8dc33cd9-d4f1-41d8-8e6b-c7321105db66	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-07-21 15:55:45.516889+00	t
7f400993-111a-4797-bd99-04bdbf7d2259	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	6719968f-41c7-4905-874c-11747c7ab5e3	3	3	2026-07-21 15:55:45.516889+00	t
773615cd-a27a-4eb7-a08d-15c7dc3ce1fb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	932e3d51-820e-48d5-90c3-b0934171be3d	5	5	2026-07-21 15:55:45.516889+00	t
954ee803-5a89-463a-9bb2-bfc84177c560	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	4	4	2026-07-21 15:55:45.516889+00	t
dec3451c-141a-4be4-a5c8-700761ed5551	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	5	5	2026-07-21 15:55:45.516889+00	t
eb64d2f9-d40d-49f0-aa3e-e28c386a925b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-07-21 15:55:45.516889+00	t
bec4a7d6-24b7-4d15-bc7f-dad42f27911c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:45.516889+00	t
2abfc98b-2575-4123-b11e-a9aeebfd11ba	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:45.516889+00	t
443bdc75-9c58-41df-8184-72aeefaaf16d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-07-21 15:55:45.516889+00	t
c0d9183a-a135-4e38-a9bc-325b0aa3c66d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-07-21 15:55:45.516889+00	t
3ba173d3-c390-4cc6-b2e8-477169601d40	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:45.516889+00	t
cab3eb9d-a95f-4ec9-bbcc-0bf9587bdc3a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:45.516889+00	t
3e8f98a7-5db4-4b99-a6c6-41db79cfc180	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-07-21 15:55:45.516889+00	t
9f8af435-6092-40f1-8b7f-fd8e766776fd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:45.516889+00	t
7f22a721-5a33-466f-baf7-1125a5b55fb7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:45.516889+00	t
9ec04391-0535-47e9-9a08-7c2684e4429c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:45.516889+00	t
cb03a908-6c52-4cae-99d5-c669df114da9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:45.516889+00	t
ba3c4158-a77e-437f-940e-f20c7e9ae45b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	15850608-0316-4548-88ab-9489a5118f61	6	6	2026-07-21 15:55:45.516889+00	t
6056b4d6-a799-457b-a8d1-4df211374328	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:45.516889+00	t
b5ab32a8-f6b0-4548-bdac-8d6432704ab8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:45.516889+00	t
69e96f3f-50ec-4d6f-991d-09c927132470	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:45.516889+00	t
6a8c4335-6096-4732-a80d-750933b2671e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	9159ad92-33f2-4324-a469-462295b10cde	1	6	2026-07-21 15:55:45.516889+00	t
231c3907-d96e-4245-8e67-329bb683ab4b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	4	4	2026-07-21 15:55:45.516889+00	t
8dfc362e-57b5-42df-9aeb-b2f9e11899b1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:45.516889+00	t
9575475d-b520-42e2-b4cb-6f25bc33024a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:45.516889+00	t
ac99120c-dc72-4da3-9263-356eef60e4fd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	edd88ef1-c137-4c93-b824-783b445be228	4	3	2026-07-21 15:55:45.516889+00	t
bb3c7745-b15a-4abc-ad0d-a4d21a194c09	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	f64c6794-3064-458c-a614-e7be5435beb2	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:45.516889+00	t
87cb7243-f98d-4711-93bc-6dc36410f0ba	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	6719968f-41c7-4905-874c-11747c7ab5e3	3	3	2026-07-21 15:55:45.516889+00	t
10d93908-7938-4b48-adcf-7fe2a0d28aba	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	932e3d51-820e-48d5-90c3-b0934171be3d	4	4	2026-07-21 15:55:45.516889+00	t
6a13e080-6764-420a-9d79-c72b858ee691	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	4	4	2026-07-21 15:55:45.516889+00	t
2e00d494-538a-4579-a60a-e0ee94497511	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-07-21 15:55:45.516889+00	t
0519dcea-627d-4099-b6c7-03a4eb24e558	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-07-21 15:55:45.516889+00	t
22503ec6-10a9-490f-bb3a-41acb1428f5e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	54b58e4f-69dc-44b9-993f-6acdaa84b56c	2	2	2026-07-21 15:55:45.516889+00	t
be7985eb-5e38-421e-b263-72db201577e1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:45.516889+00	t
b5b7f722-420e-4f6e-af52-5bd97afe316b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	5	5	2026-07-21 15:55:45.516889+00	t
20d54248-005d-40bc-bf86-2a7e37231d66	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	cde36b5a-9ba6-4068-bacc-48e73422a43c	4	4	2026-07-21 15:55:45.516889+00	t
00775ea7-64a3-4895-a148-91f07dfb40b4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:45.516889+00	t
14610334-adef-419a-ae60-16d307b81ef8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:45.516889+00	t
bf005916-32ae-4775-b998-7c36801fd9cc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:45.516889+00	t
ea35cb8a-1f93-46a8-8d71-822470654a92	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	5	5	2026-07-21 15:55:45.516889+00	t
0f27be65-6cfd-422f-9827-68db34f85c52	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:45.516889+00	t
e361c516-4516-4b3c-b961-2c9b48dc79f2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:45.516889+00	t
4af852ce-08f4-4fa3-8ea5-ad61457e2933	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:45.516889+00	t
a020b2f6-4957-49e1-b3b7-918a2156c62d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-07-21 15:55:45.516889+00	t
62662b5f-4077-4812-b738-22aa4277fdd2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	9ca78e45-60fb-40ae-9375-4637946e2405	2	2	2026-07-21 15:55:45.516889+00	t
2d92bd11-aa9b-4e92-bf33-841b5ae0215a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	4	4	2026-07-21 15:55:45.516889+00	t
5810e3a7-5e09-43d2-819b-e2296c3e90f7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-07-21 15:55:45.516889+00	t
25c720f1-36e2-479b-b0b0-9c1c56d868ca	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	9159ad92-33f2-4324-a469-462295b10cde	1	6	2026-07-21 15:55:45.516889+00	t
d05128cd-fd91-4d92-aef1-e7b7c888b3b3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	5	5	2026-07-21 15:55:45.516889+00	t
25931b88-f9f9-4033-8f22-2b1f5e7523a0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	d0886045-cca4-42bb-8796-1a24c7fe8023	5	5	2026-07-21 15:55:45.516889+00	t
90bf4d00-d842-4763-9199-592f97e6a170	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	5	5	2026-07-21 15:55:45.516889+00	t
9da3452f-76df-453c-9b65-f6d1963760b0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:45.516889+00	t
b82c59f2-a8a9-497d-a52f-1be3943e5c4a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09fa0905-d6f6-438b-8516-955acb64a590	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:45.516889+00	t
20b13477-d739-4d85-800e-ab1684e44b87	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:45.516889+00	t
dadfdc0d-143c-461f-a971-28fca601c180	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:45.516889+00	t
2438e101-1341-4ae6-9ba9-5b4b9b683f4d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	5	5	2026-07-21 15:55:45.516889+00	t
95f61567-c0d2-470c-8b91-77fea5692c6e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:45.516889+00	t
9269b8d2-4f0a-41e0-817d-ec90360d0403	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-07-21 15:55:45.516889+00	t
c7b99ce9-d03c-47fd-a82d-47484fd807cf	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	54b58e4f-69dc-44b9-993f-6acdaa84b56c	5	5	2026-07-21 15:55:45.516889+00	t
b6ee088f-c788-4949-8888-4cc82a95cb4e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:45.516889+00	t
b7ad8e19-e798-4e48-af77-9dd121ec5554	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	4	4	2026-07-21 15:55:45.516889+00	t
eae167ac-0ac7-4e43-8eab-0e69217c13d0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-07-21 15:55:45.516889+00	t
08611ba4-248c-4399-96f1-a5f38e6f79bf	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	12aed47e-7498-4c49-87fe-86a96d2f6b4b	4	4	2026-07-21 15:55:45.516889+00	t
0c071df2-d5cb-4905-a89b-7224bd1b8dda	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:45.516889+00	t
a7fb1ec6-96d4-40b1-8a28-f7d9ed8223f4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-07-21 15:55:45.516889+00	t
fde28e19-a97e-42a3-8d1d-dd859a67fdd9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:45.516889+00	t
84f06de6-ad04-4092-84e5-8365304911a6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-07-21 15:55:45.516889+00	t
727e012e-d82f-40ab-b190-ac338edf194a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:45.516889+00	t
4d90d358-d515-4b9d-bf75-cb94172a2965	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:45.516889+00	t
1398bdfe-003a-47da-94f2-d054c1648d4e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:45.516889+00	t
304157fe-67e7-40d5-a1d1-bc5b0fdd417f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-07-21 15:55:45.516889+00	t
8d78014e-8562-408c-aa35-ef0312e97cc1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:45.516889+00	t
d3d24b70-e979-4e83-b505-a218eb0d4722	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:45.516889+00	t
47832ef2-0016-4464-aacb-af88fa6d23be	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	9159ad92-33f2-4324-a469-462295b10cde	2	5	2026-07-21 15:55:45.516889+00	t
1da21c40-2510-4c6c-860b-534225a64875	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:45.516889+00	t
47c24df1-e489-4f98-9179-712df9d0a1f8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:45.516889+00	t
f992e0c0-6221-4400-8803-7e781123126b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	3	3	2026-07-21 15:55:45.516889+00	t
87c61ee5-4222-4e82-910a-7d39fa7817ef	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:45.516889+00	t
7235f68c-4c06-439a-96db-5a99ca9961b9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1b88860-1e4e-4dde-bdc0-4415bd6ccba6	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-07-21 15:55:45.516889+00	t
7c577b41-3642-497a-9376-fe314c89c08b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	6719968f-41c7-4905-874c-11747c7ab5e3	3	3	2026-07-21 15:55:45.516889+00	t
230cae65-6b11-4fa6-bd30-0e93de897138	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	932e3d51-820e-48d5-90c3-b0934171be3d	4	4	2026-07-21 15:55:45.516889+00	t
f984ade3-7864-41a9-9488-57e67f132ab3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	3	3	2026-07-21 15:55:45.516889+00	t
f8c0a616-1862-4e3e-bffd-65201d3fd34b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:45.516889+00	t
2d8e5667-1e31-45a5-a0b9-7a52901ffc51	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	692c0cf4-a1cd-4655-8603-791e5900ef43	3	4	2026-07-21 15:55:45.516889+00	t
5e414b5b-0170-4e39-9195-266e765e7db2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:45.516889+00	t
5dab28c9-cd8e-48a7-a968-78c29bf3dc68	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:45.516889+00	t
e9062f88-d662-4fc9-85f9-8e07f28038ba	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-07-21 15:55:45.516889+00	t
c2f64240-8f9f-45c2-ac72-94dfe1036bce	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-07-21 15:55:45.516889+00	t
4b79b2f3-f73a-45ae-941b-ea3d13246cfa	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:45.516889+00	t
798bf85d-2078-4d67-9d10-064f882fbc38	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:45.516889+00	t
8416f663-f7ba-4d22-af32-111e778d43f9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:45.516889+00	t
9fb2c856-f705-4973-9c79-9792f9a22bde	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:45.516889+00	t
4dc457eb-65d6-4920-83df-dcca2ea8fbe3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-07-21 15:55:45.516889+00	t
abdb0a69-f521-4825-8935-ff0639fefb4f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	f9f07677-fb34-4877-85d1-a883dfab8025	6	6	2026-07-21 15:55:45.516889+00	t
24521ccb-15c3-4ca1-b5db-6ef000a12823	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:45.516889+00	t
3a110162-37f5-4c8a-84f8-e8b471999c91	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:45.516889+00	t
3c20aadb-717b-42d4-b82c-5c514d213cdd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	9ca78e45-60fb-40ae-9375-4637946e2405	5	5	2026-07-21 15:55:45.516889+00	t
4d2fb8c7-e027-4af9-8566-17a856e2710e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:45.516889+00	t
b64e4ce4-e290-4a57-9af7-5ee0b6db57b2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:45.516889+00	t
275e0bf1-578f-41a3-b8e2-72e0b043d74f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	9159ad92-33f2-4324-a469-462295b10cde	1	6	2026-07-21 15:55:45.516889+00	t
59f8d4f0-8f22-452a-b4d3-8b9a85a01b2c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	5	5	2026-07-21 15:55:45.516889+00	t
41c1da99-acff-493d-bed6-303380d23fd8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	d0886045-cca4-42bb-8796-1a24c7fe8023	5	5	2026-07-21 15:55:45.516889+00	t
e2c33cfd-80db-44a1-a83d-e657d0e8c928	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-07-21 15:55:45.516889+00	t
b4feaca6-00a2-41aa-ba8f-ef4e9041b48c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:45.516889+00	t
7d0f68ca-aba3-445b-9f52-3242a59f161e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fcd670b3-6915-4195-abbc-c24762e2b4d7	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:45.516889+00	t
2d4bd7da-9b69-4b84-8359-0cc7f94b2e61	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:45.516889+00	t
827a0b91-776e-41f4-a598-978a8e7a9763	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	932e3d51-820e-48d5-90c3-b0934171be3d	5	5	2026-07-21 15:55:45.516889+00	t
b864afbd-a6c7-4997-b833-f9cce404466c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	6	6	2026-07-21 15:55:45.516889+00	t
8703b7e4-bbc2-4b3c-a70b-ae05efe7a88d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:45.516889+00	t
5d1b9111-c840-4afd-be6b-86b4a7409b73	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	692c0cf4-a1cd-4655-8603-791e5900ef43	5	2	2026-07-21 15:55:45.516889+00	t
cb35954e-fdaa-4e49-9552-6b9f3882386c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:45.516889+00	t
6dbb62ba-6888-4c2b-8fa0-29a2bd0c0669	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	704411e7-e372-41cf-9797-8333554dba60	2	2	2026-07-21 15:55:45.516889+00	t
17b78b63-44c9-41c2-99e3-3a8691696e20	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	4	4	2026-07-21 15:55:45.516889+00	t
be14cbfb-4b34-4199-bcfe-fe21efef7f93	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	cde36b5a-9ba6-4068-bacc-48e73422a43c	3	3	2026-07-21 15:55:45.516889+00	t
62887381-cce7-4e5c-a3e3-f353469c9b94	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:45.516889+00	t
7dd471d8-0f02-489f-8411-eb4a47a20b12	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	0beac4db-206d-498b-852e-ced7a137074b	4	3	2026-07-21 15:55:45.516889+00	t
28f5a7f4-105d-46a4-afbd-a101fd6be1cc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:45.516889+00	t
4a614a81-3b52-4cb4-b5b4-e68743dee9e7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:45.516889+00	t
1034d010-ac9e-4693-adc3-3987784ea066	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:45.516889+00	t
dae125b6-1fec-40d0-ad5d-3c680b5267dc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:45.516889+00	t
ad080bbb-9f4c-499e-aae7-f796db92b6bd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:45.516889+00	t
27414c86-ca04-481f-b74f-8d7a02063183	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:45.516889+00	t
8a3831aa-10ba-4538-b260-725e3b3c69e7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:45.516889+00	t
0d68c92d-ba05-4c26-8c10-26a8c2b3526c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:45.516889+00	t
81494b4c-6fdd-4179-8380-d817ad68c87f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:45.516889+00	t
45876eb1-1f1c-489f-803c-083d26568706	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	9159ad92-33f2-4324-a469-462295b10cde	2	5	2026-07-21 15:55:45.516889+00	t
50b4a98d-688f-4d9d-9a48-f80df26cc8f4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	5	5	2026-07-21 15:55:45.516889+00	t
d9f6df15-5c8b-4408-9ba1-2c53e0b6bfca	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:45.516889+00	t
566db945-66b7-4e06-95bd-0c61d9945689	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	5	5	2026-07-21 15:55:45.516889+00	t
ead55f3e-6574-4bef-afed-5e2dd55fec16	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	edd88ef1-c137-4c93-b824-783b445be228	3	4	2026-07-21 15:55:45.516889+00	t
1404f1de-3958-47e7-ad1b-6484734a8629	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8a86f854-b022-4254-88ca-b2a74be7a6e9	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-07-21 15:55:45.516889+00	t
a622bc3d-dd27-4c9a-8ab0-dafa6ac16c64	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	6719968f-41c7-4905-874c-11747c7ab5e3	3	3	2026-07-21 15:55:45.516889+00	t
8ca9944d-ab0b-4a0e-9ce7-0056e04a81c8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:45.516889+00	t
f0c00435-476b-4fe0-a474-46de5aee4c96	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	1	1	2026-07-21 15:55:45.516889+00	t
d233c955-30d4-4108-8c52-02d61d8ff99b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:45.516889+00	t
51fc9623-575d-46cc-850c-3a5e9bf9329f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	692c0cf4-a1cd-4655-8603-791e5900ef43	5	2	2026-07-21 15:55:45.516889+00	t
b9c20185-ab5c-4fed-8b4f-f48522d4acd3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	54b58e4f-69dc-44b9-993f-6acdaa84b56c	2	2	2026-07-21 15:55:45.516889+00	t
b9f61913-d11e-466a-95cc-52c71d27a810	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	704411e7-e372-41cf-9797-8333554dba60	3	3	2026-07-21 15:55:45.516889+00	t
5bf72432-f9a2-4a8a-946e-ffd67ebb6833	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	1	1	2026-07-21 15:55:45.516889+00	t
09ca5ccf-4883-4330-8e70-93f277ade86a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	cde36b5a-9ba6-4068-bacc-48e73422a43c	2	2	2026-07-21 15:55:45.516889+00	t
8ad00521-9930-467f-9a27-d8c5ae12d47c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	12aed47e-7498-4c49-87fe-86a96d2f6b4b	2	2	2026-07-21 15:55:45.516889+00	t
2d67848f-a24b-4880-9eaf-e1e240fcda4a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	0beac4db-206d-498b-852e-ced7a137074b	5	2	2026-07-21 15:55:45.516889+00	t
d2381118-bcbf-465c-89a4-a8e294ccea7c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	50dbae72-9a1d-4fd9-928b-301e852cad68	1	1	2026-07-21 15:55:45.516889+00	t
2ae8ccef-e86e-4e47-9695-626093078878	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	2	2	2026-07-21 15:55:45.516889+00	t
54d62a8f-ce43-4f94-9db4-09234a677bde	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	fb9d8599-17df-4d90-bae1-f4c19a597ac3	2	2	2026-07-21 15:55:45.516889+00	t
b56b9c3d-5ad8-4108-aaad-5faa108bb0b5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	f9f07677-fb34-4877-85d1-a883dfab8025	2	2	2026-07-21 15:55:45.516889+00	t
40247402-1f4c-45af-9196-144291fc3a0d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-07-21 15:55:45.516889+00	t
418a88dd-a31f-45cc-bc36-6794abed1a1c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	15850608-0316-4548-88ab-9489a5118f61	2	2	2026-07-21 15:55:45.516889+00	t
3a163949-89d2-4b6f-97f0-704fd007a318	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:45.516889+00	t
c511d202-ca69-446e-b36c-ab79c602c8a2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	3	3	2026-07-21 15:55:45.516889+00	t
db19e329-3194-40a4-a31e-4b3209e0d39b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:45.516889+00	t
ff8eed7f-1338-406a-b37f-1fb45274105b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	9159ad92-33f2-4324-a469-462295b10cde	5	2	2026-07-21 15:55:45.516889+00	t
99ed4435-c227-49ab-9f57-de296864a65e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	3	3	2026-07-21 15:55:45.516889+00	t
afe3b472-5c5e-448f-96ad-40d28896afe5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:45.516889+00	t
cef0a4f4-539c-4ebc-b50e-6a0533e7cac9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	3	3	2026-07-21 15:55:45.516889+00	t
23e0d732-4885-4ca1-ac33-e62c94046f2f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	edd88ef1-c137-4c93-b824-783b445be228	5	2	2026-07-21 15:55:45.516889+00	t
6e005f9a-5af1-493d-a5c7-9a63ad6a4a36	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	7f60a9af-f5e1-42fc-83eb-0db48e49365d	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	3	3	2026-07-21 15:55:45.516889+00	t
9b778a2b-f506-4663-951c-6169507685a1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	6719968f-41c7-4905-874c-11747c7ab5e3	1	1	2026-07-21 15:55:45.516889+00	t
e1650b24-d90c-4bcc-aaa1-a61a23834fb3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	932e3d51-820e-48d5-90c3-b0934171be3d	2	2	2026-07-21 15:55:45.516889+00	t
9e611429-7895-466c-b1e0-de3055459608	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	3	3	2026-07-21 15:55:45.516889+00	t
052356a5-b2b3-4992-9ba8-fc5a8488f452	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:45.516889+00	t
4177664b-f7af-4e88-983f-b9fca7322c87	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	692c0cf4-a1cd-4655-8603-791e5900ef43	5	2	2026-07-21 15:55:45.516889+00	t
0f4fae02-9285-463b-8929-5dbd9f0fbaa9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:45.516889+00	t
7da06ad3-683c-4669-90ab-17f94d46870e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:45.516889+00	t
35e65c99-6c45-46db-b79c-b19f3373bb8f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	3	3	2026-07-21 15:55:45.516889+00	t
11742202-0226-41e0-b6f4-b143f345d640	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-07-21 15:55:45.516889+00	t
328eb052-8b0d-4b0b-adf2-934bc8002a0d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	12aed47e-7498-4c49-87fe-86a96d2f6b4b	4	4	2026-07-21 15:55:45.516889+00	t
429682cd-c8d6-4542-8b3e-cba2ab3e719e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	0beac4db-206d-498b-852e-ced7a137074b	3	4	2026-07-21 15:55:45.516889+00	t
4d1b64d1-8f7a-40c2-bd40-0fc0a4f42d2b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-07-21 15:55:45.516889+00	t
6b2a1b55-754f-4ebc-b9a1-ea8c5458582f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	3	3	2026-07-21 15:55:45.516889+00	t
010c1259-a88a-47c2-b503-ae3ac565d8d7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:45.516889+00	t
5cb780c0-fd8b-46b8-b9c5-069eb2bb753e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:45.516889+00	t
6d92feab-a29e-4806-88bc-5d3181532d51	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:45.516889+00	t
a482dd56-9ebf-4750-8593-8af0b4b1413a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:45.516889+00	t
49e17bc4-7720-4eb9-a0dc-56355b1b9a93	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-07-21 15:55:45.516889+00	t
732e6fa5-e84d-4c78-a700-2143864b6441	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:45.516889+00	t
2053da0a-959c-4c0f-9e1b-2a7e77d69c77	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-07-21 15:55:45.516889+00	t
68a818c5-7bab-4eff-98da-1c7a46085b44	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-07-21 15:55:45.516889+00	t
d4499524-49bc-4794-b0ca-046f078d9c6a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	5	5	2026-07-21 15:55:45.516889+00	t
de407dbf-929c-477e-9873-664a9e20685e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:45.516889+00	t
57ed091a-29a9-4495-90ce-5f3f703b2e4a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-07-21 15:55:45.516889+00	t
35f88b13-f1fb-40ee-b0b6-b46c91848916	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	edd88ef1-c137-4c93-b824-783b445be228	1	6	2026-07-21 15:55:45.516889+00	t
65121fbc-f1fc-4ec1-af81-8c30021a454b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3ed24ced-0b07-4e88-90e6-a97e411da8a9	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:45.516889+00	t
3286ee71-acb7-4586-b763-fed354329894	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	6719968f-41c7-4905-874c-11747c7ab5e3	2	2	2026-07-21 15:55:45.516889+00	t
8bbedcfa-455d-4949-9f4f-0cf375669673	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	932e3d51-820e-48d5-90c3-b0934171be3d	5	5	2026-07-21 15:55:45.516889+00	t
c5f2fc90-19ae-4f3b-bef4-c0e7b807cc6a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	5	5	2026-07-21 15:55:45.516889+00	t
6dbcd76c-6aea-4ba1-98dd-d371f99d2e11	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	5	5	2026-07-21 15:55:45.516889+00	t
92119aa2-b882-44db-8920-54f4ff7a5034	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	692c0cf4-a1cd-4655-8603-791e5900ef43	3	4	2026-07-21 15:55:45.516889+00	t
7addb48d-47e1-4613-854e-8cd9f32cdca2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-07-21 15:55:45.516889+00	t
9bc4c0b6-77a0-4244-b44c-aecf59c25a16	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:45.516889+00	t
ed3b56f3-56d4-404e-98b7-e8d885a9836a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	5	5	2026-07-21 15:55:45.516889+00	t
f388992a-e125-4b52-b0b0-b1d72bd271f0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-07-21 15:55:45.516889+00	t
04487e8b-adff-4ab7-91b4-9d4dc22cf03e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:45.516889+00	t
ae4e8088-45d7-4a3c-a929-5d834c59c39f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	0beac4db-206d-498b-852e-ced7a137074b	4	3	2026-07-21 15:55:45.516889+00	t
3613f23b-795e-4ee4-84bb-c9dd079b0a93	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:45.516889+00	t
6540cbb1-4d73-455b-ab90-d8deae0076d9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:45.516889+00	t
65b64715-5444-4983-a796-4b1d24c7bfe2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:45.516889+00	t
fa529f87-474b-46f2-a478-03e8cc91b2d5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:45.516889+00	t
7f81603e-688a-49fe-9b43-63e76149a8f0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-07-21 15:55:45.516889+00	t
f7cbb875-e44d-4b60-b8fa-2fe3c1d73073	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-07-21 15:55:45.516889+00	t
c8ecbf66-4963-4709-8f73-a9940fed4704	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-07-21 15:55:45.516889+00	t
fe41157b-6ae4-4124-8d92-07224f877c37	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	4	4	2026-07-21 15:55:45.516889+00	t
45c3e186-1df4-45be-9320-99a58aadc6ca	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-07-21 15:55:45.516889+00	t
a1444c25-74d4-4778-8f20-c7948281233c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	9159ad92-33f2-4324-a469-462295b10cde	5	2	2026-07-21 15:55:45.516889+00	t
cdac15d4-d438-4c20-ae7e-da7a8409a077	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:45.516889+00	t
79563746-76a1-4f28-acf7-4722716d711a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:45.516889+00	t
3a36c55b-bc35-4d26-a44a-bb76f2a02573	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	5	5	2026-07-21 15:55:45.516889+00	t
4eae0112-c53e-4eb0-bf85-92ed67afbd8c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:45.516889+00	t
26b2bb7c-86ff-4ad7-b4ae-ffcf6cb332fd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	09051a63-bc4f-4bf8-a04b-a249829ef5c1	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:45.516889+00	t
53cfd7f3-5070-42c8-bff9-04ddb95147f9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	6719968f-41c7-4905-874c-11747c7ab5e3	2	2	2026-07-21 15:55:45.516889+00	t
1a48cab6-1c3c-43f1-a26d-c0b249a3adae	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:45.516889+00	t
bcdac607-c4b6-4e20-b167-945530664564	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	3	3	2026-07-21 15:55:45.516889+00	t
71be71ca-df2a-4ea7-903c-75dbc37cb504	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-07-21 15:55:45.516889+00	t
be0a09c3-8010-4723-bea5-08864cb94992	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	692c0cf4-a1cd-4655-8603-791e5900ef43	3	4	2026-07-21 15:55:45.516889+00	t
5ce7e431-a5ba-4a54-9e86-52277d69e4a1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-07-21 15:55:45.516889+00	t
be75abdc-ab82-4369-b0a9-8ccc3b3e453c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:46.356949+00	t
0826a531-471b-40f0-bb21-eba71dcf66ec	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	3	3	2026-07-21 15:55:46.356949+00	t
79c46e2b-e093-46e6-9591-55b205326331	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	cde36b5a-9ba6-4068-bacc-48e73422a43c	4	4	2026-07-21 15:55:46.356949+00	t
f62e863c-f948-4f9f-a57b-8afaf2775691	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:46.356949+00	t
bf76c01b-7eb7-463e-a5fa-d1971f92b14b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	0beac4db-206d-498b-852e-ced7a137074b	5	2	2026-07-21 15:55:46.356949+00	t
f0cad198-3f22-479a-8d97-bfd400930ae6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-07-21 15:55:46.356949+00	t
9c8692f2-0dc7-4bc1-ac1e-2408a930c899	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:46.356949+00	t
a670f865-3f3b-4d79-b5f7-3c36b265d56f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:46.356949+00	t
490f6ca1-3b89-404b-af11-65aec905f68f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:46.356949+00	t
868f3c9e-395c-4761-961c-f216991995e5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-07-21 15:55:46.356949+00	t
12bd27a6-d1b7-4321-8b5a-93ac51f72379	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	15850608-0316-4548-88ab-9489a5118f61	2	2	2026-07-21 15:55:46.356949+00	t
464ea759-01ff-49ad-b52a-06f42301cd77	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:46.356949+00	t
f37284ff-595a-4347-a6f7-62fbad30a60f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	3	3	2026-07-21 15:55:46.356949+00	t
7848922e-a0e1-4ca1-a929-3e725a79a09d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	2	2	2026-07-21 15:55:46.356949+00	t
f64a266a-cb0c-430f-8e6f-c5bde8ebec2c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	9159ad92-33f2-4324-a469-462295b10cde	6	1	2026-07-21 15:55:46.356949+00	t
830a092b-9592-4704-bb04-37c77cc226af	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	2	2	2026-07-21 15:55:46.356949+00	t
0580c5d4-d49d-4829-9890-e62b213af88f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	d0886045-cca4-42bb-8796-1a24c7fe8023	2	2	2026-07-21 15:55:46.356949+00	t
e3498fe3-7360-4f5c-bc70-d920fb193e08	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	2	2	2026-07-21 15:55:46.356949+00	t
0ceb7d19-c19a-4adf-93a5-f240cb06386b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	edd88ef1-c137-4c93-b824-783b445be228	5	2	2026-07-21 15:55:46.356949+00	t
7f9fd219-3f4e-48ea-9138-a0373afeacab	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8952a14a-5c08-4d50-9f1f-b48eb1a39509	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	2	2	2026-07-21 15:55:46.356949+00	t
d4719cca-9064-4315-bd29-1fd6dc5e1dec	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:46.356949+00	t
cf9b156b-126e-4db7-92be-4d2bfaa8bdf3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	932e3d51-820e-48d5-90c3-b0934171be3d	6	6	2026-07-21 15:55:46.356949+00	t
2589a7d9-65d2-4391-a660-4c3e6aa67a90	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	4	4	2026-07-21 15:55:46.356949+00	t
3fd4a27b-e4e5-4582-8908-bae6f0b20aed	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-07-21 15:55:46.356949+00	t
080ba390-427d-44bc-bb99-5ace604f37e8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	692c0cf4-a1cd-4655-8603-791e5900ef43	1	6	2026-07-21 15:55:46.356949+00	t
c86c3365-6bae-46df-bc37-a6f4615d3b57	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:46.356949+00	t
8041cebd-8b5f-4847-bf0d-d0a52bbb3f72	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:46.356949+00	t
6401bcca-f236-4653-a8dd-66a7e06d0514	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	5	5	2026-07-21 15:55:46.356949+00	t
d73ba5ee-fe63-48b1-8af2-8acaeb6d5f97	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:46.356949+00	t
a0fe49ae-fc82-4331-9804-80ff1fc6965a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:46.356949+00	t
4059f65e-2be4-441a-8c57-cf9d06bd2523	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:46.356949+00	t
49e809dd-9515-4161-ae4b-fc681e234fd3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-07-21 15:55:46.356949+00	t
cdf71e60-c429-408b-8a45-277cf550ba94	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:46.356949+00	t
48fe1a3b-43c9-4a94-baf3-3e5738743f21	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:46.356949+00	t
8e98256b-4349-4ab2-b924-2a97b509062f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	f9f07677-fb34-4877-85d1-a883dfab8025	6	6	2026-07-21 15:55:46.356949+00	t
1d75efd2-4d0e-48a1-970b-71c855228a98	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:46.356949+00	t
cf39aa70-b1eb-443f-9a63-639e89c35d12	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	15850608-0316-4548-88ab-9489a5118f61	6	6	2026-07-21 15:55:46.356949+00	t
273f8ad1-2968-4f5f-a408-f859faf0dbc7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:46.356949+00	t
e2e18099-3d75-44bc-ad05-5c9860ad402f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:46.356949+00	t
fc279d76-5396-47f2-859f-1b659ea3a48f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:46.356949+00	t
865357a6-3b8a-46e4-a3c1-ec3806db4872	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	9159ad92-33f2-4324-a469-462295b10cde	2	5	2026-07-21 15:55:46.356949+00	t
dd7ce3e6-df92-4c31-b9c9-e4ea8882e7d4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	5	5	2026-07-21 15:55:46.356949+00	t
3517157e-7034-4456-9dbc-54e8efe03c63	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	d0886045-cca4-42bb-8796-1a24c7fe8023	5	5	2026-07-21 15:55:46.356949+00	t
fa379a3d-463c-4df6-b22a-5352d19330ff	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-07-21 15:55:46.356949+00	t
ab03527f-429b-4dca-94f9-383fc6228b6f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:46.356949+00	t
d6a62a70-ba1b-4f69-ae3e-4deaa3c0de2e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d324c690-1648-45e9-9776-862573bb0526	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:46.356949+00	t
ee59ad86-6259-4d7d-8f86-ca20a3e82a47	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:46.356949+00	t
4c0f81e4-4f7a-4c8b-a78b-02cee417d25f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	932e3d51-820e-48d5-90c3-b0934171be3d	2	2	2026-07-21 15:55:46.356949+00	t
9a663efc-694a-40b1-837f-4947366c4b60	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	1	1	2026-07-21 15:55:46.356949+00	t
0f0580da-657e-4ffd-a3a5-6f8caac8e08d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:46.356949+00	t
dbe93c05-a98a-4cab-b2e8-baec63fff2f2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	692c0cf4-a1cd-4655-8603-791e5900ef43	6	1	2026-07-21 15:55:46.356949+00	t
dd83342c-db60-4f4c-bd38-502d741d7bef	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:46.356949+00	t
3fd7f0cf-b86f-42b3-8571-c34e230f6a94	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:46.356949+00	t
043ca475-2a77-4840-aa41-5ddc4d80866f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	3	3	2026-07-21 15:55:46.356949+00	t
5830514a-f33b-47b3-80fc-163488bfdd22	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:46.356949+00	t
a945d35a-d138-491f-ac18-49d6556a14c6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:46.356949+00	t
e508968d-4ecb-4039-8eff-eeab38160950	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:46.356949+00	t
83b308c0-d9c7-4099-9a81-c69f5dd0b51e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-07-21 15:55:46.356949+00	t
3eb5988f-7035-430e-89c9-f8e444321e05	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:46.356949+00	t
93ccb512-7934-4ed4-a955-41336e3a6b1a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:46.356949+00	t
7bf8569f-f32d-4d4a-b1a8-555f51998661	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:46.356949+00	t
a5e567b9-c63a-412d-87ed-d5695ebe2fdd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:46.356949+00	t
ff48d1bd-02b6-489f-a89d-55b282ce056c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	15850608-0316-4548-88ab-9489a5118f61	6	6	2026-07-21 15:55:46.356949+00	t
8b0e633e-1f66-4197-a283-2e3bdd20483a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	9ca78e45-60fb-40ae-9375-4637946e2405	6	6	2026-07-21 15:55:46.356949+00	t
0937ef69-fd40-468a-a26a-3357b970e12f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	4	4	2026-07-21 15:55:46.356949+00	t
fd9392ab-1d8e-4d61-9452-d23398ca956a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-07-21 15:55:46.356949+00	t
08de9316-180e-483b-b121-86f700f07624	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	9159ad92-33f2-4324-a469-462295b10cde	4	3	2026-07-21 15:55:46.356949+00	t
7b5f39b9-b2eb-4ab0-8104-c2c4a90ed246	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:46.356949+00	t
e0f41881-e7f0-435a-b8cf-fb562a0908de	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:46.356949+00	t
09d82123-5bc4-4ac1-b938-4a9367119c9d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	5	5	2026-07-21 15:55:46.356949+00	t
8df4e17f-c12f-47ef-9800-0e5e4887384d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:46.356949+00	t
ab4e90ba-ae73-46ef-bf19-bfddecf077f1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	c2d8a068-a3af-4181-9cb0-60eb4c92166a	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:46.356949+00	t
79bec30b-a402-4dc0-91ae-fa8a80b86f69	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	6719968f-41c7-4905-874c-11747c7ab5e3	1	1	2026-07-21 15:55:46.356949+00	t
1c6e3e4b-5bce-4ac4-b07c-b619acbab4cc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	932e3d51-820e-48d5-90c3-b0934171be3d	2	2	2026-07-21 15:55:46.356949+00	t
cb080e30-ee9d-40ad-975a-bc6428347abf	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	1	1	2026-07-21 15:55:46.356949+00	t
b9f2c80c-89a0-4d5d-b9d3-4321bad2ec95	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	1	1	2026-07-21 15:55:46.356949+00	t
08756751-6154-46a1-ae88-8cd7059fcb1b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	692c0cf4-a1cd-4655-8603-791e5900ef43	6	1	2026-07-21 15:55:46.356949+00	t
0598348a-aaaf-4af1-a621-3a9d11bc4d39	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	54b58e4f-69dc-44b9-993f-6acdaa84b56c	1	1	2026-07-21 15:55:46.356949+00	t
2744dff5-0659-42fa-be0f-25b38354da8f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:46.356949+00	t
a541a16a-0720-4b1c-a5f1-8f7307afb1f3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	3	3	2026-07-21 15:55:46.356949+00	t
507f71e2-7c99-44a6-8a45-65e2aff3f3ed	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	cde36b5a-9ba6-4068-bacc-48e73422a43c	3	3	2026-07-21 15:55:46.356949+00	t
fc657e85-e396-4d1f-b8a9-d14c72f0ab07	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:46.356949+00	t
7c2a3c1a-7f63-44bf-8a88-94908858dcdc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:46.356949+00	t
a10d793b-3a83-4a1b-a8c7-513c77790584	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-07-21 15:55:46.356949+00	t
663a4a71-b000-43f9-94d3-d8f5bd834898	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:46.356949+00	t
3e5c939f-4e22-4767-9524-862aec411634	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:46.356949+00	t
3e65919d-236b-49c7-a787-b30ba18d0015	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	f9f07677-fb34-4877-85d1-a883dfab8025	6	6	2026-07-21 15:55:46.356949+00	t
1afe88c3-44d3-4649-aa6b-0804df0f2757	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:46.356949+00	t
fabda72f-b6c1-4c62-a1e2-0be3a1b0ffd6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-07-21 15:55:46.356949+00	t
934cde8a-981b-4adf-8e4e-58831285281a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:46.356949+00	t
f4a42b21-a7ac-45fb-9f7d-dfffa5a2c2af	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	2	2	2026-07-21 15:55:46.356949+00	t
142c603d-4d34-48ac-80f1-32bd3284d3d5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	3	3	2026-07-21 15:55:46.356949+00	t
10fa9077-dced-42b0-881d-db7b2ec2574a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-07-21 15:55:46.356949+00	t
c3504e87-dc06-4f53-a5db-306f3dee841a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	4	4	2026-07-21 15:55:46.356949+00	t
c1e608c1-defd-4f5a-81ec-1b854282c232	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:46.356949+00	t
c135983a-eb46-4b5a-a51b-843a416fec78	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:46.356949+00	t
a9284e43-f684-4066-b5b4-2619edcf1b2e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	edd88ef1-c137-4c93-b824-783b445be228	3	4	2026-07-21 15:55:46.356949+00	t
88c1906a-3add-43f2-ade0-b81c0ee3a7fb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a4cf42f3-e285-4b38-9f64-c6139213e457	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-07-21 15:55:46.356949+00	t
586fdfbb-a516-475e-87d1-7dd6a0c58940	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	6719968f-41c7-4905-874c-11747c7ab5e3	3	3	2026-07-21 15:55:46.356949+00	t
c2e90fc0-b583-4761-b733-31f5a36e5842	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:46.356949+00	t
39bad8e9-42bc-4f3b-927b-d23935b12666	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	4	4	2026-07-21 15:55:46.356949+00	t
681dc892-d93b-4ffd-a461-c201bfc625d5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:46.356949+00	t
acbe62f3-7536-4aa8-bebf-39c610a565e7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-07-21 15:55:46.356949+00	t
3a62094f-80a0-477f-8a46-90f52f53f630	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:46.356949+00	t
de7673cc-bcfe-4862-9ad6-efaa01e20870	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	704411e7-e372-41cf-9797-8333554dba60	4	4	2026-07-21 15:55:46.356949+00	t
9ce7c667-aa83-4300-b382-a9fea1453f2a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	3	3	2026-07-21 15:55:46.356949+00	t
180e916c-376b-4f07-b9dd-ed9622a97152	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	cde36b5a-9ba6-4068-bacc-48e73422a43c	4	4	2026-07-21 15:55:46.356949+00	t
2eaeb032-9f88-4665-a2bc-d4fbfff685ff	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	12aed47e-7498-4c49-87fe-86a96d2f6b4b	2	2	2026-07-21 15:55:46.356949+00	t
b5b503e4-d9a2-4abb-bb8e-f1b689620a7f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	0beac4db-206d-498b-852e-ced7a137074b	3	4	2026-07-21 15:55:46.356949+00	t
87b15736-9e1e-4093-9b59-65cab25271b6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	50dbae72-9a1d-4fd9-928b-301e852cad68	2	2	2026-07-21 15:55:46.356949+00	t
0ec65837-67e2-4e51-82ec-68a932818344	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:46.356949+00	t
30511b08-fc17-42ee-ac13-0d69297b6c5c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:46.356949+00	t
de41731f-70e7-4730-b202-26174a810ba7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	f9f07677-fb34-4877-85d1-a883dfab8025	6	6	2026-07-21 15:55:46.356949+00	t
9ca97cd3-9034-4400-ac0a-ede9175df89c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-07-21 15:55:46.356949+00	t
fbff8280-8cf8-4a32-9d60-bff38ba885c8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-07-21 15:55:46.356949+00	t
9296492a-b8d1-489b-b99d-6798e8420355	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-07-21 15:55:46.356949+00	t
4c9d93fd-4d32-4d7e-90d9-d1f8c6461436	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	3	3	2026-07-21 15:55:46.356949+00	t
42c6f6c6-3cf4-4ca0-a384-b0644e513767	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	3	3	2026-07-21 15:55:46.356949+00	t
cdf5394c-3290-4591-a040-374eca1f9019	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	9159ad92-33f2-4324-a469-462295b10cde	1	6	2026-07-21 15:55:46.356949+00	t
2f916b72-c7d4-4c2e-b8d0-cfe92abe4ced	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	4	4	2026-07-21 15:55:46.356949+00	t
f823d837-cefe-4cc0-a911-2141ae277bcf	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:46.356949+00	t
97d6386c-ac02-4503-a5be-b304247ec536	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	5	5	2026-07-21 15:55:46.356949+00	t
fcfde152-acab-4f63-ab1a-d771255d84aa	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:46.356949+00	t
afcd63e1-68ea-4b25-8eb7-bf359b9497f2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ad7d2769-b37d-44dd-9062-1778dae0ab87	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-07-21 15:55:46.356949+00	t
b316ebf9-e01f-42dd-b00c-c06f926b7bb4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:46.356949+00	t
aee647e7-e4d1-4d46-83ea-570fa8d9a3dc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	932e3d51-820e-48d5-90c3-b0934171be3d	4	4	2026-07-21 15:55:46.356949+00	t
e9f60800-c9c9-44e0-b5a7-62f4d83f3270	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	3	3	2026-07-21 15:55:46.356949+00	t
d9d8b52f-2b8b-4c68-92a2-215516b1d489	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:46.356949+00	t
8c0f9c38-495a-4b71-b1a0-d72e98366aa3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	692c0cf4-a1cd-4655-8603-791e5900ef43	1	6	2026-07-21 15:55:46.356949+00	t
d4989f63-d01b-4c1a-a7df-20a79b04b538	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:46.356949+00	t
89930f1c-4b50-420c-adc2-ee4f53b1cd42	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:46.356949+00	t
8c79ee5f-09f3-45d0-b1e6-7cc2a10cf7c3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	3	3	2026-07-21 15:55:46.356949+00	t
ace3db2a-467a-4f70-b3f4-6f549ca8b379	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	cde36b5a-9ba6-4068-bacc-48e73422a43c	3	3	2026-07-21 15:55:46.356949+00	t
8531cc30-0860-4c85-a7bc-4b0924d79088	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:46.356949+00	t
f4d14014-8053-4152-873d-f331907ce9cc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	0beac4db-206d-498b-852e-ced7a137074b	3	4	2026-07-21 15:55:46.356949+00	t
74613365-2680-414e-99d3-9a288059d95c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:46.356949+00	t
9ddf85ca-85ab-4a91-8ae2-3885234b65fd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	5	5	2026-07-21 15:55:46.356949+00	t
0fffb978-5f8d-46c0-9aa7-bff0509e753d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-07-21 15:55:46.356949+00	t
4d594f69-bb46-4a29-9a22-6a6c93f9809d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:46.356949+00	t
0a6c4d1c-f015-4619-9b7c-751a5451992a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:46.356949+00	t
3ed1471a-5ad9-4843-88bc-95a4e68a2000	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	15850608-0316-4548-88ab-9489a5118f61	6	6	2026-07-21 15:55:46.356949+00	t
16f48ef0-411a-46fd-be20-464cb0bfeee9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	9ca78e45-60fb-40ae-9375-4637946e2405	6	6	2026-07-21 15:55:46.356949+00	t
a25912f5-dc04-4919-8903-516f06cee4cc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:46.356949+00	t
d6ae4612-fb7b-4c35-82c3-605fa9ab45d7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:46.356949+00	t
37d05ca5-2005-4b67-8b83-4f1b18f13da5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-07-21 15:55:46.356949+00	t
eac63bac-9c1c-47d8-91fa-e0c9cbfaecfa	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:46.356949+00	t
0b213f2e-e64a-4d1b-8ac4-c379732e7021	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	d0886045-cca4-42bb-8796-1a24c7fe8023	5	5	2026-07-21 15:55:46.356949+00	t
e3fe6053-612c-4c56-9a0d-1d266311cb0b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-07-21 15:55:46.356949+00	t
d83ae2a4-1582-47c4-9116-13ee7432bb29	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	edd88ef1-c137-4c93-b824-783b445be228	3	4	2026-07-21 15:55:46.356949+00	t
09a6bb62-22de-41a4-9004-436471be5e67	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	32c1a027-b64e-4742-a3bd-77315884caf1	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:46.356949+00	t
32d2d11f-cc80-479a-9f9d-d1f3b328d55c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	6719968f-41c7-4905-874c-11747c7ab5e3	5	5	2026-07-21 15:55:46.356949+00	t
11036a1a-2519-4ef9-ad94-e16972b55036	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:46.356949+00	t
bdc25878-49af-4a84-a595-6f41e9bd79dc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	2	2	2026-07-21 15:55:46.356949+00	t
6cd26fc8-5fc4-410a-8b84-5dc127dfa4d6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-07-21 15:55:46.356949+00	t
aa954611-3a96-4fd3-82a3-6f425100a8f7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	692c0cf4-a1cd-4655-8603-791e5900ef43	3	4	2026-07-21 15:55:46.356949+00	t
357a7f27-6046-4420-a2f0-9e56bd1c73e3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:46.356949+00	t
efdd8e17-eab3-473a-a3c2-7ea934456f76	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:46.356949+00	t
a611d187-2f75-455a-a2ec-247af7e05dcd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	5	5	2026-07-21 15:55:46.356949+00	t
b03211c3-8a6a-40e2-8496-5e4aad5d6098	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-07-21 15:55:46.356949+00	t
f3ebed99-a0cf-4a9b-97cc-c5c3dff81bc7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:46.356949+00	t
d623cc3e-8024-4354-877d-2fac9852c641	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	0beac4db-206d-498b-852e-ced7a137074b	4	3	2026-07-21 15:55:46.356949+00	t
44222391-a79d-4a9f-afd1-c9d2b98eeacf	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-07-21 15:55:46.356949+00	t
30c4db9e-6727-4ebb-b081-0042ef35a0c5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	2	2	2026-07-21 15:55:46.356949+00	t
972cb72b-e0e7-4b80-bf5b-78a64c1c0024	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:46.356949+00	t
e3dcbabf-8ad5-4ef5-8dca-7c40fac8c873	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	f9f07677-fb34-4877-85d1-a883dfab8025	6	6	2026-07-21 15:55:46.356949+00	t
801e36e6-28b4-43b9-99f1-2af2c44fe21e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:46.356949+00	t
e5494523-7d95-4ec2-ab8a-ac830ea73122	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	15850608-0316-4548-88ab-9489a5118f61	6	6	2026-07-21 15:55:46.356949+00	t
7b125ee3-25f1-4fec-80c3-f9cf310a474d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	9ca78e45-60fb-40ae-9375-4637946e2405	6	6	2026-07-21 15:55:46.356949+00	t
7f1f0972-fb13-461f-a8a3-6b7ffa6356e5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:46.356949+00	t
e41f99f4-b3a9-4f3d-8b96-1a02b5cf0806	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:46.356949+00	t
370fa0db-b5d1-439e-99d3-628ee453982d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	9159ad92-33f2-4324-a469-462295b10cde	1	6	2026-07-21 15:55:46.356949+00	t
c51a65e5-4f3e-4cc1-b670-62c2ec9c3237	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	3	3	2026-07-21 15:55:46.356949+00	t
09735982-b927-4372-9e3b-eb5e4e00fd96	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	d0886045-cca4-42bb-8796-1a24c7fe8023	3	3	2026-07-21 15:55:46.356949+00	t
5cbfbd04-1a47-41f4-a294-b2509d24eacb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:46.356949+00	t
1d7c8b2e-9629-436c-ab48-7f0d45b50de3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	edd88ef1-c137-4c93-b824-783b445be228	3	4	2026-07-21 15:55:46.356949+00	t
760fa16c-1dcb-4f6c-a276-2099749c9f4c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	59f9902b-38f9-41c5-829b-49ecc6659fc6	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-07-21 15:55:46.356949+00	t
a75c7969-3b44-4bfa-b49f-27a19b3d11c3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	6719968f-41c7-4905-874c-11747c7ab5e3	1	1	2026-07-21 15:55:46.356949+00	t
604254e7-e004-42e3-8eed-1df45d017fe3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	932e3d51-820e-48d5-90c3-b0934171be3d	2	2	2026-07-21 15:55:46.356949+00	t
3d3c2eec-5cbe-49ee-8db5-74fe325afc50	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	3	3	2026-07-21 15:55:46.356949+00	t
8db19d03-964a-48ad-9248-f63125a7771e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:46.356949+00	t
5289a1e0-a17e-478b-a0a3-ecf383b150f4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	692c0cf4-a1cd-4655-8603-791e5900ef43	3	4	2026-07-21 15:55:46.356949+00	t
08d4015a-bb7d-4b78-bfec-8a27a5748235	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:46.356949+00	t
99078706-cc92-4c54-b47c-147e5531cdde	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:46.356949+00	t
b9aa5363-4590-43ef-ba68-fb9405c873d7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-07-21 15:55:46.356949+00	t
e6812f69-56d7-4223-a9bb-3ece1e2320ec	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:46.356949+00	t
ee7d4647-cf57-43f0-8276-3ab39df2a916	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:46.356949+00	t
ac359eca-d56e-4569-9eec-b192753c24f0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:46.356949+00	t
a1dd0538-bc1e-4def-b0d2-e1903a68a905	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:46.356949+00	t
efeddfff-d360-42e7-ae7b-b2679a475688	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	5	5	2026-07-21 15:55:46.356949+00	t
f62e28f8-411c-42c0-acf3-2c7c480982f0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-07-21 15:55:46.356949+00	t
742cc125-b2a0-458d-a800-a41fce4aef19	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:46.356949+00	t
e9dedde2-7050-4551-b22e-08259a45d12f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	0e549040-6265-402f-951a-d0aab6b09263	3	3	2026-07-21 15:55:46.356949+00	t
e47b8516-9db8-408b-a85d-2bff8f9a7d45	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-07-21 15:55:46.356949+00	t
282fa5bb-bfac-4e59-a181-7fcad236eb7a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-07-21 15:55:46.356949+00	t
52e94049-9168-49b3-b3ee-d07934aceb92	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	4	4	2026-07-21 15:55:46.356949+00	t
591fcda8-0c84-4464-8558-f070568de840	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-07-21 15:55:46.356949+00	t
8a3e3e22-4964-484f-9285-ced4d8610ea2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	9159ad92-33f2-4324-a469-462295b10cde	2	5	2026-07-21 15:55:46.356949+00	t
6e426764-741f-4973-924b-f410f5643336	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	5	5	2026-07-21 15:55:46.356949+00	t
fd02b79a-ccde-4db1-9757-bd99824dd74e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:46.356949+00	t
2cee06b9-9a66-4d83-96c6-b5ac75be5107	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	3	3	2026-07-21 15:55:46.356949+00	t
8802b76b-42d3-4a5a-aeeb-494467318726	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	edd88ef1-c137-4c93-b824-783b445be228	3	4	2026-07-21 15:55:46.356949+00	t
e0b6b400-bdae-47f8-83ba-947a63bbca02	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	9621111e-bc8b-438a-963f-94dc6452a704	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:46.356949+00	t
c5e50075-2c88-4879-b548-9fe873387f1c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	6719968f-41c7-4905-874c-11747c7ab5e3	3	3	2026-07-21 15:55:46.356949+00	t
682863c5-fe91-46d6-9a87-55016d83353e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	932e3d51-820e-48d5-90c3-b0934171be3d	4	4	2026-07-21 15:55:46.356949+00	t
16940eb7-10f6-4cc7-84d8-df1a962546d1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	3	3	2026-07-21 15:55:46.356949+00	t
39dbce39-5abb-421c-b727-cc24c04bb3f5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	5	5	2026-07-21 15:55:46.356949+00	t
236b426e-6f2b-4673-9137-25762f839651	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	692c0cf4-a1cd-4655-8603-791e5900ef43	3	4	2026-07-21 15:55:46.356949+00	t
417a7009-cd39-4374-94ed-e46ddba16e74	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	54b58e4f-69dc-44b9-993f-6acdaa84b56c	5	5	2026-07-21 15:55:46.356949+00	t
45c3d43c-7afe-4e85-b9cb-8b63ffb25783	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:46.356949+00	t
ea9474c7-814c-457a-998e-3789fbb9610c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-07-21 15:55:46.356949+00	t
0f18c2eb-216d-4338-a5ec-02cdbeb42b4c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:46.356949+00	t
d3685642-2cce-48d1-86cf-cca06740d8b8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:46.356949+00	t
8ba0ab06-d41e-40fd-aed1-db860a505038	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:46.356949+00	t
429650c5-91e9-4c72-b2cb-37335da20819	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:46.356949+00	t
548dba9c-8f55-46cb-84bd-d2dd614c129c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	3	3	2026-07-21 15:55:46.356949+00	t
17ccbef3-56e9-454d-ab3c-a95f050da122	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-07-21 15:55:46.356949+00	t
baa7155b-150d-4436-af35-7ab0e7f12eef	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:46.356949+00	t
87d84042-4e97-4fe8-b11a-263ae9e61667	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	0e549040-6265-402f-951a-d0aab6b09263	3	3	2026-07-21 15:55:46.356949+00	t
845e1b95-bb1f-4759-ad99-a508ed475538	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-07-21 15:55:46.356949+00	t
458ae84c-330b-4ac5-ad0c-f7949b42748f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:46.356949+00	t
1e5498ce-3723-42ed-84d7-30bbdeda2764	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	4	4	2026-07-21 15:55:46.356949+00	t
6657cc32-3a76-418c-9a05-34f400ad10c4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-07-21 15:55:46.356949+00	t
fd4d497f-dbc2-48f3-a371-ca9538443d8b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	9159ad92-33f2-4324-a469-462295b10cde	4	3	2026-07-21 15:55:46.356949+00	t
e9f2accc-41db-46a8-9239-800048bda981	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	4	4	2026-07-21 15:55:46.356949+00	t
c5b3cdcc-4820-4472-be20-bb0fc4895134	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:46.356949+00	t
d74dee61-1f67-4226-b558-cb8c11201158	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	5	5	2026-07-21 15:55:46.356949+00	t
f403600f-bc18-4528-b3ac-d7867c5ef163	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:46.356949+00	t
fcea20fa-8b3e-4224-88cc-92b85bef473d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d2bfea2a-e0f9-49be-9467-b2968aae8618	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:46.356949+00	t
42bf4fd6-4647-4c91-b9d6-6271cfee188d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	6719968f-41c7-4905-874c-11747c7ab5e3	1	1	2026-07-21 15:55:46.356949+00	t
61082349-97c8-4bb6-b930-c4ab75e819c9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	932e3d51-820e-48d5-90c3-b0934171be3d	2	2	2026-07-21 15:55:46.356949+00	t
4c0aa2a7-3d5a-40cb-a977-9ca59570aa57	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	1	1	2026-07-21 15:55:46.356949+00	t
7e8ad1d8-a591-432f-933b-b5957b23978a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	2	2	2026-07-21 15:55:46.356949+00	t
ddd30cb4-1351-41e2-b587-a3746aa9a795	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	692c0cf4-a1cd-4655-8603-791e5900ef43	5	2	2026-07-21 15:55:46.356949+00	t
ec8047ca-65ac-432d-bc0c-271dc3bfc914	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	54b58e4f-69dc-44b9-993f-6acdaa84b56c	2	2	2026-07-21 15:55:46.356949+00	t
5a517046-9a96-4fc8-b449-6579f66144f3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	704411e7-e372-41cf-9797-8333554dba60	2	2	2026-07-21 15:55:46.356949+00	t
999e0dad-0eb3-444b-bdb7-1ed67a53d0a4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	2	2	2026-07-21 15:55:46.356949+00	t
b5be80a8-b3a3-424d-9af1-4cfecc61e103	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	cde36b5a-9ba6-4068-bacc-48e73422a43c	1	1	2026-07-21 15:55:46.356949+00	t
0ff41232-9172-4952-a31f-ba663fd89529	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	12aed47e-7498-4c49-87fe-86a96d2f6b4b	2	2	2026-07-21 15:55:46.356949+00	t
113d01a1-fa40-448b-85de-787196895d22	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	0beac4db-206d-498b-852e-ced7a137074b	3	4	2026-07-21 15:55:46.356949+00	t
6ea79611-84c6-4de6-b1b2-f555634e35d4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	50dbae72-9a1d-4fd9-928b-301e852cad68	3	3	2026-07-21 15:55:46.356949+00	t
edd9d1ae-cbd5-45f5-a938-e634e66452e7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	1	1	2026-07-21 15:55:46.356949+00	t
46341d7d-d177-4f4e-be3b-3ec5e1cc4d32	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	fb9d8599-17df-4d90-bae1-f4c19a597ac3	2	2	2026-07-21 15:55:46.356949+00	t
74eb58e8-be72-45a1-a0c3-7b762f450a5f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	f9f07677-fb34-4877-85d1-a883dfab8025	2	2	2026-07-21 15:55:46.356949+00	t
d1424b4d-ed49-4514-b8ab-9069191c0077	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	0e549040-6265-402f-951a-d0aab6b09263	2	2	2026-07-21 15:55:46.356949+00	t
4f6ecfb6-3134-4ca3-b43c-eb8cee14768e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	15850608-0316-4548-88ab-9489a5118f61	2	2	2026-07-21 15:55:46.356949+00	t
7b55f319-57e0-4610-8fd8-dd076a7f18e2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	9ca78e45-60fb-40ae-9375-4637946e2405	1	1	2026-07-21 15:55:46.356949+00	t
0998fc2d-1e80-4e91-8e6c-0e53c88c305a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	5	5	2026-07-21 15:55:46.356949+00	t
02750d46-f07c-4e5b-9151-20f131534bd1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	3	3	2026-07-21 15:55:46.356949+00	t
eaff9225-e6f5-43e0-b52c-e0ebce1e2436	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-07-21 15:55:46.356949+00	t
ccdde81f-492f-43eb-8747-44f212b3521e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	1	1	2026-07-21 15:55:46.356949+00	t
58a0333c-f88b-4235-9e3c-39437bd7b048	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	d0886045-cca4-42bb-8796-1a24c7fe8023	3	3	2026-07-21 15:55:46.356949+00	t
f49358fe-e921-4c11-9dfb-0b7902e536c3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	2	2	2026-07-21 15:55:46.356949+00	t
9fd05627-62de-4243-b341-343678eb0a94	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	edd88ef1-c137-4c93-b824-783b445be228	6	1	2026-07-21 15:55:46.356949+00	t
cb88d501-eb93-4685-9a85-5487bf263a18	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3a7a4a13-8196-40f4-a980-0b0e24ce493c	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	3	3	2026-07-21 15:55:46.356949+00	t
236da7b5-9cf4-4e9f-9dc9-8cf4fe074010	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:46.356949+00	t
98f2be98-edd0-41e9-9cdb-ccb4b41c1e28	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	932e3d51-820e-48d5-90c3-b0934171be3d	5	5	2026-07-21 15:55:46.356949+00	t
dcafb47b-e580-48a1-9d06-61a1e2eacaae	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	5	5	2026-07-21 15:55:46.356949+00	t
50a720b3-8050-4f6a-b27e-be9207577c79	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	6	6	2026-07-21 15:55:46.356949+00	t
5a07264d-6fae-4be6-9f8f-0a0826edbcf0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	692c0cf4-a1cd-4655-8603-791e5900ef43	2	5	2026-07-21 15:55:46.356949+00	t
17d4ccb1-afa9-404f-8796-ca56f4207d86	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-07-21 15:55:46.356949+00	t
89f13d62-05c0-471a-b200-554de80da8e4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:46.356949+00	t
37cb2db1-9187-4e86-81fa-71f0438e3913	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-07-21 15:55:46.356949+00	t
d93ca7ca-4ff4-4ecd-8841-e852ed41f687	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:46.356949+00	t
e3a5b31e-d525-41b9-b13a-58f414ee04f6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:46.356949+00	t
df4da453-f731-4242-a890-873c0feeeb8d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:46.356949+00	t
1f7f2f19-eb0a-4adf-82e6-b95e233b6d7e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:46.356949+00	t
06b29eff-865b-43d2-923b-eec4186e0d51	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	5	5	2026-07-21 15:55:46.356949+00	t
5a3593e1-f064-4342-9764-dd8085ea19e4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-07-21 15:55:46.356949+00	t
5c620973-cb32-4435-8c86-e7da12bc9586	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:46.356949+00	t
302be46a-fd7a-4194-97d7-b8c866551f96	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:46.356949+00	t
45fb8e49-2cbf-4df6-b33e-f9f3b8ad30dd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:46.356949+00	t
34e2a5ce-4e11-48ba-939a-584303dbc356	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-07-21 15:55:46.356949+00	t
292d70ba-3776-483f-9bba-eb8b164362a0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:46.356949+00	t
ea46c815-fbb5-4316-96ad-9c3e16559dbb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:46.356949+00	t
1cc047b3-d7e9-46dc-acbd-b2172dc0962e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	9159ad92-33f2-4324-a469-462295b10cde	1	6	2026-07-21 15:55:46.356949+00	t
b1587f86-a7cf-44bf-8eef-3424cf3fb032	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:46.356949+00	t
10877c4a-1f0f-43b1-87e4-75f283564484	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:46.356949+00	t
60b141c4-b449-469c-ba65-437bd10d935e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-07-21 15:55:46.356949+00	t
b9b73d51-3596-4409-b5f0-579e1982d6d4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	edd88ef1-c137-4c93-b824-783b445be228	1	6	2026-07-21 15:55:46.356949+00	t
ad018f1b-abdd-419c-af29-8bbc764b3f8f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0824f2b5-d4c3-4d88-bfe8-b96f6f0b0ee6	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:46.356949+00	t
4a746b89-8f8c-456f-ba7f-fc9d3776cec3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	6719968f-41c7-4905-874c-11747c7ab5e3	1	1	2026-07-21 15:55:46.356949+00	t
8c8c5c7a-6bcc-48b9-84e9-4010ffaa83a6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:46.356949+00	t
a4ed8f92-cb5a-4a59-bae0-26d92c012c4d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	2	2	2026-07-21 15:55:46.356949+00	t
e3973e09-0458-4cf0-91f4-337430207850	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	2	2	2026-07-21 15:55:46.356949+00	t
042cdcd1-ef14-4360-821f-be7205c0669c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	692c0cf4-a1cd-4655-8603-791e5900ef43	5	2	2026-07-21 15:55:46.356949+00	t
76b83674-ff0a-4f7e-8739-cfca61478084	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	54b58e4f-69dc-44b9-993f-6acdaa84b56c	1	1	2026-07-21 15:55:46.356949+00	t
ae3d7e4d-08d2-476d-a33e-0182100ff67f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:46.356949+00	t
0526173f-a141-4c38-813d-80135d7e6c42	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	4	4	2026-07-21 15:55:46.356949+00	t
ec2a1807-81cf-4488-a5f6-29ec7775764b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	cde36b5a-9ba6-4068-bacc-48e73422a43c	3	3	2026-07-21 15:55:46.356949+00	t
3db138d7-51ab-4f77-ad1c-c92d7b998941	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:46.356949+00	t
929c0fec-3f34-40ed-b462-a42939dda20b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:46.356949+00	t
945979c1-7882-433b-806e-de581abf9530	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:46.356949+00	t
ed5d4f10-5334-4105-a199-1ae1516580e2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	3	3	2026-07-21 15:55:46.356949+00	t
09890ae1-acb5-4f43-8a96-d291c9e07418	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-07-21 15:55:46.356949+00	t
da388d1c-7737-4031-a31b-c678846ce136	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:46.356949+00	t
284bd1c2-e6db-49d2-9547-9e7cce2b35d9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:46.356949+00	t
4f7106f8-db0d-4700-86f3-c781a481c6cc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:46.356949+00	t
c73b61e1-e9e1-4a7f-a169-35a231a7b6b3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:46.356949+00	t
77283c15-720f-468b-834e-82342a72c096	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	3	3	2026-07-21 15:55:46.356949+00	t
f12bcdeb-781f-4744-8410-59ef8fec71fb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:46.356949+00	t
fc8a9095-9e7f-4b83-9860-024c4496add3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	9159ad92-33f2-4324-a469-462295b10cde	5	2	2026-07-21 15:55:46.356949+00	t
48f0e7ea-97fe-437f-bd24-beb8cb646d40	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	5	5	2026-07-21 15:55:46.356949+00	t
e5e3ca60-1c95-4062-83fd-a448bae280c9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:46.356949+00	t
d37b32a7-8f47-4341-a529-fa6783411c78	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-07-21 15:55:46.356949+00	t
4be99121-7b87-4101-a389-6fe5f1400188	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	edd88ef1-c137-4c93-b824-783b445be228	1	6	2026-07-21 15:55:46.356949+00	t
e1229ed4-38cc-4d0e-bf65-57e6f0ff95a7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9f6242f-3133-4277-ba2e-d05d80760ef9	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:46.356949+00	t
8770106d-9422-4282-bfe5-d96f24446bb6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:46.356949+00	t
922f4a81-eca6-4a82-a9ce-f09c85b0bcb6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	932e3d51-820e-48d5-90c3-b0934171be3d	4	4	2026-07-21 15:55:46.356949+00	t
0f0c380b-8703-4ee7-91ce-0ac99dbda098	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	6	6	2026-07-21 15:55:46.356949+00	t
dfcf8fb4-7623-4632-9e2d-68078277f642	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	6	6	2026-07-21 15:55:46.356949+00	t
e91e18ae-e9f8-46dd-8d6e-daa367ab1031	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	692c0cf4-a1cd-4655-8603-791e5900ef43	2	5	2026-07-21 15:55:46.356949+00	t
dc4cc0f0-cb4e-4a30-8bd1-b4e432955885	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-07-21 15:55:46.356949+00	t
14efc245-e4a6-4ee2-943f-cb2c8937ae44	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:46.356949+00	t
7a2eb773-4ffc-4ac9-b0ea-4d0e618a42a9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-07-21 15:55:46.356949+00	t
08bd3351-0e0c-4980-873a-1f55b68a27ea	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:46.356949+00	t
165e9699-b555-4fcc-9d7e-ebf3328a15b8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:46.356949+00	t
e769bc1d-4749-41ff-a784-85b3c75596b0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:46.356949+00	t
11ea314b-3879-4f77-8689-4054e2b768f1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:46.356949+00	t
05b6c5bb-9435-4efb-bdb5-55f3bb3c326e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	5	5	2026-07-21 15:55:46.356949+00	t
7b4a4a77-73a0-411e-bab4-d347cdd1450d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:46.356949+00	t
2dba2d9e-4575-4a46-a548-be4e1bc1b820	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:46.356949+00	t
807c6e48-38ff-4004-92f4-e1c557f6c480	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:46.356949+00	t
1444ba3f-bd5f-4717-8243-da8801f3645b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:46.356949+00	t
0f62cedc-ba76-4ee1-8603-c6d4c86247ba	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	9ca78e45-60fb-40ae-9375-4637946e2405	6	6	2026-07-21 15:55:46.356949+00	t
83e98a86-9067-4a9a-bfc6-33f741f59397	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:46.356949+00	t
8b3da346-bdde-4864-aee2-77b9d139c807	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:46.356949+00	t
d9cd064f-f313-48e5-9304-25ed9252cbb2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	9159ad92-33f2-4324-a469-462295b10cde	2	5	2026-07-21 15:55:46.356949+00	t
1da33f77-ca41-46e9-8ff5-8ff52aaf064c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:46.356949+00	t
e80e19f5-c7e0-4b79-842c-d1c12cca1ff6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:46.356949+00	t
4bce79fd-ece6-44a4-aa60-4ef607af6b72	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-07-21 15:55:46.356949+00	t
196694a7-853e-4fca-a767-c9fcd7d43bf7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	edd88ef1-c137-4c93-b824-783b445be228	1	6	2026-07-21 15:55:46.356949+00	t
2a893707-2f6d-4c2b-8ea3-4a47fb3ed247	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4f408a03-1d69-42e6-9eab-f7831d93381f	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:46.356949+00	t
8d7aacda-9c59-4557-bc2e-7e0f35705b4f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:46.356949+00	t
10c74f89-7176-4e16-b525-e46f3a3f47d2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	932e3d51-820e-48d5-90c3-b0934171be3d	4	4	2026-07-21 15:55:46.356949+00	t
9c4bc404-95fd-471f-9cec-988c2495a743	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	4	4	2026-07-21 15:55:46.356949+00	t
da8e01fb-1b02-4a71-b8bf-8c75661083f6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-07-21 15:55:46.356949+00	t
e5454380-ee5f-4c2b-9fe7-91e2f6fdb2ab	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	692c0cf4-a1cd-4655-8603-791e5900ef43	3	4	2026-07-21 15:55:46.356949+00	t
1d2c94d8-4b3b-4b3c-87fe-e294e997c112	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:46.356949+00	t
b76652eb-8d53-4c29-bca1-93f586c42149	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:46.356949+00	t
30f13a55-3684-4a37-a9ef-fd29af5852b3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	5	5	2026-07-21 15:55:46.356949+00	t
584f5160-606e-4c9e-9e06-f7d2819451ee	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:46.356949+00	t
6dfe7334-6ecb-46d2-9b2c-846d33933e31	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:46.356949+00	t
0ba4555a-12cd-44cb-a35c-445a2e88f47a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:46.356949+00	t
753f3bc5-e142-4df5-9816-35555910fcd3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-07-21 15:55:46.356949+00	t
4308e737-b7b1-415b-bb58-4c9361ee2e81	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:46.356949+00	t
3e35c2d4-a378-4bf1-a28c-f484be889569	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:46.356949+00	t
113a008f-c17a-4261-bde7-854a825d91ee	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	f9f07677-fb34-4877-85d1-a883dfab8025	6	6	2026-07-21 15:55:46.356949+00	t
f6d4589c-6695-4367-a25c-36cabae1b9a7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:46.356949+00	t
e24979f8-8c89-448c-8bbe-0506ce4f916f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:46.356949+00	t
1844b224-bf2a-4cc8-a5da-1188638997d3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	9ca78e45-60fb-40ae-9375-4637946e2405	6	6	2026-07-21 15:55:46.356949+00	t
68920194-427b-4da0-91f8-d9999dd83bac	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:46.356949+00	t
785b8dd9-480c-4a48-9b67-27ff42999094	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:46.356949+00	t
6e535687-898f-4708-9577-92e8ea4f1296	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	9159ad92-33f2-4324-a469-462295b10cde	1	6	2026-07-21 15:55:46.356949+00	t
9fc9f71f-fcd1-4ab3-8986-54f48c449074	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	4	4	2026-07-21 15:55:46.356949+00	t
c1349b06-3cc5-4c1e-88e3-5eec2520becd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	d0886045-cca4-42bb-8796-1a24c7fe8023	3	3	2026-07-21 15:55:46.356949+00	t
6638d078-90ad-4b04-be11-b1cf30fdd6ae	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:46.356949+00	t
d291417a-2ed4-49c5-bc56-b26bf51fa806	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:46.356949+00	t
da6aef99-1b03-4de1-ac6e-98fb72451e66	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	8090ad16-d3e0-4089-9f52-d51da6ef1172	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-07-21 15:55:46.356949+00	t
a4f0fc89-606a-4ffd-a6a8-77e831ec899a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	6719968f-41c7-4905-874c-11747c7ab5e3	5	5	2026-07-21 15:55:46.356949+00	t
e82512c5-5e47-4256-ac43-dee710d44404	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	932e3d51-820e-48d5-90c3-b0934171be3d	6	6	2026-07-21 15:55:46.356949+00	t
1a78f071-27db-4a14-a095-e9ea22bdb2ef	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	6	6	2026-07-21 15:55:46.356949+00	t
de88fbaf-42c4-475f-8f66-8e182df36dee	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	6	6	2026-07-21 15:55:46.356949+00	t
dc4258d9-5fe1-4878-bc37-242473166590	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	692c0cf4-a1cd-4655-8603-791e5900ef43	3	4	2026-07-21 15:55:46.356949+00	t
1dac5003-b1d1-480a-bf6c-f23758fdfc36	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	54b58e4f-69dc-44b9-993f-6acdaa84b56c	6	6	2026-07-21 15:55:46.356949+00	t
3958242f-5165-4456-b380-a2dbdf04a5fa	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:46.356949+00	t
2739166f-c1a6-4fe1-a3c4-e5bd2c4c6517	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	4	4	2026-07-21 15:55:46.356949+00	t
feb7f261-7418-40d1-82b1-509657574bb0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-07-21 15:55:46.356949+00	t
506205c8-d2dd-49c1-afa4-b5729c8a1e43	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:46.356949+00	t
e254d396-6f9b-48c3-8940-0373e03037c3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:46.356949+00	t
e84304f2-24a4-4567-9ef6-a9d867801ebd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-07-21 15:55:46.356949+00	t
572b7795-95c8-4be1-94da-69f047ea14f5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	2	2	2026-07-21 15:55:46.356949+00	t
94a3a613-62c7-465e-a87b-0f04d914344e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:46.356949+00	t
77598da6-3e7a-4d12-8fcc-77d8995679bb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	f9f07677-fb34-4877-85d1-a883dfab8025	3	3	2026-07-21 15:55:46.356949+00	t
ae072ec5-4090-4f62-8112-a64efa964a6d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-07-21 15:55:46.356949+00	t
b504d1dd-e7b8-4e3d-99ae-0fc4695e082f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-07-21 15:55:46.356949+00	t
41f8f6cb-1208-45e1-9430-209b865146e5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	9ca78e45-60fb-40ae-9375-4637946e2405	5	5	2026-07-21 15:55:46.356949+00	t
5a018681-653f-4ebe-a757-3dd87efa19bd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:46.356949+00	t
f1bc07ab-7fff-49f3-9a56-48f9395c79d6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-07-21 15:55:46.356949+00	t
b488ccb9-6fcf-484c-9940-4735edab37db	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	9159ad92-33f2-4324-a469-462295b10cde	2	5	2026-07-21 15:55:46.356949+00	t
cfeb952a-057e-42af-aba6-0ed3aa08e25f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	3	3	2026-07-21 15:55:46.356949+00	t
08c0b0f7-c646-4c52-a680-2fa83dc38638	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	d0886045-cca4-42bb-8796-1a24c7fe8023	5	5	2026-07-21 15:55:46.356949+00	t
dbe7541e-f482-42b7-99a2-e37c874596d1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:46.356949+00	t
f16e9358-b667-4d0d-ab2a-3ba8dcd0bd76	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:46.356949+00	t
9e8218c2-a562-483d-b586-49a606375f17	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ea08550a-2298-4fb4-901e-e64a072455ba	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:46.356949+00	t
679d2253-c46e-43e1-afd3-6397ed743ceb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:46.356949+00	t
fbaea712-2ce8-4bb2-8add-577429ddc56b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	932e3d51-820e-48d5-90c3-b0934171be3d	6	6	2026-07-21 15:55:46.356949+00	t
442044c9-7d8e-4f6b-a3a3-4de2912df918	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	6	6	2026-07-21 15:55:46.356949+00	t
ee40a4df-eba5-4704-9b51-0f47b9bba982	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	6	6	2026-07-21 15:55:46.356949+00	t
a460a076-10e6-4b52-8094-49a629a1dfd5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	692c0cf4-a1cd-4655-8603-791e5900ef43	1	6	2026-07-21 15:55:46.356949+00	t
7a08ce7c-dc51-46e7-a5c5-70ec35373ec4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	54b58e4f-69dc-44b9-993f-6acdaa84b56c	6	6	2026-07-21 15:55:46.356949+00	t
ade8bdb9-bfa3-4298-ba9f-078c9833fc7f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	704411e7-e372-41cf-9797-8333554dba60	4	4	2026-07-21 15:55:46.356949+00	t
f43ae76c-5e03-4b0d-9fbd-d0d8cc5f97b2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	5	5	2026-07-21 15:55:46.356949+00	t
1399b66d-cec4-4a8e-b95f-d595ad26b0dc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:46.356949+00	t
5678154f-4cc5-4b6b-b269-9414decf5c7e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:46.356949+00	t
50a295ef-c9a8-4548-af9e-1ad76bbc5aa5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:46.356949+00	t
ae5aac9e-f095-4179-af9e-104eeb43d6ce	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-07-21 15:55:46.356949+00	t
0cdc12ea-41fd-4af9-a95e-2e7fed262f4a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:46.356949+00	t
3f2ebeff-f07f-43a7-8ae1-7903f10cb995	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:46.356949+00	t
2faafba6-4841-434e-ba19-6935e3d715a5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:46.356949+00	t
00b25b94-df19-41a3-8155-bc49af5b3293	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-07-21 15:55:46.356949+00	t
98d4a431-81cf-4433-9ec0-9d327e9829d5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-07-21 15:55:46.356949+00	t
a12ef998-c106-4c4e-bd87-31427e3e4aef	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:46.356949+00	t
992491cf-9687-4880-a22a-18829edee8af	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	5	5	2026-07-21 15:55:46.356949+00	t
e7fcf6c8-c3b8-46ea-83b4-ffc4f2d1a624	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:46.356949+00	t
6ff3e917-8cec-4237-a98d-ccaa92cdd129	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-07-21 15:55:46.356949+00	t
8d303233-ed04-465a-9ced-74f4660e8d17	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	4	4	2026-07-21 15:55:46.356949+00	t
08638533-f834-46ec-a5b7-713b5eec8606	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:46.356949+00	t
7820150c-d56c-404b-bcd0-68d76b090e3d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	3	3	2026-07-21 15:55:46.356949+00	t
4af72407-ab6a-454b-abdf-0fb76975b41b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	edd88ef1-c137-4c93-b824-783b445be228	4	3	2026-07-21 15:55:46.356949+00	t
672028fa-4899-4652-8e32-a8664f434e10	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	43f18981-46b4-4905-8961-25b545827061	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:46.356949+00	t
bc6d4779-571d-41a7-98a8-af1374f893fb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	6719968f-41c7-4905-874c-11747c7ab5e3	3	3	2026-07-21 15:55:46.356949+00	t
59b478b5-9adf-4f68-a499-0df513f2cdfe	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:46.356949+00	t
76c0f365-5d8c-4275-907d-f4a77c0e217c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	2	2	2026-07-21 15:55:46.356949+00	t
c832d6c8-2c12-4e04-ac79-544352ae8ee3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	2	2	2026-07-21 15:55:46.356949+00	t
75395878-6913-45d4-a67a-78b2f1548ce5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	692c0cf4-a1cd-4655-8603-791e5900ef43	5	2	2026-07-21 15:55:46.356949+00	t
516b4654-45e3-4d44-90e3-5c32a20ae4b0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	54b58e4f-69dc-44b9-993f-6acdaa84b56c	1	1	2026-07-21 15:55:46.356949+00	t
eaa8765a-eb9b-4a3e-ab83-dd2326674a7a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	704411e7-e372-41cf-9797-8333554dba60	4	4	2026-07-21 15:55:46.356949+00	t
94b64158-f038-4a54-bc3b-72f99949b30f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	1	1	2026-07-21 15:55:46.356949+00	t
f4e61935-fa56-4116-8df3-c8d845871898	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	cde36b5a-9ba6-4068-bacc-48e73422a43c	2	2	2026-07-21 15:55:46.356949+00	t
fec7378b-5c19-450b-9eea-c4d0c117bbad	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	12aed47e-7498-4c49-87fe-86a96d2f6b4b	3	3	2026-07-21 15:55:46.356949+00	t
504ee0c9-cf53-46ae-bd7d-ed552044a6e6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	0beac4db-206d-498b-852e-ced7a137074b	4	3	2026-07-21 15:55:46.356949+00	t
65411603-9a1b-45d6-b2ac-3f15eddad60b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	50dbae72-9a1d-4fd9-928b-301e852cad68	2	2	2026-07-21 15:55:46.356949+00	t
d0ed090a-c943-4dbf-b939-4000499327aa	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:46.356949+00	t
240c4382-9b52-427b-8672-59f6d87cbd65	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	fb9d8599-17df-4d90-bae1-f4c19a597ac3	3	3	2026-07-21 15:55:46.356949+00	t
9f8a4ed6-233f-4bb8-ab42-9b525930d7ff	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	f9f07677-fb34-4877-85d1-a883dfab8025	2	2	2026-07-21 15:55:46.356949+00	t
f0ef16dc-1e9f-45e1-9796-1d9962c9494c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-07-21 15:55:46.356949+00	t
524f4b25-9187-4adb-9ba9-61bcf899f729	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:46.356949+00	t
856e5981-dc3f-403d-ac3f-f0db05c4ac7f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:46.356949+00	t
42f7f4e7-3d87-4d52-88ee-720ee676d42f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:46.356949+00	t
0a1fc91b-c17e-4780-9971-3d3891a06907	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:46.356949+00	t
8b3978e0-abdf-4888-992b-4f43908c93b7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	9159ad92-33f2-4324-a469-462295b10cde	5	2	2026-07-21 15:55:46.356949+00	t
49ed3f0f-bfe7-4af5-a5a9-2e133662e312	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	5	5	2026-07-21 15:55:46.356949+00	t
27c22b5b-1b0b-4d3d-a99f-99a7f32566b4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	d0886045-cca4-42bb-8796-1a24c7fe8023	5	5	2026-07-21 15:55:46.356949+00	t
4a8ceaa3-2960-4797-adb8-20632c22f3e5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	5	5	2026-07-21 15:55:46.356949+00	t
dda1a2b7-2242-498d-a3c2-909224e93ae3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:46.356949+00	t
32828e42-6b19-428b-ba4d-7d9e7a53a470	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	03673095-a516-4322-ade5-3d9705f28fb8	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-07-21 15:55:46.356949+00	t
05d4ca8a-2f2e-4653-adbf-7575223c2b7b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	6719968f-41c7-4905-874c-11747c7ab5e3	2	2	2026-07-21 15:55:46.356949+00	t
f5d28e3e-8b52-47d1-894a-76b4c4a49d17	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	932e3d51-820e-48d5-90c3-b0934171be3d	1	1	2026-07-21 15:55:46.356949+00	t
4b73c8b0-082d-4541-910f-3ab9d833dd0c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	1	1	2026-07-21 15:55:46.356949+00	t
7f3a4b4b-9d2c-49f8-96d0-e700336ad321	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	2	2	2026-07-21 15:55:46.356949+00	t
55eaa27f-1c30-4064-a2bd-a7b9bfdf4964	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	692c0cf4-a1cd-4655-8603-791e5900ef43	6	1	2026-07-21 15:55:46.356949+00	t
cc984ea1-50d7-4e55-a169-1bbdde4df300	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	54b58e4f-69dc-44b9-993f-6acdaa84b56c	2	2	2026-07-21 15:55:46.356949+00	t
f7afd77a-0335-4ff8-9529-aa1de4e939bb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	704411e7-e372-41cf-9797-8333554dba60	4	4	2026-07-21 15:55:46.356949+00	t
c998351a-55ee-473f-b31f-593fd82370d2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	3	3	2026-07-21 15:55:46.356949+00	t
ae87acd6-3ebc-4122-bcd8-a7fe04b04a9e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	cde36b5a-9ba6-4068-bacc-48e73422a43c	3	3	2026-07-21 15:55:46.356949+00	t
5b638550-ee03-4565-b048-6df57be41fd2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:46.356949+00	t
7121af9b-984a-4352-8fe4-06e2ec8e4e39	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	0beac4db-206d-498b-852e-ced7a137074b	3	4	2026-07-21 15:55:46.356949+00	t
5ee3b0f3-05fb-46e9-9963-95f211de1d6a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	50dbae72-9a1d-4fd9-928b-301e852cad68	3	3	2026-07-21 15:55:46.356949+00	t
b215dec1-9ce5-49e7-88d3-557969bd1a87	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	1	1	2026-07-21 15:55:46.356949+00	t
c6b92b6e-3ffb-42fc-a289-e91fb1f0d783	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	fb9d8599-17df-4d90-bae1-f4c19a597ac3	3	3	2026-07-21 15:55:46.356949+00	t
e057608f-b533-4c2d-b25d-10674798b078	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	f9f07677-fb34-4877-85d1-a883dfab8025	2	2	2026-07-21 15:55:46.356949+00	t
5d737565-cf9d-4494-b7f0-6bdfc0d08e92	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	0e549040-6265-402f-951a-d0aab6b09263	3	3	2026-07-21 15:55:46.356949+00	t
494a233b-65c8-483e-82aa-577afc99a434	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	15850608-0316-4548-88ab-9489a5118f61	1	1	2026-07-21 15:55:46.356949+00	t
9deabf3b-9c19-4294-a85d-7152e9326b06	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	9ca78e45-60fb-40ae-9375-4637946e2405	1	1	2026-07-21 15:55:46.356949+00	t
5548a298-f274-4eae-9960-e23cfde639e5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	4	4	2026-07-21 15:55:46.356949+00	t
09245c73-e2e8-45bf-91b6-e4e231df9f3c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	2	2	2026-07-21 15:55:46.356949+00	t
23d09a97-edd2-4d03-9d7d-32b0931ece79	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	9159ad92-33f2-4324-a469-462295b10cde	6	1	2026-07-21 15:55:46.356949+00	t
893a8495-1b09-4a5d-b8b0-78fabaa41487	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	3	3	2026-07-21 15:55:46.356949+00	t
6072cc07-1da4-46cf-ab59-9761ce6ce8c9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	d0886045-cca4-42bb-8796-1a24c7fe8023	1	1	2026-07-21 15:55:46.356949+00	t
7d5c409a-882e-4b39-a82c-a8a3c4911c05	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	1	1	2026-07-21 15:55:46.356949+00	t
5367cf8f-a906-4c9a-9e96-9cb7f9b3fe66	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	edd88ef1-c137-4c93-b824-783b445be228	4	3	2026-07-21 15:55:46.356949+00	t
426faf5a-02ed-45fb-b6e2-ebf041052655	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	3998692d-21b1-4eeb-9d95-3f117532fa4f	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	1	1	2026-07-21 15:55:46.356949+00	t
afbf9234-87b3-48cc-8230-4b30b1a5505b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:46.356949+00	t
82a86f58-0ddc-41b1-9e6d-3793624f9470	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:46.356949+00	t
1b6815e8-c3d5-4851-96e5-e0b912e3156a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	2	2	2026-07-21 15:55:46.356949+00	t
21a4b488-209f-4d1e-a7ad-c4cb0d260310	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-07-21 15:55:46.356949+00	t
2f23c004-c6d6-4ccc-98df-8bd711f3aca9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	692c0cf4-a1cd-4655-8603-791e5900ef43	5	2	2026-07-21 15:55:46.356949+00	t
c9ff25f2-77ab-4b9f-bf8a-09ecf5c3fae9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:46.356949+00	t
ef2d98d3-7c43-4d85-bbc0-eda4c373c4a7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:46.356949+00	t
5c18eac7-7be3-4e6b-bf27-abe7b926e19d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-07-21 15:55:46.356949+00	t
56bfddbc-bfb7-414f-af26-373319aedd27	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:46.356949+00	t
1b1d506a-a34f-4e05-86c5-801f149613dc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:46.356949+00	t
4a69e669-d94e-437a-baa8-a1308c82bb4b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:46.356949+00	t
e799fcb4-9064-46b2-80eb-a8b4ff6ae67d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-07-21 15:55:46.356949+00	t
29e4ebba-9b3f-4b06-93ca-7dd48e4d9f14	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:46.356949+00	t
cee2c4bf-cde7-417b-958b-e5199313b2f8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:46.356949+00	t
2e0a8a39-f79c-4149-8ebf-9dfb05be8465	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	f9f07677-fb34-4877-85d1-a883dfab8025	6	6	2026-07-21 15:55:46.356949+00	t
49e639a4-3ecd-49ce-b8ca-26e7c6ab6c34	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-07-21 15:55:46.356949+00	t
a6917262-1686-4966-8c9f-c6f6f10d3219	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	15850608-0316-4548-88ab-9489a5118f61	3	3	2026-07-21 15:55:46.356949+00	t
181e7fc4-0547-4a69-81e2-5fe66bc5ea68	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	9ca78e45-60fb-40ae-9375-4637946e2405	5	5	2026-07-21 15:55:46.356949+00	t
283135ef-49fa-40b4-a556-096926742a13	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	3	3	2026-07-21 15:55:46.356949+00	t
16b66afa-9b0d-4bd8-a139-2df6d807efb4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-07-21 15:55:46.356949+00	t
895d4e94-065f-4aae-be1c-3569ee4e3a70	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	9159ad92-33f2-4324-a469-462295b10cde	6	1	2026-07-21 15:55:46.356949+00	t
0a387803-566a-440d-b7f9-b27ce4ac7af8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:46.356949+00	t
bca40224-c8fd-4b2c-816d-2b9a85630549	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	d0886045-cca4-42bb-8796-1a24c7fe8023	5	5	2026-07-21 15:55:46.356949+00	t
d02c1090-4909-444e-b56c-e8e9be4283a5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-07-21 15:55:46.356949+00	t
90e88c8b-cd46-4f27-8fad-0579153e545a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	edd88ef1-c137-4c93-b824-783b445be228	1	6	2026-07-21 15:55:46.356949+00	t
b849e8b3-bb61-47b1-9e25-299f04da76ea	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	ce765b3b-3135-490f-9939-2e873d5d30e7	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:46.356949+00	t
cae9f165-6e87-4a82-aec0-d749bb362005	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	6719968f-41c7-4905-874c-11747c7ab5e3	2	2	2026-07-21 15:55:46.356949+00	t
ba31e622-9f80-42b9-8880-4013f09b7629	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	932e3d51-820e-48d5-90c3-b0934171be3d	4	4	2026-07-21 15:55:46.356949+00	t
227d6b99-c37c-42e8-b92d-952a06d5f244	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	5	5	2026-07-21 15:55:46.356949+00	t
b8fed2dc-be03-48d2-a8b4-812c88382625	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	5	5	2026-07-21 15:55:46.356949+00	t
eedcc7c1-cab3-498f-bba7-c2024ddd2daa	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	692c0cf4-a1cd-4655-8603-791e5900ef43	2	5	2026-07-21 15:55:46.356949+00	t
21a8f8ab-495a-4d66-ac1e-4b780af0e6a7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-07-21 15:55:46.356949+00	t
598fedcc-f709-42cc-8fce-e09deea3dcd3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:46.356949+00	t
502c05b9-d0dc-4bd9-b993-8c393de010c5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	4	4	2026-07-21 15:55:46.356949+00	t
a67ee1d3-7c68-45ac-ad3a-0434d81d834e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:46.356949+00	t
a092dec0-add6-410d-80d9-b90708f1d483	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:46.356949+00	t
1736567e-08a4-426e-b364-0638d9cc42e5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:46.356949+00	t
576b1c9f-1f07-41f2-8640-88521f415ee1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-07-21 15:55:46.356949+00	t
3c54f120-1d75-4a3b-832e-d859256bfaf2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:46.936739+00	t
2324aacb-6f87-4080-95ed-88791946b07d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-07-21 15:55:46.936739+00	t
974349bf-0b46-4d1c-b0fd-54b77534f1b0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:46.936739+00	t
e2c97840-7e1c-4ad5-86ad-2ccc086f29c8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	0e549040-6265-402f-951a-d0aab6b09263	6	6	2026-07-21 15:55:46.936739+00	t
828e2108-77c7-4e31-9156-9548a977adb2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:46.936739+00	t
a5788c5c-d79a-4dda-8d94-89ad29678348	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	9ca78e45-60fb-40ae-9375-4637946e2405	5	5	2026-07-21 15:55:46.936739+00	t
548b7bf1-400b-463e-b40f-36515e8c595c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:46.936739+00	t
c6060a20-de49-40aa-a250-4132cd832daa	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:46.936739+00	t
64531084-1441-472f-ba18-a9eb4f1de7ba	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-07-21 15:55:46.936739+00	t
05b7713c-5821-4759-8db5-952c6d7f21af	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	5	5	2026-07-21 15:55:46.936739+00	t
ccc1a618-1601-4b68-bef1-0522f99b6615	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:46.936739+00	t
78c956d6-17f6-4ec3-a27b-110004ad6bb2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:46.936739+00	t
94a17f2d-cf56-4af8-b0fd-34b87ac41c45	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	edd88ef1-c137-4c93-b824-783b445be228	1	6	2026-07-21 15:55:46.936739+00	t
1e1f7e14-4a7a-46d7-aefd-37157410ec11	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	4ba06ec1-fcab-4ac6-9522-f82c39fc491c	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:46.936739+00	t
56b3f30e-812d-44a6-9389-4efa55dfad9e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	6719968f-41c7-4905-874c-11747c7ab5e3	1	1	2026-07-21 15:55:46.936739+00	t
7ff07d7b-785a-4659-b8d3-fc31542c6997	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	932e3d51-820e-48d5-90c3-b0934171be3d	1	1	2026-07-21 15:55:46.936739+00	t
48906929-dc0f-4aab-8cd6-2fa3a2d90851	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	2	2	2026-07-21 15:55:46.936739+00	t
88a5a686-632b-4c72-be9e-e13b0a225567	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:46.936739+00	t
d2380882-c23e-4413-8e68-a3493c4f392c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	692c0cf4-a1cd-4655-8603-791e5900ef43	6	1	2026-07-21 15:55:46.936739+00	t
40a520d6-b234-4764-baee-2084e4b5397d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	54b58e4f-69dc-44b9-993f-6acdaa84b56c	2	2	2026-07-21 15:55:46.936739+00	t
cccbf739-ec1f-409e-a7b1-1fa059f3a8b5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	704411e7-e372-41cf-9797-8333554dba60	4	4	2026-07-21 15:55:46.936739+00	t
63bed94a-5f27-4ce3-b192-7d2cd77533cd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	5	5	2026-07-21 15:55:46.936739+00	t
9287cb01-819a-47c4-b88d-b7508a0c2f24	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:46.936739+00	t
3a588683-6738-4fa8-ae54-7e9a3727ab7d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:46.936739+00	t
132fbb50-b677-4138-b4a7-49ae61df2ff7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:46.936739+00	t
99dda8c7-fd09-4e3e-ada5-595d09338920	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:46.936739+00	t
d0309d4a-00d5-43a6-a574-24742cf355f5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-07-21 15:55:46.936739+00	t
f4778f5c-5954-4d3f-bc4b-5e94d49695c6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:46.936739+00	t
4ff6a71d-a1f5-458c-9e73-70a12a72b746	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	f9f07677-fb34-4877-85d1-a883dfab8025	6	6	2026-07-21 15:55:46.936739+00	t
18fc5b30-fdef-4ec5-a738-4f0c333ac968	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:46.936739+00	t
632326aa-d911-4ad1-bd71-89f907d0fc84	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:46.936739+00	t
61af646f-2405-4a7a-9f77-035ef6c4063a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	9ca78e45-60fb-40ae-9375-4637946e2405	6	6	2026-07-21 15:55:46.936739+00	t
87e8209e-e288-4f0d-8ab1-a2db5c289268	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-07-21 15:55:46.936739+00	t
617a2882-d59b-458f-ae0c-422fa1638451	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:46.936739+00	t
01135a69-4eb2-40a0-b58d-04775328913e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	9159ad92-33f2-4324-a469-462295b10cde	1	6	2026-07-21 15:55:46.936739+00	t
0133aeee-f50b-4b68-8418-7c9fa7ec9c6b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:46.936739+00	t
0b834eb0-2064-4304-af75-4d82ee1f0d70	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:46.936739+00	t
d1157f91-c2db-4e9a-b2a8-b7c8a0abe117	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-07-21 15:55:46.936739+00	t
6c97888f-9026-4edd-b6ea-b845217b0f4e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	edd88ef1-c137-4c93-b824-783b445be228	1	6	2026-07-21 15:55:46.936739+00	t
13f395fa-7e9e-48e7-af9d-7ea01b862d57	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	781b97dd-8e8b-4d8d-81ed-19218325759e	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-07-21 15:55:46.936739+00	t
0cc280f9-d166-43e6-aa0a-442cbf82b8ad	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	6719968f-41c7-4905-874c-11747c7ab5e3	1	1	2026-07-21 15:55:46.936739+00	t
3ba355a3-f7de-406a-ad9d-1b7b07a9c66c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:46.936739+00	t
d39c3420-8d28-477a-906d-6c3ead900847	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	1	1	2026-07-21 15:55:46.936739+00	t
a038a6de-4de8-4aed-8643-4f7b6fec8f81	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	1	1	2026-07-21 15:55:46.936739+00	t
64f1fdf2-6af2-43f8-812b-8a68be014162	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	692c0cf4-a1cd-4655-8603-791e5900ef43	6	1	2026-07-21 15:55:46.936739+00	t
d8097407-72ef-4db0-8346-adaed86eb19a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	54b58e4f-69dc-44b9-993f-6acdaa84b56c	1	1	2026-07-21 15:55:46.936739+00	t
0bd376b0-8c32-4477-a898-27b4ad62ab20	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:46.936739+00	t
77d78391-526c-4719-9098-7eaa328dc48f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	3	3	2026-07-21 15:55:46.936739+00	t
4bbcd17b-dcc9-46fa-8063-5679c143b5fc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-07-21 15:55:46.936739+00	t
d84da0ce-6b3c-43b5-987f-99547cc02cf9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	12aed47e-7498-4c49-87fe-86a96d2f6b4b	4	4	2026-07-21 15:55:46.936739+00	t
c5a78542-83ef-419e-8c3d-05a50c471eb1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	0beac4db-206d-498b-852e-ced7a137074b	5	2	2026-07-21 15:55:46.936739+00	t
d1a8ae86-d10d-4f52-afd3-2662fd5f3291	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	50dbae72-9a1d-4fd9-928b-301e852cad68	3	3	2026-07-21 15:55:46.936739+00	t
e19d4aee-f044-4442-b281-ab8dfe67ac01	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	3	3	2026-07-21 15:55:46.936739+00	t
38a899d5-c35c-4278-a1c9-99db900dfa9b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	fb9d8599-17df-4d90-bae1-f4c19a597ac3	3	3	2026-07-21 15:55:46.936739+00	t
662d533c-6166-4b25-841e-d07a25ec8092	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:46.936739+00	t
1b800f71-03f7-4138-aca0-14cc79cca56a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:46.936739+00	t
a9e18901-fc03-4cc4-be96-a40311ec5be7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:46.936739+00	t
e6a1c3a7-1783-4a7f-a535-c7568e489124	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-07-21 15:55:46.936739+00	t
f08c1341-e7b9-4fd6-b767-cbaee2e1b857	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	5	5	2026-07-21 15:55:46.936739+00	t
59d69777-f2a8-4c79-a086-15b0de70813e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:46.936739+00	t
82115622-5b87-48e7-ac8c-436d1240ab40	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	9159ad92-33f2-4324-a469-462295b10cde	4	3	2026-07-21 15:55:46.936739+00	t
9f124ff4-1c57-4ff5-b032-5b87b36a4b23	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	5	5	2026-07-21 15:55:46.936739+00	t
af570967-c4c7-4472-9e09-0872bd9e7d0e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	d0886045-cca4-42bb-8796-1a24c7fe8023	5	5	2026-07-21 15:55:46.936739+00	t
d25c9b6b-2bab-4414-a1f9-1b0185901a1e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	5	5	2026-07-21 15:55:46.936739+00	t
1ff1fe27-152a-4563-835a-27e35a1e9dbb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:46.936739+00	t
42174909-d088-456c-84b7-e26f3d892a2f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	17b8de9a-3d8e-4606-bdf0-8b8b7ac5a63e	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:46.936739+00	t
e0b05f9d-36b8-4654-b1bc-dbc6cf30158f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	6719968f-41c7-4905-874c-11747c7ab5e3	3	3	2026-07-21 15:55:46.936739+00	t
57c02c1d-04ae-4293-8f53-7a5fcbf6f204	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:46.936739+00	t
43faf19c-2150-4de3-a180-20669fb4db1f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	4	4	2026-07-21 15:55:46.936739+00	t
51c7cb8e-5efa-41c3-9bdf-2cb51b27fee8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	2	2	2026-07-21 15:55:46.936739+00	t
1b1a8388-bfbc-4583-a3fb-247ca967f694	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-07-21 15:55:46.936739+00	t
c233fd1f-c6de-4cde-998b-8d83f885e995	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:46.936739+00	t
94c5f219-ad6b-4d65-accc-0b4e33a486ee	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	704411e7-e372-41cf-9797-8333554dba60	3	3	2026-07-21 15:55:46.936739+00	t
99625243-c9d8-42e3-bdce-1ee4b08cffa9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	4	4	2026-07-21 15:55:46.936739+00	t
629563ae-d168-4965-b291-9c9e31c75a0c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	cde36b5a-9ba6-4068-bacc-48e73422a43c	4	4	2026-07-21 15:55:46.936739+00	t
f4f9aff2-52f8-409e-abc0-af1351476470	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	12aed47e-7498-4c49-87fe-86a96d2f6b4b	4	4	2026-07-21 15:55:46.936739+00	t
6b357bcb-da4e-44e7-a133-970dc74d9919	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	0beac4db-206d-498b-852e-ced7a137074b	3	4	2026-07-21 15:55:46.936739+00	t
5b430b99-853a-484c-a4a0-1bb71f0117bc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-07-21 15:55:46.936739+00	t
aef945cf-a9a6-4f13-8f72-707e6d40eb73	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	5	5	2026-07-21 15:55:46.936739+00	t
ebe07b1f-8e17-4f3e-b108-f9047f7d4f2a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:46.936739+00	t
73957c65-cffe-4f7f-a359-7f4b48bf9dc5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:46.936739+00	t
e0268797-5158-4391-a31b-6b1edc889715	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-07-21 15:55:46.936739+00	t
2d879ef4-9698-4ce1-abd1-7a2098bd294c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	15850608-0316-4548-88ab-9489a5118f61	6	6	2026-07-21 15:55:46.936739+00	t
3a26e941-4d21-4f08-ad82-5af81cf8a09b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-07-21 15:55:46.936739+00	t
3c0d8505-feac-4b49-9a5d-8ff50c738391	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	4	4	2026-07-21 15:55:46.936739+00	t
ff6c10fb-abaf-46f5-9ab0-8f34974c6041	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:46.936739+00	t
476668e8-13e6-421f-a502-be3b13130705	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	9159ad92-33f2-4324-a469-462295b10cde	4	3	2026-07-21 15:55:46.936739+00	t
0ab2ddac-5466-4e90-af23-dced7dba5480	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:46.936739+00	t
e8343227-a5ab-450d-9dbf-5ea99f9a41e3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:46.936739+00	t
f5588bb9-527a-4e57-b24a-6ef8af385fc8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	5	5	2026-07-21 15:55:46.936739+00	t
2c625275-e84d-4bbe-a34d-c536f1811647	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	edd88ef1-c137-4c93-b824-783b445be228	3	4	2026-07-21 15:55:46.936739+00	t
bd9e11e7-b5d6-43f4-bf49-bb08b3105f96	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	18ad22d3-a41b-46c3-aabd-d126ee33169c	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:46.936739+00	t
38efe792-9d84-4226-8ee7-5f9b4b951f85	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:46.936739+00	t
aeafad36-7401-4a8e-9bc3-0efaf679e328	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:46.936739+00	t
ad18ed77-9e41-4bb1-b67c-ba42612a382c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	4	4	2026-07-21 15:55:46.936739+00	t
6248c74a-e370-4930-8b84-fb320cb47287	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	2	2	2026-07-21 15:55:46.936739+00	t
4b694f64-c9cf-4b41-8ecd-0f463d3e0b40	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	692c0cf4-a1cd-4655-8603-791e5900ef43	6	1	2026-07-21 15:55:46.936739+00	t
3665bb28-a71b-4191-ac26-eb60b99a9093	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:46.936739+00	t
967dc89a-e168-4980-80f8-f0b12eb76a86	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	704411e7-e372-41cf-9797-8333554dba60	4	4	2026-07-21 15:55:46.936739+00	t
097bc7e0-2015-45d5-8e27-3526378f88d5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	5	5	2026-07-21 15:55:46.936739+00	t
9f5c4e82-a423-4e77-8d5d-5c1c43f05b9e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	cde36b5a-9ba6-4068-bacc-48e73422a43c	2	2	2026-07-21 15:55:46.936739+00	t
916840bf-c6ae-489a-99c8-e31443bee8e2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	12aed47e-7498-4c49-87fe-86a96d2f6b4b	3	3	2026-07-21 15:55:46.936739+00	t
b43ae23d-dbf4-4562-8ca1-47993781040a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:46.936739+00	t
181737d3-f9b3-43c9-a9bc-020143086547	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-07-21 15:55:46.936739+00	t
63f7a78a-6c77-4efe-8bc4-c702f527091d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:46.936739+00	t
74f71e3a-6cb3-48d3-b21b-533ea9a0d4aa	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:46.936739+00	t
dae64e0a-97ac-47c8-a1ff-dd6b6de4d4df	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:46.936739+00	t
53c964d4-a008-4f12-956c-303c1c48ca35	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:46.936739+00	t
0bba9961-8fa4-4d50-9376-9bbf857f81d0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-07-21 15:55:46.936739+00	t
1f789658-a29a-4681-98f1-0519d10ef3d3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:46.936739+00	t
0293463e-1e8c-48bb-b9dc-8b43648ccd2f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	4	4	2026-07-21 15:55:46.936739+00	t
26a48715-08f9-465a-a932-8a0d96425f81	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-07-21 15:55:46.936739+00	t
54db2464-5fb4-4885-beed-bf1ef9795950	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-07-21 15:55:46.936739+00	t
a8952601-8a9b-4ebb-bfa7-151d42b42927	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	4	4	2026-07-21 15:55:46.936739+00	t
edb96dad-98e4-47e3-9f9a-c58732feb085	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	d0886045-cca4-42bb-8796-1a24c7fe8023	3	3	2026-07-21 15:55:46.936739+00	t
2d52630c-d2e9-4229-9520-33175fdb855b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	2	2	2026-07-21 15:55:46.936739+00	t
8bb558e4-4c3e-45c2-98bc-f6ce004a526c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	edd88ef1-c137-4c93-b824-783b445be228	5	2	2026-07-21 15:55:46.936739+00	t
94273e5c-f968-4b82-ae87-b56e6aa9646a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e36bea18-ec14-4efe-940a-0acf3c127089	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:46.936739+00	t
cfc3dfc9-c890-4726-8db4-8080e535b133	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:46.936739+00	t
9de917c6-ec79-48fc-81c4-cb5fa1325c18	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	932e3d51-820e-48d5-90c3-b0934171be3d	5	5	2026-07-21 15:55:46.936739+00	t
4d8fc11c-4440-472c-b708-a53ad30bf719	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	3	3	2026-07-21 15:55:46.936739+00	t
bfee19dd-33e5-4d1f-87f3-5321b4380453	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-07-21 15:55:46.936739+00	t
d75ffe8d-736a-4c1d-a94e-38efd12eaa85	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-07-21 15:55:46.936739+00	t
79b5f72b-2714-41b5-abb6-526ca1d76e68	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:46.936739+00	t
174121d2-cbc2-4d73-bcda-aabd0358d85c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:46.936739+00	t
0a469a4d-093b-4c2c-810b-fb655d3392a7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	5	5	2026-07-21 15:55:46.936739+00	t
a04f0d07-e829-4208-a5e8-41ece3b39a53	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	cde36b5a-9ba6-4068-bacc-48e73422a43c	4	4	2026-07-21 15:55:46.936739+00	t
aebd5c84-dc67-4496-9c8b-cee02d9d4236	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	12aed47e-7498-4c49-87fe-86a96d2f6b4b	3	3	2026-07-21 15:55:46.936739+00	t
6c31900f-dfb1-44ca-aabf-2e4e8e200e60	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	0beac4db-206d-498b-852e-ced7a137074b	2	5	2026-07-21 15:55:46.936739+00	t
8e8c3ac5-1bb4-4649-86f8-b9bf8a3ef545	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-07-21 15:55:46.936739+00	t
fb29fa70-2491-4ca2-a9d9-58f43fd0fb2f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:46.936739+00	t
28eaf4fd-cc7c-4482-846a-4e7f08690ddb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:46.936739+00	t
f3e05f40-51d5-4865-ba85-7fcacbfade2c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:46.936739+00	t
80134f14-cd02-4543-92a2-4547bcf7cd75	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:46.936739+00	t
c8f01eda-0a6d-4307-8c1f-a3e0593c4b6f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	15850608-0316-4548-88ab-9489a5118f61	6	6	2026-07-21 15:55:46.936739+00	t
5fed6e7c-0900-4704-8fd9-a148f6c2ec3f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	9ca78e45-60fb-40ae-9375-4637946e2405	5	5	2026-07-21 15:55:46.936739+00	t
96e41030-b8df-4e14-9b8f-8ad9308e086c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	3	3	2026-07-21 15:55:46.936739+00	t
4fe29791-8123-41e2-b97c-f5e02c7383c3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-07-21 15:55:46.936739+00	t
58115bb6-4e4d-4c77-b66d-55862aea5994	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	9159ad92-33f2-4324-a469-462295b10cde	4	3	2026-07-21 15:55:46.936739+00	t
5253bd47-15fa-4b9c-9f0f-4ffe23ee3ffe	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:46.936739+00	t
0f448ed8-3cfa-4d36-9ab7-aff3349dc370	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-07-21 15:55:46.936739+00	t
bac2b59f-3aa3-4bb1-9f66-2f2c013c3e09	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-07-21 15:55:46.936739+00	t
1dcfaa9c-ec57-41de-8c10-9d03ce1b3886	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	edd88ef1-c137-4c93-b824-783b445be228	1	6	2026-07-21 15:55:46.936739+00	t
838e9fc3-0c31-4add-862f-145da64c99f2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	620abd73-3446-4f08-968c-5cc30a547080	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:46.936739+00	t
396f92ec-65e9-4ba8-bb5b-e13fd90431e6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	6719968f-41c7-4905-874c-11747c7ab5e3	1	1	2026-07-21 15:55:46.936739+00	t
ed96dd61-e4e3-4ed7-8313-f03da8a82b99	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	932e3d51-820e-48d5-90c3-b0934171be3d	2	2	2026-07-21 15:55:46.936739+00	t
15486bb4-c9a6-42ed-8664-40bbc347db98	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	2	2	2026-07-21 15:55:46.936739+00	t
6995ed03-35c7-4fd0-add5-17954929b40a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	2	2	2026-07-21 15:55:46.936739+00	t
11618e12-7b37-4dae-a52b-b5831e607778	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	692c0cf4-a1cd-4655-8603-791e5900ef43	6	1	2026-07-21 15:55:46.936739+00	t
05f7ce00-c111-4ced-82b5-1f58c1b877f2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	54b58e4f-69dc-44b9-993f-6acdaa84b56c	1	1	2026-07-21 15:55:46.936739+00	t
5e3bd16d-7de1-462e-906e-3b25d1a31f12	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	704411e7-e372-41cf-9797-8333554dba60	3	3	2026-07-21 15:55:46.936739+00	t
9f69ddf8-167d-482c-9f6b-feec5f328888	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	3	3	2026-07-21 15:55:46.936739+00	t
ce8dd6dd-01b5-4a54-afd1-0a424af71bfc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	cde36b5a-9ba6-4068-bacc-48e73422a43c	3	3	2026-07-21 15:55:46.936739+00	t
33b4173e-f706-41fb-ac19-2eaab7807c34	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	12aed47e-7498-4c49-87fe-86a96d2f6b4b	1	1	2026-07-21 15:55:46.936739+00	t
daa457cc-d41e-4ca7-9076-8675714b5db2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	0beac4db-206d-498b-852e-ced7a137074b	4	3	2026-07-21 15:55:46.936739+00	t
e594b18a-bb85-47a8-96d1-eedac702599a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	50dbae72-9a1d-4fd9-928b-301e852cad68	1	1	2026-07-21 15:55:46.936739+00	t
84f78ecf-e3e2-4e51-9e2a-aef88f85fa30	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	2	2	2026-07-21 15:55:46.936739+00	t
d7c9816f-da02-46b9-b9ac-2aff3e399ad4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	fb9d8599-17df-4d90-bae1-f4c19a597ac3	1	1	2026-07-21 15:55:46.936739+00	t
af4e5560-f5e4-498f-90db-985f64c9c170	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	f9f07677-fb34-4877-85d1-a883dfab8025	3	3	2026-07-21 15:55:46.936739+00	t
0c75f383-26ef-42d7-9933-08a6182aaa76	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-07-21 15:55:46.936739+00	t
cca0d3d9-b2d1-4126-bec0-10ddc0f80384	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	15850608-0316-4548-88ab-9489a5118f61	3	3	2026-07-21 15:55:46.936739+00	t
b56e10cb-641b-45cc-840f-70ef37bf4c44	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:46.936739+00	t
2b00df23-b191-4d8b-8ceb-2bd0ff7498ed	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	3	3	2026-07-21 15:55:46.936739+00	t
064e067c-fa64-4679-9bfd-54c59587b30d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-07-21 15:55:46.936739+00	t
19c9b5be-70b3-42ba-b006-d19e6dbcd8b2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-07-21 15:55:46.936739+00	t
38f94d89-8324-4722-9b9a-dc693745a3ba	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	2	2	2026-07-21 15:55:46.936739+00	t
01a463c6-693d-4513-a772-08494d78d6e8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:46.936739+00	t
6516c6be-50c7-467c-b117-c792d7e8ea7e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	1	1	2026-07-21 15:55:46.936739+00	t
88c8699c-ea73-49c7-a0c8-3821148e3961	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	edd88ef1-c137-4c93-b824-783b445be228	6	1	2026-07-21 15:55:46.936739+00	t
f0ed49f1-b579-4cad-849c-0745a08bac46	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	973856c0-03d3-4a13-9372-7a4f751b3343	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	3	3	2026-07-21 15:55:46.936739+00	t
9244d09b-5d01-4ef8-8352-feef592130df	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-07-21 15:55:46.936739+00	t
ae64b673-392e-4a3d-a41f-97cf5c1e9fd5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-07-21 15:55:46.936739+00	t
0ef0b062-78f9-41e8-9144-59e182c83827	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	5	5	2026-07-21 15:55:46.936739+00	t
82833e27-59c6-49ab-9326-c32dc9ec0733	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-07-21 15:55:46.936739+00	t
e48593c0-555c-44d0-bd59-c5e76f22e1e7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-07-21 15:55:46.936739+00	t
18bdee85-7aa4-4f42-b49d-6d4fd3ebc3e9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	54b58e4f-69dc-44b9-993f-6acdaa84b56c	2	2	2026-07-21 15:55:46.936739+00	t
60133579-b079-488f-bbd3-61ae218105eb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:46.936739+00	t
71054f27-0a05-40ee-87c6-8a399aa93c9b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	4	4	2026-07-21 15:55:46.936739+00	t
ca306237-010c-4b87-bbc2-8682ec22d713	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:46.936739+00	t
07b5c713-5203-4954-a2fc-6587c759fa91	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	12aed47e-7498-4c49-87fe-86a96d2f6b4b	4	4	2026-07-21 15:55:46.936739+00	t
b31401c5-13c8-4a4c-90b6-909b8bea1460	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	0beac4db-206d-498b-852e-ced7a137074b	3	4	2026-07-21 15:55:46.936739+00	t
bdfd4103-f267-4a97-a984-a5764975d5ab	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-07-21 15:55:46.936739+00	t
285c722c-aaa9-4730-88df-6599231097e5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:46.936739+00	t
69aab575-0c02-40b5-9395-322b9e4d408b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:46.936739+00	t
b85699e1-2e78-42b2-8025-b63775c5836b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:46.936739+00	t
5ffe1b98-8324-4ced-87fb-174a7b1b1434	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-07-21 15:55:46.936739+00	t
cdee479d-9998-4574-afc0-e9cde633ef87	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	15850608-0316-4548-88ab-9489a5118f61	3	3	2026-07-21 15:55:46.936739+00	t
09fb3cb3-2872-4144-bd78-09fc9e290aa1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:46.936739+00	t
e1186cc9-9ea6-402b-a956-da08b106cc6f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	4	4	2026-07-21 15:55:46.936739+00	t
27977f8b-9c0e-4f23-90c5-139979c7b247	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-07-21 15:55:46.936739+00	t
12c10638-808e-4ca6-9231-fdfd29e68f48	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	9159ad92-33f2-4324-a469-462295b10cde	4	3	2026-07-21 15:55:46.936739+00	t
f63e4b90-a07b-48c4-92fd-0bae69c51bc9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	3	3	2026-07-21 15:55:46.936739+00	t
afe09266-1fc5-4ee7-8c5b-1e96ac1a3afc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:46.936739+00	t
8856c03e-6d63-4890-9529-f51ece3286cb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-07-21 15:55:46.936739+00	t
99a608a9-7891-45de-99ce-cee82e9dea10	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	edd88ef1-c137-4c93-b824-783b445be228	3	4	2026-07-21 15:55:46.936739+00	t
e73d9f1f-975a-4573-82b7-66007e71139c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	a1642696-9ec7-404e-bbef-93a0d2880667	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-07-21 15:55:46.936739+00	t
38eb381e-96aa-438b-b9f8-cdd329e522d1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	6719968f-41c7-4905-874c-11747c7ab5e3	3	3	2026-07-21 15:55:46.936739+00	t
c5a67095-c993-4c06-82c7-f7a7dd3f6cf7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	932e3d51-820e-48d5-90c3-b0934171be3d	4	4	2026-07-21 15:55:46.936739+00	t
70798629-0cad-44ec-8d5c-35d8968f0e60	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	5	5	2026-07-21 15:55:46.936739+00	t
ec8d9d76-2cf4-4155-9409-32f14f753fb2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-07-21 15:55:46.936739+00	t
92a03568-2679-4c2b-a01d-988260dcff92	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	692c0cf4-a1cd-4655-8603-791e5900ef43	2	5	2026-07-21 15:55:46.936739+00	t
219d44e3-e9cd-4489-880e-218669b67c0c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-07-21 15:55:46.936739+00	t
ecc76137-6c0b-4384-a938-2d5af58870e1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:46.936739+00	t
00d23a03-5870-4118-af7d-1f265ce60663	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	5	5	2026-07-21 15:55:46.936739+00	t
cf444b62-6a81-4e50-bf29-fc20ac51c187	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	cde36b5a-9ba6-4068-bacc-48e73422a43c	4	4	2026-07-21 15:55:46.936739+00	t
40eda9bf-2037-4e60-9e29-40cc8f0c60f6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:46.936739+00	t
f7585d64-dad7-4cf3-875e-034870de2307	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	0beac4db-206d-498b-852e-ced7a137074b	3	4	2026-07-21 15:55:46.936739+00	t
da024bfa-1ae6-4401-a738-ded8c6c0eb8b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-07-21 15:55:46.936739+00	t
f2bddf1c-ee56-4565-a786-3e64bc7727af	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:46.936739+00	t
10da3359-bf76-4d1f-86b9-e039136763b2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-07-21 15:55:46.936739+00	t
1f9b4b6c-7e5c-4c3c-9ac2-c37a722e9f0d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:46.936739+00	t
66ad29b9-2757-43e1-b9de-c18a88879acf	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	0e549040-6265-402f-951a-d0aab6b09263	3	3	2026-07-21 15:55:46.936739+00	t
f8b4c72b-70f8-4c50-8f93-448f66236a28	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:46.936739+00	t
5a612f58-2c22-4980-813c-a0e0d2d24439	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-07-21 15:55:46.936739+00	t
998253a4-5076-4f8c-96a3-924cb299440c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	3	3	2026-07-21 15:55:46.936739+00	t
acd8f5b0-47dc-4905-a021-2696c920bd49	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:46.936739+00	t
9dd76909-b687-4120-91a6-063b825a8bd4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-07-21 15:55:46.936739+00	t
4290ff2e-133a-4fea-8e42-e70b3d115a16	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	3	3	2026-07-21 15:55:46.936739+00	t
c61b904e-5536-426f-b0cc-3496bb4611a7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:46.936739+00	t
dccc70cf-350c-48f7-aec0-48503dc65c5e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:46.936739+00	t
bf36f68b-76dc-4b7e-a1ae-e51341f04789	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	edd88ef1-c137-4c93-b824-783b445be228	2	5	2026-07-21 15:55:46.936739+00	t
2919ba18-6aa0-452a-9342-76285f0f9e84	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	675e72d7-ac8f-47d6-aa97-a623e3ce1056	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-07-21 15:55:46.936739+00	t
ac21b95c-9a35-44bf-9fb1-dbc815c06cf0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	6719968f-41c7-4905-874c-11747c7ab5e3	3	3	2026-07-21 15:55:46.936739+00	t
3a9935eb-1c43-4611-b4cb-878d4a24bc55	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	932e3d51-820e-48d5-90c3-b0934171be3d	4	4	2026-07-21 15:55:46.936739+00	t
f78ce7ab-90cf-454b-8a7f-345c18512aba	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	4	4	2026-07-21 15:55:46.936739+00	t
7f45c4b7-af0a-43c7-b4a7-1204f1988f7d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:46.936739+00	t
576e8f64-3c3c-42da-908f-2fab821be5d4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-07-21 15:55:46.936739+00	t
9201c255-737f-410c-9741-9b85d88b10b1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-07-21 15:55:46.936739+00	t
42713021-171b-4b6b-baf3-276d42387354	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-07-21 15:55:46.936739+00	t
3fb05fa3-8fe2-4398-96a2-577c015e0cb9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-07-21 15:55:46.936739+00	t
92448300-d38a-4888-b007-c73307581d04	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-07-21 15:55:46.936739+00	t
01d91b36-b6b1-4852-a98d-1e1335d34200	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-07-21 15:55:46.936739+00	t
d7b1e50c-4586-4154-85fa-bc23158a9058	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:46.936739+00	t
f15416c9-63d0-4e15-93ac-1b7ce5082964	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-07-21 15:55:46.936739+00	t
bc346024-5f24-4bb9-88f2-d1a53da212b8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	5	5	2026-07-21 15:55:46.936739+00	t
46bb8dba-e35f-4d7e-806d-39bae1b93cfe	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-07-21 15:55:46.936739+00	t
0564985e-dae1-4ea5-be82-56882a367cba	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:46.936739+00	t
4f9095e6-7242-48c4-a77d-b0d421fe1d12	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:46.936739+00	t
137d608b-b3bb-4509-81ba-bfca3846cef5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-07-21 15:55:46.936739+00	t
b1c4569a-c99a-49d2-a3fe-bdce82ba89b5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:46.936739+00	t
db36a8c8-dfc7-49c6-8f4d-c994ee4a43f2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	5	5	2026-07-21 15:55:46.936739+00	t
820411f7-101e-4b91-a709-7995b73e9a65	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:46.936739+00	t
f8a38830-b408-45b2-a9f0-db55aadb375c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-07-21 15:55:46.936739+00	t
98a13151-cc31-4e89-8fb4-03f4fded876e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-07-21 15:55:46.936739+00	t
294cf596-897e-4565-919f-94324eebd078	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	d0886045-cca4-42bb-8796-1a24c7fe8023	5	5	2026-07-21 15:55:46.936739+00	t
5b1a7822-4c57-4778-a7e4-da2776aba4a3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	5	5	2026-07-21 15:55:46.936739+00	t
2b9e0fc3-6f04-493a-aeed-1dcd765733aa	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	edd88ef1-c137-4c93-b824-783b445be228	4	3	2026-07-21 15:55:46.936739+00	t
a919c7c9-ffb8-4657-a902-436540e2ab88	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	d9237063-891b-4adb-8efc-ce51139bec62	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-07-21 15:55:46.936739+00	t
a9e08f29-5f9a-4d49-9a02-ceb3bf9b3069	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	6719968f-41c7-4905-874c-11747c7ab5e3	2	2	2026-07-21 15:55:46.936739+00	t
0379b9f1-b718-4efd-bf66-ba47cfd05a3e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	932e3d51-820e-48d5-90c3-b0934171be3d	5	5	2026-07-21 15:55:46.936739+00	t
8bee0541-b942-4317-b413-89aad58ae462	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	4	4	2026-07-21 15:55:46.936739+00	t
11b35462-e6d8-4ca9-b829-2f300ce2f50f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-07-21 15:55:46.936739+00	t
86bd4a3b-ea15-474e-955b-1be46153bdf2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	692c0cf4-a1cd-4655-8603-791e5900ef43	5	2	2026-07-21 15:55:46.936739+00	t
bd374e21-7d42-48f4-b26f-0007c9723457	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	54b58e4f-69dc-44b9-993f-6acdaa84b56c	1	1	2026-07-21 15:55:46.936739+00	t
4cb05f41-8da5-451f-a79d-598df2c7e9a0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	704411e7-e372-41cf-9797-8333554dba60	4	4	2026-07-21 15:55:46.936739+00	t
3bd81a44-3b0c-407f-aac3-1b8b7b3c5f52	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	5	5	2026-07-21 15:55:46.936739+00	t
002b64d2-c2a9-42b2-bae1-68ca990be890	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	cde36b5a-9ba6-4068-bacc-48e73422a43c	3	3	2026-07-21 15:55:46.936739+00	t
ae2a1bb8-ac4e-4091-82c9-ba501dcc39b9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	12aed47e-7498-4c49-87fe-86a96d2f6b4b	3	3	2026-07-21 15:55:46.936739+00	t
3be866b5-fae5-48a3-9c83-d6750eb754b0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	0beac4db-206d-498b-852e-ced7a137074b	3	4	2026-07-21 15:55:46.936739+00	t
12333ae5-82d5-49ae-99d2-b5c669eca9c4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-07-21 15:55:46.936739+00	t
6dcd48a5-2e7d-4761-9bdf-8e6959d6c1c7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	2	2	2026-07-21 15:55:46.936739+00	t
431eea9f-ebf9-4d33-9113-f008e5181f63	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	fb9d8599-17df-4d90-bae1-f4c19a597ac3	2	2	2026-07-21 15:55:46.936739+00	t
3a991019-4f61-4319-bc28-758a19ad205e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-07-21 15:55:46.936739+00	t
ee5bf654-7fa8-436a-8ce1-918cc9aea489	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:46.936739+00	t
79bae665-d89d-4e95-9066-955faab59ae0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-07-21 15:55:46.936739+00	t
81d8e67a-409d-45dd-b2d2-48df3b9d9072	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:46.936739+00	t
bd324cea-5eb0-4513-85bd-38f664d38a18	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	4	4	2026-07-21 15:55:46.936739+00	t
704e4db0-7dcf-4eeb-bea4-66847a1ce4ed	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:46.936739+00	t
3452289b-1630-46cf-90fb-e21acf622f5c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	9159ad92-33f2-4324-a469-462295b10cde	2	5	2026-07-21 15:55:46.936739+00	t
86ba1162-c144-462b-b393-3fa534fa5ba2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	3	3	2026-07-21 15:55:46.936739+00	t
d5c1aa1e-d8df-4bd3-8696-3589d3c926e5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-07-21 15:55:46.936739+00	t
124c8c86-77ce-49c7-a9d0-e50beb865bad	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:46.936739+00	t
423f8044-42fa-4bdb-8fad-e5e439eda0d6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	edd88ef1-c137-4c93-b824-783b445be228	4	3	2026-07-21 15:55:46.936739+00	t
2f292781-6cf2-4fd6-b0ae-8391740b8772	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	292aa4f1-8613-470a-bc30-95d5725ad49c	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	2	2	2026-07-21 15:55:46.936739+00	t
b2d5e548-d72c-40a5-a8c2-c7c71b383303	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	6719968f-41c7-4905-874c-11747c7ab5e3	2	2	2026-07-21 15:55:46.936739+00	t
90f316a3-ca0d-4097-b882-7c117f903fe7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	932e3d51-820e-48d5-90c3-b0934171be3d	5	5	2026-07-21 15:55:46.936739+00	t
1adb99a2-428c-4200-b28d-877c9d37c561	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	1	1	2026-07-21 15:55:46.936739+00	t
18a6c9f2-be99-42cd-b684-95d92cc170c5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-07-21 15:55:46.936739+00	t
78494fc1-3d57-4598-b819-fda1614a7e98	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-07-21 15:55:46.936739+00	t
88136b47-a966-4dd5-8a48-dfae2688b94b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	54b58e4f-69dc-44b9-993f-6acdaa84b56c	3	3	2026-07-21 15:55:46.936739+00	t
6bac2f08-105d-44a9-8d0e-ec30b830a303	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	704411e7-e372-41cf-9797-8333554dba60	5	5	2026-07-21 15:55:46.936739+00	t
70c6bc5d-a0ad-45b2-a047-3bc84796a6d4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	4	4	2026-07-21 15:55:46.936739+00	t
412648fc-5a19-489d-89ae-64ff6d6e5ab9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-07-21 15:55:46.936739+00	t
202c4d33-a29b-4183-9313-5ac5e3339557	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-07-21 15:55:46.936739+00	t
236445bb-04d3-44c3-a826-ea62ced7d56d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	0beac4db-206d-498b-852e-ced7a137074b	1	6	2026-07-21 15:55:46.936739+00	t
4a456dfd-f427-46b3-a4ef-fb61e8489e45	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-07-21 15:55:46.936739+00	t
abd4874c-6bc1-40b9-a4d2-a16ad6915f57	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-07-21 15:55:46.936739+00	t
79cdfc40-6b60-4d4b-9482-98854cd43eef	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-07-21 15:55:46.936739+00	t
e669de27-6149-4309-a0e2-c635613e8843	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-07-21 15:55:46.936739+00	t
c0befa50-15fe-4867-8a31-94a92846d41e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	0e549040-6265-402f-951a-d0aab6b09263	5	5	2026-07-21 15:55:46.936739+00	t
2a3dddbb-1638-4826-a218-ece616ebfdfb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-07-21 15:55:46.936739+00	t
1730030a-b891-4603-804a-4050851c651e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-07-21 15:55:46.936739+00	t
6b29c844-72aa-45b3-807d-05404fbbe0f4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	5	5	2026-07-21 15:55:46.936739+00	t
a2434917-52a8-494d-b0db-07e579516de9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-07-21 15:55:46.936739+00	t
5387afe0-e4cc-4c31-9cb2-9e645a558e14	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-07-21 15:55:46.936739+00	t
7303c301-3985-4c28-b17e-7bc0e4dfe632	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	4	4	2026-07-21 15:55:46.936739+00	t
4fb14dc9-269b-4339-b4c6-30c64d407a8e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	d0886045-cca4-42bb-8796-1a24c7fe8023	5	5	2026-07-21 15:55:46.936739+00	t
ecf38a5b-295e-43fa-8c4e-dbdff55550ce	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-07-21 15:55:46.936739+00	t
9e04a2ee-e573-4873-a2aa-7b4ea1887fd4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	edd88ef1-c137-4c93-b824-783b445be228	4	3	2026-07-21 15:55:46.936739+00	t
bbe85305-d28e-4f85-ace5-2a63a8236c28	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	6da10e7b-845a-435d-ad7e-7ff8ed4e6198	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-07-21 15:55:46.936739+00	t
b000f7ba-6bf2-4c1a-ac53-a8ee3bfc9083	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	6719968f-41c7-4905-874c-11747c7ab5e3	6	6	2026-08-02 03:15:06.859735+00	f
2f6ae031-d0be-4736-8c7b-8b42989ec8bb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	932e3d51-820e-48d5-90c3-b0934171be3d	6	6	2026-08-02 03:15:06.859735+00	f
f0b11294-7652-412c-a49e-81365ec57ca4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	2	2	2026-08-02 03:15:06.859735+00	f
0c7fdc5b-8968-4b5d-8e83-ab10337a5445	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	5	5	2026-08-02 03:15:06.859735+00	f
f834fb9d-a4f7-4783-b95b-e59102a60da8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	692c0cf4-a1cd-4655-8603-791e5900ef43	5	2	2026-08-02 03:15:06.859735+00	f
3720b171-64fe-4183-8c55-006c0fcb9b52	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-08-02 03:15:06.859735+00	f
fc701e6f-5a9e-47c9-98ad-cc7db1d88b24	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-08-02 03:15:06.859735+00	f
9f827b0e-ce23-4046-9e2d-5599d8f84ca8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-08-02 03:15:06.859735+00	f
b003627e-13a3-44fc-b185-3a7288df7246	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-08-02 03:15:06.859735+00	f
2539ae87-bd53-4d68-a3b7-8c6aaa5b4ad7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	12aed47e-7498-4c49-87fe-86a96d2f6b4b	3	3	2026-08-02 03:15:06.859735+00	f
4b4e78b9-46ed-41d6-9b81-a09d078824ee	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	0beac4db-206d-498b-852e-ced7a137074b	5	2	2026-08-02 03:15:06.859735+00	f
4719fd20-0895-46e0-baa4-b8a215825d27	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-08-02 03:15:06.859735+00	f
798736cc-74e8-483b-b8d8-18c98096859a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	2	2	2026-08-02 03:15:06.859735+00	f
4f4feddc-b959-4e88-8274-fcedf5f63c95	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-08-02 03:15:06.859735+00	f
90e4e3b2-cfb8-469d-854e-4489df124d26	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-08-02 03:15:06.859735+00	f
a6b14175-3008-45b6-8a24-5e06c319ada6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-08-02 03:15:06.859735+00	f
3d840589-0b14-48f0-8ba3-b90b3520d0b2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-08-02 03:15:06.859735+00	f
f0b343b7-d85a-405d-af8c-e06c03f39d95	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	9ca78e45-60fb-40ae-9375-4637946e2405	5	5	2026-08-02 03:15:06.859735+00	f
0dcd0e01-bc2f-410c-9963-2dec8f3aab39	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	4	4	2026-08-02 03:15:06.859735+00	f
157e514b-5918-4513-a024-ceeaf6eb4b1f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	2	2	2026-08-02 03:15:06.859735+00	f
305e8387-f248-41ff-a796-985e275e543b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	9159ad92-33f2-4324-a469-462295b10cde	4	3	2026-08-02 03:15:06.859735+00	f
392e8a23-f1ec-4fd9-b12d-6b5a3d5c3d52	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	2	2	2026-08-02 03:15:06.859735+00	f
bf64d4a5-39de-4ee7-90ed-9eefb3d07feb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-08-02 03:15:06.859735+00	f
27b4419b-9df1-4892-846c-d94e5c0da84c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	3	3	2026-08-02 03:15:06.859735+00	f
41d7893b-a289-445e-b4df-ac4f7170c16b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	edd88ef1-c137-4c93-b824-783b445be228	5	2	2026-08-02 03:15:06.859735+00	f
e23f63ef-2bb5-411d-a21e-3f31482623be	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44851510-f4fa-4590-b20d-2f4b3059919c	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-08-02 03:15:06.859735+00	f
40b13af4-f1fa-4611-b36d-9c0737864b49	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	6719968f-41c7-4905-874c-11747c7ab5e3	5	5	2026-09-01 17:57:33.936098+00	f
d9748185-02d7-443b-91ed-252b823c3c1f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	932e3d51-820e-48d5-90c3-b0934171be3d	3	3	2026-09-01 17:57:33.936098+00	f
55d389ab-a6a7-42cc-a942-75a6519eb6e3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	2	2	2026-09-01 17:57:33.936098+00	f
d629921d-1ff2-4c19-aa42-d6c8c2b25aa6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	3	3	2026-09-01 17:57:33.936098+00	f
f9344880-dbac-42d1-9cab-c8794f2b5424	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	692c0cf4-a1cd-4655-8603-791e5900ef43	6	1	2026-09-01 17:57:33.936098+00	f
208eb2bf-4328-447b-bd1e-fab962869f64	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-09-01 17:57:33.936098+00	f
fa094eee-7255-40de-baef-f7847412365e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-09-01 17:57:33.936098+00	f
0e645d64-960b-49ec-b163-7ec0698dcb6f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	6	6	2026-09-01 17:57:33.936098+00	f
8441cfe6-5766-45b2-b23b-f7e765a42310	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	cde36b5a-9ba6-4068-bacc-48e73422a43c	6	6	2026-09-01 17:57:33.936098+00	f
af68ffb7-87e3-4be6-9b6f-addba8524b29	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	12aed47e-7498-4c49-87fe-86a96d2f6b4b	6	6	2026-09-01 17:57:33.936098+00	f
6f079ce8-04d4-48a9-8259-f8a2ca367d2a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	0beac4db-206d-498b-852e-ced7a137074b	6	1	2026-09-01 17:57:33.936098+00	f
532c2078-0058-4d59-8103-c7a49ba949a7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	50dbae72-9a1d-4fd9-928b-301e852cad68	6	6	2026-09-01 17:57:33.936098+00	f
623638c0-ea2d-4f4f-aec3-1135174a56f7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	6	6	2026-09-01 17:57:33.936098+00	f
c9ff7167-8098-49d7-adad-c57d79c9f2c5	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-09-01 17:57:33.936098+00	f
098f8bad-2ce6-441b-bb3b-a7da76332d90	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	f9f07677-fb34-4877-85d1-a883dfab8025	6	6	2026-09-01 17:57:33.936098+00	f
da527b7f-07c1-4cfc-862c-aa06dfbacb54	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	0e549040-6265-402f-951a-d0aab6b09263	3	3	2026-09-01 17:57:33.936098+00	f
e4bc6a1b-4382-4853-8133-fd07d186d6e6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	15850608-0316-4548-88ab-9489a5118f61	3	3	2026-09-01 17:57:33.936098+00	f
5e67837a-81f4-4c90-9acf-08afb96cb30d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	9ca78e45-60fb-40ae-9375-4637946e2405	3	3	2026-09-01 17:57:33.936098+00	f
0de90459-e291-479c-b236-ff88345bbe87	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	3	3	2026-09-01 17:57:33.936098+00	f
a7d568e4-0eaf-423b-8ecd-71c7b6b9f1e8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	3	3	2026-09-01 17:57:33.936098+00	f
95e9b30b-8b62-49b1-a8be-b7551cdfb2e7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	9159ad92-33f2-4324-a469-462295b10cde	3	4	2026-09-01 17:57:33.936098+00	f
45a51291-3c8c-4270-9f1c-c2d05305a299	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	3	3	2026-09-01 17:57:33.936098+00	f
800fa831-c8ea-4999-b073-f5ce97f98cee	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	d0886045-cca4-42bb-8796-1a24c7fe8023	3	3	2026-09-01 17:57:33.936098+00	f
765f8ee5-b589-4c04-bbb0-8ed06bc29511	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	3	3	2026-09-01 17:57:33.936098+00	f
b2413449-bca3-4cf6-9491-bf9504a66d49	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	edd88ef1-c137-4c93-b824-783b445be228	3	4	2026-09-01 17:57:33.936098+00	f
2f2a3833-b031-472f-83de-5c708db09306	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	44386158-5a64-4f3f-bf3d-0daee0f400f4	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	3	3	2026-09-01 17:57:33.936098+00	f
ae748f53-917d-43c1-958d-2aa7f6a965c2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	6719968f-41c7-4905-874c-11747c7ab5e3	6	6	2026-09-17 17:32:01.163672+00	f
8b65adcb-f752-4cf7-be03-cce697e427fc	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	932e3d51-820e-48d5-90c3-b0934171be3d	5	5	2026-09-17 17:32:01.163672+00	f
1ed55268-c5f1-40cd-8b03-cb2f97f229ce	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	5	5	2026-09-17 17:32:01.163672+00	f
50e1220e-0287-4600-8366-54a037f441ab	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	5	5	2026-09-17 17:32:01.163672+00	f
e5c3cebe-635c-4ca5-8cb0-c37b1e5cea5e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-09-17 17:32:01.163672+00	f
0dbd7f48-d6e5-439a-9b2b-cb50dfb1f039	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-09-17 17:32:01.163672+00	f
a886ec87-a529-4c0b-bca1-e37d3fa7262b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	704411e7-e372-41cf-9797-8333554dba60	6	6	2026-09-17 17:32:01.163672+00	f
8ebe0cdf-34b7-4d39-b952-ec539dcc7468	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	1	1	2026-09-17 17:32:01.163672+00	f
9a5c225b-d663-440f-b715-a5f178abf5ab	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-09-17 17:32:01.163672+00	f
c21b1678-c472-4ee7-90b8-40a2d88113e6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	12aed47e-7498-4c49-87fe-86a96d2f6b4b	5	5	2026-09-17 17:32:01.163672+00	f
b1b0d5cd-d8b6-4e68-9e6d-5b840597c1fb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	0beac4db-206d-498b-852e-ced7a137074b	4	3	2026-09-17 17:32:01.163672+00	f
e8b26044-e4ba-4053-8308-7a42ec668b46	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	50dbae72-9a1d-4fd9-928b-301e852cad68	2	2	2026-09-17 17:32:01.163672+00	f
73454b8d-1fba-4c87-9d66-7dbb4cb53570	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-09-17 17:32:01.163672+00	f
e807e6b4-54e0-41a8-8b54-40607e91f742	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-09-17 17:32:01.163672+00	f
b07c79eb-713a-47b2-aa52-dde3a8fd241b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	f9f07677-fb34-4877-85d1-a883dfab8025	5	5	2026-09-17 17:32:01.163672+00	f
f18b78cd-a9ed-4dc1-987c-a7c0c5a26098	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	0e549040-6265-402f-951a-d0aab6b09263	3	3	2026-09-17 17:32:01.163672+00	f
8c665a60-02ab-4c6d-be46-b607c0b2600b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	15850608-0316-4548-88ab-9489a5118f61	6	6	2026-09-17 17:32:01.163672+00	f
c5935d59-7946-4a44-9244-deed2abc757e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	9ca78e45-60fb-40ae-9375-4637946e2405	1	1	2026-09-17 17:32:01.163672+00	f
62e10b59-3e00-41d5-9f6c-4d2bb9581dd0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	6	6	2026-09-17 17:32:01.163672+00	f
79694aec-5382-49f8-a9c8-6526fff33684	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	1	1	2026-09-17 17:32:01.163672+00	f
ed7f2f24-cf68-45f3-ae7a-684db03ccdfb	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	9159ad92-33f2-4324-a469-462295b10cde	6	1	2026-09-17 17:32:01.163672+00	f
9c300c91-2a0b-4cac-98ce-50790fce9729	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	2	2	2026-09-17 17:32:01.163672+00	f
6cc039b3-8751-4f2d-a14b-18c6eb45b949	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	d0886045-cca4-42bb-8796-1a24c7fe8023	5	5	2026-09-17 17:32:01.163672+00	f
c0c5233b-0e2a-4bce-a842-ca6f0d273653	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	3	3	2026-09-17 17:32:01.163672+00	f
a081c2c0-875d-431e-b719-9eab160fb5a2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	edd88ef1-c137-4c93-b824-783b445be228	6	1	2026-09-17 17:32:01.163672+00	f
3f241985-4a1a-4275-b04c-f83ac5b2be2e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	e08e92b7-3c7d-4d27-a1d4-24c02c949cee	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-09-17 17:32:01.163672+00	f
c082fd3b-de82-46e5-8992-82925485c96d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	6719968f-41c7-4905-874c-11747c7ab5e3	2	2	2026-10-05 22:52:30.5022+00	f
d40e8cd7-1d87-4833-962b-767407eaec97	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	932e3d51-820e-48d5-90c3-b0934171be3d	2	2	2026-10-05 22:52:30.5022+00	f
37095553-c59d-47bc-999c-a1117f3e1ea0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	4	4	2026-10-05 22:52:30.5022+00	f
ad25e4da-6a38-41c9-9384-88fac09d1b42	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	5	5	2026-10-05 22:52:30.5022+00	f
8eda7739-07ba-4817-b4e9-4fd53bfe5a57	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	692c0cf4-a1cd-4655-8603-791e5900ef43	5	2	2026-10-05 22:52:30.5022+00	f
1a5949ff-a036-4b1b-a168-16e45ba4968c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-10-05 22:52:30.5022+00	f
38a73bef-6625-4746-a2dd-5b88ff390a3b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	704411e7-e372-41cf-9797-8333554dba60	4	4	2026-10-05 22:52:30.5022+00	f
30a0e8ee-48ca-4e70-96a4-a8a2760301ef	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	2	2	2026-10-05 22:52:30.5022+00	f
c90ac6c2-25a0-4c92-a986-d4dfb511bea0	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	cde36b5a-9ba6-4068-bacc-48e73422a43c	2	2	2026-10-05 22:52:30.5022+00	f
b324ec69-0b14-4936-823e-07f05aee2250	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	12aed47e-7498-4c49-87fe-86a96d2f6b4b	4	4	2026-10-05 22:52:30.5022+00	f
c6e4cffb-11ad-4ac0-bd75-4c515b085a7a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	0beac4db-206d-498b-852e-ced7a137074b	4	3	2026-10-05 22:52:30.5022+00	f
39eede1c-592c-4c2a-bbf6-3c3f84e3e56c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-10-05 22:52:30.5022+00	f
786c9ed2-d9e0-4283-8a56-b888b4a9a33a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	3	3	2026-10-05 22:52:30.5022+00	f
51c6f2e2-0482-4c78-b8fe-7c3650f69c6a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	fb9d8599-17df-4d90-bae1-f4c19a597ac3	6	6	2026-10-05 22:52:30.5022+00	f
fcff47d2-1e6a-4011-9fe0-31164109d408	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	f9f07677-fb34-4877-85d1-a883dfab8025	3	3	2026-10-05 22:52:30.5022+00	f
63d55d92-9e96-45d7-9baa-4b2a266973a6	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-10-05 22:52:30.5022+00	f
91749f55-4e8e-4f9e-8861-726566674e51	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	15850608-0316-4548-88ab-9489a5118f61	5	5	2026-10-05 22:52:30.5022+00	f
c4a5e2af-7c49-4e17-9102-e96b9e8cffc1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	9ca78e45-60fb-40ae-9375-4637946e2405	2	2	2026-10-05 22:52:30.5022+00	f
2fb49a55-b358-4392-8e56-50d20c9b0dfa	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	2	2	2026-10-05 22:52:30.5022+00	f
43ed909d-850e-4b12-9196-68d50fcf86e7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	5	5	2026-10-05 22:52:30.5022+00	f
6b95f06c-13a0-4ddc-96ce-359d3486ced8	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	9159ad92-33f2-4324-a469-462295b10cde	5	2	2026-10-05 22:52:30.5022+00	f
d45e933c-7c29-4404-beeb-78644c978a7b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	6	6	2026-10-05 22:52:30.5022+00	f
87cf8b80-70b3-46fc-a614-203862bb7bca	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	d0886045-cca4-42bb-8796-1a24c7fe8023	6	6	2026-10-05 22:52:30.5022+00	f
04f0ad16-301f-4b31-b7d2-fb2de980ca4a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	6	6	2026-10-05 22:52:30.5022+00	f
91915067-7b07-46cf-864a-bef3603c6f3a	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	edd88ef1-c137-4c93-b824-783b445be228	6	1	2026-10-05 22:52:30.5022+00	f
d7432af2-dd12-4eaf-a271-dd5beb4197c3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	0c15bea4-ce08-47fa-adbe-c2e10f97af99	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	6	6	2026-10-05 22:52:30.5022+00	f
07621112-0f84-42b3-a17e-73deed221827	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	6719968f-41c7-4905-874c-11747c7ab5e3	5	5	2026-10-05 23:04:59.66714+00	f
1d7025c4-2890-4c89-9e4b-3caeca39c089	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	932e3d51-820e-48d5-90c3-b0934171be3d	4	4	2026-10-05 23:04:59.66714+00	f
98cd14ee-c4d1-45d0-ae61-4fa60e9a21e9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	6	6	2026-10-05 23:04:59.66714+00	f
68794522-4f38-4e64-b91c-cfd010e08d8b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-10-05 23:04:59.66714+00	f
5fbe1a64-5936-4974-a7e0-82ea1b4af19f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	692c0cf4-a1cd-4655-8603-791e5900ef43	5	2	2026-10-05 23:04:59.66714+00	f
c005dd71-3faf-4b03-bf2e-9599325ce31d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	54b58e4f-69dc-44b9-993f-6acdaa84b56c	5	5	2026-10-05 23:04:59.66714+00	f
0c14e65b-9072-451c-ae9e-0f385aa69d5b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	704411e7-e372-41cf-9797-8333554dba60	3	3	2026-10-05 23:04:59.66714+00	f
51f2b215-98b8-4a92-94b1-6347371d3f77	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	2	2	2026-10-05 23:04:59.66714+00	f
23381f13-9699-4191-b9b1-ef9afcb8740b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	cde36b5a-9ba6-4068-bacc-48e73422a43c	5	5	2026-10-05 23:04:59.66714+00	f
943e6d02-551a-47cc-81bf-8ec7fe1cab70	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	12aed47e-7498-4c49-87fe-86a96d2f6b4b	4	4	2026-10-05 23:04:59.66714+00	f
81dafe22-c518-4259-ab15-528b37c3d906	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	0beac4db-206d-498b-852e-ced7a137074b	4	3	2026-10-05 23:04:59.66714+00	f
23a5153b-21c4-493b-9bf7-6e4f64bbce20	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	50dbae72-9a1d-4fd9-928b-301e852cad68	5	5	2026-10-05 23:04:59.66714+00	f
65214c2c-3c48-4961-ad49-e846114efe63	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-10-05 23:04:59.66714+00	f
0e477c57-749e-4de0-98c4-8bb56bfae2ad	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	fb9d8599-17df-4d90-bae1-f4c19a597ac3	5	5	2026-10-05 23:04:59.66714+00	f
7f8c955b-db16-4b94-9bde-5fde6b77c10b	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	f9f07677-fb34-4877-85d1-a883dfab8025	3	3	2026-10-05 23:04:59.66714+00	f
fc1f7c25-3a6f-47df-bf9b-3c4c205b8898	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-10-05 23:04:59.66714+00	f
d395bc3d-58a2-493b-a139-e23f2b122021	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	15850608-0316-4548-88ab-9489a5118f61	3	3	2026-10-05 23:04:59.66714+00	f
80fe4a42-5039-42b3-898a-87f4389252d9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	9ca78e45-60fb-40ae-9375-4637946e2405	5	5	2026-10-05 23:04:59.66714+00	f
04df30c8-fd60-429d-b7ae-88e81e342daf	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	5	5	2026-10-05 23:04:59.66714+00	f
f1f558c1-6d7f-4266-810e-dfeca9513c15	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	6	6	2026-10-05 23:04:59.66714+00	f
73cd4b4a-bf91-4477-8040-4ec6f2fddf32	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	9159ad92-33f2-4324-a469-462295b10cde	5	2	2026-10-05 23:04:59.66714+00	f
8b1843ba-b54c-42d1-a774-a1cdc2ff6b3c	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	3	3	2026-10-05 23:04:59.66714+00	f
96efd324-7069-4b01-aa24-8fce675bec4d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-10-05 23:04:59.66714+00	f
eeaf90f6-1f2a-482d-8e5d-a4aa08ab7447	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	5	5	2026-10-05 23:04:59.66714+00	f
7b5792c1-2f1a-4967-9132-a810d538c835	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	edd88ef1-c137-4c93-b824-783b445be228	4	3	2026-10-05 23:04:59.66714+00	f
4a01f131-48d5-4029-9ca2-c723d85c13da	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	959ecc36-e701-41cb-9329-84e715bfa2af	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	5	5	2026-10-05 23:04:59.66714+00	f
28cf5be7-8bd8-4acb-8e40-9e43e6004a96	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	6719968f-41c7-4905-874c-11747c7ab5e3	4	4	2026-10-08 03:43:49.690945+00	f
9a9f9ab2-fb43-4a24-bd30-9dee3f9619d2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	932e3d51-820e-48d5-90c3-b0934171be3d	4	4	2026-10-08 03:43:49.690945+00	f
4f7e426c-b901-4e91-91e0-0529870b0f30	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	0f65a05a-8b99-47a2-be89-97d1fa3e31d0	4	4	2026-10-08 03:43:49.690945+00	f
839e7dc7-526d-4e78-a4c1-2b2c7bae041f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	31f15fda-0c0d-441b-9aa2-e70fb97fc1cc	4	4	2026-10-08 03:43:49.690945+00	f
4d4a9e13-293f-4ccd-be40-02e339fbc8bd	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	692c0cf4-a1cd-4655-8603-791e5900ef43	4	3	2026-10-08 03:43:49.690945+00	f
cdf5b182-8604-4e70-b33e-dd6cc90f31e3	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	54b58e4f-69dc-44b9-993f-6acdaa84b56c	4	4	2026-10-08 03:43:49.690945+00	f
998ce8b4-d26f-43b4-90ec-c8e38b3ddb4e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	704411e7-e372-41cf-9797-8333554dba60	4	4	2026-10-08 03:43:49.690945+00	f
22940424-5f6b-49dc-a3ad-57a90da09b49	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	8b8d307e-bfa5-406d-8d06-6ad26dc66cd6	4	4	2026-10-08 03:43:49.690945+00	f
9a641e45-4518-4b5b-8951-0efa5ceddebf	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	cde36b5a-9ba6-4068-bacc-48e73422a43c	4	4	2026-10-08 03:43:49.690945+00	f
d4a48673-f7a6-4348-a4bc-bce0a7e3b289	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	12aed47e-7498-4c49-87fe-86a96d2f6b4b	4	4	2026-10-08 03:43:49.690945+00	f
736c3735-a99e-4df5-a9cc-ede2eb93f624	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	0beac4db-206d-498b-852e-ced7a137074b	4	3	2026-10-08 03:43:49.690945+00	f
ae79571c-522e-493d-b289-707373231b95	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	50dbae72-9a1d-4fd9-928b-301e852cad68	4	4	2026-10-08 03:43:49.690945+00	f
899a2a5a-9f27-4938-b0d8-7c4b83183474	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	6e85d37b-ac4b-4df0-8455-8bdd23f5e6cf	4	4	2026-10-08 03:43:49.690945+00	f
7ba87754-416a-4faa-8992-5b3355cb9df7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	fb9d8599-17df-4d90-bae1-f4c19a597ac3	4	4	2026-10-08 03:43:49.690945+00	f
55ab9086-3e1b-4d7e-b97e-97467566e5d2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	f9f07677-fb34-4877-85d1-a883dfab8025	4	4	2026-10-08 03:43:49.690945+00	f
628d81c7-0708-424e-87cc-7908abc6d4e1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	0e549040-6265-402f-951a-d0aab6b09263	4	4	2026-10-08 03:43:49.690945+00	f
dcc0c7b8-68f4-4b98-b9b8-6b1d76f22bfe	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	15850608-0316-4548-88ab-9489a5118f61	4	4	2026-10-08 03:43:49.690945+00	f
b39927d6-4e59-4940-a28a-e5de9f2985a1	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	9ca78e45-60fb-40ae-9375-4637946e2405	4	4	2026-10-08 03:43:49.690945+00	f
0e2197c8-fa5e-4042-93e4-cf1058a6d3a9	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	fc7c1510-f0ca-40ba-a15f-b6cc24a8027c	4	4	2026-10-08 03:43:49.690945+00	f
28ac7a17-b5a0-4910-9c71-db25fde4fec4	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	2cc6d8c1-da6d-446e-9fa6-bc0bae2022e9	4	4	2026-10-08 03:43:49.690945+00	f
19a58718-b55b-42aa-9c64-2abee0474a7d	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	9159ad92-33f2-4324-a469-462295b10cde	4	3	2026-10-08 03:43:49.690945+00	f
6da6f0d0-465d-410a-bdff-21f220af5e7e	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	de32f83f-df9f-4a2c-8c9c-df9d48792e6b	4	4	2026-10-08 03:43:49.690945+00	f
aff190c6-ed85-4a75-abf5-d8beb333f8ca	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	d0886045-cca4-42bb-8796-1a24c7fe8023	4	4	2026-10-08 03:43:49.690945+00	f
6965be96-1ccd-446f-b740-54302d7ee65f	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	072e52b6-eacc-46e6-8fa4-a6ff04242c1b	4	4	2026-10-08 03:43:49.690945+00	f
d36e46b2-77b7-47ce-80fb-4b867d2dd1c2	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	edd88ef1-c137-4c93-b824-783b445be228	4	3	2026-10-08 03:43:49.690945+00	f
ea796375-4241-41ef-a0d2-27f49ee91ce7	ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	fb5e1f2a-8802-4f0a-9fca-f87619a43873	fe3f810e-a1fb-4830-8d96-ea5850a61cbc	4	4	2026-10-08 03:43:49.690945+00	f
\.


--
-- Data for Name: surveys; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.surveys (id, school_id, cycle_id, name, opens_at, closes_at, anonymity, status, created_by, created_at, wave) FROM stdin;
ec3b0a3a-1e4b-4f47-bc50-de5b2832e60f	a0000000-0000-0000-0000-000000000001	\N	School Culture Scan	\N	\N	anonymous	draft	\N	2026-07-20 16:40:34.269688+00	1
\.


--
-- Name: conversation_logs conversation_logs_neon_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_logs
    ADD CONSTRAINT conversation_logs_neon_id_key UNIQUE (neon_id);


--
-- Name: conversation_logs conversation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_logs
    ADD CONSTRAINT conversation_logs_pkey PRIMARY KEY (id);


--
-- Name: cycles cycles_neon_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cycles
    ADD CONSTRAINT cycles_neon_id_key UNIQUE (neon_id);


--
-- Name: cycles cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cycles
    ADD CONSTRAINT cycles_pkey PRIMARY KEY (id);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);


--
-- Name: invites invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_token_key UNIQUE (token);


--
-- Name: pairings pairings_cycle_host_visitor_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairings
    ADD CONSTRAINT pairings_cycle_host_visitor_key UNIQUE (cycle_id, host_id, visitor_id);


--
-- Name: pairings pairings_cycle_id_teacher_a_teacher_b_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairings
    ADD CONSTRAINT pairings_cycle_id_teacher_a_teacher_b_key UNIQUE (cycle_id, host_id, visitor_id);


--
-- Name: pairings pairings_neon_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairings
    ADD CONSTRAINT pairings_neon_id_key UNIQUE (neon_id);


--
-- Name: pairings pairings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairings
    ADD CONSTRAINT pairings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: profiles profiles_neon_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_neon_id_key UNIQUE (neon_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: schools schools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_pkey PRIMARY KEY (id);


--
-- Name: survey_items survey_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_items
    ADD CONSTRAINT survey_items_pkey PRIMARY KEY (id);


--
-- Name: survey_items survey_items_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_items
    ADD CONSTRAINT survey_items_position_key UNIQUE ("position");


--
-- Name: survey_responses survey_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);


--
-- Name: surveys surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);


--
-- Name: conversation_logs_host_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_logs_host_id_idx ON public.conversation_logs USING btree (host_id);


--
-- Name: conversation_logs_visitor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_logs_visitor_id_idx ON public.conversation_logs USING btree (visitor_id);


--
-- Name: survey_items_dimension_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_items_dimension_idx ON public.survey_items USING btree (dimension);


--
-- Name: survey_items_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_items_position_idx ON public.survey_items USING btree ("position");


--
-- Name: survey_responses_respondent_item_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX survey_responses_respondent_item_key ON public.survey_responses USING btree (respondent, item_id);


--
-- Name: survey_responses_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_responses_school_idx ON public.survey_responses USING btree (school_id);


--
-- Name: survey_responses_survey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_responses_survey_idx ON public.survey_responses USING btree (survey_id);


--
-- Name: survey_items survey_items_single_active_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER survey_items_single_active_version AFTER INSERT OR UPDATE ON public.survey_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.survey_items_single_active_version();


--
-- Name: conversation_logs conversation_logs_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_logs
    ADD CONSTRAINT conversation_logs_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.cycles(id) ON DELETE CASCADE;


--
-- Name: conversation_logs conversation_logs_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_logs
    ADD CONSTRAINT conversation_logs_host_id_fkey FOREIGN KEY (host_id) REFERENCES public.profiles(id);


--
-- Name: conversation_logs conversation_logs_logged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_logs
    ADD CONSTRAINT conversation_logs_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES public.profiles(id);


--
-- Name: conversation_logs conversation_logs_pairing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_logs
    ADD CONSTRAINT conversation_logs_pairing_id_fkey FOREIGN KEY (pairing_id) REFERENCES public.pairings(id) ON DELETE CASCADE;


--
-- Name: conversation_logs conversation_logs_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_logs
    ADD CONSTRAINT conversation_logs_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: conversation_logs conversation_logs_visitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_logs
    ADD CONSTRAINT conversation_logs_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES public.profiles(id);


--
-- Name: cycles cycles_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cycles
    ADD CONSTRAINT cycles_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: invites invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id);


--
-- Name: invites invites_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: pairings pairings_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairings
    ADD CONSTRAINT pairings_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id);


--
-- Name: pairings pairings_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairings
    ADD CONSTRAINT pairings_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.cycles(id) ON DELETE CASCADE;


--
-- Name: pairings pairings_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairings
    ADD CONSTRAINT pairings_host_id_fkey FOREIGN KEY (host_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: pairings pairings_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairings
    ADD CONSTRAINT pairings_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id);


--
-- Name: pairings pairings_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairings
    ADD CONSTRAINT pairings_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: pairings pairings_visitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairings
    ADD CONSTRAINT pairings_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.survey_items(id) ON DELETE RESTRICT;


--
-- Name: survey_responses survey_responses_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: surveys surveys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: surveys surveys_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.cycles(id) ON DELETE CASCADE;


--
-- Name: surveys surveys_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: cycles admin deletes cycles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin deletes cycles" ON public.cycles FOR DELETE TO authenticated USING ((public.is_school_admin() AND (school_id = public.my_school_id())));


--
-- Name: pairings admin deletes pairings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin deletes pairings" ON public.pairings FOR DELETE TO authenticated USING ((public.is_school_admin() AND (school_id = public.my_school_id())));


--
-- Name: invites admin deletes school invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin deletes school invites" ON public.invites FOR DELETE TO authenticated USING ((public.is_school_admin() AND (school_id = public.my_school_id())));


--
-- Name: invites admin reads school invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin reads school invites" ON public.invites FOR SELECT TO authenticated USING ((public.is_school_admin() AND (school_id = public.my_school_id())));


--
-- Name: cycles admin updates cycles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin updates cycles" ON public.cycles FOR UPDATE TO authenticated USING ((public.is_school_admin() AND (school_id = public.my_school_id()))) WITH CHECK ((public.is_school_admin() AND (school_id = public.my_school_id())));


--
-- Name: pairings admin updates pairings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin updates pairings" ON public.pairings FOR UPDATE TO authenticated USING ((public.is_school_admin() AND (school_id = public.my_school_id()))) WITH CHECK ((public.is_school_admin() AND (school_id = public.my_school_id())));


--
-- Name: invites admin updates school invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin updates school invites" ON public.invites FOR UPDATE TO authenticated USING ((public.is_school_admin() AND (school_id = public.my_school_id()))) WITH CHECK ((public.is_school_admin() AND (school_id = public.my_school_id())));


--
-- Name: cycles admin writes cycles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin writes cycles" ON public.cycles FOR INSERT TO authenticated WITH CHECK ((public.is_school_admin() AND (school_id = public.my_school_id())));


--
-- Name: pairings admin writes pairings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin writes pairings" ON public.pairings FOR INSERT TO authenticated WITH CHECK ((public.is_school_admin() AND (school_id = public.my_school_id())));


--
-- Name: invites admin writes school invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin writes school invites" ON public.invites FOR INSERT TO authenticated WITH CHECK ((public.is_school_admin() AND (school_id = public.my_school_id())));


--
-- Name: pairings admins can manage pairings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins can manage pairings" ON public.pairings FOR UPDATE USING (((school_id = public.my_school_id()) AND public.is_admin()));


--
-- Name: surveys admins can manage surveys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins can manage surveys" ON public.surveys USING (((school_id = public.my_school_id()) AND public.is_admin()));


--
-- Name: conversation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: cycles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_items demo anon read active survey items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "demo anon read active survey items" ON public.survey_items FOR SELECT TO anon USING (active);


--
-- Name: survey_responses demo anon submit survey responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "demo anon submit survey responses" ON public.survey_responses FOR INSERT TO anon WITH CHECK (((respondent IS NOT NULL) AND ((auth.uid() IS NULL) OR (respondent <> auth.uid())) AND (synthetic = false) AND public.survey_is_open(survey_id) AND (EXISTS ( SELECT 1
   FROM public.survey_items i
  WHERE ((i.id = survey_responses.item_id) AND i.active)))));


--
-- Name: survey_responses insert_response; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_response ON public.survey_responses FOR INSERT TO authenticated WITH CHECK (((respondent <> auth.uid()) AND ((raw_value >= 1) AND (raw_value <= 6)) AND ((scored_value >= 1) AND (scored_value <= 6)) AND (synthetic = false)));


--
-- Name: invites invitee reads own invite; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invitee reads own invite" ON public.invites FOR SELECT TO authenticated USING ((lower(email) = public.my_email()));


--
-- Name: invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_logs pair reads own logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pair reads own logs" ON public.conversation_logs FOR SELECT TO authenticated USING (((host_id = public.my_profile_id()) OR (visitor_id = public.my_profile_id())));


--
-- Name: conversation_logs pair updates own drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pair updates own drafts" ON public.conversation_logs FOR UPDATE TO authenticated USING ((((host_id = public.my_profile_id()) OR (visitor_id = public.my_profile_id())) AND (status = 'draft'::text))) WITH CHECK (((host_id = public.my_profile_id()) OR (visitor_id = public.my_profile_id())));


--
-- Name: conversation_logs pair writes own logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pair writes own logs" ON public.conversation_logs FOR INSERT TO authenticated WITH CHECK ((((host_id = public.my_profile_id()) OR (visitor_id = public.my_profile_id())) AND (logged_by = public.my_profile_id()) AND (status = 'draft'::text)));


--
-- Name: pairings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pairings ENABLE ROW LEVEL SECURITY;

--
-- Name: pairings participant or admin reads pairings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "participant or admin reads pairings" ON public.pairings FOR SELECT TO authenticated USING (((host_id = public.my_profile_id()) OR (visitor_id = public.my_profile_id()) OR (public.is_school_admin() AND (school_id = public.my_school_id()))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth_user_id = auth.uid()));


--
-- Name: survey_items read_active_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_active_items ON public.survey_items FOR SELECT TO authenticated USING ((active = true));


--
-- Name: cycles same school reads cycles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "same school reads cycles" ON public.cycles FOR SELECT TO authenticated USING ((school_id = public.my_school_id()));


--
-- Name: profiles same school reads profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "same school reads profiles" ON public.profiles FOR SELECT TO authenticated USING (((school_id IS NOT NULL) AND (school_id = public.my_school_id())));


--
-- Name: surveys school members can read surveys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "school members can read surveys" ON public.surveys FOR SELECT USING ((school_id = public.my_school_id()));


--
-- Name: schools; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.survey_items ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: surveys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_logs teachers can insert logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "teachers can insert logs" ON public.conversation_logs FOR INSERT WITH CHECK ((school_id = public.my_school_id()));


--
-- Name: pairings teachers can request pairings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "teachers can request pairings" ON public.pairings FOR INSERT WITH CHECK ((school_id = public.my_school_id()));


--
-- Name: schools users can read own school; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can read own school" ON public.schools FOR SELECT USING ((id = public.my_school_id()));


--
-- Name: profiles users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can update own profile" ON public.profiles FOR UPDATE USING ((auth_user_id = auth.uid())) WITH CHECK ((auth_user_id = auth.uid()));


--
-- PostgreSQL database dump complete
--

\unrestrict 0rk9ewbKSpivNZYgMjuefFV8lzH6xLXQSZPw2EyzFCqbPTd7OwJbHAHuKnccqbt

