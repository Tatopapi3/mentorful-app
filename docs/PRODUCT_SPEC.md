# Mentorful MVP Product Spec (Phase 1)

## Identity
Mentorful is a web-based Learning and Leadership Operating System (LLOS) that builds Teacher Collective Efficacy (TCE) through structured quarterly peer cycles and visible alignment.

## Non-negotiable philosophy
- Developmental, not evaluative
- No scoring, no rubrics, no ratings
- Validation first: strength hunting and future vision
- The engine is the collaboration cycle, not the dashboard

## Roles
### Admin
Can:
- Configure school, cycles, strategic priority
- Invite teachers
- Approve pairings
- View all visit records
- View admin dashboard
- View faculty map
- Launch and view TCE surveys and results

### Teacher
Can:
- Propose pairing
- Participate in a visit record where they are one of the two participants
- View teacher dashboard including schoolwide TCE scores and aggregates
Cannot:
- View faculty map
- View other teachers' completion status
- View visit records not involving them

## Multi-tenant
- Each school is a tenant.
- Users belong to exactly one school in Phase 1.
- Tenant isolation is strict.

## Cycle model
Default cadence: quarterly. Admin can choose semester.
Each cycle has:
- name (e.g., Q1 2026)
- start_date, end_date
- strategic_priority (text)
- status (upcoming, active, closed)

Participation requirement per teacher per cycle:
- Host 1 visit (as host)
- Conduct 1 visit (as visitor)
- Complete 1 debrief record (the record is the debrief artifact)

We track three completion flags per teacher per cycle:
- hosted_complete
- visited_complete
- debrief_complete

## Pairing model
- Teachers self-select pairings by proposing.
- Admin must approve before the pairing becomes active.
- One pairing creates one VisitRecord for a cycle.
- The system should prevent duplicate pairings between same people in the same cycle.

Pairing includes:
- cycle_id
- host_user_id
- visitor_user_id
- domain (required)
- strategic_tag (required, defaults to cycle strategic priority)
- status (pending, approved, rejected)

## Visit and Debrief Protocol (3 steps)
This is the core page. Must be minimal.

Step 1: Vision
Prompt:
"What student learning outcome or instructional focus is driving this lesson?"

Step 2: Align vision with strengths
Prompt:
"What strengths supported this vision?"

Step 3: Data and resources
Fields:
- More frequently (increase frequency of...)
- Less frequently (decrease frequency of...)
- Support needed (resources or support needed)

Required tags:
- Domain: Classroom, Planning, Communication, Assessment
- Strategic tag: defaults to cycle strategic priority, editable

Optional:
- Strength tags (chips). Allow selecting from a small preset list plus custom.

Record states:
- Draft (editable)
- Submitted (read-only)

## Teacher dashboard content
Teacher sees:
- Cycle status: hosted, visited, debrief complete
- Schoolwide TCE score and 4 domain breakdown
- Aggregated strengths themes
- Aggregated growth themes

Teacher does not see:
- Map
- Other teachers' status

## Admin dashboard content
Admin sees, filtered by selected cycle:
- Participation rate (full cycle complete percent)
- Hosted completion percent
- Visited completion percent
- Debrief completion percent
- TCE score and domain breakdown
- Strategic priority alignment percent (percent of visit records tagged to priority)
- Participation by department
- Roster management view with per-teacher completion

## Survey engine
Phase 1 supports:
- Launch survey from template
- Teacher responses
- Results: TCE overall score + 4 domain breakdown + baseline vs post comparison when available
- CSV export

Survey mode:
- Default anonymous
- Identified mode optional

Templates:
- TCE Core (required)
- TCE + Belonging (optional Phase 1B)
- TCE + AI Adoption (optional Phase 1B)

## Faculty map (Admin only)
- Nodes: teachers
- Edges: approved and submitted visit records in selected cycle
- Toggle coloring:
  - Collaboration density
  - Domain coloring
  - Strategic tag coloring

Performance:
- Schools up to 100 teachers should load in under 3 seconds.

Demo mode:
- Demo login exists.
- Demo tenant uses simulated dataset with 50 teachers and 3 cycles.

## Out of scope for Phase 1
- AI summarization
- Microcredentials and badges
- Cross-school benchmarking
- Algorithmic pairing suggestions
- Influence mapping analytics beyond simple network edges
- CTLE certificate generation inside the app

## Tone and wording constraints
- Avoid evaluative language
- Prefer: vision, strengths, alignment, more often, less often, support needed
