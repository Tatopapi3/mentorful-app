import PptxGenJS from "pptxgenjs";
import type { Deck, DeckBlock, DeckSlide } from "./deck";

/*
 * The leadership deck as a PowerPoint file (13.33 by 7.5 inches). Everything is real text and shapes, so the admin can
 * edit any slide. Colours match the Blend look.
 */
const INK = "1E2A33";
const MUTED = "66707A";
const TEAL = "00796B";
const CREAM = "F8F5EF";
const PANEL = "FFFEFB";
const LINE = "D9D6CF";
const NAVY = "16283C";
const SERIF = "Georgia";
const SANS = "Calibri";
const MONO = "Courier New";
const X = 0.7;
const W = 11.93;

export async function deckToPptx(deck: Deck): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = `${deck.school} · Mentorful leadership summary`;
  pptx.company = "Mentorful";
  deck.slides.forEach((s, i) => (s.cover ? cover(pptx, s, deck) : content(pptx, s, deck, i + 1)));
  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}

function cover(pptx: PptxGenJS, s: DeckSlide, deck: Deck) {
  const slide = pptx.addSlide();
  slide.background = { color: NAVY };
  slide.addText(s.kicker.toUpperCase(), { x: X, y: 1.5, w: W, h: 0.4, fontFace: MONO, fontSize: 12, color: "5ED4C4", charSpacing: 4 });
  slide.addText(s.title, { x: X, y: 2.0, w: W, h: 1.6, fontFace: SERIF, fontSize: 44, bold: true, color: "F6F3EC", valign: "top", fit: "shrink" });
  if (s.lead) slide.addText(s.lead, { x: X, y: 3.8, w: 10.5, h: 1.2, fontFace: SANS, fontSize: 20, color: "C9D3DC", valign: "top" });
  slide.addText(`${deck.cycle} · ${deck.date}`, { x: X, y: 6.3, w: W, h: 0.4, fontFace: MONO, fontSize: 12, color: "8FA0AE" });
}

function content(pptx: PptxGenJS, s: DeckSlide, deck: Deck, n: number) {
  const slide = pptx.addSlide();
  slide.background = { color: CREAM };
  slide.addText(s.kicker.toUpperCase(), { x: X, y: 0.45, w: W, h: 0.3, fontFace: MONO, fontSize: 11, color: TEAL, charSpacing: 3 });
  slide.addText(s.title, { x: X, y: 0.8, w: W, h: 0.9, fontFace: SERIF, fontSize: 30, bold: true, color: INK, valign: "top", fit: "shrink" });
  let y = 1.85;
  if (s.lead) {
    slide.addText(s.lead, { x: X, y, w: 11.4, h: 0.8, fontFace: SANS, fontSize: 15, color: MUTED, valign: "top" });
    y += 0.95;
  }
  for (const b of s.blocks) y = block(slide, b, y);
  slide.addText(`Mentorful · ${deck.school} · ${deck.cycle} · Counts only: no names, answers or conversations`, { x: X, y: 7.0, w: 10.5, h: 0.3, fontFace: SANS, fontSize: 9, color: MUTED });
  slide.addText(String(n), { x: 12.0, y: 7.0, w: 0.63, h: 0.3, fontFace: MONO, fontSize: 9, color: MUTED, align: "right" });
}

function block(slide: PptxGenJS.Slide, b: DeckBlock, y: number): number {
  if (b.kind === "stats") {
    const gap = 0.3;
    const w = (W - gap * (b.items.length - 1)) / b.items.length;
    b.items.forEach((it, i) => {
      const x = X + i * (w + gap);
      slide.addShape("roundRect", { x, y, w, h: 2.2, fill: { color: PANEL }, line: { color: LINE, width: 1 }, rectRadius: 0.12 });
      slide.addText(it.value, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.95, fontFace: SERIF, fontSize: 44, bold: true, color: TEAL, valign: "middle" });
      slide.addText(it.label, { x: x + 0.25, y: y + 1.2, w: w - 0.5, h: 0.4, fontFace: SANS, fontSize: 15, bold: true, color: INK, valign: "top" });
      slide.addText(it.note, { x: x + 0.25, y: y + 1.6, w: w - 0.5, h: 0.4, fontFace: SANS, fontSize: 12, color: MUTED, valign: "top" });
    });
    return y + 2.5;
  }
  if (b.kind === "bars") {
    const rowH = 0.7;
    const trackX = X + 4.0;
    const trackW = 6.2;
    b.rows.forEach((r, i) => {
      const ry = y + i * rowH;
      slide.addText(r.label, { x: X, y: ry, w: 3.9, h: 0.5, fontFace: SANS, fontSize: 15, color: INK, valign: "middle" });
      slide.addShape("roundRect", { x: trackX, y: ry + 0.12, w: trackW, h: 0.26, fill: { color: "E7E4DD" }, line: { type: "none" }, rectRadius: 0.13 });
      const fill = Math.max(0.05, Math.min(1, r.value / r.max)) * trackW;
      slide.addShape("roundRect", { x: trackX, y: ry + 0.12, w: fill, h: 0.26, fill: { color: TEAL }, line: { type: "none" }, rectRadius: 0.13 });
      slide.addText(r.text, { x: trackX + trackW + 0.2, y: ry, w: 1.5, h: 0.5, fontFace: MONO, fontSize: 13, bold: true, color: INK, valign: "middle" });
    });
    return y + b.rows.length * rowH + 0.15;
  }
  if (b.kind === "table") {
    const head = b.head.map((t) => ({ text: t, options: { bold: true, color: MUTED, fontFace: MONO, fontSize: 11, fill: { color: "EFEBE2" } } }));
    const rows = b.rows.map((r) => r.map((t, i) => ({ text: t, options: { color: INK, fontFace: SANS, fontSize: 14, bold: i === 0 } })));
    slide.addTable([head, ...rows], { x: X, y, w: W, colW: [3.4, 1.6, 2.0, 2.6, 2.33], border: { type: "solid", color: LINE, pt: 0.75 }, fill: { color: PANEL }, rowH: 0.42, valign: "middle", margin: [0.04, 0.12, 0.04, 0.12] });
    return y + (b.rows.length + 1) * 0.42 + 0.3;
  }
  if (b.kind === "points") {
    b.items.forEach((it, i) => {
      const py = y + i * 1.05;
      slide.addShape("rect", { x: X, y: py + 0.05, w: 0.08, h: 0.85, fill: { color: TEAL }, line: { type: "none" } });
      slide.addText(
        [
          { text: it.title, options: { bold: true, fontSize: 18, fontFace: SERIF, color: INK, breakLine: true } },
          { text: it.detail, options: { fontSize: 14, fontFace: SANS, color: MUTED } },
        ],
        { x: X + 0.3, y: py, w: W - 0.3, h: 0.95, valign: "top" },
      );
    });
    return y + b.items.length * 1.05 + 0.1;
  }
  slide.addText(b.text, { x: X, y, w: W, h: 0.5, fontFace: SANS, fontSize: 12, italic: true, color: MUTED, valign: "top" });
  return y + 0.6;
}
