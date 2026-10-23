"use client";

import { useState } from "react";
import type { PlacedLog, RhythmGrid } from "@/lib/teacher/orbit";

/*
 * Your orbit: every dot is one entry in your journal, circling you and your co-mentors. Filter by conversations, visits or
 * reflections, click a dot to read it, and see the rhythm of your last twelve weeks. It is built only from the journal
 * this teacher can already read; nothing is sent anywhere. Colours come from the page's own tokens, so it sits in Nick's
 * look or the Blend look without changes.
 */
const teal = "var(--ev-teal, var(--teal))";
const indigo = "var(--ev-teal-deep, #4a55c8)";
const muted = "var(--ev-muted, var(--muted))";
const line = "var(--ev-line, var(--line))";
const ink = "var(--ev-ink, var(--ink))";
const card = "var(--ev-panel-solid, var(--card))";
const display = "var(--ev-display, var(--font-serif), Georgia, serif)";
const mono = "var(--ev-mono, var(--font-mono), monospace)";
const PINK = "#d6509a";

type Filter = "all" | "conversation" | "visit" | "reflection";
type Person = { name: string; initials: string };

const box: React.CSSProperties = { border: `1px solid ${line}`, background: card, borderRadius: 14, padding: "20px 22px 18px", minWidth: 0 };
const eyebrow: React.CSSProperties = { font: `500 11px ${mono}`, letterSpacing: "0.16em", textTransform: "uppercase", color: muted, display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px" };
const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function TeacherOrbit({ me, partners, logs, rhythm }: { me: Person; partners: Person[]; logs: PlacedLog[]; rhythm: RhythmGrid | null }) {
  const [f, setF] = useState<Filter>("all");
  const [sel, setSel] = useState<string | null>(logs[logs.length - 1]?.id ?? null);
  const count = (x: Filter) => logs.filter((l) => (x === "all" ? true : x === "reflection" ? l.reflection : l.kind === x)).length;
  const chips: { id: Filter; label: string; dot?: string }[] = [
    { id: "all", label: "All" },
    { id: "conversation", label: "Conversations", dot: teal },
    { id: "visit", label: "Visits", dot: indigo },
    { id: "reflection", label: "Reflections", dot: PINK },
  ];
  const on = (l: PlacedLog) => f === "all" || (f === "reflection" ? l.reflection : l.kind === f);
  const chosen = logs.find((l) => l.id === sel) ?? null;
  const people = partners.length === 0 ? [{ p: me, x: 360, mine: true }] : partners.length === 1 ? [{ p: me, x: 246, mine: true }, { p: partners[0], x: 474, mine: false }] : [{ p: partners[0], x: 226, mine: false }, { p: me, x: 360, mine: true }, { p: partners[1], x: 494, mine: false }];

  return (
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "stretch", margin: "0 0 22px" }}>
      <section style={{ ...box, flex: "2 1 480px" }} aria-label="Your orbit">
        <p style={eyebrow}><span style={{ width: 18, height: 2, background: indigo, display: "inline-block" }} />Your orbit</p>
        <div role="group" aria-label="Filter the orbit" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {chips.map((c) => (
            <button key={c.id} type="button" onClick={() => setF(c.id)} aria-pressed={f === c.id} style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, border: `1px solid ${f === c.id ? "transparent" : line}`, background: f === c.id ? "linear-gradient(135deg, #0a9a8a, #4a55c8)" : card, color: f === c.id ? "#fff" : ink, fontSize: 14, fontWeight: 600 }}>
              {c.dot && f !== c.id && <i style={{ width: 9, height: 9, borderRadius: "50%", background: c.dot, display: "inline-block" }} />}
              {c.label} <span style={{ opacity: 0.75, fontWeight: 500 }}>{count(c.id)}</span>
            </button>
          ))}
        </div>
        <svg viewBox="0 0 720 300" role="group" aria-label={`Your orbit: ${logs.length} journal entries`} style={{ width: "100%", height: "auto", display: "block", maxHeight: 300 }}>
          <ellipse cx="360" cy="150" rx="338" ry="116" fill="none" stroke={line} />
          <ellipse cx="360" cy="150" rx="238" ry="84" fill="none" stroke={line} strokeDasharray="3 5" />
          {people.map(({ p, x, mine }) => (
            <g key={p.name + x}>
              <circle cx={x} cy="140" r={mine ? 40 : 36} fill={card} stroke={mine ? indigo : teal} strokeWidth="2.5" />
              <text x={x} y="147" textAnchor="middle" fontSize="19" fontWeight="600" fill={ink}>{p.initials}</text>
              <text x={x} y="198" textAnchor="middle" fontSize="12" fill={muted}>{mine ? "You" : p.name.split(" ")[0]}</text>
            </g>
          ))}
          {logs.map((l) => (
            <g key={l.id} opacity={on(l) ? 1 : 0.15} style={{ cursor: "pointer", transition: "opacity .25s" }} onClick={() => setSel(l.id)}>
              <circle cx={l.x} cy={l.y} r="14" fill="transparent" />
              {l.reflection && <circle cx={l.x} cy={l.y} r="10" fill="none" stroke={PINK} strokeWidth="1.8" opacity={f === "reflection" ? 1 : 0.6} />}
              {sel === l.id && <circle cx={l.x} cy={l.y} r="14" fill="none" stroke={ink} strokeWidth="1.5" />}
              <circle cx={l.x} cy={l.y} r="5.4" fill={l.kind === "visit" ? indigo : teal}>
                <title>{`${l.heading} · ${fmt(l.when)}`}</title>
              </circle>
            </g>
          ))}
        </svg>
        {chosen ? (
          <div style={{ border: `1px solid ${line}`, background: "var(--ev-soft, var(--paper-2))", borderRadius: 12, padding: "14px 18px" }} aria-live="polite">
            <div style={{ font: `500 11px ${mono}`, letterSpacing: "0.12em", textTransform: "uppercase", color: chosen.reflection ? PINK : muted, display: "flex", gap: 8, alignItems: "center" }}>
              <i style={{ width: 8, height: 8, borderRadius: "50%", background: chosen.kind === "visit" ? indigo : teal, display: "inline-block" }} />
              {chosen.kind === "visit" ? "Visit" : "Conversation"}{chosen.reflection ? " · with a reflection" : ""} · {fmt(chosen.when)} · {chosen.domain}
            </div>
            <h3 style={{ font: `600 18px ${display}`, margin: "6px 0 4px" }}>{chosen.heading}</h3>
            {chosen.text && <p style={{ margin: "0 0 8px", lineHeight: 1.55 }}>{chosen.text}</p>}
            <a href={`#log-${chosen.id}`} style={{ color: teal, fontWeight: 600, textDecoration: "none" }}>Open in your journal →</a>
          </div>
        ) : (
          <p style={{ margin: "12px 0 0", color: muted }}>Your orbit starts with your first logged conversation. Each one becomes a dot here.</p>
        )}
      </section>

      <section style={{ ...box, flex: "1 1 280px" }} aria-label="Your rhythm">
        <p style={eyebrow}><span style={{ width: 18, height: 2, background: indigo, display: "inline-block" }} />Your rhythm</p>
        {rhythm ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${rhythm.weeks.length}, minmax(0, 1fr))`, gap: 4 }} role="img" aria-label={`${rhythm.active} of ${rhythm.weeks.length} weeks had something shared`}>
              {rhythm.weeks.map((w) => (
                <div key={w[0].date} style={{ display: "grid", gap: 4 }}>
                  {w.map((c) => (
                    <div key={c.date} title={c.count ? `${fmt(c.date)}: ${c.count}` : fmt(c.date)} style={{ aspectRatio: "1", borderRadius: 4, background: c.count ? `color-mix(in srgb, ${teal} ${Math.round(40 + (c.count / rhythm.max) * 50)}%, transparent)` : "var(--ev-soft, var(--paper-2))" }} />
                  ))}
                </div>
              ))}
            </div>
            <p style={{ margin: "14px 0 0", fontSize: 15 }}><strong>{rhythm.active}</strong> of the last {rhythm.weeks.length} weeks had something shared.</p>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: muted }}>Each column is a week, ending {fmt(rhythm.to)}.</p>
          </>
        ) : (
          <p style={{ color: muted, margin: 0 }}>Your rhythm appears once you log a conversation.</p>
        )}
      </section>
    </div>
  );
}
