import Link from "next/link";
import { NETWORK_MIN_RESPONDENTS, networkAllowed } from "@/lib/report/gates";
import type { DeptMatrix } from "@/lib/admin/network";
import { cultureBubbles, flowArcs } from "@/lib/admin/visuals";
import { DIMENSION_LABEL, type ReportStats } from "@/lib/report/stats";

/*
 * Three diagrams in the manner of the Mentorful Engine designs, drawn the same in every look: the colors come from
 * whichever look's tokens are present (--ev-* in Aurora and the blend, Nick's tokens otherwise), so each keeps its own
 * palette and its own light and dark.
 */
const teal = "var(--ev-teal, var(--teal))";
const tealDeep = "var(--ev-teal-deep, var(--teal-dk))";
const amber = "var(--ev-amber, var(--amber))";
const amberSoft = "var(--ev-amber-soft, var(--amber-bg))";
const muted = "var(--ev-muted, var(--muted))";
const line = "var(--ev-line, var(--line))";
const ink = "var(--ev-ink, var(--ink))";
const card = "var(--ev-panel-solid, var(--card))";
const display = "var(--ev-display, var(--font-serif, Georgia, serif))";

/** The four culture dimensions as bubbles: size is the average, lines show which move together, the lowest is the focus. */
// The ties between dimensions are partial correlations, which are unstable under 25 respondents (Nick, Oct 29), so below that the
// averages still show and the ties do not.
export function CultureBubbles({ stats, synthetic, n }: { stats: Pick<ReportStats, "dimensions" | "partial">; synthetic?: boolean; n?: number }) {
  const { bubbles, ties: allTies } = cultureBubbles(stats);
  const tiesShown = n === undefined || networkAllowed(n);
  const ties = tiesShown ? allTies : [];
  const at = Object.fromEntries(bubbles.map((b) => [b.dimension, b]));
  return (
    <div>
      <svg viewBox="0 0 640 340" role="img" aria-label={`The four culture dimensions: ${bubbles.map((b) => `${DIMENSION_LABEL[b.dimension]} ${b.mean.toFixed(1)}`).join(", ")}`} style={{ width: "100%", maxWidth: 720, height: "auto", display: "block", margin: "0 auto" }}>
        {ties.map((t) => {
          const A = at[t.a];
          const B = at[t.b];
          const dx = B.x - A.x;
          const dy = B.y - A.y;
          const len = Math.hypot(dx, dy) || 1;
          const x1 = A.x + (dx / len) * A.r;
          const y1 = A.y + (dy / len) * A.r;
          const x2 = B.x - (dx / len) * B.r;
          const y2 = B.y - (dy / len) * B.r;
          const lx = x1 + (x2 - x1) * 0.3;
          const ly = y1 + (y2 - y1) * 0.3;
          return (
            <g key={`${t.a}-${t.b}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={t.weak ? muted : tealDeep} strokeOpacity={t.weak ? 0.5 : 0.45} strokeWidth={t.width} strokeDasharray={t.weak ? "4 5" : undefined} strokeLinecap="round" />
              <text x={lx} y={ly} fontSize="11" fill={t.weak ? muted : ink} textAnchor="middle" dominantBaseline="middle" style={{ paintOrder: "stroke", stroke: card, strokeWidth: 4 }}>
                {t.value.toFixed(2)}
              </text>
            </g>
          );
        })}
        {bubbles.map((b) => (
          <g key={b.dimension}>
            {b.focus && <circle cx={b.x} cy={b.y} r={b.r + 9} fill={amberSoft} />}
            <circle cx={b.x} cy={b.y} r={b.r} fill={card} stroke={b.focus ? amber : teal} strokeWidth={b.focus ? 3 : 2} />
            <text x={b.x} y={b.y - 3} textAnchor="middle" fontSize="22" fontWeight="600" fill={ink} style={{ fontFamily: display }}>
              {b.mean.toFixed(1)}
            </text>
            <text x={b.x} y={b.y + 15} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={muted}>
              {DIMENSION_LABEL[b.dimension]}
            </text>
            {b.focus && (
              <g transform={`translate(${b.x - 36} ${b.y - b.r - 24})`}>
                <rect width="72" height="20" rx="10" fill={amber} />
                <text x="36" y="14" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#fff">
                  Focus area
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
      <p style={{ margin: "6px 0 0", fontSize: 12.5, color: muted, textAlign: "center" }}>
        {tiesShown
          ? "Bigger circles mean a higher average. Thicker lines mean two dimensions rise and fall together once the others are held constant; dashed lines are too weak to tell from no tie."
          : `Bigger circles mean a higher average. The ties between dimensions need at least ${NETWORK_MIN_RESPONDENTS} respondents to be reliable, so they aren't drawn yet.`}
        {synthetic ? " Demo data, not real staff responses." : ""}
      </p>
    </div>
  );
}

/** Departments along a line, with an arc between every two that have a pair between them. Thicker means more pairs. */
export function PairingFlow({ matrix }: { matrix: DeptMatrix }) {
  const W = Math.max(560, matrix.depts.length * 104);
  const { dots, arcs } = flowArcs(matrix, W, 190);
  if (dots.length < 2) return null;
  const labelFit = (s: string) => (s.length > 15 ? `${s.slice(0, 14)}…` : s);
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} 262`} role="img" aria-label={`Pairs between departments: ${arcs.map((a) => `${a.a} and ${a.b} ${a.count}`).join(", ") || "none yet"}`} style={{ width: "100%", minWidth: dots.length * 84, height: "auto", display: "block" }}>
        <line x1="20" x2={W - 20} y1="190" y2="190" stroke={line} />
        {arcs.map((a) => (
          <path key={`${a.a}|${a.b}`} d={a.d} fill="none" stroke={teal} strokeOpacity="0.5" strokeWidth={a.width} strokeLinecap="round">
            <title>{`${a.a} and ${a.b}: ${a.count} ${a.count === 1 ? "pair" : "pairs"}`}</title>
          </path>
        ))}
        {dots.map((d) => (
          <g key={d.dept}>
            <circle cx={d.x} cy="190" r="7" fill={card} stroke={tealDeep} strokeWidth="3" />
            <text x={d.x} y="216" textAnchor="middle" fontSize="12" fontWeight="600" fill={ink}>
              {labelFit(d.dept)}
            </text>
            <text x={d.x} y="233" textAnchor="middle" fontSize="11" fill={muted}>
              {d.within} within
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** One horizontal bar split into labelled parts, with the legend beneath. */
export function StackBar({ parts }: { parts: { label: string; value: number; tone: "teal" | "amber" | "grey" }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const color = { teal, amber, grey: "var(--ev-soft, var(--line))" } as const;
  return (
    <div>
      <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: "var(--ev-soft, var(--paper-2))", gap: 2 }} role="img" aria-label={parts.map((p) => `${p.value} ${p.label}`).join(", ")}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: color[p.tone] }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: "6px 20px", flexWrap: "wrap", marginTop: 10, fontSize: 14 }}>
        {parts.map((p) => (
          <span key={p.label} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <i style={{ width: 10, height: 10, borderRadius: "50%", background: color[p.tone], display: "inline-block", border: p.tone === "grey" ? `1px solid ${line}` : undefined }} />
            <strong>{p.value}</strong> {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The highlighted line at the top of Pulse: the one thing to focus on, with a way to see why. */
export function FocusBanner({ lead, body, href, cta }: { lead: string; body: string; href: string; cta: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", background: amberSoft, border: `1px solid ${amber}`, borderRadius: 14, padding: "16px 22px", margin: "22px 0 0" }}>
      <span aria-hidden style={{ width: 44, height: 44, borderRadius: "50%", background: amber, color: "#fff", display: "grid", placeItems: "center", flex: "none" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>
      </span>
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <div style={{ font: "500 11px var(--ev-mono, var(--font-mono, monospace))", letterSpacing: "0.14em", textTransform: "uppercase", color: amber, marginBottom: 3 }}>Your focus this cycle</div>
        <div style={{ fontSize: 16, lineHeight: 1.5 }}>
          <strong>{lead}.</strong> {body}
        </div>
      </div>
      <Link href={href} prefetch={false} style={{ color: amber, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
        {cta} ›
      </Link>
    </div>
  );
}
