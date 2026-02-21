#!/usr/bin/env bash
set -euo pipefail

mkdir -p docs tasks apps/web packages/db

cat > docs/PRODUCT_SPEC.md <<'EOF'
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
EOF

cat > docs/ACCEPTANCE_TESTS.md <<'EOF'
# Mentorful MVP Acceptance Tests (Phase 1)

## Auth and tenancy
- A user from School A cannot access any data from School B.
- A teacher cannot access any admin-only route.
- A teacher cannot access /admin/map. Redirect to /dashboard with an error toast.

## Roles
- Admin can invite teachers and assign roles.
- Teachers cannot see roster completion table.
- Teachers cannot see any other teacher's completion status.

## Cycles
- Admin can create a cycle with name, dates, strategic priority.
- Admin can select an active cycle filter on admin dashboard.
- Data shown on admin dashboard changes when cycle changes.

## Pairing
- Teacher can propose a pairing.
- Pairing stays pending until admin approval.
- Approved pairing becomes visible to both participants.
- Duplicate pairing for same cycle and same pair is prevented.

## Visit record
- Visit record has 3 steps: Vision, Strength Alignment, Data and Resources.
- Domain and strategic tag are required before submission.
- Draft can be saved and edited.
- Submitted record is read-only.
- Teacher can only view visit records where they are host or visitor.
- Admin can view all visit records in their school.

## Teacher dashboard
- Teacher sees cycle completion status (hosted, visited, debrief).
- Teacher sees schoolwide TCE score and domain breakdown.
- Teacher sees aggregated themes (strengths and growth) from submitted records.

## Admin dashboard
- Admin sees participation metrics:
  - percent fully complete
  - percent hosted complete
  - percent visited complete
  - percent debrief complete
- Admin sees TCE score and 4 domain breakdown.
- Admin sees strategic priority alignment percent.
- Admin sees participation by department.

## Survey
- Admin can launch TCE Core survey.
- Teachers can submit responses.
- Admin can view results with overall and domain breakdown.
- Admin can export CSV.

## Faculty map
- Admin can open /admin/map and see network graph.
- Teacher cannot open /admin/map.
- Map supports toggle: domain coloring and strategic tag coloring.
- Demo tenant displays simulated dataset.

## Demo mode
- Demo login exists.
- Demo data is labeled simulated.
- Demo data cannot be modified by non-admin demo user.
EOF

# tasks 001..030 (short form placeholders that Codex can expand if needed)
for i in $(seq -w 1 30); do
  : # keep loop for later append
done

cat > tasks/001-repo-bootstrap.md <<'EOF'
# 001 Repo bootstrap
Goal: Initialize Next.js app router + TypeScript at /apps/web with pnpm workspace, ESLint + Prettier.
Acceptance: pnpm -w dev works; pnpm -w lint passes.
EOF

cat > tasks/002-env-config.md <<'EOF'
# 002 Environment config
Goal: Add .env.example and env validation for Clerk + DB.
Vars: DATABASE_URL, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, NEXT_PUBLIC_APP_URL.
EOF

cat > tasks/003-db-prisma-setup.md <<'EOF'
# 003 Prisma setup
Goal: Prisma schema in /packages/db wired to Postgres; migrations + seed scaffold.
Acceptance: pnpm -w prisma:migrate runs.
EOF

# (To keep this message manageable, we’ll add tasks 004-030 after Codex starts — Codex can generate them from the SOW and wireframes.)
echo "Kickoff docs created. Add remaining tasks as needed." 1>&2
