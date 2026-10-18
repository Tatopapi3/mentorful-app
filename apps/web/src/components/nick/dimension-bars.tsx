import { DIMENSIONS, DIMENSION_LABEL, type Dimension } from "@/lib/report/stats";

const SUB: Record<Dimension, string> = {
  structural: "Mentoring network",
  relational: "Psychological safety",
  cognitive: "Shared instructional language",
  efficacy: "Collective efficacy",
};

/** The four dimension averages in the bar style of the existing overview, with a 95% band. */
export default function NickDimensionBars({ means, ci }: { means: Record<Dimension, number>; ci: Record<Dimension, number> }) {
  return (
    <div>
      {DIMENSIONS.map((d) => {
        const lo = Math.max(1, means[d] - ci[d]);
        const hi = Math.min(6, means[d] + ci[d]);
        return (
          <div key={d} className="nk-dim">
            <span>
              {DIMENSION_LABEL[d]}
              <small>{SUB[d]}</small>
            </span>
            <span className="adm-track" role="img" aria-label={`${DIMENSION_LABEL[d]}: ${means[d].toFixed(2)} out of 6, plus or minus ${ci[d].toFixed(2)}`}>
              <i style={{ width: `${(means[d] / 6) * 100}%` }} />
              <span className="nk-band" style={{ left: `${(lo / 6) * 100}%`, width: `${((hi - lo) / 6) * 100}%` }} />
            </span>
            <b>
              {means[d].toFixed(2)} <small>±{ci[d].toFixed(2)}</small>
            </b>
          </div>
        );
      })}
      <p className="adm-foot">The bracket is a 95% band on the average. It widens as fewer people respond.</p>
    </div>
  );
}
