import SlideShell from "./SlideShell";
import { ACTIONS, DRAFT_COPY, SLIDE_COUNT } from "@/lib/report/deck";
import { DIMENSION_LABEL, type Dimension } from "@/lib/report/stats";
import { T, wrapText } from "@/lib/report/svg";

/** Slide 6 — what to do about it. */
export default function ActionsSlide({
  weakest,
  synthetic,
  footerLeft,
}: {
  weakest: Dimension;
  synthetic: boolean;
  footerLeft: string;
}) {
  return (
    <SlideShell
      title={ACTIONS.title}
      subtitle={ACTIONS.subtitle}
      synthetic={synthetic}
      slideNumber={6}
      slideCount={SLIDE_COUNT}
      footerLeft={footerLeft}
      draft={DRAFT_COPY}
    >
      {(area) => {
        const rowH = area.h / ACTIONS.items.length;
        return (
          <g>
            {ACTIONS.items.map((item, i) => {
              const y = area.y + i * rowH;
              // The action tracks the data rather than restating a fixed guess.
              const text = item.text.replace("{weakest}", DIMENSION_LABEL[weakest]);
              const lines = wrapText(text, area.w - 96, 19);
              return (
                <g key={item.heading}>
                  <circle cx={area.x + 22} cy={y + 16} r={20} fill={T.series} />
                  <text
                    x={area.x + 22}
                    y={y + 23}
                    fontSize={20}
                    fontWeight={600}
                    fill={T.surface}
                    textAnchor="middle"
                  >
                    {i + 1}
                  </text>
                  <text x={area.x + 68} y={y + 24} fontSize={25} fontWeight={600} fill={T.inkPrimary}>
                    {item.heading}
                  </text>
                  {lines.map((line, j) => (
                    <text
                      key={`l-${j}`}
                      x={area.x + 68}
                      y={y + 56 + j * 26}
                      fontSize={19}
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
