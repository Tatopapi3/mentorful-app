"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { GroupSummary } from "@/lib/admin/summaries";
import { monthLabel } from "@/lib/admin/trends";

/*
 * A department name you can click, and the side panel that opens. The panel shows counts only: how many teachers,
 * how many pairs involve the department and which other departments they reach, the share of teachers who have
 * talked, and conversations by month (anything under 5 already hidden). Never a name, an answer or a conversation.
 * Wrap the part of a page that has department names in <GroupSummaryRoot>, and use <DeptLink> for each name.
 */
const Ctx = createContext<((dept: string) => void) | null>(null);

export function DeptLink({ dept, children, style }: { dept: string; children?: ReactNode; style?: React.CSSProperties }) {
  const open = useContext(Ctx);
  if (!open) return <>{children ?? dept}</>;
  return (
    <button type="button" onClick={() => open(dept)} aria-haspopup="dialog" title={`Summary for ${dept}`} style={{ all: "unset", cursor: "pointer", borderBottom: "1px dotted currentColor", ...style }}>
      {children ?? dept}
    </button>
  );
}

const ink = "var(--ev-ink, var(--ink))";
const muted = "var(--ev-muted, var(--muted))";
const line = "var(--ev-line, var(--line))";
const teal = "var(--ev-teal, var(--teal-dk))";
const display = "var(--ev-display, var(--font-serif, Georgia, serif))";

export function GroupSummaryRoot({ summaries, children }: { summaries: Record<string, GroupSummary>; children: ReactNode }) {
  const [dept, setDept] = useState<string | null>(null);
  const close = useCallback(() => setDept(null), []);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!dept) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [dept, close]);
  const s = dept ? summaries[dept] : null;
  return (
    <Ctx.Provider value={(d) => summaries[d] && setDept(d)}>
      {children}
      {s && (
        <div role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()} style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(10,20,30,0.42)", backdropFilter: "blur(3px)" }}>
          <aside role="dialog" aria-modal="true" aria-label={`Group summary: ${s.dept}`} style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "min(440px, 100%)", overflowY: "auto", background: "var(--ev-panel-solid, var(--card))", color: ink, borderLeft: `1px solid ${line}`, padding: "28px 28px 40px", boxShadow: "-24px 0 60px -20px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ font: "500 11px var(--ev-mono, var(--font-mono, monospace))", letterSpacing: "0.16em", textTransform: "uppercase", color: teal }}>Group summary</span>
              <button ref={closeRef} type="button" onClick={close} aria-label="Close" style={{ all: "unset", cursor: "pointer", width: 36, height: 36, borderRadius: "50%", border: `1px solid ${line}`, display: "grid", placeItems: "center", fontSize: 18 }}>
                ×
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, margin: "18px 0 6px" }}>
              <h2 style={{ font: `600 30px ${display}`, letterSpacing: "-0.02em", margin: 0 }}>{s.dept}</h2>
              <span style={{ fontSize: 12.5, color: teal, whiteSpace: "nowrap" }}>Privacy protected</span>
            </div>
            <div style={{ borderTop: `1px solid ${line}`, margin: "14px 0" }} />
            <p style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 10 }}>
              <strong style={{ font: `600 52px ${display}`, letterSpacing: "-0.03em" }}>{s.teachers}</strong>
              <span style={{ color: muted }}>teachers</span>
            </p>
            <p style={{ margin: "4px 0 18px", color: teal, fontSize: 14 }}>✓ Group is large enough to show</p>

            <Block title="Pairs">
              <p style={{ margin: 0 }}>
                <strong>{s.pairs}</strong> {s.pairs === 1 ? "pair involves" : "pairs involve"} this department: <strong>{s.across}</strong> reach another department and <strong>{s.within}</strong> stay inside it.
              </p>
            </Block>
            <Block title="Who it is connected to">
              {s.connected.length === 0 ? (
                <p style={{ margin: 0 }}>No pair reaches another department yet.</p>
              ) : (
                <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
                  {s.connected.map((c) => (
                    <li key={c.dept}>
                      {c.dept}: {c.count} {c.count === 1 ? "pair" : "pairs"}
                    </li>
                  ))}
                </ul>
              )}
              {s.notConnected.length > 0 && <p style={{ margin: 0, color: muted, fontSize: 14 }}>Not yet connected to: {s.notConnected.join(", ")}.</p>}
            </Block>
            {s.activePct !== null && (
              <Block title="Participation">
                <p style={{ margin: 0 }}>
                  <strong>{s.activePct}%</strong> of teachers here are in a pair that has talked.
                </p>
              </Block>
            )}
            {s.months.length > 0 && (
              <Block title="Conversations by month">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {s.months.map((m) => (
                    <li key={m.month}>
                      {monthLabel(m.month)}: {m.n === null ? "fewer than 5" : m.n}
                    </li>
                  ))}
                </ul>
              </Block>
            )}
            <div style={{ borderTop: `1px solid ${line}`, marginTop: 22, paddingTop: 16, color: muted, fontSize: 14 }}>
              <strong style={{ color: ink }}>Teachers stay protected.</strong> This summary contains counts only, never names, answers, or conversation content.
            </div>
          </aside>
        </div>
      )}
    </Ctx.Provider>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: "var(--ev-soft, var(--paper-2))", border: `1px solid ${line}`, borderRadius: 12, padding: "14px 18px", margin: "0 0 12px" }}>
      <div style={{ font: "500 11px var(--ev-mono, var(--font-mono, monospace))", letterSpacing: "0.12em", textTransform: "uppercase", color: muted, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}
