"use client";

import { useMemo, useState } from "react";
import { publishRound } from "@/app/admin/pairings/actions";
import type { AdminPair, AdminPerson } from "@/lib/admin/facts";
import { bestRound, draftRound, impactOf, impactSentence, linksOpenedBy, swapVisitor, type Impact, type PairIds } from "@/lib/admin/simulator";
import type { Skin } from "@/components/admin/kit";

type Mode = "finish" | "plan";
type Strategy = "best" | "random";

const tone = {
  teal: "var(--ev-teal, var(--teal-dk, #0f766e))",
  amber: "var(--ev-amber, var(--amber, #b45309))",
  muted: "var(--ev-muted, var(--muted, #6b7280))",
  line: "var(--ev-line, var(--line, #d9d4c7))",
  card: "var(--ev-panel-solid, var(--card, #fff))",
  soft: "var(--ev-soft, #eeeae0)",
};

const btn = (skin: Skin, primary?: boolean) => (skin === "nick" ? `nk-btn${primary ? " nk-primary" : ""}` : `ev-btn sm${primary ? " primary" : ""}`);

/** Before and after for one number, coloured only when it moved: higher is better for every number shown. */
function Delta({ label, before, after, unit = "", note }: { label: string; before: number | null; after: number | null; unit?: string; note?: string }) {
  const moved = before !== null && after !== null && before !== after;
  const up = moved && after! > before!;
  return (
    <div style={{ border: `1px solid ${tone.line}`, borderRadius: 12, padding: "14px 16px", background: tone.card, minWidth: 0 }}>
      <small style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10.5, color: tone.muted }}>{label}</small>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", margin: "4px 0 2px" }}>
        <span style={{ color: tone.muted, fontSize: 15 }}>{before === null ? "n/a" : `${before}${unit}`}</span>
        <span aria-hidden style={{ color: tone.muted }}>→</span>
        <strong style={{ font: "600 26px var(--ev-display, var(--font-serif, Georgia, serif))", color: moved ? (up ? tone.teal : tone.amber) : undefined }}>{after === null ? "n/a" : `${after}${unit}`}</strong>
        {moved && <span style={{ fontSize: 12, fontWeight: 600, color: up ? tone.teal : tone.amber }}>{up ? "up" : "down"}</span>}
      </div>
      {note && <small style={{ color: tone.muted }}>{note}</small>}
    </div>
  );
}

const abbr = (d: string) => (d.length <= 9 ? d : d.slice(0, 8) + "…");

