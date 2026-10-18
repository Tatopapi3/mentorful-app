import PptxGenJS from "pptxgenjs";
import { ACTIONS, DRAFT_COPY, INTRO, PANEL_COPY } from "./deck.ts";
import { buildFindings, fmtR, fmtScale } from "./findings.ts";
import { gateSentence, NETWORK_FLOOR, type Gates } from "./gates.ts";
import { cteScore } from "./headline.ts";
import { NEGLIGIBLE_PARTIAL, isNegligible, nodeRadius, samplingCaveat } from "./networkStyle.ts";
import { DIMENSIONS, DIMENSION_LABEL, type Dimension, type ReportStats } from "./stats.ts";

/**
 * The Culture Scan report as an editable PowerPoint deck, six slides like the on-screen report. The
 * deck is for editing; the PDF is for sharing. It is built from the same aggregate stats as the page, so
 * it carries the same rules: the CTE score as the headline, an early-look label below the report gate, a
 * locked network slide below the network floor, dashed faint ties, and the sampling caveat.
 *
 * Pure apart from the pptxgenjs object it returns: no database, no network.
 */

export type DeckMeta = {
  schoolName: string;
  dateLabel: string;
  gates: Gates;
  synthetic: boolean;
};

const INK = "1F1F1D";
const MUTED = "6B6A65";
const SERIES = "1E5F74";
const NEGATIVE = "B3362F";
const FAINT = "9AA3AA";
const AMBER = "FDF3DC";
const FONT = "Arial";

