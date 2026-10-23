# Mentorful teacher-pairing MCP server

An MCP server for the teacher-pairing agent described in
[`prompts/teacher-pairing-agent.md`](prompts/teacher-pairing-agent.md). It runs
over stdio and offers:

| Kind | Name | What it gives |
|---|---|---|
| Resource | `mcp://mentorful-db/school/{school_id}/profiles` | Teachers: id, name, department, strength domains |
| Resource | `mcp://mentorful-db/school/{school_id}/exclusion_rules` | Active do-not-pair rules, as id pairs |
| Resource | `mcp://mentorful-db/school/{school_id}/pairing_history` | Pairings from the last 2 cycles |
| Tool | `generate_pairings` | Runs the algorithm and returns the pairing state |
| Prompt | `teacher_pairing_agent` | The system prompt plus the request to carry out |

## Run it

```bash
cd apps/mcp-pairing
npm install
npm start          # demo data, school_id "mentorful-sandbox"
npm test
```

Node 22.18 or later runs the TypeScript directly; there is no build step.

To add it to Claude Code or another MCP client:

```json
{
  "mcpServers": {
    "mentorful-pairing": {
      "command": "node",
      "args": ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "apps/mcp-pairing/src/index.ts"],
      "env": { "MENTORFUL_DATA": "demo" }
    }
  }
}
```

### Data

- `MENTORFUL_DATA=demo` (the default) reads the teacher dashboard's sample
  data in `apps/web/public/mentortrdash/data` and the sample conflict rule in
  `demo/exclusion_rules.json`, which says Mia Kim and Noah Nguyen must not be
  paired.
- `MENTORFUL_DATA=supabase` reads the live project. It needs `SUPABASE_URL` (or
  `NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`, and the
  `pairing_exclusion_rules` table from `apps/web/scripts/015_pairing_exclusion_rules.sql`,
  which is written but not yet applied.

The service key bypasses RLS, so the server must only ever run where that key
is already allowed: a trusted machine or a server route, never a browser.

## `generate_pairings`

Input is the schema in the prompt, plus an optional `seed`:

```json
{
  "school_id": "mentorful-sandbox",
  "variant": "TEACHER_REQUESTED",
  "requested_pairs": [{ "requester_id": "liam", "target_id": "harper" }],
  "admin_overrides": [],
  "exclude_previous_cycles_count": 2,
  "seed": 11
}
```

- `ADMIN_ASSIGNED` checks each override and pairs nobody else.
- `RANDOMIZED` pairs everyone, preferring another department and then
  different strengths.
- `TEACHER_REQUESTED` pairs mutual requests first, then single-sided ones (the
  requester visits), then everyone left as in `RANDOMIZED`.
- Admin overrides are applied first in every variant, and checked the same way.

The result has `pairs` (with host, visitor, source, `cross_department` and
`shared_domains`), `unassigned` with a reason, `rejected` with a reason
(`conflict`, `repeat_pair`, `already_assigned`, `not_in_roster`,
`same_teacher`), the `seed` used, and an `admin_summary` that holds counts,
rates and domain tallies only.

## Invariants, and where each is enforced

- **Exposure over perfection:** `exposureScore` in `src/pairing.ts`, plus
  drawing from the biggest departments first so the last teachers aren't left
  with same-department partners. Tested over 500 seeds.
- **Conflict safeguards:** excluded pairs are never formed, and an override
  naming one is rejected.
- **No repeats:** pairs from the last `exclude_previous_cycles_count` cycles are
  treated like conflicts.
- **Privacy:** `src/data.ts` refuses to query `survey_responses` and
  `conversation_logs` at all, reads only name, department and strength columns
  from `profiles`, and reads only the two id columns of exclusion rules. The
  admin summary carries no ids or names.
