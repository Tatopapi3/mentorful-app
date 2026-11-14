import { describe, expect, it } from "vitest";
import { claimProfile } from "@/lib/roster/claim";
import { MAX_ROSTER_ROWS, parseRosterCsv } from "@/lib/roster/csv";

describe("parseRosterCsv", () => {
  it("reads rows without a header as first name, last name, email, department", () => {
    const r = parseRosterCsv("Ada, Lovelace, ADA@school.org, Math\nAlan,Turing,alan@school.org,Science\n");
    expect(r.problems).toEqual([]);
    expect(r.rows).toEqual([
      { first_name: "Ada", last_name: "Lovelace", email: "ada@school.org", department: "Math" },
      { first_name: "Alan", last_name: "Turing", email: "alan@school.org", department: "Science" },
    ]);
  });

  it("finds columns by header, in any order and spelling", () => {
    const r = parseRosterCsv("Email Address,Department,Last Name,First Name\nada@school.org,Math,Lovelace,Ada");
    expect(r.rows).toEqual([{ first_name: "Ada", last_name: "Lovelace", email: "ada@school.org", department: "Math" }]);
  });

  it("splits a single name column at the last space", () => {
    const r = parseRosterCsv("name,email\nMary Ann Evans,mae@school.org\nCher,cher@school.org");
    expect(r.rows[0]).toMatchObject({ first_name: "Mary Ann", last_name: "Evans" });
    expect(r.problems).toEqual([{ line: 3, message: "Both a first name and a last name are needed." }]);
  });

  it("handles quotes, commas inside quotes, \\r\\n, a byte-order mark and tabs pasted from a spreadsheet", () => {
    const quoted = parseRosterCsv('﻿first,last,email,dept\r\n"Ada","Love, lace",ada@school.org,"Math ""Honors"""\r\n');
    expect(quoted.rows).toEqual([{ first_name: "Ada", last_name: "Love, lace", email: "ada@school.org", department: 'Math "Honors"' }]);
    const tabs = parseRosterCsv("Ada\tLovelace\tada@school.org\tMath");
    expect(tabs.rows).toHaveLength(1);
    expect(tabs.rows[0].email).toBe("ada@school.org");
  });

  it("reports a bad row with its line number and still returns the good ones", () => {
    const r = parseRosterCsv("first,last,email\nAda,Lovelace,ada@school.org\nBad,Email,not-an-email\n,NoFirst,x@school.org\nAda,Again,ada@school.org");
    expect(r.rows.map((x) => x.email)).toEqual(["ada@school.org"]);
    expect(r.problems.map((p) => p.line)).toEqual([3, 4, 5]);
    expect(r.problems[0].message).toMatch(/not a valid email/);
    expect(r.problems[2].message).toMatch(/more than once/);
  });

  it("says so when there is nothing to add, when the header is missing a name column, and when the list is too long", () => {
    expect(parseRosterCsv("  \n \n").rows).toEqual([]);
    expect(parseRosterCsv("   ").problems[0].message).toMatch(/Nothing to add/);
    expect(parseRosterCsv("email,department\na@b.org,Math").problems[0].message).toMatch(/first name and a last name/);
    const big = Array.from({ length: MAX_ROSTER_ROWS + 1 }, (_, i) => `N,${i},n${i}@school.org`).join("\n");
    const r = parseRosterCsv(big);
    expect(r.rows).toEqual([]);
    expect(r.problems[0].message).toMatch(/up to 500/i);
  });
});

describe("claimProfile", () => {
  it("is true only when the database returns the id of a linked profile", async () => {
    expect(await claimProfile({ rpc: async () => ({ data: "0b4e1b1e-0000-4000-8000-000000000001", error: null }) })).toBe(true);
    expect(await claimProfile({ rpc: async () => ({ data: null, error: null }) })).toBe(false);
  });

  it("never throws: a database without script 026, or a network failure, just means nothing was claimed", async () => {
    expect(await claimProfile({ rpc: async () => ({ data: null, error: { code: "PGRST202" } }) })).toBe(false);
    expect(await claimProfile({ rpc: async () => ({ data: "x", error: { message: "boom" } }) })).toBe(false);
    expect(
      await claimProfile({
        rpc: () => {
          throw new Error("offline");
        },
      })
    ).toBe(false);
  });
});
