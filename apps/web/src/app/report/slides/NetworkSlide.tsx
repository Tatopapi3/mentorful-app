import SlideShell from "./SlideShell";
import { PANEL_COPY, SLIDE_COUNT } from "@/lib/report/deck";
import { DIMENSIONS, DIMENSION_LABEL, type Dimension, type ReportStats } from "@/lib/report/stats";
import { fmtR, fmtScale } from "@/lib/report/findings";
import { T, type Pt, quadPoint, shiftToward, textWidth } from "@/lib/report/svg";

/**
 * Slide 3 — the four-node partial-correlation network.
 *
 * Node order is canonical clockwise from top-left: Structural, Relational,
 * Cognitive, Efficacy. Layout is a fixed rectangle rather than force-directed —
 * a report must render identically every time, and with four nodes the K4
 * shows all six edges without occlusion.
 *
 * thickness → |partial| · color → sign (blue ↔ red) · gray → below threshold,
 * where the sign isn't meaningful. Every edge also carries its printed value,
 * so nothing depends on color alone.
 */

const NEGLIGIBLE = 0.15;

export default function NetworkSlide({
  stats,
  finding,
  synthetic,
  footerLeft,
}: {
  stats: ReportStats;
  finding: string;
  synthetic: boolean;
  footerLeft: string;
}) {
  return (
    <SlideShell
      title={PANEL_COPY.network.title}
      subtitle={PANEL_COPY.network.subtitle}
      finding={finding}
      synthetic={synthetic}
      slideNumber={3}
      slideCount={SLIDE_COUNT}
      footerLeft={footerLeft}
    >
      {(area) => {
        // Legend sits to the right, so the graph keeps the vertical room.
        const graphW = area.w - 340;
        const cx = area.x + graphW / 2;
        const cy = area.y + area.h / 2;
        const r = 52;
        const halfW = Math.min(300, graphW / 2 - 90);
        const halfH = Math.max(70, Math.min(124, area.h / 2 - r - 16));

        const POS: Record<Dimension, Pt> = {
          structural: { x: cx - halfW, y: cy - halfH },
          relational: { x: cx + halfW, y: cy - halfH },
          cognitive: { x: cx + halfW, y: cy + halfH },
          efficacy: { x: cx - halfW, y: cy + halfH },
        };

        const edges = [];
        for (let i = 0; i < DIMENSIONS.length; i++) {
          for (let j = i + 1; j < DIMENSIONS.length; j++) {
            const a = DIMENSIONS[i];
            const b = DIMENSIONS[j];
            const value = stats.partial[i][j];
            const p0 = POS[a];
            const p2 = POS[b];
            const isDiagonal = j - i === 2;
            const mid = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
            let c: Pt = mid;
            if (isDiagonal) {
              const dx = p2.x - p0.x;
              const dy = p2.y - p0.y;
              const len = Math.hypot(dx, dy) || 1;
              const bow = i === 0 ? 54 : -54;
              c = { x: mid.x + (-dy / len) * bow, y: mid.y + (dx / len) * bow };
            }
            const start = shiftToward(p0, c, r);
            const end = shiftToward(p2, c, r);
            edges.push({
              key: `${a}-${b}`,
              value,
              start,
              end,
              c,
              labelAt: quadPoint(start, c, end, isDiagonal ? 0.3 : 0.5),
            });
          }
        }

        const hasNegative = edges.some((e) => e.value <= -NEGLIGIBLE);
        const hasNegligible = edges.some((e) => Math.abs(e.value) < NEGLIGIBLE);
        const legend = [
          { color: T.series, text: "Positive tie" },
          ...(hasNegative ? [{ color: T.negative, text: "Negative tie" }] : []),
          ...(hasNegligible ? [{ color: T.baseline, text: `No direct tie (|r| < ${NEGLIGIBLE})` }] : []),
        ];
        const legendX = area.x + area.w - 300;
        const legendTop = cy - (legend.length * 42) / 2;

        return (
          <g>
            {edges.map((e) => (
              <path
                key={e.key}
                d={`M ${e.start.x} ${e.start.y} Q ${e.c.x} ${e.c.y} ${e.end.x} ${e.end.y}`}
                fill="none"
                stroke={
                  Math.abs(e.value) < NEGLIGIBLE
                    ? T.baseline
                    : e.value > 0
                      ? T.series
                      : T.negative
                }
                strokeWidth={Math.abs(e.value) < NEGLIGIBLE ? 2.5 : 3 + Math.abs(e.value) * 16}
                strokeLinecap="round"
              />
            ))}

            {edges.map((e) => {
              const label = fmtR(e.value);
              const w = textWidth(label, 20) + 16;
              return (
                <g key={`lbl-${e.key}`}>
                  <rect
                    x={e.labelAt.x - w / 2}
                    y={e.labelAt.y - 15}
                    width={w}
                    height={30}
                    rx={6}
                    fill={T.surface}
                  />
                  <text
                    x={e.labelAt.x}
                    y={e.labelAt.y + 7}
                    fontSize={20}
                    fill={T.inkSecondary}
                    textAnchor="middle"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Name and value live inside the node, so the graph needs no
                external label ring and keeps its vertical room. */}
            {DIMENSIONS.map((d) => {
              const p = POS[d];
              return (
                <g key={d}>
                  <circle cx={p.x} cy={p.y} r={r} fill={T.surface} stroke={T.series} strokeWidth={4} />
                  <text
                    x={p.x}
                    y={p.y - 4}
                    fontSize={15}
                    fill={T.inkSecondary}
                    textAnchor="middle"
                  >
                    {DIMENSION_LABEL[d]}
                  </text>
                  <text
                    x={p.x}
                    y={p.y + 24}
                    fontSize={26}
                    fontWeight={600}
                    fill={T.inkPrimary}
                    textAnchor="middle"
                  >
                    {fmtScale(stats.dimensions[d].mean)}
                  </text>
                </g>
              );
            })}

            {legend.map((item, i) => (
              <g key={item.text}>
                <line
                  x1={legendX}
                  x2={legendX + 30}
                  y1={legendTop + i * 42}
                  y2={legendTop + i * 42}
                  stroke={item.color}
                  strokeWidth={5}
                  strokeLinecap="round"
                />
                <text
                  x={legendX + 44}
                  y={legendTop + i * 42 + 6}
                  fontSize={18}
                  fill={T.inkSecondary}
                >
                  {item.text}
                </text>
              </g>
            ))}
            <text
              x={legendX}
              y={legendTop + legend.length * 42 + 16}
              fontSize={15}
              fill={T.muted}
            >
              Line thickness = strength
            </text>
          </g>
        );
      }}
    </SlideShell>
  );
}
