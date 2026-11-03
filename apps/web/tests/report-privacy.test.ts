import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MIN_RESPONDENTS, loadFromAggregateJson } from "@/lib/report/data";
import { holdText } from "@/lib/report/gates";
import { reportAccess } from "@/lib/report/access";
import { DIMENSIONS, aggregatesFromRows, computeReportStats, statsFromAggregates, type ReportItem, type ResponseRow } from "@/lib/report/stats";

// The instrument: 26 active items, 6 / 9 / 6 / 5 per dimension, as in the database.
const PER_DIM: Record<(typeof DIMENSIONS)[number], number> = { structural: 6, relational: 9, cognitive: 6, efficacy: 5 };
const items: ReportItem[] = [];
for (const d of DIMENSIONS) for (let i = 0; i < PER_DIM[d]; i++) items.push({ id: `${d}-${i}`, position: items.length + 1, dimension: d, reverse: i % 4 === 3 });

/** A small deterministic generator, so the numbers are the same on every machine. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeRows(n: number, seed = 7): ResponseRow[] {
  const r = rng(seed);
  const rows: ResponseRow[] = [];
  for (let p = 0; p < n; p++) {
    const mood = r() * 3; // a shared mood makes the four dimensions correlate, like real answers
    for (const it of items) {
      const v = Math.max(1, Math.min(6, Math.round(2 + mood + (r() - 0.5) * 2.5)));
      rows.push({ respondent: `r${p}`, item_id: it.id, scored_value: v });
    }
  }
  return rows;
}

/** What culture_scan_aggregates returns for these rows, built from the rows with the same formulas. */
function asDatabaseJson(rows: ResponseRow[], extra: Record<string, unknown> = {}) {
  const a = aggregatesFromRows(rows, items);
  return { status: "ok", n: a.n, dropped: a.dropped, demo_n: 0, means: a.means, sds: a.sds, correlation: a.correlation, ...extra };
}

describe("the report from the database's aggregates alone", () => {
  const rows = makeRows(40);
  const direct = computeReportStats(rows, items);

  it("gives exactly the same report as adding up the raw answers in the app", () => {
    const load = loadFromAggregateJson(asDatabaseJson(rows), items, "s1");
    expect(load.status).toBe("ok");
    if (load.status !== "ok") return;
    expect(load.stats).toEqual(direct);
    expect(load.demoN).toBe(0);
    expect(load.includesSynthetic).toBe(false);
  });

  it("builds the report from the aggregates without ever seeing a row", () => {
    const a = aggregatesFromRows(rows, items);
    expect(statsFromAggregates(a, items).dimensions.efficacy.mean).toBeCloseTo(direct.dimensions.efficacy.mean, 12);
    expect(Object.keys(a).sort()).toEqual(["correlation", "dropped", "means", "n", "sds"]);
  });

  it("labels demo respondents as demo", () => {
    const load = loadFromAggregateJson(asDatabaseJson(rows, { demo_n: 34 }), items, "s1");
    expect(load.status === "ok" && load.demoN).toBe(34);
    expect(load.status === "ok" && load.includesSynthetic).toBe(true);
  });
});

describe("what the page is told when results are held back", () => {
  it("passes through 'not-closed' with the close date, and 'no-data'", () => {
    expect(loadFromAggregateJson({ status: "not-closed", closes_at: null }, items, "s1")).toEqual({ status: "not-closed", surveyId: "s1", closesAt: null });
    expect(loadFromAggregateJson({ status: "not-closed", closes_at: "2026-12-01T00:00:00Z" }, items, "s1")).toEqual({
      status: "not-closed",
      surveyId: "s1",
      closesAt: "2026-12-01T00:00:00Z",
    });
    expect(loadFromAggregateJson({ status: "no-data" }, items, "s1")).toEqual({ status: "no-data", surveyId: "s1" });
  });

  it("passes through each below-floor reason", () => {
    expect(loadFromAggregateJson({ status: "below-floor", reason: "floor", n: 3, floor: 5 }, items, "s1")).toEqual({ status: "below-floor", surveyId: "s1", n: 3, floor: 5, reason: "floor" });
    expect(loadFromAggregateJson({ status: "below-floor", reason: "participation", n: 20, floor: 30 }, items, "s1")).toMatchObject({ reason: "participation", floor: 30 });
    expect(loadFromAggregateJson({ status: "below-floor", reason: "no-headcount", n: 20, floor: 0 }, items, "s1")).toMatchObject({ reason: "no-headcount" });
  });

  it("never builds a half report from an answer it does not understand", () => {
    const ok = asDatabaseJson(makeRows(10));
    const garbage: unknown[] = [
      null,
      undefined,
      "ok",
      {},
      { status: "surprise" },
      { ...ok, means: undefined },
      { ...ok, sds: { ...ok.sds, efficacy: null } },
      { ...ok, means: { ...ok.means, structural: Number.NaN } },
      { ...ok, correlation: ok.correlation.slice(1) },
      { ...ok, correlation: ok.correlation.map((row) => row.slice(1)) },
      { ...ok, n: "10" },
    ];
    for (const g of garbage) expect(loadFromAggregateJson(g, items, "s1").status).toBe("misconfigured");
  });

  it("holds the report to at least five complete respondents", () => {
    expect(MIN_RESPONDENTS).toBe(5);
  });

  it("explains a closed-survey hold in words the school lead can act on", () => {
    expect(holdText("not-closed").title).toMatch(/released when the survey closes/i);
    expect(holdText(null).title).toMatch(/no culture scan results/i);
    expect(holdText("below-floor").title).toMatch(/not enough responses/i);
  });
});

describe("who may open the report", () => {
  const school = "a0000000-0000-0000-0000-000000000001";
  it("lets the administrator of the Culture Scan's school in", () => {
    expect(reportAccess(school, school)).toBe("ok");
  });
  it("refuses a signed-in person who is not an administrator", () => {
    expect(reportAccess(null, school)).toBe("not-admin");
  });
  it("refuses an administrator of another school", () => {
    expect(reportAccess("b0000000-0000-0000-0000-000000000002", school)).toBe("wrong-school");
  });
});

describe("the report page and the landing page are closed to the public", () => {
  const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
  it("the report page asks for a signed-in administrator and sends the signed-out to sign in", () => {
    const page = read("app/report/page.tsx");
    expect(page).toContain('requireAdmin("/report")');
    expect(page).toContain("loadReportStats(admin!.supabase)");
    expect(read("lib/admin/require.ts")).toContain("/login?next=");
  });
  it("the landing page no longer offers the report to people who are not signed in", () => {
    const home = read("app/page.tsx");
    const open = home.slice(home.indexOf("const OPEN"), home.indexOf("const SIGNED_IN"));
    expect(open).not.toContain("/report");
    expect(open).toContain("/survey");
  });
  it("the survey's thank-you page no longer shows an invented progress count", () => {
    const done = read("app/survey/complete/page.tsx");
    expect(done).not.toContain("FACULTY_PROGRESS");
    expect(done).not.toMatch(/\b32 of 50\b/);
  });
  it("nothing outside the report loader reads the service key", () => {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const hits = execSync(`grep -rln SUPABASE_SERVICE_ROLE_KEY src || true`, { cwd: new URL("..", import.meta.url).pathname }).toString().trim().split("\n").filter(Boolean);
    expect(hits).toEqual(["src/lib/report/data.ts"]);
  });
});
