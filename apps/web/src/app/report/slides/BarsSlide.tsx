import SlideShell from "./SlideShell";
import { PANEL_COPY, SLIDE_COUNT } from "@/lib/report/deck";
import { DIMENSIONS, DIMENSION_LABEL, SCALE_MAX, SCALE_MIN, type ReportStats } from "@/lib/report/stats";
import { fmtScale } from "@/lib/report/findings";
import { T, barPath, makeScale } from "@/lib/report/svg";

/**
 * Slide 2 — dimension means with 95% confidence bands.
 *
 * One series, so one color for every bar: a per-bar ramp would double-encode
 * length as hue. Every bar is direct-labeled, so no value depends on a tooltip
 * a static slide cannot have.
 */
export default function BarsSlide({
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
      title={PANEL_COPY.bars.title}
      subtitle={PANEL_COPY.bars.subtitle}
      finding={finding}
      synthetic={synthetic}
      slideNumber={2}
      slideCount={SLIDE_COUNT}
      footerLeft={footerLeft}
    >
      {(area) => {
        const labelRight = area.x + 200;
        const x = makeScale(SCALE_MIN, SCALE_MAX, labelRight + 30, area.x + area.w - 110);
        const plotH = area.h - 38;
        const rowH = plotH / DIMENSIONS.length;
        const barH = Math.min(48, rowH * 0.44);
        const ticks = Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, i) => SCALE_MIN + i);

        return (
          <g>
            {ticks.map((t) => (
              <line
                key={`g-${t}`}
                x1={x(t)}
                x2={x(t)}
                y1={area.y}
                y2={area.y + plotH}
                stroke={t === SCALE_MIN ? T.baseline : T.gridline}
                strokeWidth={1}
              />
            ))}

            {DIMENSIONS.map((d, i) => {
              const stat = stats.dimensions[d];
              const cy = area.y + i * rowH + rowH / 2;
              const barY = cy - barH / 2;
              const xEnd = x(stat.mean);
              const xLo = x(stat.ciLow);
              const xHi = x(stat.ciHigh);

              return (
                <g key={d}>
                  <text
                    x={labelRight}
                    y={cy + 8}
                    fontSize={23}
                    fill={T.inkSecondary}
                    textAnchor="end"
                  >
                    {DIMENSION_LABEL[d]}
                  </text>
                  <path d={barPath(x(SCALE_MIN), xEnd, barY, barH, 6)} fill={T.series} />
                  <g stroke={T.seriesDark} strokeWidth={3} strokeLinecap="butt">
                    <line x1={xLo} x2={xHi} y1={cy} y2={cy} />
                    <line x1={xLo} x2={xLo} y1={cy - 13} y2={cy + 13} />
                    <line x1={xHi} x2={xHi} y1={cy - 13} y2={cy + 13} />
                  </g>
                  <text x={Math.max(xEnd, xHi) + 18} y={cy + 9} fontSize={25} fill={T.inkPrimary}>
                    {fmtScale(stat.mean)}
                  </text>
                </g>
              );
            })}

            {ticks.map((t) => (
              <text
                key={`t-${t}`}
                x={x(t)}
                y={area.y + plotH + 30}
                fontSize={18}
                fill={T.muted}
                textAnchor="middle"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {t}
              </text>
            ))}
          </g>
        );
      }}
    </SlideShell>
  );
}
