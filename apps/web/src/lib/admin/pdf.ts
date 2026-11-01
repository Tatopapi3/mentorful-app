import { jsPDF } from "jspdf";
import type { Deck, DeckBlock, DeckSlide } from "./deck";
import { DIMENSIONS, DIMENSION_LABEL, type Dimension } from "@/lib/report/stats";
import { facultyOrbit } from "./faculty-orbit";
import type { AdminSnapshot } from "./facts";
import { coverage, departmentMatrix } from "./network";

/*
 * Real PDF files for the leadership deck, the board summary and the faculty connection, drawn straight from the same
 * numbers the pages show, so a click on "Download PDF" saves a file instead of opening the print dialog. Text stays
 * selectable and the files are small. Aggregates only: counts and rates, never a name, an answer or a conversation.
 * Drawn with the PDF's built-in Helvetica and Courier, so characters outside Latin-1 are simplified first.
 */

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = { ink: "#14122b", muted: "#65627f", line: "#e0def5", teal: "#0a7268", indigo: "#4f46e5", track: "#e8e7f7", head: "#efeefb", tealLight: "#5eead4", white: "#ffffff" };

const SIMPLE: [RegExp, string][] = [
  [/→/g, " to "],
  [/≥/g, ">="],
  [/≤/g, "<="],
  [/ | | /g, " "],
];
// Anything outside the PDF's standard text set would print as a stray symbol.
const OUTSIDE = /[^\x20-\x7E¡-ÿ–—‘’“”•…]/g;
export const clean = (s: string): string => SIMPLE.reduce((t, [re, to]) => t.replace(re, to), s).replace(OUTSIDE, "");

function fill(d: jsPDF, c: string) {
  d.setFillColor(...hex(c));
}
function stroke(d: jsPDF, c: string) {
  d.setDrawColor(...hex(c));
}
function ink(d: jsPDF, c: string) {
  d.setTextColor(...hex(c));
}

/** A smooth colour band drawn as thin strips (PDF text and shapes have no built-in gradient here). */
function gradient(d: jsPDF, x: number, y: number, w: number, h: number, from: string, to: string, steps = 64) {
  const a = hex(from);
  const b = hex(to);
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    d.setFillColor(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t));
    d.rect(x + (i * w) / steps, y, w / steps + 0.6, h, "F");
  }
}

type Face = { font: "helvetica" | "courier"; style?: "normal" | "bold" | "italic"; size: number; color: string };

/** Draws wrapped text whose top edge is `y`; returns the y below it. */
function paragraph(d: jsPDF, text: string, x: number, y: number, width: number, face: Face, lineHeight: number, opts: { charSpace?: number; align?: "left" | "right" | "center" } = {}): number {
  d.setFont(face.font, face.style ?? "normal");
  d.setFontSize(face.size);
  ink(d, face.color);
  const lines = d.splitTextToSize(clean(text), width) as string[];
  const first = y + lineHeight / 2 + face.size * 0.35;
  lines.forEach((ln, i) => d.text(ln, x, first + i * lineHeight, { charSpace: opts.charSpace ?? 0, align: opts.align ?? "left" }));
  return y + lines.length * lineHeight;
}

function wrapped(d: jsPDF, text: string, width: number, face: Pick<Face, "font" | "style" | "size">): string[] {
  d.setFont(face.font, face.style ?? "normal");
  d.setFontSize(face.size);
  return d.splitTextToSize(clean(text), width) as string[];
}

function bytes(d: jsPDF): ArrayBuffer {
  return d.output("arraybuffer");
}

