import SlideShell from "./SlideShell";
import { PANEL_COPY, SLIDE_COUNT } from "@/lib/report/deck";
import { DIMENSION_LABEL, SCALE_MAX, SCALE_MIN } from "@/lib/report/stats";
import { fmtScale, type EfficacyStructureGap } from "@/lib/report/findings";
import { T, makeScale, textWidth } from "@/lib/report/svg";

/**
 * Slide 4 — the efficacy–structure gap.
 *
 * The gap is a single number, so the form is a hero figure, not a chart. The
 * 1–6 strip underneath shows *where* on the scale the two sit: a bare "1.4"
 * can't distinguish 5.0→3.6 from 3.0→1.6, and the advice differs.
 */
export default function GapSlide({
  gap,
  finding,
  synthetic,
  footerLeft,
}: {
  gap: EfficacyStructureGap;
  finding: string;
  synthetic: boolean;
  footerLeft: string;
}) {
  return (
    <SlideShell
      title={PANEL_COPY.gap.title}
      subtitle={PANEL_COPY.gap.subtitles[gap.gapCase]}
      finding={finding}
      synthetic={synthetic}
      slideNumber={4}
      slideCount={SLIDE_COUNT}
      footerLeft={footerLeft}
    >
      {(area) => {
        const heroSize = 132;
        const heroText = fmtScale(Math.abs(gap.gap));
        const heroW = textWidth(heroText, heroSize);
        const heroBaseline = area.y + heroSize * 0.82;

        const axisY = area.y + area.h - 46;
        const x = makeScale(SCALE_MIN, SCALE_MAX, area.x + 20, area.x + area.w - 20);
        const ticks = Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, i) => SCALE_MIN + i);

        const xStructural = x(gap.structuralMean);
        const xEfficacy = x(gap.efficacyMean);
        const collide = Math.abs(xEfficacy - xStructural) < 300;

        const direction =
          gap.gapCase === "belief-ahead"
            ? "Efficacy ahead of Structural"
            : gap.gapCase === "structure-ahead"
              ? "Structural ahead of Efficacy"
              : "Efficacy and Structural level";

        return (
          <g>
            <text
              x={area.x}
              y={heroBaseline}
              fontSize={heroSize}
              fontWeight={600}
              fill={T.inkPrimary}
            >
              {heroText}
            </text>
            <text x={area.x + heroW + 28} y={heroBaseline - 58} fontSize={22} fill={T.muted}>
              points of separation
            </text>
            <text x={area.x + heroW + 28} y={heroBaseline - 22} fontSize={24} fill={T.inkPrimary}>
              {direction}
            </text>
            <text x={area.x + heroW + 28} y={heroBaseline + 12} fontSize={20} fill={T.inkSecondary}>
              {`${DIMENSION_LABEL.efficacy} ${fmtScale(gap.efficacyMean)} · ${DIMENSION_LABEL.structural} ${fmtScale(gap.structuralMean)}`}
            </text>

            <line
              x1={x(SCALE_MIN)}
              x2={x(SCALE_MAX)}
              y1={axisY}
              y2={axisY}
              stroke={T.gridline}
              strokeWidth={2}
            />
            {ticks.map((t) => (
              <g key={`t-${t}`}>
                <line
                  x1={x(t)}
                  x2={x(t)}
                  y1={axisY - 7}
                  y2={axisY + 7}
                  stroke={T.baseline}
                  strokeWidth={2}
                />
                <text
                  x={x(t)}
                  y={axisY + 34}
                  fontSize={18}
                  fill={T.muted}
                  textAnchor="middle"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {t}
                </text>
              </g>
            ))}

            <line
              x1={xStructural}
              x2={xEfficacy}
              y1={axisY}
              y2={axisY}
              stroke={T.series}
              strokeWidth={6}
              strokeLinecap="round"
            />
            {[
              { cx: xStructural, label: DIMENSION_LABEL.structural, v: gap.structuralMean, dy: 0 },
              {
                cx: xEfficacy,
                label: DIMENSION_LABEL.efficacy,
                v: gap.efficacyMean,
                dy: collide ? -32 : 0,
              },
            ].map((p) => (
              <g key={p.label}>
                <circle cx={p.cx} cy={axisY} r={11} fill={T.series} stroke={T.surface} strokeWidth={4} />
                <text
                  x={p.cx}
                  y={axisY - 26 + p.dy}
                  fontSize={20}
                  fill={T.inkSecondary}
                  textAnchor="middle"
                >
                  {`${p.label} ${fmtScale(p.v)}`}
                </text>
              </g>
            ))}
          </g>
        );
      }}
    </SlideShell>
  );
}
