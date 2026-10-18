import SlideShell from "./SlideShell";
import { PANEL_COPY, SLIDE_COUNT } from "@/lib/report/deck";
import { T, wrapText } from "@/lib/report/svg";

/**
 * Slide 3 when the network gate is closed. Correlations need an absolute sample whatever the response
 * percentage, so a small school sees its scores and the efficacy-structure gap but not the network.
 */
export default function NetworkLockedSlide({
  n,
  floor,
  synthetic,
  footerLeft,
}: {
  n: number;
  floor: number;
  synthetic: boolean;
  footerLeft: string;
}) {
  const lines = wrapText(
    `The network needs at least ${floor} responses, however many staff there are. This school has ${n}. The dimension averages and the efficacy-structure gap on the other slides are unaffected.`,
    900,
    22,
  );
  return (
    <SlideShell
      title={PANEL_COPY.network.title}
      subtitle="Not enough responses yet to show how the four dimensions connect"
      synthetic={synthetic}
      slideNumber={3}
      slideCount={SLIDE_COUNT}
      footerLeft={footerLeft}
    >
      {(area) => (
        <g>
          <text x={area.x} y={area.y + 20} fontSize={30} fontWeight={600} fill={T.inkPrimary}>
            Locked
          </text>
          {lines.map((line, i) => (
            <text key={i} x={area.x} y={area.y + 70 + i * 32} fontSize={22} fill={T.inkSecondary}>
              {line}
            </text>
          ))}
        </g>
      )}
    </SlideShell>
  );
}
