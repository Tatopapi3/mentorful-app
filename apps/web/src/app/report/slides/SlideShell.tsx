import type { ReactNode } from "react";
import {
  BANNER_H,
  FINDING_LEADING,
  FINDING_SIZE,
  FOOTER_SIZE,
  MARGIN,
  SLIDE_H,
  SLIDE_W,
  SUBTITLE_LEADING,
  SUBTITLE_SIZE,
  TITLE_SIZE,
  slideLayout,
  type Rect,
} from "@/lib/report/deck";
import { FONT, T, wrapText } from "@/lib/report/svg";

/**
 * The 16:9 slide frame. Draws the chrome — banner, title, wrapped subtitle,
 * wrapped finding sentence, footer — and hands the leftover area to the body.
 *
 * There is deliberately no <title> element: SVG renders it as a hover tooltip,
 * which showed up floating over the graphic. Accessibility rides on
 * role="img" + aria-label instead, which exports cleanly.
 */
export default function SlideShell({
  title,
  subtitle,
  finding,
  synthetic,
  slideNumber,
  slideCount,
  footerLeft,
  draft = false,
  children,
}: {
  title: string;
  subtitle: string;
  finding?: string;
  synthetic: boolean;
  slideNumber: number;
  slideCount: number;
  footerLeft: string;
  draft?: boolean;
  children: (area: Rect) => ReactNode;
}) {
  const innerW = SLIDE_W - MARGIN * 2;
  const subtitleLines = wrapText(subtitle, innerW, SUBTITLE_SIZE);
  const findingLines = finding ? wrapText(finding, innerW, FINDING_SIZE) : [];

  const layout = slideLayout({
    subtitleLines: subtitleLines.length,
    findingLines: findingLines.length,
    synthetic,
  });

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${SLIDE_W} ${SLIDE_H}`}
      width="100%"
      data-slide={slideNumber}
      role="img"
      aria-label={`Slide ${slideNumber} of ${slideCount}. ${title}. ${subtitle} ${finding ?? ""}`}
      style={{ display: "block", fontFamily: FONT }}
    >
      <rect width={SLIDE_W} height={SLIDE_H} fill={T.surface} />

      {/* Unmissable when the numbers aren't real. A slide can be exported and
          presented on its own, so this has to travel with the pixels. */}
      {synthetic && (
        <g>
          <rect width={SLIDE_W} height={BANNER_H} fill={T.warning} />
          <text
            x={MARGIN}
            y={BANNER_H / 2 + 6}
            fontSize={17}
            fontWeight={700}
            fill={T.inkPrimary}
            letterSpacing={0.6}
          >
            SYNTHETIC DEMO DATA — NOT REAL STAFF RESPONSES
          </text>
        </g>
      )}

      <text x={MARGIN} y={layout.titleY} fontSize={TITLE_SIZE} fontWeight={600} fill={T.inkPrimary}>
        {title}
      </text>

      {subtitleLines.map((line, i) => (
        <text
          key={`sub-${i}`}
          x={MARGIN}
          y={layout.subtitleTop + i * SUBTITLE_LEADING}
          fontSize={SUBTITLE_SIZE}
          fill={T.inkSecondary}
        >
          {line}
        </text>
      ))}

      {children(layout.content)}

      {findingLines.map((line, i) => (
        <text
          key={`find-${i}`}
          x={MARGIN}
          y={layout.findingTop + i * FINDING_LEADING}
          fontSize={FINDING_SIZE}
          fill={T.inkPrimary}
        >
          {line}
        </text>
      ))}

      <line
        x1={MARGIN}
        x2={SLIDE_W - MARGIN}
        y1={layout.footerY - 26}
        y2={layout.footerY - 26}
        stroke={T.gridline}
        strokeWidth={1}
      />
      <text x={MARGIN} y={layout.footerY} fontSize={FOOTER_SIZE} fill={T.muted}>
        {footerLeft}
      </text>
      {draft && (
        <text
          x={SLIDE_W / 2}
          y={layout.footerY}
          fontSize={FOOTER_SIZE}
          fontWeight={600}
          fill={T.negative}
          textAnchor="middle"
        >
          DRAFT COPY — REPLACE BEFORE PRESENTING
        </text>
      )}
      <text
        x={SLIDE_W - MARGIN}
        y={layout.footerY}
        fontSize={FOOTER_SIZE}
        fill={T.muted}
        textAnchor="end"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {`${slideNumber} / ${slideCount}`}
      </text>
    </svg>
  );
}
