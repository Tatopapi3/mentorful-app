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
