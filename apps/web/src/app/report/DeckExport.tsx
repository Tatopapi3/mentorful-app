"use client";

import { useEffect, useState } from "react";
import { SLIDE_H, SLIDE_W } from "@/lib/report/deck";

/**
 * Export controls for the deck.
 *
 * Everything is derived from the SVG already in the DOM rather than re-rendered
 * from a second code path, so what downloads is exactly what was previewed.
 * The slides are self-contained (no external CSS, fonts or images), which is
 * what makes both the standalone .svg and the canvas rasterisation reliable.
 */

const PNG_SCALE = 2; // 3200×1800 — enough for a projector without being huge.

function slideElement(index: number): SVGSVGElement {
  const el = document.querySelector<SVGSVGElement>(`svg[data-slide="${index}"]`);
  if (!el) throw new Error(`Slide ${index} not found in the page.`);
  return el;
}

/** Serialize to a standalone SVG file with explicit pixel dimensions. */
function slideSvgString(index: number): string {
  const clone = slideElement(index).cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(SLIDE_W));
  clone.setAttribute("height", String(SLIDE_H));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("data-slide");
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function rasterize(index: number, scale: number): Promise<HTMLCanvasElement> {
  const svg = slideSvgString(index);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.width = SLIDE_W;
    img.height = SLIDE_H;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Could not rasterize slide ${index}.`));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = SLIDE_W * scale;
    canvas.height = SLIDE_H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");
    // JPEG has no alpha, and a transparent slide would rasterize to black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas encoding failed."))),
      type,
      quality
    )
  );
}

export function SlideActions({ index, name }: { index: number; name: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "svg" | "png") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "svg") {
        const blob = new Blob([slideSvgString(index)], { type: "image/svg+xml;charset=utf-8" });
        triggerDownload(blob, `${index}-${name}.svg`);
      } else {
        const canvas = await rasterize(index, PNG_SCALE);
        triggerDownload(await canvasToBlob(canvas, "image/png"), `${index}-${name}.png`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
      <span className="ev-muted" style={{ fontSize: 13, marginRight: 4 }}>
        Slide {index}
      </span>
      <button type="button" className="ev-btn sm" disabled={busy !== null} onClick={() => run("svg")}>
        {busy === "svg" ? "…" : "SVG"}
      </button>
      <button type="button" className="ev-btn sm" disabled={busy !== null} onClick={() => run("png")}>
        {busy === "png" ? "…" : "PNG"}
      </button>
      {error && <span className="ap-error" style={{ margin: 0 }}>{error}</span>}
    </div>
  );
}

export function DeckToolbar({ count }: { count: number }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function downloadPdf() {
    setBusy(true);
    setError(null);
    try {
      // Loaded on demand so the PDF encoder never ships in the page bundle.
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [SLIDE_W, SLIDE_H],
        compress: true,
      });

      for (let i = 1; i <= count; i++) {
        setProgress(`Rendering slide ${i} of ${count}…`);
        const canvas = await rasterize(i, PNG_SCALE);
        // JPEG keeps a 6-slide deck to a sane file size; at 2× the text stays crisp.
        const data = canvas.toDataURL("image/jpeg", 0.95);
        if (i > 1) pdf.addPage([SLIDE_W, SLIDE_H], "landscape");
        pdf.addImage(data, "JPEG", 0, 0, SLIDE_W, SLIDE_H);
      }

      setProgress("Writing PDF…");
      pdf.save("culture-scan-deck.pdf");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function downloadPptx() {
    setBusy(true);
    setError(null);
    try {
      // Loaded on demand so the PowerPoint writer never ships in the page bundle.
      const { default: PptxGenJS } = await import("pptxgenjs");
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.title = "Culture Scan deck";
      for (let i = 1; i <= count; i++) {
        setProgress(`Rendering slide ${i} of ${count}…`);
        const canvas = await rasterize(i, PNG_SCALE);
        const data = canvas.toDataURL("image/jpeg", 0.92).replace(/^data:/, "");
        pptx.addSlide().addImage({ data, x: 0, y: 0, w: 13.333, h: 7.5 });
      }
      setProgress("Writing PowerPoint…");
      await pptx.writeFile({ fileName: "culture-scan-deck.pptx" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function downloadAllPng() {
    setBusy(true);
    setError(null);
    try {
      for (let i = 1; i <= count; i++) {
        setProgress(`Rendering slide ${i} of ${count}…`);
        const canvas = await rasterize(i, PNG_SCALE);
        triggerDownload(await canvasToBlob(canvas, "image/png"), `culture-scan-${i}.png`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  // "Download PDF" on the Reports page opens this page with ?download=pdf and the file is saved straight away.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("download") !== "pdf") return;
    const t = setTimeout(() => void downloadPdf(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" className="ev-btn primary" disabled={busy} onClick={downloadPdf}>
        Download deck as PDF
      </button>
      <button type="button" className="ev-btn" disabled={busy} onClick={downloadPptx}>
        Download deck as PowerPoint
      </button>
      <button type="button" className="ev-btn" disabled={busy} onClick={downloadAllPng}>
        Download all PNGs
      </button>
      {progress && <span className="ev-muted" style={{ fontSize: 13 }}>{progress}</span>}
      {error && <span className="ap-error" style={{ margin: 0 }}>{error}</span>}
    </div>
  );
}
