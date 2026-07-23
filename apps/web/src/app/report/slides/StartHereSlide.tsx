import SlideShell from "./SlideShell";
import { PANEL_COPY, SLIDE_COUNT } from "@/lib/report/deck";
import { DIMENSIONS, DIMENSION_LABEL, SCALE_MAX, SCALE_MIN, type ReportStats } from "@/lib/report/stats";
import { fmtScale, type Weakest } from "@/lib/report/findings";
import { T, barPath, makeScale } from "@/lib/report/svg";

/**
 * Slide 5 — the "start here" callout.
 *
 * Emphasis form: the target dimension carries the series hue and the other
 * three recede to gray. Every bar stays named and valued, so identity never
 * rests on color alone.
 */
export default function StartHereSlide({
  stats,
  weakest,
  finding,
  synthetic,
  footerLeft,
}: {
  stats: ReportStats;
  weakest: Weakest;
  finding: string;
  synthetic: boolean;
  footerLeft: string;
}) {
  return (
    <SlideShell
      title={PANEL_COPY.startHere.title}
      subtitle={PANEL_COPY.startHere.subtitle}
      finding={finding}
      synthetic={synthetic}
      slideNumber={5}
      slideCount={SLIDE_COUNT}
      footerLeft={footerLeft}
    >
      {(area) => {
        const headingBaseline = area.y + 76;
        const barsTop = headingBaseline + 54;
        const rowH = Math.max(44, (area.y + area.h - barsTop) / DIMENSIONS.length);
        const barH = Math.min(26, rowH * 0.5);
        const labelRight = area.x + 200;
        const x = makeScale(SCALE_MIN, SCALE_MAX, labelRight + 30, area.x + area.w - 110);

        return (
          <g>
            <text x={area.x} y={headingBaseline} fontSize={82} fontWeight={600} fill={T.inkPrimary}>
              {DIMENSION_LABEL[weakest.dimension]}
            </text>
            <text x={area.x} y={headingBaseline + 34} fontSize={21} fill={T.muted}>
              {`${fmtScale(weakest.mean)} of ${SCALE_MAX} · lowest of the four dimensions · ${fmtScale(
                weakest.gapToTop
              )} points below ${DIMENSION_LABEL[weakest.topDimension]}`}
            </text>

            <line
              x1={x(SCALE_MIN)}
              x2={x(SCALE_MIN)}
              y1={barsTop - 8}
              y2={barsTop + rowH * DIMENSIONS.length - 8}
              stroke={T.baseline}
              strokeWidth={1}
            />

            {DIMENSIONS.map((d, i) => {
              const stat = stats.dimensions[d];
              const isTarget = d === weakest.dimension;
              const cy = barsTop + i * rowH + rowH / 2 - 8;
              const xEnd = x(stat.mean);
              return (
                <g key={d}>
                  <text
                    x={labelRight}
                    y={cy + 7}
                    fontSize={21}
                    fontWeight={isTarget ? 600 : 400}
                    fill={isTarget ? T.inkPrimary : T.inkSecondary}
                    textAnchor="end"
                  >
                    {DIMENSION_LABEL[d]}
                  </text>
                  <path
                    d={barPath(x(SCALE_MIN), xEnd, cy - barH / 2, barH, 5)}
                    fill={isTarget ? T.series : T.deEmphasis}
                  />
                  <text
                    x={xEnd + 18}
                    y={cy + 8}
                    fontSize={22}
                    fontWeight={isTarget ? 600 : 400}
                    fill={isTarget ? T.inkPrimary : T.inkSecondary}
                  >
                    {fmtScale(stat.mean)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      }}
    </SlideShell>
  );
}
