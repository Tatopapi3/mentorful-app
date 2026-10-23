import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePairings, type Teacher } from "../src/pairing.ts";

const T = (id: string, department: string, domains: string[]): Teacher => ({ id, name: id, department, domains });
const roster = [
  T("m1", "Math", ["CLASSROOM", "PLANNING"]),
  T("m2", "Math", ["CLASSROOM", "PLANNING"]),
  T("s1", "Science", ["ASSESSMENT", "PLANNING"]),
  T("s2", "Science", ["ASSESSMENT", "PLANNING"]),
  T("e1", "English", ["CLASSROOM", "COMMUNICATION"]),
  T("e2", "English", ["CLASSROOM", "COMMUNICATION"]),
];
const pairKey = (p: { host_id: string; visitor_id: string }) => [p.host_id, p.visitor_id].sort().join("|");

test("RANDOMIZED pairs everyone across departments when it can", () => {
  for (let seed = 1; seed <= 500; seed++) {
    const r = generatePairings({ school_id: "x", variant: "RANDOMIZED", seed }, roster, [], []);
    assert.equal(r.pairs.length, 3);
    assert.equal(r.unassigned.length, 0);
    assert.equal(r.admin_summary.cross_department_pairs, 3, `seed ${seed}`);
  }
});

test("conflicts and recent repeats are never paired", () => {
  const exclusions = [{ teacher_a: "m1", teacher_b: "s1" }];
  const history = [{ host_id: "m1", visitor_id: "e1", cycles_ago: 0 }];
  for (let seed = 1; seed <= 50; seed++) {
    const r = generatePairings({ school_id: "x", variant: "RANDOMIZED", seed }, roster, exclusions, history);
    const keys = r.pairs.map(pairKey);
    assert.ok(!keys.includes("m1|s1"), `conflict paired, seed ${seed}`);
    assert.ok(!keys.includes("e1|m1"), `repeat paired, seed ${seed}`);
  }
});

test("history older than the lookback is allowed again", () => {
  const history = [{ host_id: "m1", visitor_id: "s1", cycles_ago: 2 }];
  const r = generatePairings(
    { school_id: "x", variant: "ADMIN_ASSIGNED", admin_overrides: [{ host_id: "m1", visitor_id: "s1" }], exclude_previous_cycles_count: 2 },
    roster, [], history
  );
  assert.equal(r.pairs.length, 1);
  assert.equal(r.rejected.length, 0);
});

test("ADMIN_ASSIGNED validates overrides and pairs nobody else", () => {
  const r = generatePairings(
    {
      school_id: "x",
      variant: "ADMIN_ASSIGNED",
      admin_overrides: [
        { host_id: "m1", visitor_id: "s1" },
        { host_id: "m2", visitor_id: "s2" },
        { host_id: "m1", visitor_id: "e1" },
        { host_id: "e2", visitor_id: "nobody" },
      ],
    },
    roster,
    [{ teacher_a: "s2", teacher_b: "m2" }],
    []
  );
  assert.deepEqual(r.pairs.map(pairKey), ["m1|s1"]);
  assert.deepEqual(r.rejected.map((x) => x.reason), ["conflict", "already_assigned", "not_in_roster"]);
  assert.equal(r.unassigned.length, 4);
  assert.ok(r.unassigned.every((u) => u.reason === "not_assigned_by_admin"));
});

test("TEACHER_REQUESTED: mutual first, then single-sided, then the rest", () => {
  const r = generatePairings(
    {
      school_id: "x",
      variant: "TEACHER_REQUESTED",
      seed: 7,
      requested_pairs: [
        { requester_id: "e1", target_id: "s1" }, // single-sided, but s1 is taken by the mutual pair below
        { requester_id: "m1", target_id: "s1" },
        { requester_id: "s1", target_id: "m1" },
        { requester_id: "e2", target_id: "m2" },
      ],
    },
    roster, [], []
  );
  const bySource = Object.fromEntries(r.pairs.map((p) => [pairKey(p), p.source]));
  assert.equal(bySource["m1|s1"], "mutual_request");
  assert.equal(bySource["e2|m2"], "single_request");
  // The requester visits the teacher they asked for.
  const single = r.pairs.find((p) => p.source === "single_request")!;
  assert.equal(single.visitor_id, "e2");
  assert.deepEqual(r.rejected, [{ kind: "request", a: "e1", b: "s1", reason: "already_assigned" }]);
  assert.equal(r.pairs.length, 3);
  assert.equal(r.admin_summary.pairs_by_source.randomized, 1);
});

test("an odd roster leaves one teacher, with a reason", () => {
  const r = generatePairings({ school_id: "x", variant: "RANDOMIZED", seed: 3 }, roster.slice(0, 5), [], []);
  assert.equal(r.pairs.length, 2);
  assert.equal(r.unassigned.length, 1);
  assert.equal(r.unassigned[0].reason, "odd_count");
});

test("the admin summary holds counts only, no ids or names", () => {
  const r = generatePairings({ school_id: "x", variant: "RANDOMIZED", seed: 1 }, roster, [], []);
  const text = JSON.stringify(r.admin_summary);
  for (const t of roster) assert.ok(!text.includes(`"${t.id}"`));
  assert.equal(r.admin_summary.participation_rate, 1);
});

test("the same seed gives the same pairs", () => {
  const a = generatePairings({ school_id: "x", variant: "RANDOMIZED", seed: 42 }, roster, [], []);
  const b = generatePairings({ school_id: "x", variant: "RANDOMIZED", seed: 42 }, roster, [], []);
  assert.deepEqual(a.pairs, b.pairs);
});

test("uneven departments still get the most cross-department pairs possible", () => {
  const big = [T("m1", "Math", []), T("m2", "Math", []), T("m3", "Math", []), T("m4", "Math", []), T("s1", "Science", []), T("s2", "Science", [])];
  for (let seed = 1; seed <= 500; seed++) {
    const r = generatePairings({ school_id: "x", variant: "RANDOMIZED", seed }, big, [], []);
    assert.equal(r.pairs.length, 3);
    assert.equal(r.admin_summary.cross_department_pairs, 2, `seed ${seed}`);
  }
});