export function buildDeck(stats: ReportStats, meta: DeckMeta): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.title = `${meta.schoolName}: School Culture Scan`;

  const findings = buildFindings(stats);
  const cte = cteScore(stats);
  const early = meta.gates.early;
  const footer = `${meta.schoolName} · School Culture Scan · ${stats.n} respondents · Group averages only. Groups under ${meta.gates.cellFloor} people are never shown.`;

  const banner = (slide: PptxGenJS.Slide) => {
    const text = [
      early ? `Early look, not yet representative. ${gateSentence(meta.gates)}` : "",
      meta.synthetic ? "Synthetic demo data. Not real staff responses." : "",
    ]
      .filter(Boolean)
      .join("  ");
    if (!text) return;
    slide.addText(text, { x: 0.6, y: 0.12, w: 12.1, h: 0.4, fontFace: FONT, fontSize: 11, color: INK, fill: { color: AMBER }, margin: 6 });
  };

  const addSlide = (title: string, subtitle?: string) => {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    banner(slide);
    slide.addText(title, { x: 0.6, y: 0.65, w: 12.1, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: INK });
    if (subtitle) slide.addText(subtitle, { x: 0.6, y: 1.3, w: 12.1, h: 0.6, fontFace: FONT, fontSize: 14, color: MUTED, valign: "top" });
    slide.addText(footer, { x: 0.6, y: 6.95, w: 12.1, h: 0.35, fontFace: FONT, fontSize: 9, color: MUTED });
    if (DRAFT_COPY) slide.addText("Draft copy", { x: 11.4, y: 6.95, w: 1.3, h: 0.35, fontFace: FONT, fontSize: 9, color: MUTED, align: "right" });
    return slide;
  };

  // 1. Title and the headline score
  {
    const s = addSlide(INTRO.title, INTRO.subtitle);
    s.addText(meta.schoolName, { x: 0.6, y: 2.2, w: 12.1, h: 0.6, fontFace: FONT, fontSize: 24, color: INK });
    s.addText(cte.score.toFixed(1), { x: 0.6, y: 3.0, w: 3.2, h: 1.5, fontFace: FONT, fontSize: 80, bold: true, color: SERIES });
    s.addText(
      `CTE score, out of 6.\nThe Efficacy average: staff's shared belief that together they can move outcomes.\n±${cte.ciHalfWidth.toFixed(1)} (95%) · n = ${cte.n}`,
      { x: 4.0, y: 3.15, w: 8.7, h: 1.3, fontFace: FONT, fontSize: 15, color: MUTED, valign: "middle" },
    );
    s.addText(`${meta.dateLabel}`, { x: 0.6, y: 5.0, w: 6, h: 0.4, fontFace: FONT, fontSize: 12, color: MUTED });
  }

  // 2. Average of each dimension
  {
    const s = addSlide(PANEL_COPY.bars.title, PANEL_COPY.bars.subtitle);
    s.addChart(
      "bar",
      [{ name: "Average (1 to 6)", labels: DIMENSIONS.map((d) => DIMENSION_LABEL[d]), values: DIMENSIONS.map((d) => Number(stats.dimensions[d].mean.toFixed(2))) }],
      {
        x: 0.6, y: 2.0, w: 7.4, h: 4.6, barDir: "col", chartColors: [SERIES],
        valAxisMinVal: 1, valAxisMaxVal: 6, valAxisMajorUnit: 1, showValue: true, dataLabelFormatCode: "0.0",
        catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, dataLabelFontSize: 12, showLegend: false,
      },
    );
    s.addText(findings.loadBearing.finding.sentence, { x: 8.4, y: 2.2, w: 4.3, h: 3.2, fontFace: FONT, fontSize: 15, color: INK, valign: "top" });
    s.addText(
      DIMENSIONS.map((d) => `${DIMENSION_LABEL[d]}  ${fmtScale(stats.dimensions[d].mean)} ±${stats.dimensions[d].ciHalfWidth.toFixed(1)}`).join("\n"),
      { x: 8.4, y: 5.3, w: 4.3, h: 1.3, fontFace: FONT, fontSize: 11, color: MUTED, valign: "top" },
    );
  }

  // 3. The network, or the reason it is locked
  {
    const s = addSlide(PANEL_COPY.network.title, PANEL_COPY.network.subtitle);
    if (!meta.gates.network) {
      s.addText(`Locked. The network needs at least ${NETWORK_FLOOR} responses, however many staff there are. This school has ${stats.n}. The averages and the efficacy-structure gap are unaffected.`, {
        x: 0.6, y: 2.4, w: 10.5, h: 1.6, fontFace: FONT, fontSize: 20, color: INK, valign: "top",
      });
    } else {
      const pos: Record<Dimension, { x: number; y: number }> = {
        structural: { x: 2.6, y: 2.9 },
        relational: { x: 7.0, y: 2.9 },
        cognitive: { x: 7.0, y: 5.5 },
        efficacy: { x: 2.6, y: 5.5 },
      };
      const diameter = (d: Dimension) => (nodeRadius(stats.dimensions[d].mean) / 46) * 1.1;
      for (let i = 0; i < DIMENSIONS.length; i++) {
        for (let j = i + 1; j < DIMENSIONS.length; j++) {
          const a = pos[DIMENSIONS[i]];
          const b = pos[DIMENSIONS[j]];
          const value = stats.partial[i][j];
          const faint = isNegligible(value);
          s.addShape("line", {
            x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y),
            flipV: (b.x - a.x) * (b.y - a.y) < 0,
            line: { color: faint ? FAINT : value > 0 ? SERIES : NEGATIVE, width: faint ? 1 : 1.5 + Math.abs(value) * 8, dashType: faint ? "dash" : "solid" },
          });
          s.addText(fmtR(value), { x: (a.x + b.x) / 2 - 0.35, y: (a.y + b.y) / 2 - 0.17, w: 0.7, h: 0.34, align: "center", fontFace: FONT, fontSize: 11, color: MUTED, fill: { color: "FFFFFF" } });
        }
      }
      for (const d of DIMENSIONS) {
        const dia = diameter(d);
        s.addShape("ellipse", { x: pos[d].x - dia / 2, y: pos[d].y - dia / 2, w: dia, h: dia, fill: { color: "FFFFFF" }, line: { color: SERIES, width: 2.5 } });
        s.addText(`${DIMENSION_LABEL[d]}\n${fmtScale(stats.dimensions[d].mean)}`, { x: pos[d].x - dia / 2, y: pos[d].y - dia / 2, w: dia, h: dia, align: "center", valign: "middle", fontFace: FONT, fontSize: 11, bold: true, color: INK });
      }
      s.addText(
        `Line thickness = strength. Dashed = no direct tie (under ${NEGLIGIBLE_PARTIAL}). Node size = average.\n${samplingCaveat(stats.n)}`,
        { x: 9.4, y: 3.0, w: 3.3, h: 2.4, fontFace: FONT, fontSize: 12, color: MUTED, valign: "top" },
      );
      s.addText(findings.network.finding.sentence, { x: 9.4, y: 5.2, w: 3.3, h: 1.6, fontFace: FONT, fontSize: 11, color: INK, valign: "top" });
    }
  }

  // 4. Efficacy minus Structure
  {
    const s = addSlide(PANEL_COPY.gap.title, PANEL_COPY.gap.subtitles[findings.gap.gapCase]);
    s.addText(fmtScale(findings.gap.efficacyMean), { x: 0.8, y: 2.3, w: 2.6, h: 1.2, fontFace: FONT, fontSize: 60, bold: true, color: SERIES });
    s.addText("Efficacy", { x: 0.8, y: 3.5, w: 2.6, h: 0.4, fontFace: FONT, fontSize: 14, color: MUTED });
    s.addText(fmtScale(findings.gap.structuralMean), { x: 4.0, y: 2.3, w: 2.6, h: 1.2, fontFace: FONT, fontSize: 60, bold: true, color: INK });
    s.addText("Structural", { x: 4.0, y: 3.5, w: 2.6, h: 0.4, fontFace: FONT, fontSize: 14, color: MUTED });
    s.addText(findings.gap.finding.sentence, { x: 0.8, y: 4.3, w: 11.8, h: 2.3, fontFace: FONT, fontSize: 17, color: INK, valign: "top" });
  }

  // 5. Start here
  {
    const s = addSlide(PANEL_COPY.startHere.title, PANEL_COPY.startHere.subtitle);
    s.addText(DIMENSION_LABEL[findings.weakest.dimension], { x: 0.8, y: 2.2, w: 6, h: 0.9, fontFace: FONT, fontSize: 40, bold: true, color: SERIES });
    s.addText(findings.weakest.finding.sentence, { x: 0.8, y: 3.3, w: 11.8, h: 2.2, fontFace: FONT, fontSize: 18, color: INK, valign: "top" });
  }

  // 6. Where to start
  {
    const s = addSlide(ACTIONS.title, ACTIONS.subtitle);
    ACTIONS.items.forEach((item, i) => {
      const y = 2.2 + i * 1.5;
      s.addShape("ellipse", { x: 0.8, y, w: 0.5, h: 0.5, fill: { color: SERIES }, line: { color: SERIES } });
      s.addText(String(i + 1), { x: 0.8, y, w: 0.5, h: 0.5, align: "center", valign: "middle", fontFace: FONT, fontSize: 14, bold: true, color: "FFFFFF" });
      s.addText(item.heading, { x: 1.55, y: y - 0.05, w: 11, h: 0.5, fontFace: FONT, fontSize: 18, bold: true, color: INK });
      s.addText(item.text.replace("{weakest}", DIMENSION_LABEL[findings.weakest.dimension]), { x: 1.55, y: y + 0.45, w: 11, h: 0.8, fontFace: FONT, fontSize: 13, color: MUTED, valign: "top" });
    });
  }

  return pptx;
}

export async function deckBuffer(stats: ReportStats, meta: DeckMeta): Promise<Buffer> {
  const out = await buildDeck(stats, meta).write({ outputType: "nodebuffer" });
  return out as Buffer;
}