export function pdfResponse(file: ArrayBuffer, filename: string): Response {
  return new Response(file, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}

/* ------------------------------------------------------------------------------------------------ leadership deck */

const SW = 960;
const SH = 540;
const CQ = SW / 100; // one slide-width percent, like the on-screen deck's cqw

function drawBlock(d: jsPDF, b: DeckBlock, x: number, y: number, w: number, k: number): number {
  const q = (n: number) => n * CQ * k;
  if (b.kind === "stats") {
    y += q(3);
    const gap = q(1.6);
    const cardW = (w - gap * (b.items.length - 1)) / b.items.length;
    const pad = q(1.8);
    const noteLines = b.items.map((i) => wrapped(d, i.note, cardW - pad * 2, { font: "helvetica", size: q(1.15) }));
    const labelLines = b.items.map((i) => wrapped(d, i.label, cardW - pad * 2, { font: "helvetica", style: "bold", size: q(1.45) }));
    const lh = q(1.15) * 1.3;
    const cardH = pad + q(4) * 1.05 + q(0.8) + Math.max(...labelLines.map((l) => l.length)) * q(1.45) * 1.25 + q(0.5) + Math.max(...noteLines.map((l) => l.length)) * lh + pad * 0.9;
    b.items.forEach((it, i) => {
      const cx = x + i * (cardW + gap);
      fill(d, C.white);
      stroke(d, C.line);
      d.setLineWidth(0.8);
      d.roundedRect(cx, y, cardW, cardH, q(1), q(1), "FD");
      let cy = y + pad;
      cy = paragraph(d, it.value, cx + pad, cy, cardW - pad * 2, { font: "helvetica", style: "bold", size: q(4), color: C.teal }, q(4) * 1.05) + q(0.8);
      cy = paragraph(d, it.label, cx + pad, cy, cardW - pad * 2, { font: "helvetica", style: "bold", size: q(1.45), color: C.ink }, q(1.45) * 1.25) + q(0.5);
      paragraph(d, it.note, cx + pad, cy, cardW - pad * 2, { font: "helvetica", size: q(1.15), color: C.muted }, lh);
    });
    return y + cardH;
  }
  if (b.kind === "bars") {
    y += q(2.2);
    const labelW = q(32);
    const textW = q(9);
    const trackX = x + labelW + q(1.6);
    const trackW = w - labelW - textW - q(3.2);
    const rowH = q(1.5) * 1.5;
    for (const r of b.rows) {
      const mid = y + rowH / 2;
      paragraph(d, r.label, x, y, labelW, { font: "helvetica", size: q(1.5), color: C.ink }, rowH);
      fill(d, C.track);
      d.roundedRect(trackX, mid - q(0.7), trackW, q(1.4), q(0.7), q(0.7), "F");
      const bw = Math.max(5, Math.min(100, (r.value / r.max) * 100)) / 100 * trackW;
      fill(d, C.indigo);
      d.roundedRect(trackX, mid - q(0.7), bw, q(1.4), q(0.7), q(0.7), "F");
      paragraph(d, r.text, trackX + trackW + q(1.6), y, textW, { font: "courier", style: "bold", size: q(1.25), color: C.ink }, rowH);
      y += rowH + q(1.3) - rowH * 0.25;
    }
    return y;
  }
  if (b.kind === "table") {
    y += q(1.2);
    const cols = b.head.length;
    const first = w * (cols > 2 ? 0.34 : 0.5);
    const rest = (w - first) / Math.max(1, cols - 1);
    const colW = (i: number) => (i === 0 ? first : rest);
    const padX = q(1);
    const padY = q(0.65);
    const size = q(1.35);
    const lh = size * 1.3;
    const row = (cells: string[], head: boolean) => {
      const lines = cells.map((c, i) => wrapped(d, head ? c.toUpperCase() : c, colW(i) - padX * 2, head ? { font: "courier", style: "bold", size: q(1) } : { font: "helvetica", style: i === 0 ? "bold" : "normal", size }));
      const h = Math.max(...lines.map((l) => l.length)) * (head ? q(1) * 1.3 : lh) + padY * 2;
      let cx = x;
      cells.forEach((c, i) => {
        fill(d, head ? C.head : C.white);
        stroke(d, C.line);
        d.setLineWidth(0.8);
        d.rect(cx, y, colW(i), h, "FD");
        paragraph(d, head ? c.toUpperCase() : c, cx + padX, y + padY, colW(i) - padX * 2, head ? { font: "courier", style: "bold", size: q(1), color: C.muted } : { font: "helvetica", style: i === 0 ? "bold" : "normal", size, color: C.ink }, head ? q(1) * 1.3 : lh, head ? { charSpace: 0.6 } : {});
        cx += colW(i);
      });
      y += h;
    };
    row(b.head, true);
    for (const r of b.rows) row(r, false);
    return y;
  }
  if (b.kind === "points") {
    y += q(2);
    for (const p of b.items) {
      const pad = q(1.8);
      const after = paragraph(d, p.title, x + pad, y, w - pad, { font: "helvetica", style: "bold", size: q(1.9), color: C.ink }, q(1.9) * 1.25);
      const end = paragraph(d, p.detail, x + pad, after + q(0.3), w - pad, { font: "helvetica", size: q(1.4), color: C.muted }, q(1.4) * 1.45);
      fill(d, C.indigo);
      d.rect(x, y, q(0.5), end - y, "F");
      y = end + q(1.6);
    }
    return y;
  }
  return paragraph(d, b.text, x, y + q(1.6), w, { font: "helvetica", style: "italic", size: q(1.15), color: C.muted }, q(1.15) * 1.4);
}

function drawSlide(d: jsPDF, s: DeckSlide, deck: Deck, n: number, k: number): number {
  const q = (v: number) => v * CQ * k;
  const x = 5.4 * CQ;
  const w = SW - x * 2;
  if (s.cover) {
    gradient(d, 0, 0, SW, SH, "#1b1760", "#0d0b2b");
    gradient(d, 0, SH - 7, SW, 7, "#0ea5a4", "#4f46e5");
    let y = 5.2 * CQ + 9 * CQ;
    y = paragraph(d, s.kicker.toUpperCase(), x, y, w, { font: "courier", style: "bold", size: 1.05 * CQ, color: C.tealLight }, 1.05 * CQ * 1.6, { charSpace: 2 }) + CQ;
    y = paragraph(d, s.title, x, y, w * 0.8, { font: "helvetica", style: "bold", size: 4.6 * CQ, color: "#f2f1ff" }, 4.6 * CQ * 1.12) + 2 * CQ;
    if (s.lead) y = paragraph(d, s.lead, x, y, w * 0.88, { font: "helvetica", size: 1.9 * CQ, color: "#c9c8f0" }, 1.9 * CQ * 1.5);
    paragraph(d, `${deck.cycle} · ${deck.date}`, x, y + 5 * CQ, w, { font: "courier", size: 1.1 * CQ, color: "#a5a3c6" }, 1.1 * CQ * 1.5);
    return 0;
  }
  fill(d, C.white);
  d.rect(0, 0, SW, SH, "F");
  let y = 5.2 * CQ;
  y = paragraph(d, s.kicker.toUpperCase(), x, y, w, { font: "courier", style: "bold", size: q(1.05), color: C.teal }, q(1.05) * 1.6, { charSpace: 1.8 }) + q(1);
  y = paragraph(d, s.title, x, y, w, { font: "helvetica", style: "bold", size: q(2.9), color: C.ink }, q(2.9) * 1.15) + q(1.4);
  if (s.lead) y = paragraph(d, s.lead, x, y, w * 0.88, { font: "helvetica", size: q(1.5), color: C.muted }, q(1.5) * 1.5) + q(2);
  for (const b of s.blocks) y = drawBlock(d, b, x, y, w, k);
  const bottom = y;
  paragraph(d, `Mentorful · ${deck.school} · ${deck.cycle} · Counts only: no names, answers or conversations`, x, SH - 1.6 * CQ - 14, w * 0.9, { font: "helvetica", size: 0.95 * CQ, color: C.muted }, 14);
  paragraph(d, String(n), SW - x, SH - 1.6 * CQ - 14, 40, { font: "helvetica", size: 0.95 * CQ, color: C.muted }, 14, { align: "right" });
  return bottom;
}

/** The leadership deck as a 16:9 landscape PDF, one slide per page. */
export function deckPdf(deck: Deck): ArrayBuffer {
  const make = () => new jsPDF({ orientation: "landscape", unit: "pt", format: [SW, SH], compress: true });
  const d = make();
  d.setProperties({ title: `${deck.school} · Leadership deck`, subject: "Mentorful leadership deck: counts only", creator: "Mentorful" });
  deck.slides.forEach((s, i) => {
    if (i > 0) d.addPage([SW, SH], "landscape");
    // Shrink the slide's content until it fits above the footer, like the on-screen slide clips what would overflow.
    let k = 1;
    for (const tryK of [1, 0.92, 0.85, 0.78, 0.7, 0.62]) {
      k = tryK;
      if (s.cover || drawSlide(make(), s, deck, i + 1, tryK) <= SH - 3.4 * CQ - 30) break;
    }
    drawSlide(d, s, deck, i + 1, k);
  });
  return bytes(d);
}

/* ------------------------------------------------------------------------------------------------ board summary */

export type SummaryPdfInput = {
  school: string;
  cycle: string;
  date: string;
  headline: string;
  stats: { label: string; value: string; note: string }[];
  scan: { means: Record<Dimension, number>; ci: Record<Dimension, number>; respondents: string } | null;
  participation: string | null;
  actions: { tone: "do" | "watch" | "good"; label: string; title: string; detail: string }[];
  footnote: string;
};

const PW = 612;
const PH = 792;
const PM = 46;

/** The one-page board summary as a Letter PDF (it carries onto a second page only if the next moves run long). */
export function summaryPdf(s: SummaryPdfInput): ArrayBuffer {
  const d = new jsPDF({ orientation: "portrait", unit: "pt", format: [PW, PH], compress: true });
  d.setProperties({ title: `${s.school} · Board summary`, subject: "Mentorful board summary: counts only", creator: "Mentorful" });
  const w = PW - PM * 2;
  gradient(d, 0, 0, PW, 8, "#0ea5a4", "#4f46e5");
  let y = 34;
  y = paragraph(d, `Board summary · ${s.cycle} · ${s.date}`.toUpperCase(), PM, y, w, { font: "courier", style: "bold", size: 8.5, color: C.teal }, 13, { charSpace: 1.2 }) + 4;
  y = paragraph(d, s.school, PM, y, w, { font: "helvetica", style: "bold", size: 24, color: C.ink }, 29) + 4;
  y = paragraph(d, s.headline, PM, y, w * 0.92, { font: "helvetica", size: 11.5, color: C.muted }, 16.5) + 16;

  const gap = 10;
  const cardW = (w - gap * (s.stats.length - 1)) / s.stats.length;
  const cardH = 78;
  s.stats.forEach((st, i) => {
    const cx = PM + i * (cardW + gap);
    fill(d, C.white);
    stroke(d, C.line);
    d.setLineWidth(0.8);
    d.roundedRect(cx, y, cardW, cardH, 7, 7, "FD");
    paragraph(d, st.value, cx + 10, y + 8, cardW - 20, { font: "helvetica", style: "bold", size: 24, color: C.teal }, 28);
    paragraph(d, st.label, cx + 10, y + 38, cardW - 20, { font: "helvetica", style: "bold", size: 9.5, color: C.ink }, 12);
    paragraph(d, st.note, cx + 10, y + 52, cardW - 20, { font: "helvetica", size: 8, color: C.muted }, 10);
  });
  y += cardH + 22;

  const heading = (eyebrow: string, title: string, right?: string) => {
    if (y > PH - 120) {
      d.addPage([PW, PH], "portrait");
      y = PM;
    }
    stroke(d, C.line);
    d.setLineWidth(0.8);
    d.line(PM, y, PM + w, y);
    y += 10;
    paragraph(d, eyebrow.toUpperCase(), PM, y, w, { font: "courier", style: "bold", size: 7.5, color: C.teal }, 11, { charSpace: 1 });
    if (right) paragraph(d, right, PM + w, y, 240, { font: "courier", size: 8, color: C.muted }, 11, { align: "right" });
    y += 12;
    y = paragraph(d, title, PM, y, w, { font: "helvetica", style: "bold", size: 15, color: C.ink }, 19) + 8;
  };

  if (s.scan) {
    heading("School-wide averages", "Culture Scan", s.scan.respondents);
    const labelW = 80;
    const trackX = PM + labelW + 10;
    const trackW = w - labelW - 10 - 92;
    for (const dim of DIMENSIONS) {
      fill(d, C.track);
      d.roundedRect(trackX, y + 3, trackW, 9, 4.5, 4.5, "F");
      gradient(d, trackX, y + 3, Math.max(4, (s.scan.means[dim] / 6) * trackW), 9, "#5eead4", "#818cf8", 40);
      paragraph(d, DIMENSION_LABEL[dim], PM, y, labelW, { font: "helvetica", size: 11, color: C.ink }, 15);
      paragraph(d, `${s.scan.means[dim].toFixed(2)}  +/- ${s.scan.ci[dim].toFixed(2)}`, trackX + trackW + 10, y, 90, { font: "courier", style: "bold", size: 9, color: C.ink }, 15);
      y += 22;
    }
    y += 6;
  }

  if (s.participation) {
    heading("Pairs in action", "Participation");
    y = paragraph(d, s.participation, PM, y, w, { font: "helvetica", size: 11, color: C.muted }, 16) + 14;
  }

  heading("Where to head", "Next moves");
  if (s.actions.length === 0) y = paragraph(d, "Nothing needs attention right now.", PM, y, w, { font: "helvetica", size: 11, color: C.muted }, 16) + 10;
  const chip = { do: { bg: "#fdecc8", fg: "#7a4b00" }, watch: { bg: "#e0def5", fg: "#3b3875" }, good: { bg: "#d3f2ee", fg: "#0a5e56" } } as const;
  for (const a of s.actions) {
    const lines = wrapped(d, a.detail, w - 110, { font: "helvetica", size: 10 });
    const need = 16 + lines.length * 14 + 12;
    if (y + need > PH - 60) {
      d.addPage([PW, PH], "portrait");
      y = PM;
    }
    fill(d, chip[a.tone].bg);
    d.roundedRect(PM, y + 1, 96, 15, 7.5, 7.5, "F");
    paragraph(d, a.label, PM + 48, y + 1, 90, { font: "helvetica", style: "bold", size: 8, color: chip[a.tone].fg }, 15, { align: "center" });
    y = paragraph(d, a.title, PM + 110, y, w - 110, { font: "helvetica", style: "bold", size: 11.5, color: C.ink }, 16);
    y = paragraph(d, a.detail, PM + 110, y, w - 110, { font: "helvetica", size: 10, color: C.muted }, 14) + 12;
  }
  paragraph(d, s.footnote, PM, Math.min(y + 8, PH - 56), w, { font: "helvetica", style: "italic", size: 8.5, color: C.muted }, 12);
  return bytes(d);
}

/* ------------------------------------------------------------------------------------------- faculty connection */

const LW = 792;
const LH = 612;

/**
 * The faculty connection by department, as a map and a table. Departments are the dots, a solid line means the two
 * departments have at least one pair between them and a dashed line means none yet. Counts only: no teacher is drawn,
 * and departments under 5 teachers are left out, exactly like the CSV.
 */
export function connectionPdf(snap: AdminSnapshot, date: string): ArrayBuffer {
  const d = new jsPDF({ orientation: "landscape", unit: "pt", format: [LW, LH], compress: true });
  d.setProperties({ title: `${snap.school.name} · Faculty connection`, subject: "Mentorful faculty connection by department: counts only", creator: "Mentorful" });
  const m = departmentMatrix(snap);
  const cov = coverage(m);
  const orbit = facultyOrbit(snap, snap.participation ?? null, null);
  const w = LW - PM * 2;

  gradient(d, 0, 0, LW, 8, "#0ea5a4", "#4f46e5");
  let y = 34;
  y = paragraph(d, `Faculty connection · ${snap.cycle?.name ?? "No cycle"} · ${date}`.toUpperCase(), PM, y, w, { font: "courier", style: "bold", size: 8.5, color: C.teal }, 13, { charSpace: 1.2 }) + 4;
  y = paragraph(d, snap.school.name, PM, y, w, { font: "helvetica", style: "bold", size: 24, color: C.ink }, 29) + 4;
  const sentence = m.depts.length < 2 ? "There are not yet two departments with five or more teachers to draw a connection between." : `${cov.connected} of ${cov.possible} possible connections between departments exist. A dashed line is a connection that does not exist yet.`;
  y = paragraph(d, sentence, PM, y, w * 0.9, { font: "helvetica", size: 11.5, color: C.muted }, 16.5) + 14;

  const top = y;
  const n = m.depts.length;
  const cx = PM + 190;
  const cy = top + (LH - top - 90) / 2 + 6;
  const R = Math.min(120, (LH - top - 170) / 2);
  const at = (i: number): [number, number] => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n);
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  };
  if (n >= 2) {
    d.setLineWidth(1);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = m.depts[i];
        const b = m.depts[j];
        const linked = (a < b ? `${a}|${b}` : `${b}|${a}`) in m.cross;
        const [x1, y1] = at(i);
        const [x2, y2] = at(j);
        if (linked) {
          stroke(d, C.indigo);
          d.setLineWidth(1.6);
          d.setLineDashPattern([], 0);
        } else {
          stroke(d, "#d97706");
          d.setLineWidth(0.9);
          d.setLineDashPattern([4, 3], 0);
        }
        d.line(x1, y1, x2, y2);
      }
    }
    d.setLineDashPattern([], 0);
  }
  const biggest = Math.max(1, ...m.depts.map((x) => m.size[x] ?? 1));
  m.depts.forEach((dept, i) => {
    const [x, yy] = at(i);
    const r = 8 + 10 * Math.sqrt((m.size[dept] ?? 1) / biggest);
    fill(d, C.white);
    stroke(d, C.teal);
    d.setLineWidth(2);
    d.circle(x, yy, r, "FD");
    const cosA = Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / n);
    const align = cosA > 0.25 ? "left" : cosA < -0.25 ? "right" : "center";
    const lx = x + (align === "left" ? r + 6 : align === "right" ? -r - 6 : 0);
    const ly = align === "center" ? (yy < cy ? yy - r - 24 : yy + r + 4) : yy - 12;
    paragraph(d, dept, lx, ly, 120, { font: "helvetica", style: "bold", size: 10.5, color: C.ink }, 13, { align });
    paragraph(d, `${m.size[dept] ?? 0} teachers`, lx, ly + 13, 120, { font: "helvetica", size: 8.5, color: C.muted }, 11, { align });
  });
  // Legend
  const ly = LH - 70;
  stroke(d, C.indigo);
  d.setLineWidth(1.6);
  d.line(PM, ly, PM + 26, ly);
  paragraph(d, "Departments with a pair between them", PM + 34, ly - 6, 190, { font: "helvetica", size: 8.5, color: C.muted }, 12);
  stroke(d, "#d97706");
  d.setLineWidth(0.9);
  d.setLineDashPattern([4, 3], 0);
  d.line(PM, ly + 16, PM + 26, ly + 16);
  d.setLineDashPattern([], 0);
  paragraph(d, "No pair between them yet", PM + 34, ly + 10, 190, { font: "helvetica", size: 8.5, color: C.muted }, 12);

  // Table
  const tx = PM + 400;
  const tw = LW - PM - tx;
  const cols = [tw * 0.4, tw * 0.17, tw * 0.21, tw * 0.22];
  let ty = top + 4;
  const rowAt = (cells: string[], head: boolean) => {
    const lines = cells.map((c, i) => wrapped(d, head ? c.toUpperCase() : c, cols[i] - 12, head ? { font: "courier", style: "bold", size: 7 } : { font: "helvetica", style: i === 0 ? "bold" : "normal", size: 10 }));
    const h = Math.max(...lines.map((l) => l.length)) * (head ? 9.5 : 13) + 10;
    let x = tx;
    cells.forEach((c, i) => {
      fill(d, head ? C.head : C.white);
      stroke(d, C.line);
      d.setLineWidth(0.8);
      d.rect(x, ty, cols[i], h, "FD");
      paragraph(d, head ? c.toUpperCase() : c, x + 6, ty + 5, cols[i] - 12, head ? { font: "courier", style: "bold", size: 7, color: C.muted } : { font: "helvetica", style: i === 0 ? "bold" : "normal", size: 10, color: C.ink }, head ? 9.5 : 13);
      x += cols[i];
    });
    ty += h;
  };
  rowAt(["Department", "Teachers", "Reaches", "Pairs that have talked"], true);
  for (const p of orbit.planets) rowAt([p.dept, String(p.teachers), `${p.reach} of ${p.possible}`, p.activePct === null ? "n/a" : `${p.activePct}%`], false);
  const note = `Counts only: no teacher is named or drawn. ${m.omitted.length > 0 ? `${m.omitted.length} department${m.omitted.length === 1 ? "" : "s"} with fewer than 5 teachers ${m.omitted.length === 1 ? "is" : "are"} left out to protect privacy. ` : ""}The named faculty map stays inside Mentorful for the school lead.`;
  paragraph(d, note, tx, ty + 12, tw, { font: "helvetica", style: "italic", size: 8.5, color: C.muted }, 12);
  return bytes(d);
}
