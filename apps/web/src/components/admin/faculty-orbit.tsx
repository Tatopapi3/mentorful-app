"use client";

import { useState } from "react";
import { useGroupSummary } from "@/components/admin/group-summary";
import { LENS_LABEL, LENS_NOTE, farness, type Direction, type Lens, type Planet } from "@/lib/admin/faculty-orbit";

/*
 * The faculty orbit: each department with five or more teachers is a planet around the centre. The chips change what
 * "closer" means, and the planets glide to their new distance. Clicking a planet opens the same group summary as a
 * department name elsewhere on the page. Counts only, never a name or an answer.
 */
const ink = "var(--ev-ink, var(--ink))";
const muted = "var(--ev-muted, var(--muted))";
const line = "var(--ev-line, var(--line))";
const teal = "var(--ev-teal, var(--teal-dk))";
const mono = "var(--ev-mono, var(--font-mono, monospace))";
const INDIGO = "#4a55c8";
const AMBER = "#d98a1c";

const W = 760;
const H = 440;
const CX = W / 2;
const CY = H / 2;
const R_MIN = 70;
const R_MAX = 300;

const tone = (v: number | null) => (v === null ? muted : v >= 0.67 ? teal : v >= 0.34 ? INDIGO : AMBER);
const where = (i: number, n: number, f: number) => {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n + 0.35;
  // Even the closest planet keeps off the centre, so a lens where everyone ties does not pile them up.
  const rx = R_MIN + (0.35 + 0.65 * f) * (R_MAX - R_MIN);
  return { x: CX + rx * Math.cos(angle), y: CY + rx * 0.56 * Math.sin(angle) };
};

export function FacultyOrbit({ planets, lenses, directions }: { planets: Planet[]; lenses: Lens[]; directions: Record<Lens, Direction[]> }) {
  const [lens, setLens] = useState<Lens>(lenses[0] ?? "connections");
  const open = useGroupSummary();
  const dirs = directions[lens] ?? [];
  return (
    <div>
      <style>{`.fo-planet{transition:transform .7s cubic-bezier(.3,.7,.2,1)}.fo-planet:focus-visible circle.fo-body{stroke:${ink};stroke-width:2.5}@media (prefers-reduced-motion:reduce){.fo-planet{transition:none}}`}</style>
      <div role="group" aria-label="What closer to the centre means" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {lenses.map((l) => (
          <button key={l} type="button" aria-pressed={l === lens} onClick={() => setLens(l)} style={{ all: "unset", cursor: "pointer", padding: "7px 14px", borderRadius: 999, border: `1px solid ${l === lens ? teal : line}`, background: l === lens ? "var(--ev-soft, var(--teal-bg))" : "transparent", color: l === lens ? teal : ink, font: `500 13px var(--ev-sans, inherit)` }}>
            {LENS_LABEL[l]}
          </button>
        ))}
      </div>
      <p style={{ margin: "0 0 10px", color: muted, fontSize: 14 }}>{LENS_NOTE[lens]}</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Faculty orbit by ${LENS_LABEL[lens]}: ${planets.map((p) => `${p.dept} ${p.notes[lens]}`).join("; ")}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[0, 1 / 3, 2 / 3, 1].map((f) => {
          const rx = R_MIN + f * (R_MAX - R_MIN);
          return <ellipse key={f} cx={CX} cy={CY} rx={rx} ry={rx * 0.56} fill="none" stroke={line} strokeDasharray={f === 1 ? "none" : "3 6"} />;
        })}
        <circle cx={CX} cy={CY} r={26} fill="var(--ev-soft, var(--teal-bg))" stroke={teal} />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize={11} fill={teal} style={{ font: `500 11px ${mono}`, letterSpacing: "0.08em" }}>FACULTY</text>
        {planets.map((p, i) => {
          const pos = where(i, planets.length, farness(p.values[lens]));
          const r = 13 + Math.sqrt(p.teachers) * 3.2;
          const c = tone(p.values[lens]);
          return (
            <g key={p.dept} className="fo-planet" style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, cursor: "pointer" }} role="button" tabIndex={0} aria-label={`${p.dept}, ${p.teachers} teachers, ${p.notes[lens]}. Open summary.`} onClick={() => open?.(p.dept)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open?.(p.dept))}>
              <circle className="fo-body" r={r} fill={c} fillOpacity={0.88} stroke={c} />
              <text y={4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#fff">{p.teachers}</text>
              <text y={r + 15} textAnchor="middle" fontSize={13} fontWeight={600} fill={ink}>{p.dept}</text>
              <text y={r + 30} textAnchor="middle" fontSize={11.5} fill={muted}>{p.notes[lens]}</text>
            </g>
          );
        })}
      </svg>
      <p style={{ margin: "4px 0 14px", color: muted, fontSize: 13 }}>Bigger planets have more teachers. <span style={{ color: teal }}>●</span> close in, <span style={{ color: INDIGO }}>●</span> middle, <span style={{ color: AMBER }}>●</span> near the edge. Select a planet for its summary.</p>
      {dirs.length > 0 && (
        <div style={{ borderTop: `1px solid ${line}`, paddingTop: 14 }}>
          <div style={{ font: `500 11px ${mono}`, letterSpacing: "0.14em", textTransform: "uppercase", color: teal, marginBottom: 8 }}>Which way to head · {LENS_LABEL[lens]}</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            {dirs.map((d) => (
              <li key={d.title}>
                <strong style={{ color: ink }}>{d.title}.</strong> <span style={{ color: muted }}>{d.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