/** Every pair of drawn departments: filled where a pair already connects them, marked where the round adds the first, empty where none does. */
function LinkGrid({ impact }: { impact: Impact }) {
  const { depts, grid } = impact;
  if (depts.length < 2) return <p style={{ color: tone.muted, fontSize: 13.5 }}>Fewer than two departments have five or more teachers, so there is no connection grid to draw.</p>;
  const cell = (a: string, b: string) => grid.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));
  const look = {
    kept: { bg: tone.teal, fg: "#fff", text: "✓", word: "already connected" },
    new: { bg: "transparent", fg: tone.teal, text: "+ new", word: "newly connected by this round" },
    missing: { bg: "repeating-linear-gradient(45deg, transparent 0 4px, rgba(120,120,120,.18) 4px 5px)", fg: tone.muted, text: "–", word: "still not connected" },
  } as const;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 3, fontSize: 12 }} aria-label="Which departments have a pair between them">
        <thead>
          <tr>
            <th />
            {depts.slice(1).map((d) => (
              <th key={d} scope="col" style={{ fontWeight: 500, color: tone.muted, padding: "0 4px 4px", textAlign: "center" }}>{abbr(d)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {depts.slice(0, -1).map((row, i) => (
            <tr key={row}>
              <th scope="row" style={{ fontWeight: 500, color: tone.muted, paddingRight: 8, textAlign: "right", whiteSpace: "nowrap" }}>{abbr(row)}</th>
              {depts.slice(1).map((col, j) => {
                if (j < i) return <td key={col} />;
                const c = cell(row, col);
                const l = look[c?.state ?? "missing"];
                return (
                  <td key={col} title={`${row} and ${col}: ${l.word}`} aria-label={`${row} and ${col}: ${l.word}`} style={{ width: 64, height: 34, textAlign: "center", borderRadius: 8, background: l.bg, color: l.fg, border: c?.state === "new" ? `2px solid ${tone.teal}` : `1px solid ${tone.line}`, fontWeight: 600 }}>
                    {l.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: tone.muted }}>✓ already connected · + new from this round · – still no pair between them</p>
    </div>
  );
}

/**
 * The pairing simulator. The admin sees what a round would do to the faculty network, changes it, and watches the
 * numbers move before anything is saved. "Finish this cycle" proposes pairs for the teachers who have none and can be
 * published; "Plan next cycle" re-pairs everyone, avoids repeating this cycle's pairs, and is for planning only.
 * Everything is computed in the browser from names and departments the Pairing page already shows.
 */
export default function RoundSimulator({ skin, people, pairs, requests, cycleId, back }: { skin: Skin; people: AdminPerson[]; pairs: AdminPair[]; requests: AdminPair[]; cycleId: string; back: string }) {
  const [mode, setMode] = useState<Mode>("finish");
  const [countRequests, setCountRequests] = useState(true);
  const [strategy, setStrategy] = useState<Strategy>("best");
  const [seed, setSeed] = useState(1);
  const [edit, setEdit] = useState<{ key: string; pairs: PairIds[] } | null>(null);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const approved = useMemo<PairIds[]>(() => pairs.map((p) => [p.a, p.b]), [pairs]);
  const asked = useMemo<PairIds[]>(() => requests.filter((r) => !pairs.some((p) => [p.a, p.b].some((id) => id === r.a || id === r.b))).map((r) => [r.a, r.b]), [requests, pairs]);

  // What stands before the proposal, and who the proposal is drawn from.
  const baseline = useMemo<PairIds[]>(() => (mode === "finish" ? [...approved, ...(countRequests ? asked : [])] : approved), [mode, approved, asked, countRequests]);
  const kept = useMemo<PairIds[]>(() => (mode === "finish" ? baseline : []), [mode, baseline]);
  const pool = useMemo(() => {
    if (mode === "plan") return people.map((p) => p.id);
    const taken = new Set([...approved, ...asked].flat());
    return people.filter((p) => !taken.has(p.id)).map((p) => p.id);
  }, [mode, people, approved, asked]);

  const key = `${mode}:${countRequests}:${strategy}:${seed}`;
  const auto = useMemo(() => {
    const past = mode === "plan" ? approved : [];
    return strategy === "best" ? bestRound(people, pool, kept, past, 200, seed * 1000) : draftRound(people, pool, past, seed);
  }, [mode, strategy, seed, people, pool, kept, approved]);
  const proposal = edit?.key === key ? edit.pairs : auto.pairs;
  const leftOut = pool.filter((id) => !proposal.flat().includes(id));

  const impact = useMemo(() => impactOf(people, baseline, proposal, kept), [people, baseline, proposal, kept]);
  const name = (id: string) => byId.get(id)?.name ?? "A teacher";
  const dept = (id: string) => byId.get(id)?.dept ?? "";

  const reset = (m: Mode, c = countRequests) => {
    setMode(m);
    setCountRequests(c);
    setEdit(null);
  };
  const rerun = (s: Strategy) => {
    setStrategy(s);
    setSeed((n) => n + 1);
    setEdit(null);
  };
  const { before, after } = impact;
  const canPublish = mode === "finish" && proposal.length > 0 && !!cycleId;

  return (
    <div>
      <div role="tablist" aria-label="What to simulate" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 12px" }}>
        {([["finish", "Finish this cycle"], ["plan", "Plan next cycle"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} className={btn(skin, mode === k)} onClick={() => reset(k)}>
            {label}
          </button>
        ))}
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: tone.muted }}>
        {mode === "finish"
          ? "Proposes partners for teachers who have none, then shows what that does to the school. You can publish it."
          : "Draws a whole new round for every teacher, avoiding this cycle's pairs, to see what next cycle could look like. Nothing here is saved."}
      </p>

      {mode === "finish" && asked.length > 0 && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "0 0 14px", fontSize: 14 }}>
          <input type="checkbox" checked={countRequests} onChange={(e) => reset("finish", e.target.checked)} />
          Count the {asked.length} waiting {asked.length === 1 ? "request" : "requests"} as approved
        </label>
      )}

      {mode === "finish" && pool.length < 2 ? (
        <p style={{ color: tone.muted }}>{pool.length === 0 ? "Every teacher already has a partner or a request waiting, so there is no round to simulate. Try Plan next cycle." : "Only one teacher is left without a partner, so there is nobody to pair them with."}</p>
      ) : (
        <>
          <p aria-live="polite" style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 600 }}>{impactSentence(impact)}</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, margin: "0 0 18px" }}>
            <Delta label="Pairs across departments" before={before.crossPct} after={after.crossPct} unit="%" note={`${after.pairs} ${after.pairs === 1 ? "pair" : "pairs"} in all`} />
            <Delta label="Department connections" before={before.connected} after={after.connected} note={`of ${after.possible} possible`} />
            <Delta label="Teachers with a partner" before={before.partneredPct} after={after.partneredPct} unit="%" note={after.unpaired > 0 ? `${after.unpaired} still without` : "everyone paired"} />
            <Delta label="Least-connected department reaches" before={before.leastReached?.connected ?? null} after={after.leastReached?.connected ?? null} note={after.leastReached ? `of ${after.leastReached.possible} other departments` : undefined} />
          </div>

          <div className="sim-cols" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, alignItems: "start" }}>
            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Which departments touch</h3>
              <LinkGrid impact={impact} />
              {impact.omitted.length > 0 && <p style={{ margin: "8px 0 0", fontSize: 12, color: tone.muted }}>Left out because they have under 5 teachers: {impact.omitted.join(", ")}.</p>}
            </div>

            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>The proposed pairs {proposal.length > 0 && <span style={{ color: tone.muted, fontWeight: 400 }}>· {proposal.length}</span>}</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 10px" }}>
                <button type="button" className={btn(skin, strategy === "best")} onClick={() => rerun("best")}>Best of 200 rounds</button>
                <button type="button" className={btn(skin)} onClick={() => rerun("random")}>Another random round</button>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 420, overflowY: "auto" }}>
                {proposal.map(([host, visitor], i) => {
                  const opens = linksOpenedBy(people, baseline, proposal, i);
                  const crossing = dept(host) !== dept(visitor);
                  return (
                    <li key={`${host}:${visitor}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "9px 0", borderBottom: `1px solid ${tone.line}` }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontWeight: 600 }}>{name(host)}</strong> · <strong style={{ fontWeight: 600 }}>{name(visitor)}</strong>
                        <div style={{ fontSize: 12.5, color: tone.muted }}>
                          {dept(host)} and {dept(visitor)}
                          {opens.length > 0 && <span style={{ color: tone.teal, fontWeight: 600 }}> · opens {opens.map(([a, b]) => `${a} ↔ ${b}`).join(", ")}</span>}
                          {!crossing && <span style={{ color: tone.amber }}> · same department</span>}
                        </div>
                      </div>
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <label style={{ fontSize: 12, color: tone.muted }}>
                          <span style={{ position: "absolute", left: -9999 }}>Change the partner of {name(host)}</span>
                          <select
                            value=""
                            onChange={(e) => e.target.value && setEdit({ key, pairs: swapVisitor(proposal, i, e.target.value) })}
                            style={{ font: "inherit", fontSize: 12.5, padding: "4px 6px", borderRadius: 6, border: `1px solid ${tone.line}`, background: tone.card, maxWidth: 150 }}
                          >
                            <option value="">Change partner…</option>
                            {proposal.flat().filter((id) => id !== host && id !== visitor).map((id) => (
                              <option key={id} value={id}>{name(id)} ({dept(id)})</option>
                            ))}
                          </select>
                        </label>
                        <button type="button" className={btn(skin)} aria-label={`Leave out ${name(host)} and ${name(visitor)}`} onClick={() => setEdit({ key, pairs: proposal.filter((_, j) => j !== i) })}>
                          Leave out
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {leftOut.length > 0 && <p style={{ margin: "10px 0 0", fontSize: 13, color: tone.muted }}>Not paired in this draft: {leftOut.map(name).join(", ")}.</p>}
            </div>
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {mode === "finish" ? (
              <form action={publishRound} style={{ display: "contents" }}>
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="cycle" value={cycleId} />
                {proposal.map(([a, b]) => (
                  <input key={`${a}:${b}`} type="hidden" name="pair" value={`${a}:${b}`} />
                ))}
                <button type="submit" className={btn(skin, true)} disabled={!canPublish}>Publish {proposal.length} {proposal.length === 1 ? "pair" : "pairs"}</button>
                <span style={{ fontSize: 13, color: tone.muted }}>Nothing is saved until you press this. Waiting requests are decided separately.</span>
              </form>
            ) : (
              <span style={{ fontSize: 13, color: tone.muted }}>Planning only: there is no next cycle to publish into yet, so nothing here is saved.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
