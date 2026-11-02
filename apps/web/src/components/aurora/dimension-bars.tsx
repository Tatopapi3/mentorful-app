import { DIMENSIONS, DIMENSION_LABEL, type Dimension } from "@/lib/report/stats";
import { scanLevel } from "@/lib/admin/scan-level";
import { LevelTag } from "./severity";

const SUB: Record<Dimension, string> = {
  structural: "Mentoring network",
  relational: "Psychological safety",
  cognitive: "Shared instructional language",
  efficacy: "Collective efficacy",
};

// Each dimension's average out of 6, with a 95% band that widens as fewer people respond. The number is
// always printed, so colour and position are never the only signal.
export function DimensionBars({ means, ci, dark = false }: { means: Record<Dimension, number>; ci: Record<Dimension, number>; dark?: boolean }) {
  const track = dark ? "rgba(255,255,255,0.14)" : "var(--ev-soft)";
  const sub = dark ? "rgba(255,255,255,0.65)" : undefined;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {DIMENSIONS.map((d) => {
        const lo = Math.max(1, means[d] - ci[d]);
        const hi = Math.min(6, means[d] + ci[d]);
        return (
          <div key={d} style={{ display: "grid", gridTemplateColumns: "130px 1fr 118px", gap: 12, alignItems: "center", fontSize: 13 }}>
            <span style={{ opacity: dark ? 0.9 : 1 }}>
              <strong style={{ fontWeight: 600 }}>{DIMENSION_LABEL[d]}</strong>
              <small style={{ display: "block", color: sub }}>{SUB[d]}</small>
            </span>
            <span role="img" aria-label={`${DIMENSION_LABEL[d]}: ${means[d].toFixed(2)} out of 6, plus or minus ${ci[d].toFixed(2)}, ${scanLevel(means[d]) === "low" ? "low" : scanLevel(means[d]) === "watch" ? "watch" : "on track"}`} style={{ position: "relative", height: 12, borderRadius: 999, background: track }}>
              <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(means[d] / 6) * 100}%`, borderRadius: 999, background: "linear-gradient(90deg,#5eead4,#818cf8)" }} />
              <span style={{ position: "absolute", top: -3, bottom: -3, left: `${(lo / 6) * 100}%`, width: `${((hi - lo) / 6) * 100}%`, border: `2px solid ${dark ? "#fff" : "#17143a"}`, borderTop: 0, borderBottom: 0, borderRadius: 2, opacity: 0.55 }} />
            </span>
            <strong style={{ textAlign: "right" }}>
              {means[d].toFixed(2)}
              <small style={{ color: sub }}> ±{ci[d].toFixed(2)}</small>
              <span style={{ display: "block", marginTop: 3 }}>
                <LevelTag level={scanLevel(means[d])} dark={dark} small />
              </span>
            </strong>
          </div>
        );
      })}
      <small style={{ color: sub }}>Below 3.5 is Low, 3.5 to 4.5 is Watch. The bracket is a 95% band on the average. It widens as fewer people respond.</small>
    </div>
  );
}
