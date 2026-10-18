import { describe, expect, it } from "vitest";
import { CONCERN_DOMAINS } from "@/lib/domains.ts";
import { DIMENSIONS } from "@/lib/report/stats.ts";
import { read, sqlCode, stripTsComments, walk } from "./helpers";

// Rules from Mentorful's invariants brief that can be checked by reading the code and the SQL
// scripts, with no database. The checks that need a database are in tests/db/.

const appFiles = [...walk("src", /\.(ts|tsx)$/)];
const stripped = (f: string) => stripTsComments(read(f));
const policiesOn = (sql: string, table: string) =>
  [...sql.matchAll(/create policy[\s\S]*?;/gi)].map((m) => m[0]).filter((p) => new RegExp(`on\\s+(public\\.)?${table}\\b`, "i").test(p));

describe("Invariant: the service key stays out of pages and the browser", () => {
  const usesKey = appFiles.filter((f) => /SUPABASE_SERVICE_ROLE_KEY/.test(stripped(f)));

  it("is read in one place only, the report engine", () => {
    expect(usesKey).toEqual(["src/lib/report/data.ts"]);
  });

  it("is never given a NEXT_PUBLIC_ name, which would put it in the browser bundle", () => {
    for (const f of [...appFiles, "next.config.ts"]) expect(read(f)).not.toMatch(/NEXT_PUBLIC_[A-Z_]*SERVICE/);
  });

  it("the report engine refuses to load in a browser, and nothing that imports it is a client component", () => {
    expect(read("src/lib/report/data.ts")).toMatch(/typeof window !== "undefined"[\s\S]*throw/);
    const importers = appFiles.filter((f) => /report\/data(\.ts)?["']/.test(stripped(f)));
    expect(importers.length).toBeGreaterThan(0);
    for (const f of importers) expect(read(f)).not.toMatch(/^\s*["']use client["']/m);
  });

  it("the faculty map reads on the signed-in session, so row-level security scopes it to the reader's school", () => {
    const map = stripped("src/app/admin/map/page.tsx");
    expect(map).not.toMatch(/SERVICE_ROLE|serviceClient/);
    expect(map).toMatch(/lib\/supabase\/server/);
  });
});

describe("Invariant: the report is for the signed-in leader's own school, and never blends demo data", () => {
  it("the report page requires a signed-in admin with a school", () => {
    const page = stripped("src/app/report/page.tsx");
    expect(page).toMatch(/getUser\(\)/);
    expect(page).toMatch(/role !== "admin"/);
    expect(page).toMatch(/redirect\("\/login"\)/);
  });

  it("the school comes from the reader's own profile, never from the URL or an environment variable", () => {
    const page = stripped("src/app/report/page.tsx");
    expect(page).toMatch(/me\.school_id/);
    expect(page).not.toMatch(/searchParams|params\./);
    expect(page).not.toMatch(/CULTURE_SCAN_SCHOOL_ID/);
  });

  it("the report engine only reads the given school's responses and excludes synthetic rows unless asked", () => {
    const data = stripped("src/lib/report/data.ts");
    expect(data).toMatch(/\.eq\("school_id", schoolId\)/);
    expect(data).toMatch(/includeSynthetic \?\? false/);
    expect(data).toMatch(/if \(!includeSynthetic\) q = q\.eq\("synthetic", false\)/);
  });

  it("only the public sample route asks for synthetic data, and it is the sandbox school", () => {
    const callers = appFiles.filter((f) => /includeSynthetic:\s*true/.test(stripped(f)));
    expect(callers).toEqual(["src/app/sample-report/page.tsx"]);
    expect(stripped("src/app/sample-report/page.tsx")).toMatch(/CULTURE_SCAN_SCHOOL_ID/);
  });

  it("the landing page's report card points at the sample, not the real report", () => {
    expect(read("src/app/page.tsx")).toMatch(/href: "\/sample-report"/);
    expect(read("src/app/page.tsx")).not.toMatch(/href: "\/report"/);
  });
});

describe("Invariant: the two axes never merge", () => {
  it("the dimension values and the domain values are textually disjoint, even ignoring case", () => {
    const dims = new Set<string>(DIMENSIONS.map((d) => d.toLowerCase()));
    for (const d of CONCERN_DOMAINS) expect(dims.has(d.toLowerCase())).toBe(false);
  });

  it("the domains the code lists are all among the five fixed conversation domains", () => {
    const fixed = ["CLASSROOM", "PLANNING", "COMMUNICATION", "ASSESSMENT", "CELEBRATIONS"];
    for (const d of CONCERN_DOMAINS) expect(fixed).toContain(d);
  });

  it("no migration builds a shared lookup table that could hold both axes", () => {
    const sql = ["007_merge_neon_schema", "008_dimension_enum", "009_rls_merged_tables", "012_profile_schema_for_dashboards", "013_demo_enrichment"].map((n) => sqlCode(`scripts/${n}.sql`)).join("\n");
    expect(sql).not.toMatch(/create table[^;]*\b(taxonom|categor)/i);
  });

  it("a survey table never gets a domain column, and a conversation table never gets a dimension column", () => {
    const sql = readAllSql();
    expect(sql).not.toMatch(/alter table[^;]*(survey_items|surveys|survey_responses)[^;]*add column[^;]*\bdomain\b/i);
    expect(sql).not.toMatch(/alter table[^;]*(pairings|conversation_logs)[^;]*add column[^;]*\bdimension\b/i);
  });
});

describe("Invariant: conversations are private to the pair", () => {
  const sql = readAllSql();

  it("conversation_logs has no policy that grants an admin or a whole school read access", () => {
    const final = policiesOn(sqlCode("scripts/011_conversation_logs_pair_private.sql"), "conversation_logs").join("\n");
    expect(final).not.toMatch(/is_school_admin|is_admin|my_school_id|school_id/i);
    expect(final).toMatch(/host_id\s*=\s*public\.my_profile_id\(\)/);
  });

  it("migration 011 aborts if an admin read policy ever comes back", () => {
    expect(read("scripts/011_conversation_logs_pair_private.sql")).toMatch(/raise exception[\s\S]*is_school_admin/i);
  });

  it("admins see conversation counts through a function that hides cells under 5, never rows", () => {
    expect(sql).toMatch(/function public\.concern_domain_counts/i);
    expect(read("scripts/009_rls_merged_tables.sql")).toMatch(/MIN_CELL constant int := 5[\s\S]*count\(\*\) >= MIN_CELL then count\(\*\)::int else null/);
  });
});

describe("Invariant: survey answers cannot be read or traced", () => {
  it("survey_responses has no SELECT policy in any migration", () => {
    const policies = policiesOn(readAllSql(), "survey_responses");
    for (const p of policies) expect(p).not.toMatch(/for\s+(select|all)\b/i);
  });

  it("an authenticated insert must use a respondent id different from the user's own id", () => {
    expect(read("src/app/survey/page.tsx")).toMatch(/crypto\.randomUUID\(\)/);
  });
});

describe("Invariant: invitations don't read the auth table as the caller", () => {
  it("no invites policy reaches into auth.users directly; it goes through my_email()", () => {
    const invites = policiesOn(sqlCode("scripts/009_rls_merged_tables.sql"), "invites").join("\n");
    expect(invites).not.toMatch(/auth\.users/i);
    expect(invites).toMatch(/my_email\(\)/);
  });
});

// ---------------------------------------------------------------------------------------------
// Known gaps. Each test below describes the CORRECT behaviour, and is expected to fail today.
// `it.fails` keeps the suite green while the gap is open, and turns red the moment someone fixes
// it, which is the cue to delete the `.fails`. This list may only shrink.
// ---------------------------------------------------------------------------------------------
describe("Known gaps (expected to fail until fixed)", () => {
  it.fails("the code lists all five fixed conversation domains, including CELEBRATIONS", () => {
    expect([...CONCERN_DOMAINS]).toContain("CELEBRATIONS");
  });

  it.fails("the completion screen reads a real count, not an invented one", () => {
    expect(stripped("src/app/survey/complete/page.tsx")).not.toMatch(/finished:\s*32/);
  });

  it.fails("colleagues see a column-restricted view of profiles, not whole rows", () => {
    expect(readAllSql()).toMatch(/create (or replace )?view[^;]*(faculty_directory|colleagues)/i);
  });

  it.fails("the first sign-in attaches the account to the roster row with the same email", () => {
    expect(stripped("src/app/auth/callback/route.ts")).toMatch(/auth_user_id/);
  });

  it.fails("the score stored with a response is checked against the raw answer in the database, not trusted from the browser", () => {
    expect(readAllSql()).toMatch(/scored_value[\s\S]{0,200}(7\s*-\s*raw_value|check)/i);
  });
});

function readAllSql(): string {
  return walk("scripts", /\.sql$/).map((f) => sqlCode(f)).join("\n");
}
