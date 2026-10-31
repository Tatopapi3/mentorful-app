/**
 * Shared SVG primitives for the report panels.
 *
 * Panels are self-contained: every panel bakes its own title, visual, values and
 * finding sentence into one <svg>, so saving it drops a slide-ready asset with
 * no external CSS, fonts or images. That means no wrapping from the browser —
 * text has to be measured and split here.
 *
 * Pure functions only; the PDF export will reuse these.
 */

/** Design tokens, light surface, in the Aurora palette (ink #14122b, indigo series). Text never wears the series color. */
export const T = {
  surface: "#ffffff",
  inkPrimary: "#14122b",
  inkSecondary: "#4b4966",
  muted: "#6b6987",
  gridline: "#e4e3f3",
  baseline: "#c9c8e0",
  /** Single series hue (Aurora indigo): 6.3:1 on white, so it passes the 3:1 a graphic needs with room to spare. */
  series: "#4f46e5",
  /**
   * Blue step 700 — the confidence band, which has to stay readable both over
   * the bar fill and against the white surface where it extends past the tip.
   * A surface-colored underlay was tried first and read as a notch cut out of
   * the bar; a darker step of the same hue is the honest fix.
   */
  seriesDark: "#2e2a9e",
  /** De-emphasis fill for context marks in an emphasis chart. */
  deEmphasis: "#c9c8e0",
  /**
   * Negative pole of the diverging pair used for network edges (blue ↔ red:
   * warm/cool, so they read as opposite). Validated against the surface:
   * CVD ΔE 21.6, normal-vision ΔE 32.3.
   */
  negative: "#e34948",
  /**
   * Status amber for the synthetic-data callout. Sub-3:1 on white by design, so
   * it never carries meaning alone — it always ships as a filled bar with dark
   * ink label text on it.
   */
  warning: "#fab219",
  warningSoft: "#fdf3dc",
  border: "rgba(20,18,43,0.10)",
} as const;

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * Approximate advance width per character for the system sans, as a fraction of
 * font-size. Deliberately a slight over-estimate so wrapped lines land inside
 * their box rather than overflowing — a clipped label is worse than a short one.
 */
const CHAR_W = 0.52;

export function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_W;
}

/** Greedy word wrap to a pixel width. Returns one string per line. */
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, fontSize) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Horizontal bar with a 4px rounded data-end and a square baseline end, per the
 * mark spec. Grows left→right from `x0`.
 */
export function barPath(x0: number, xEnd: number, y: number, h: number, r = 4): string {
  const radius = Math.max(0, Math.min(r, xEnd - x0, h / 2));
  const flat = xEnd - radius;
  return [
    `M ${x0} ${y}`,
    `H ${flat}`,
    `A ${radius} ${radius} 0 0 1 ${xEnd} ${y + radius}`,
    `V ${y + h - radius}`,
    `A ${radius} ${radius} 0 0 1 ${flat} ${y + h}`,
    `H ${x0}`,
    "Z",
  ].join(" ");
}

/** Linear scale from the Likert domain onto pixels. */
export function makeScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) {
  const span = domainMax - domainMin;
  return (v: number) => rangeMin + ((v - domainMin) / span) * (rangeMax - rangeMin);
}

export const LINE_HEIGHT = 19;
export const SENTENCE_SIZE = 13;

export type Pt = { x: number; y: number };

/** Point at parameter t on the quadratic Bezier p0 → c → p2. */
export function quadPoint(p0: Pt, c: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p2.y,
  };
}

/** Move `from` toward `toward` by `dist` px — used to stop edges at node rims. */
export function shiftToward(from: Pt, toward: Pt, dist: number): Pt {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / len) * dist, y: from.y + (dy / len) * dist };
}
