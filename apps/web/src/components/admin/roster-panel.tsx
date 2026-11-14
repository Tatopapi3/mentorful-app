"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { parseRosterCsv, type RosterParse } from "@/lib/roster/csv";
import { addToRoster, removeFromRoster } from "@/lib/roster/actions";

export type RosterPerson = { id: string; name: string; email: string; department: string; signedIn: boolean };

const line = "1px solid var(--ev-line, #d9d3c5)";

/**
 * The school lead's roster: paste or upload a list, check it, add it, and see who has signed in. Rows are checked here for
 * a clear preview and checked again by the database. Only a teacher who has not signed in can be removed.
 */
export default function RosterPanel({ people }: { people: RosterPerson[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<RosterParse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<{ row: number; email: string; reason: string }[]>([]);
  const [pending, start] = useTransition();

  function check(value: string) {
    setText(value);
    setMessage(null);
    setSkipped([]);
    setParsed(value.trim() ? parseRosterCsv(value) : null);
  }

  async function onFile(file: File | undefined) {
    if (file) check(await file.text());
  }

  function add() {
    if (!parsed || parsed.rows.length === 0) return;
    setMessage(null);
    start(async () => {
      const r = await addToRoster(parsed.rows);
      if (!r.ok) return setMessage(r.message);
      setSkipped(r.skipped);
      setMessage(
        r.added > 0
          ? `Added ${r.added} ${r.added === 1 ? "teacher" : "teachers"}.${r.skipped.length ? ` ${r.skipped.length} could not be added (below).` : ""}`
          : "Nobody was added (see below)."
      );
      setText("");
      setParsed(null);
      router.refresh();
    });
  }

  function remove(p: RosterPerson) {
    if (!window.confirm(`Remove ${p.name} from the roster? They have not signed in yet.`)) return;
    setMessage(null);
    start(async () => {
      const r = await removeFromRoster(p.id);
      setMessage(r.ok ? `${p.name} was removed.` : r.message);
      if (r.ok) router.refresh();
    });
  }

  const waiting = people.filter((p) => !p.signedIn).length;

  return (
    <div>
      <p className="ev-muted" style={{ margin: "0 0 10px" }}>
        One teacher per line: first name, last name, email, department. A header row works too (first name, last name, email, department),
        and so does a column pasted from a spreadsheet or a saved .csv file. Up to 500 at a time.
      </p>
      <label htmlFor="roster-text" className="ev-muted">Teachers to add</label>
      <textarea
        id="roster-text"
        value={text}
        onChange={(e) => check(e.target.value)}
        rows={6}
        placeholder={"Ada, Lovelace, ada@yourschool.org, Math\nAlan, Turing, alan@yourschool.org, Science"}
        style={{ width: "100%", marginTop: 6, fontFamily: "ui-monospace, monospace", fontSize: 14 }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
        <label className="ev-btn sm">
          Choose a .csv file
          <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => onFile(e.target.files?.[0])} style={{ display: "none" }} />
        </label>
        <button type="button" className="ev-btn sm primary" onClick={add} disabled={pending || !parsed || parsed.rows.length === 0}>
          {pending ? "Working…" : parsed && parsed.rows.length > 0 ? `Add ${parsed.rows.length} ${parsed.rows.length === 1 ? "teacher" : "teachers"}` : "Add teachers"}
        </button>
      </div>

      {parsed && (
        <div style={{ marginTop: 12 }} aria-live="polite">
          <p style={{ margin: "0 0 6px" }}>
            <strong>{parsed.rows.length}</strong> ready to add{parsed.problems.length > 0 ? `, ${parsed.problems.length} need fixing` : ""}.
          </p>
          {parsed.problems.length > 0 && (
            <ul style={{ margin: "0 0 6px", paddingLeft: 18 }}>
              {parsed.problems.slice(0, 20).map((p) => (
                <li key={`${p.line}-${p.message}`}>Line {p.line}: {p.message}</li>
              ))}
              {parsed.problems.length > 20 && <li>and {parsed.problems.length - 20} more.</li>}
            </ul>
          )}
        </div>
      )}

      {message && (
        <p role="status" style={{ margin: "12px 0 0" }}>
          {message}
        </p>
      )}
      {skipped.length > 0 && (
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {skipped.map((s) => (
            <li key={`${s.row}-${s.email}`}>Row {s.row}{s.email ? ` (${s.email})` : ""}: {s.reason}.</li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 22, paddingTop: 14, borderTop: line }}>
        <p className="ev-muted" style={{ margin: "0 0 10px" }}>
          {waiting > 0 ? `${waiting} ${waiting === 1 ? "has" : "have"} not signed in yet. ` : ""}This list shows names, email and whether each person has signed in. It never shows
          what a teacher writes or does.
        </p>
        {people.length === 0 ? (
          <p className="ev-muted" style={{ margin: 0 }}>Nobody is on the roster yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: line }}>
                  <th scope="col" style={{ padding: "6px 8px" }}>Name</th>
                  <th scope="col" style={{ padding: "6px 8px" }}>Email</th>
                  <th scope="col" style={{ padding: "6px 8px" }}>Department</th>
                  <th scope="col" style={{ padding: "6px 8px" }}>Status</th>
                  <th scope="col" style={{ padding: "6px 8px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} style={{ borderBottom: line }}>
                    <td style={{ padding: "6px 8px" }}>{p.name}</td>
                    <td style={{ padding: "6px 8px" }}>{p.email || "no email"}</td>
                    <td style={{ padding: "6px 8px" }}>{p.department}</td>
                    <td style={{ padding: "6px 8px" }}>{p.signedIn ? "Signed in" : p.email ? "Waiting to sign in" : "Needs an email"}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {!p.signedIn && (
                        <button type="button" className="ev-btn sm" onClick={() => remove(p)} disabled={pending}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
