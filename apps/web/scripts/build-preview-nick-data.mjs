// Turns Nick's database dump (db/mentorful_handoff.sql) into the rows the demo serves: src/lib/preview/nick-data.json.
// The demo then shows Nick's own sandbox school. Run it again if the dump changes:  node scripts/build-preview-nick-data.mjs
import { readFileSync, writeFileSync } from "node:fs";

const sql = readFileSync(new URL("../db/mentorful_handoff.sql", import.meta.url), "utf8");

// column types from the CREATE TABLE statements, so booleans, numbers and json come out as such
const types = {};
for (const m of sql.matchAll(/CREATE TABLE public\.(\w+) \(\n([\s\S]*?)\n\);/g)) {
  types[m[1]] = {};
  for (const line of m[2].split("\n")) {
    const c = line.match(/^\s+"?(\w+)"? ([a-z_. ]+?)(?: DEFAULT .*| NOT NULL.*)?,?$/);
    if (c && !/^(CONSTRAINT|PRIMARY|CHECK)/.test(c[1])) types[m[1]][c[1]] = c[2].trim();
  }
}

const unescape = (s) => s.replace(/\\(.)/g, (_, c) => ({ t: "\t", n: "\n", r: "\r", b: "\b", f: "\f", v: "\v" })[c] ?? c);
const convert = (raw, type) => {
  if (raw === "\\N") return null;
  const v = unescape(raw);
  if (type === "boolean") return v === "t";
  if (/^(integer|smallint|bigint|numeric|double precision|real)/.test(type)) return Number(v);
  if (type === "jsonb" || type === "json") return JSON.parse(v);
  return v;
};

const out = {};
for (const m of sql.matchAll(/COPY public\.(\w+) \(([^)]*)\) FROM stdin;\n([\s\S]*?)\n?\\\.\n/g)) {
  const [, table, cols, body] = m;
  const names = cols.split(",").map((c) => c.trim().replace(/"/g, ""));
  out[table] = body.split("\n").filter(Boolean).map((line) => {
    const f = line.split("\t");
    return Object.fromEntries(names.map((n, i) => [n, convert(f[i], types[table]?.[n] ?? "text")]));
  });
}
for (const t of ["schools", "profiles", "cycles", "pairings", "conversation_logs", "surveys", "survey_items", "survey_responses", "invites"]) out[t] ??= [];

writeFileSync(new URL("../src/lib/preview/nick-data.json", import.meta.url), JSON.stringify(out));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
