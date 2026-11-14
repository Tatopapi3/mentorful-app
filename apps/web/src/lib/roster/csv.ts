/**
 * Reads a roster the school lead pastes or uploads, as comma-separated text, into rows for `roster_add` (script 026).
 * Pure, so it is tested directly (tests/roster-csv.test.ts). It only reads and checks the shape; the database checks every row
 * again, because the browser is not the last line of defence.
 *
 * Accepted: a header row naming the columns (first name, last name, email, department, in any order and spelling such as
 * "First Name" or "first_name"; or one "name" column that is split at the last space), or no header at all, in which case the
 * columns are first name, last name, email, department. Quoted cells may hold commas and doubled quotes.
 */
export type RosterRow = { first_name: string; last_name: string; email: string; department: string };
export type RosterProblem = { line: number; message: string };
export type RosterParse = { rows: RosterRow[]; problems: RosterProblem[] };

export const MAX_ROSTER_ROWS = 500;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Splits text into rows of cells: handles quotes, doubled quotes, commas and tabs inside quotes, \r\n and a leading byte-order mark. */
function cells(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  // A spreadsheet pasted into a text box separates cells with tabs; a saved .csv uses commas. Pick by the first line.
  const first = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = first.includes("\t") && !first.includes(",") ? "\t" : ",";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "") || out.length === 0) out.push(row);
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
type Field = "first" | "last" | "name" | "email" | "department";
const HEADER: Record<string, Field> = {
  first: "first", firstname: "first", givenname: "first",
  last: "last", lastname: "last", surname: "last", familyname: "last",
  name: "name", fullname: "name",
  email: "email", emailaddress: "email", mail: "email",
  department: "department", dept: "department", subject: "department",
};

export function parseRosterCsv(text: string): RosterParse {
  const all = cells(text).map((r, i) => ({ r, line: i + 1 })).filter((x) => x.r.some((c) => c.trim() !== ""));
  if (all.length === 0) return { rows: [], problems: [{ line: 1, message: "Nothing to add: paste at least one teacher." }] };

  // A header row is one where some cell is "email" (or a spelling of it).
  const head = all[0].r.map((c) => HEADER[norm(c)]);
  const hasHeader = head.includes("email");
  const index: Partial<Record<Field, number>> = {};
  if (hasHeader) head.forEach((f, i) => f && index[f] === undefined && (index[f] = i));
  else Object.assign(index, { first: 0, last: 1, email: 2, department: 3 });
  const body = hasHeader ? all.slice(1) : all;

  const rows: RosterRow[] = [];
  const problems: RosterProblem[] = [];
  if (hasHeader && index.name === undefined && (index.first === undefined || index.last === undefined)) {
    return { rows, problems: [{ line: all[0].line, message: "The header needs a first name and a last name column (or one name column), and an email column." }] };
  }
  const seen = new Set<string>();
  for (const { r, line } of body) {
    const get = (f: Field) => (index[f] === undefined ? "" : (r[index[f]!] ?? "").trim());
    let first = get("first");
    let last = get("last");
    if (index.name !== undefined && !first && !last) {
      const full = get("name");
      const cut = full.lastIndexOf(" ");
      first = cut > 0 ? full.slice(0, cut).trim() : full;
      last = cut > 0 ? full.slice(cut + 1).trim() : "";
    }
    const email = get("email").toLowerCase();
    const department = get("department");
    if (!first || !last) problems.push({ line, message: "Both a first name and a last name are needed." });
    else if (!EMAIL.test(email) || email.length > 254) problems.push({ line, message: `"${email || "(empty)"}" is not a valid email.` });
    else if (first.length > 80 || last.length > 80 || department.length > 80) problems.push({ line, message: "A name or department is longer than 80 characters." });
    else if (seen.has(email)) problems.push({ line, message: `${email} appears more than once in this list.` });
    else {
      seen.add(email);
      rows.push({ first_name: first, last_name: last, email, department });
    }
  }
  if (rows.length > MAX_ROSTER_ROWS) return { rows: [], problems: [{ line: 1, message: `Add up to ${MAX_ROSTER_ROWS} teachers at a time; this list has ${rows.length}.` }] };
  return { rows, problems };
}
