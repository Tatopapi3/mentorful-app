"use client";

import { useState, useTransition } from "react";
import { closeCultureScan, makeSurveyCodes } from "@/lib/report/codes-actions";

/**
 * The school lead's two controls for the Culture Scan: make one-time codes to hand out, and close the survey so the
 * results are released. Codes are shown once, on this screen, and then they are gone: the database keeps only a scrambled
 * copy, so nobody (including us) can look a code up later or tell whose it was.
 */
export default function SurveyCodesPanel({ open }: { open: boolean }) {
  const [count, setCount] = useState(10);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [closed, setClosed] = useState(!open);

  function make() {
    setMessage(null);
    start(async () => {
      const r = await makeSurveyCodes(count);
      if (r.ok) setCodes(r.codes);
      else setMessage(r.message);
    });
  }

  function close() {
    if (!window.confirm("Close the survey now? Teachers can no longer submit, and the results are released to you. This can't be undone.")) return;
    setMessage(null);
    start(async () => {
      const r = await closeCultureScan();
      if (r.ok) {
        setClosed(true);
        setCodes(null);
        setMessage("The survey is closed. The results are released: reload Pulse or Insights to see them.");
      } else setMessage(r.message);
    });
  }

  const text = (codes ?? []).join("\n");

  return (
    <div>
      {!closed && (
        <>
          <p className="ev-muted" style={{ margin: "0 0 10px" }}>
            Each teacher needs one code to take the scan. A code works once. Hand them out so that nobody can tell which code went to whom (print
            the sheet and cut it up, or send each one in its own message). Codes are shown once, here.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label htmlFor="code-count" className="ev-muted">How many codes</label>
            <input
              id="code-count"
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              style={{ width: 90 }}
            />
            <button type="button" className="ev-btn sm primary" onClick={make} disabled={pending}>
              {pending ? "Working…" : "Make codes"}
            </button>
          </div>
        </>
      )}

      {codes && codes.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8, fontFamily: "ui-monospace, monospace", fontSize: 14 }}
            aria-label="One-time codes"
          >
            {codes.map((c) => (
              <span key={c} className="ev-badge" style={{ justifyContent: "center", letterSpacing: "0.06em" }}>
                {c}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" className="ev-btn sm" onClick={() => navigator.clipboard?.writeText(text)}>
              Copy all
            </button>
            <a className="ev-btn sm" href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download="mentorful-survey-codes.txt">
              Download as a text file
            </a>
            <button type="button" className="ev-btn sm" onClick={() => window.print()}>
              Print
            </button>
          </div>
          <p className="ev-muted" style={{ margin: "8px 0 0" }}>
            These disappear when you leave this page and cannot be shown again. Make more any time.
          </p>
        </div>
      )}

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--ev-line, #d9d3c5)" }}>
        {closed ? (
          <p className="ev-muted" style={{ margin: 0 }}>
            <strong>The survey is closed.</strong> Results are released.
          </p>
        ) : (
          <>
            <p className="ev-muted" style={{ margin: "0 0 8px" }}>
              Results stay hidden while the survey is open, so nobody can read an early answer as one person&apos;s view. Close the survey when
              enough teachers have answered, and the school-wide results appear.
            </p>
            <button type="button" className="ev-btn sm" onClick={close} disabled={pending}>
              Close the survey and release results
            </button>
          </>
        )}
      </div>

      {message && (
        <p role="status" style={{ margin: "12px 0 0" }}>
          {message}
        </p>
      )}
    </div>
  );
}
