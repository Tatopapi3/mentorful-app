import { DIMENSIONS, DIMENSION_LABEL } from "@/lib/report/stats";
import { demoCount, respondentsText } from "@/lib/report/gates";
import { DOMAIN_LABEL } from "@/lib/domains";
import { participationRates } from "./participation";
import { facultyOrbit } from "./faculty-orbit";
import { coverage, departmentMatrix } from "./network";
import { cellText } from "./overview-floor";
import type { AdminSnapshot, Facts } from "./facts";

export function csvEscape(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The school-wide results as a spreadsheet: aggregates only. Survey answers are anonymous and carry no
 * department, so there is nothing here to break down by group and no row that points at a person.
 */
export type Row = (string | number | null)[];

export function resultsCsv(snap: AdminSnapshot, facts: Facts): string {
  return toCsv(resultsRows(snap, facts));
}

const toCsv = (rows: Row[]) => rows.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";

/** The results as rows (header first), shared by the CSV and the Excel file so they always say the same thing. */
export function resultsRows(snap: AdminSnapshot, facts: Facts): Row[] {
  const rows: Row[] = [["section", "metric", "value"]];
  const add = (section: string, metric: string, value: string | number | null) => rows.push([section, metric, value]);

  add("school", "School", snap.school.name);
  add("school", "Cycle", snap.cycle?.name ?? "");
  add("school", "Faculty", facts.faculty);

  if (snap.scan) {
    add("culture scan", "Respondents", snap.scan.n);
    add("culture scan", "Completion (%)", facts.scan?.completionPct ?? null);
    add("culture scan", "CTE score (Efficacy mean, out of 6)", snap.scan.means.efficacy.toFixed(2));
    for (const d of DIMENSIONS) {
      add("dimension average", DIMENSION_LABEL[d], snap.scan.means[d].toFixed(2));
      add("dimension 95% half-width", DIMENSION_LABEL[d], snap.scan.ci[d].toFixed(2));
    }
    if (snap.stats) {
      for (let i = 0; i < DIMENSIONS.length; i++)
        for (let j = i + 1; j < DIMENSIONS.length; j++) add("partial correlation", `${DIMENSION_LABEL[DIMENSIONS[i]]} and ${DIMENSION_LABEL[DIMENSIONS[j]]}`, snap.stats.partial[i][j].toFixed(2));
      add("note", "Partial correlations", `Each is accurate to about plus or minus ${(1 / Math.sqrt(snap.scan.n)).toFixed(2)} with ${snap.scan.n} respondents.`);
    }
    if (demoCount(snap.scan) > 0) add("note", "Data", `Includes synthetic demo data: ${respondentsText(snap.scan)}.`);
  }

  add("pairs", "Approved pairs", facts.pairCount);
  add("pairs", "Teachers with a partner (%)", facts.pairedPct);
  add("pairs", "Pairs that cross departments (%)", facts.crossPct);
  add("pairs", "Pairing requests waiting", facts.pendingRequests);
  add("conversations", "Logged conversations", facts.conversations);
  for (const [d, n] of Object.entries(facts.domainCounts).sort((a, b) => b[1] - a[1])) add("pairs by domain", DOMAIN_LABEL[d] ?? d, n);

  if (snap.participation) {
    const r = participationRates(snap.participation);
    add("participation", "Pairs with a conversation (%)", r.conversationPct);
    add("participation", "Pairs with a debrief (%)", r.debriefPct);
    add("participation", "Pairs fully complete (%)", r.completePct);
    add("participation", "Teachers active (%)", r.activePct);
    for (const d of r.departments) add("active teachers by department (%)", d.department, d.pct);
  }
  return rows;
}

/**
 * The picture the faculty map shows, as department totals: how many teachers and pairs each department has and how far
 * its pairs reach. The same figures as the "Faculty connection" slide in the leadership deck. Departments under 5
 * teachers are left out, a pair count under 5 is withheld, and no row names a person.
 */
export function connectionCsv(snap: AdminSnapshot, prev: AdminSnapshot | null): string {
  const { table, notes } = connectionRows(snap, prev);
  return toCsv([...table, [], ...notes]);
}

/** The faculty connection as a department table plus a few facts about the school, shared by the CSV and the Excel file. */
export function connectionRows(snap: AdminSnapshot, prev: AdminSnapshot | null): { table: Row[]; notes: Row[] } {
  const m = departmentMatrix(snap);
  const cov = coverage(m);
  const orbit = facultyOrbit(snap, snap.participation ?? null, prev);
  const rows: Row[] = [["department", "teachers", "pairs that cross departments", "pairs inside the department", "departments reached", "departments possible", "pairs that have talked (%)"]];
  for (const p of orbit.planets) {
    rows.push([p.dept, p.teachers, cellText(p.across >= 5 ? p.across : null), cellText(p.within >= 5 ? p.within : null), p.reach, p.possible, p.activePct === null ? "n/a" : p.activePct]);
  }
  const notes: Row[] = [
    ["school", snap.school.name],
    ["cycle", snap.cycle?.name ?? ""],
    ["department connections that exist", cov.connected],
    ["department connections possible", cov.possible],
  ];
  if (m.omitted.length > 0) notes.push(["note", `${m.omitted.length} department${m.omitted.length === 1 ? "" : "s"} with fewer than 5 teachers left out to protect privacy`]);
  return { table: rows, notes };
}
