"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import "@/app/aurora.css";

export type StarPerson = { id: string; name: string; dept: string; grade: string | null };
export type StarLink = { a: string; b: string };

const PALETTE = {
  aurora: { arcA: "#14b8a6", arcB: "#6366f1", halo: "#7c83ff", haloOp: 0.2, request: "#f59e0b", draft: "#ec4899", star: "#818cf8", starRing: "#fff", lone: "#8b8aa8", sel: "#14b8a6" },
  nick: { arcA: "#00897b", arcB: "#16283c", halo: "#00897b", haloOp: 0.1, request: "#c8500a", draft: "#c8500a", star: "#00897b", starRing: "#faf7f2", lone: "#8b8377", sel: "#16283c" },
} as const;

const W = 1000;
const H = 600;
const GOLDEN = 2.39996323;

const initials = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

// A faculty drawn as a sky: each department is a small galaxy, each teacher a
// star, each pair an arc between two stars. Arcs that cross departments glow,
// because crossing silos is the point of the program.
export function Constellation({
  people,
  pairs,
  requests,
  drafts,
  skin = "aurora",
  base = "/admin/aurora",
  draftLabel = "Draft round",
}: {
  people: StarPerson[];
  pairs: StarLink[];
  requests: StarLink[];
  drafts: StarLink[];
  /** "aurora" is the night-sky look; "nick" draws the same sky in the paper-and-teal palette of the existing pages. */
  skin?: "aurora" | "nick";
  /** Path prefix of the look this is shown in, so links stay inside it. */
  base?: "/admin" | "/admin/aurora";
  /** What the dotted layer is called: "Draft round" on the pairing screen, "Suggested" where it shows suggestions. */
  draftLabel?: string;
}) {
  const P = PALETTE[skin];
  const [selected, setSelected] = useState<string | null>(requests[0]?.a ?? null);
  const [layers, setLayers] = useState({ pairs: true, requests: true, drafts: true });
  const [q, setQ] = useState("");
  const [onlyLone, setOnlyLone] = useState(false);

  const { pos, galaxies } = useMemo(() => {
    const byDept = new Map<string, StarPerson[]>();
    for (const p of people) byDept.set(p.dept, [...(byDept.get(p.dept) ?? []), p]);
    const depts = [...byDept.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    const n = depts.length;
    const pos = new Map<string, { x: number; y: number }>();
    const galaxies: { dept: string; x: number; y: number; r: number; count: number }[] = [];
    depts.forEach(([dept, members], i) => {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const cx = W / 2 + Math.cos(ang) * 335;
      const cy = H / 2 + Math.sin(ang) * 200;
      const c = 15.5;
      members.forEach((m, k) => {
        const r = c * Math.sqrt(k + 0.6);
        const a = k * GOLDEN;
        pos.set(m.id, { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      });
      galaxies.push({ dept, x: cx, y: cy, r: c * Math.sqrt(members.length + 0.6) + 14, count: members.length });
    });
    return { pos, galaxies };
  }, [people]);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const partnerOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of pairs) {
      m.set(l.a, l.b);
      m.set(l.b, l.a);
    }
    return m;
  }, [pairs]);
  const requestFor = useMemo(() => {
    const m = new Map<string, StarLink>();
    for (const r of requests) {
      m.set(r.a, r);
      m.set(r.b, r);
    }
    return m;
  }, [requests]);

  const arc = (a: string, b: string) => {
    const p = pos.get(a);
    const t = pos.get(b);
    if (!p || !t) return null;
    const mx = (p.x + t.x) / 2;
    const my = (p.y + t.y) / 2;
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const bow = Math.min(90, len * 0.22);
    return `M${p.x.toFixed(1)},${p.y.toFixed(1)} Q${(mx - (dy / len) * bow).toFixed(1)},${(my + (dx / len) * bow).toFixed(1)} ${t.x.toFixed(1)},${t.y.toFixed(1)}`;
  };

  const cross = pairs.filter((l) => byId.get(l.a)?.dept !== byId.get(l.b)?.dept).length;
  const term = q.trim().toLowerCase();
  const sel = selected ? byId.get(selected) : null;
  const selPartner = selected ? byId.get(partnerOf.get(selected) ?? "") : null;
  const selRequest = selected ? requestFor.get(selected) : null;
  const selFocusIds = new Set<string>(selected ? [selected, partnerOf.get(selected) ?? "", ...(selRequest ? [selRequest.a, selRequest.b] : [])] : []);

  return (
    <div className={skin === "nick" ? "v3-sky nk-sky" : "v3-sky"}>
      <div className="v3-sky-controls">
        <div className="ev-tabs" role="group" aria-label="Layers" style={{ margin: 0 }}>
          {(drafts.length > 0 ? (["pairs", "requests", "drafts"] as const) : (["pairs", "requests"] as const)).map((k) => (
            <button
              key={k}
              type="button"
              className={layers[k] ? "on" : ""}
              aria-pressed={layers[k]}
              disabled={k === "drafts" && drafts.length === 0}
              onClick={() => setLayers((v) => ({ ...v, [k]: !v[k] }))}
            >
              {k === "pairs" ? `Pairs · ${pairs.length}` : k === "requests" ? `Requests · ${requests.length}` : `${draftLabel} · ${drafts.length}`}
            </button>
          ))}
        </div>
        <div className="ev-tabs" role="group" aria-label="Highlight" style={{ margin: 0 }}>
          <button type="button" className={onlyLone ? "on" : ""} aria-pressed={onlyLone} onClick={() => setOnlyLone((v) => !v)}>
            Who needs a partner · {people.length - partnerOf.size}
          </button>
        </div>
        <input type="search" className="ev-input" style={{ maxWidth: 240, padding: "8px 14px" }} placeholder="Find a colleague…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a colleague" />
        <span className="ev-small" style={{ marginLeft: "auto" }}>
          <strong style={{ color: "var(--ev-ink)" }}>{pairs.length ? Math.round((cross / pairs.length) * 100) : 0}%</strong> of pairs cross departments
        </span>
      </div>

      <div className="v3-sky-grid">
        <div className="v3-sky-stage">
          <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Faculty constellation" className="v3-sky-svg">
            <defs>
              <linearGradient id="v3-arc" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={P.arcA} />
                <stop offset="1" stopColor={P.arcB} />
              </linearGradient>
              <radialGradient id="v3-halo">
                <stop offset="0" stopColor={P.halo} stopOpacity={P.haloOp} />
                <stop offset="1" stopColor={P.halo} stopOpacity="0" />
              </radialGradient>
            </defs>
            {galaxies.map((g) => (
              <g key={g.dept}>
                <circle cx={g.x} cy={g.y} r={g.r + 26} fill="url(#v3-halo)" />
                <text x={g.x} y={g.y + g.r + 22} textAnchor="middle" className="v3-sky-label">
                  {g.dept} · {g.count}
                </text>
              </g>
            ))}
            {layers.pairs &&
              pairs.map((l) => {
                const d = arc(l.a, l.b);
                if (!d) return null;
                const isCross = byId.get(l.a)?.dept !== byId.get(l.b)?.dept;
                const on = selFocusIds.has(l.a) && selFocusIds.has(l.b);
                return <path key={l.a + l.b} d={d} fill="none" stroke="url(#v3-arc)" strokeWidth={on ? 3.2 : isCross ? 1.5 : 1} opacity={on ? 1 : isCross ? 0.7 : 0.3} className={isCross ? "v3-arc-cross" : undefined} />;
              })}
            {layers.requests &&
              requests.map((l) => {
                const d = arc(l.a, l.b);
                return d ? <path key={`r${l.a}${l.b}`} d={d} fill="none" stroke={P.request} strokeWidth={2} strokeDasharray="5 6" className="v3-arc-flow" /> : null;
              })}
            {layers.drafts &&
              drafts.map((l) => {
                const d = arc(l.a, l.b);
                return d ? <path key={`d${l.a}${l.b}`} d={d} fill="none" stroke={P.draft} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" className="v3-arc-flow" /> : null;
              })}
            {people.map((p, idx) => {
              const xy = pos.get(p.id);
              if (!xy) return null;
              const paired = partnerOf.has(p.id);
              const isSel = p.id === selected;
              const dim = (term && !p.name.toLowerCase().includes(term)) || (onlyLone && paired);
              return (
                <g key={p.id} transform={`translate(${xy.x.toFixed(1)} ${xy.y.toFixed(1)})`} opacity={dim ? 0.15 : 1}>
                  <circle r={14} fill="transparent" onClick={() => setSelected(p.id)} style={{ cursor: "pointer" }} />
                  <circle r={isSel ? 7.5 : paired ? 5 : onlyLone ? 6 : 3.6} fill={paired ? P.star : "none"} stroke={paired ? P.starRing : P.lone} strokeWidth={paired ? 1.4 : 1.2} strokeDasharray={paired ? undefined : "2 2"} className={paired ? "v3-star" : undefined} style={{ animationDelay: `${(idx % 9) * 0.45}s`, pointerEvents: "none" }} />
                  {isSel && <circle r={13} fill="none" stroke={P.sel} strokeWidth={2} style={{ pointerEvents: "none" }} />}
                  <title>{`${p.name} · ${p.dept}${p.grade ? ` · Grade ${p.grade}` : ""}`}</title>
                </g>
              );
            })}
          </svg>
          <div className="v3-legend">
            <span><i style={{ background: P.star }} />Paired</span>
            <span><i style={{ border: `1px dashed ${P.lone}` }} />Awaiting a partner</span>
            <span><i style={{ background: `linear-gradient(90deg,${P.arcA},${P.arcB})`, height: 3, borderRadius: 2 }} />Pair (bright = crosses departments)</span>
            <span><i style={{ borderTop: `2px dashed ${P.request}`, height: 0, borderRadius: 0 }} />Request</span>
          </div>
        </div>

        <aside className="ev-decision v3-sky-side" aria-live="polite">
          {sel ? (
            <>
              <p className="ev-eyebrow muted">Selected</p>
              <div className="ev-pair" style={{ margin: "0 0 10px" }}>
                <span className="ev-avatar">{initials(sel.name)}</span>
                <div>
                  <strong style={{ font: "600 19px var(--ev-display)", letterSpacing: "-0.03em" }}>{sel.name}</strong>
                  <small>{sel.dept}{sel.grade ? ` · Grade ${sel.grade}` : ""}</small>
                </div>
              </div>
              {selRequest ? <span className="ev-badge amber">Request pending</span> : selPartner ? <span className="ev-badge">Paired</span> : <span className="ev-badge amber">Awaiting a partner</span>}
              <div style={{ borderTop: "1px solid var(--ev-line)", margin: "16px 0", paddingTop: 16 }}>
                {selPartner ? (
                  <>
                    <h3>Co-mentor</h3>
                    <button type="button" className="ev-btn sm" onClick={() => setSelected(selPartner.id)}>
                      {selPartner.name} · {selPartner.dept}
                    </button>
                    <p className="ev-small" style={{ marginTop: 10 }}>
                      {selPartner.dept === sel.dept ? "Same department." : `Crosses from ${sel.dept} to ${selPartner.dept}.`}
                    </p>
                  </>
                ) : selRequest ? (
                  <>
                    <h3>Request</h3>
                    <p className="ev-small">
                      {byId.get(selRequest.a)?.name} asked to be paired with {byId.get(selRequest.b)?.name}. The colleague is never told.
                    </p>
                    <Link href={`${base}/pairings`} className="ev-btn primary sm">Review the request</Link>
                  </>
                ) : (
                  <>
                    <h3>No partner yet</h3>
                    <p className="ev-small">Include them in your next randomized round, or pair them by hand.</p>
                    <Link href={`${base}/pairings`} className="ev-btn sm">Open pairing</Link>
                  </>
                )}
              </div>
              <p className="ev-small" style={{ marginBottom: 0 }}>Individual answers and private notes are not part of this view.</p>
            </>
          ) : (
            <p className="ev-muted">Select a star to see who they are paired with.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
