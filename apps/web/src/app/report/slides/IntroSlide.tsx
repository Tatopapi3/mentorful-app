import SlideShell from "./SlideShell";
import { DRAFT_COPY, INTRO, SLIDE_COUNT } from "@/lib/report/deck";
import { T, wrapText } from "@/lib/report/svg";

/** Slide 1 — what the scan measures and what the four dimensions are. */
export default function IntroSlide({
  synthetic,
  footerLeft,
}: {
  synthetic: boolean;
  footerLeft: string;
}) {
  return (
    <SlideShell
      title={INTRO.title}
      subtitle={INTRO.subtitle}
      synthetic={synthetic}
      slideNumber={1}
      slideCount={SLIDE_COUNT}
      footerLeft={footerLeft}
      draft={DRAFT_COPY}
    >
      {(area) => {
        const bodyLines = wrapText(INTRO.body, area.w, 19);
        const gridTop = area.y + bodyLines.length * 27 + 34;

        const colW = (area.w - 64) / 2;
        const rowH = Math.max(96, (area.y + area.h - gridTop) / 2);

        return (
          <g>
            {bodyLines.map((line, i) => (
              <text key={`b-${i}`} x={area.x} y={area.y + i * 27} fontSize={19} fill={T.inkSecondary}>
                {line}
              </text>
            ))}

            {INTRO.dimensions.map((d, i) => {
              const cx = area.x + (i % 2) * (colW + 64);
              const cy = gridTop + Math.floor(i / 2) * rowH;
              const textLines = wrapText(d.text, colW, 17);
              return (
                <g key={d.key}>
                  <line x1={cx} x2={cx + 40} y1={cy} y2={cy} stroke={T.series} strokeWidth={3} />
                  <text x={cx} y={cy + 32} fontSize={24} fontWeight={600} fill={T.inkPrimary}>
                    {d.heading}
                  </text>
                  {textLines.map((line, j) => (
                    <text
                      key={`t-${j}`}
                      x={cx}
                      y={cy + 60 + j * 24}
                      fontSize={17}
                      fill={T.inkSecondary}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            })}
          </g>
        );
      }}
    </SlideShell>
  );
}
