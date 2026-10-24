import Link from "next/link";
import { Muted, Panel, type Skin } from "@/components/admin/kit";
import { momentum, readThemes, themeSentences } from "@/lib/admin/themes";
import type { AdminSnapshot } from "@/lib/admin/facts";
import { buildWeekly, type RawActivity } from "@/lib/admin/trends";

const teal = "var(--ev-teal, var(--teal-dk, #0f766e))";

/**
 * What pairs are working on, as themes. Built from the domain and strategic tag each pair chose, never from what was
 * said: a theme with fewer than five pairs is not shown, and the reading says how many pairs that hides.
 */
export default function ThemesPanel({ skin, snap, raw, base }: { skin: Skin; snap: AdminSnapshot; raw: RawActivity | null; base: string }) {
  const r = readThemes(snap.people, snap.pairs, snap.school.priority);
  const weekly = raw ? buildWeekly(raw) : null;
  const pace = weekly ? momentum(weekly.totals) : null;
  const max = Math.max(1, ...r.shown.map((t) => t.pairs));
  return (
    <Panel skin={skin} title="Themes" eyebrow="What pairs are working on" count={`${r.total} ${r.total === 1 ? "pair" : "pairs"}`}>
      <p style={{ margin: "0 0 14px", maxWidth: 720 }}>{themeSentences(r).join(" ")}</p>
      {r.shown.map((t) => (
        <div key={t.domain} style={{ margin: "14px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, flexWrap: "wrap" }}>
            <strong style={{ fontWeight: 600 }}>{t.label}</strong>
            <span>{t.pairs} pairs · {t.sharePct}%{t.crossPct !== null ? ` · ${t.crossPct}% cross departments` : ""}</span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: "var(--ev-soft, var(--paper-2))", marginTop: 6 }}>
            <div style={{ width: `${(t.pairs / max) * 100}%`, height: "100%", borderRadius: 999, background: teal }} />
          </div>
          {t.plc && <small style={{ color: "var(--ev-muted, var(--muted))" }}>Routes to a {t.plc}</small>}
        </div>
      ))}
      {r.hiddenPairs > 0 && <Muted skin={skin}>{r.hiddenPairs} {r.hiddenPairs === 1 ? "pair belongs" : "pairs belong"} to themes with fewer than 5 pairs, which are not shown.</Muted>}
      {pace && (
        <p style={{ margin: "14px 0 0" }}>
          <strong>Momentum:</strong>{" "}
          {pace.direction === "level" ? "conversation volume is level" : `conversation volume is ${pace.direction} ${Math.abs(pace.changePct)}%`}, {pace.recent} in the last four weeks against {pace.before} in the four before.{" "}
          <Link href={`${base}/pairings`}>See which pairs are cooling →</Link>
        </p>
      )}
      <Muted skin={skin}>Themes come from the domain each pair chose, not from anything said in a conversation. Leadership never sees conversation text.</Muted>
    </Panel>
  );
}
