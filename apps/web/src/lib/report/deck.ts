/**
 * Deck model: 16:9 slide geometry and the static copy.
 *
 * Every slide is a self-contained 1600×900 SVG — title, subtitle, visual,
 * finding sentence and footer all baked in — so a slide dropped into a
 * presentation carries its own meaning with no surrounding context.
 *
 * SVG has no text layout, so every string that can run long is wrapped
 * deliberately (see wrapText) and the layout is computed from the resulting
 * line counts rather than assumed.
 */

import type { Dimension } from "./stats.ts";
import type { GapCase } from "./findings.ts";

export const SLIDE_W = 1600;
export const SLIDE_H = 900;
export const MARGIN = 88;

/** Height of the amber synthetic-data banner when it is shown. */
export const BANNER_H = 52;

export const TITLE_SIZE = 46;
export const SUBTITLE_SIZE = 21;
export const SUBTITLE_LEADING = 30;
export const FINDING_SIZE = 22;
export const FINDING_LEADING = 32;
export const FOOTER_SIZE = 15;

/** Last baseline of the finding block; the block grows upward from here. */
const FINDING_BOTTOM = 796;
const FOOTER_BASELINE = 852;

export type Rect = { x: number; y: number; w: number; h: number };

export type SlideLayout = {
  titleY: number;
  subtitleTop: number;
  findingTop: number;
  footerY: number;
  /** Area left for the slide's visual, between subtitle and finding. */
  content: Rect;
};

/**
 * Computes slide geometry from the actual wrapped line counts, so a long
 * subtitle shrinks the visual instead of colliding with it.
 */
export function slideLayout({
  subtitleLines,
  findingLines,
  synthetic,
}: {
  subtitleLines: number;
  findingLines: number;
  synthetic: boolean;
}): SlideLayout {
  const offset = synthetic ? BANNER_H : 0;
  const titleY = offset + 140;
  const subtitleTop = titleY + 46;
  const subtitleBottom = subtitleTop + Math.max(0, subtitleLines - 1) * SUBTITLE_LEADING;

  const findingTop = FINDING_BOTTOM - Math.max(0, findingLines - 1) * FINDING_LEADING;

  const contentTop = subtitleBottom + 46;
  const contentBottom = findingTop - FINDING_SIZE - 38;

  return {
    titleY,
    subtitleTop,
    findingTop,
    footerY: FOOTER_BASELINE,
    content: {
      x: MARGIN,
      y: contentTop,
      w: SLIDE_W - MARGIN * 2,
      h: Math.max(120, contentBottom - contentTop),
    },
  };
}

// ---------------------------------------------------------------- copy

/**
 * Slide 1 and slide 6 are awaiting final copy from the user.
 *
 * While DRAFT_COPY is true, both slides carry a visible "draft copy" marker so
 * placeholder text cannot be mistaken for finished wording in an exported deck.
 * Paste the real text below and set DRAFT_COPY to false — nothing else changes.
 */
export const DRAFT_COPY = true;

export const INTRO = {
  title: "School Culture Scan",
  subtitle:
    "A measure of the social capital your school runs on — the connections, trust, shared " +
    "understanding and collective belief that determine whether good ideas actually spread.",
  body:
    "Every member of staff answered 26 questions anonymously. Their answers are combined into " +
    "four dimensions. No individual response is ever shown, and nothing here can be traced back " +
    "to a person.",
  dimensions: [
    {
      key: "structural" as Dimension,
      heading: "Structural",
      text: "The connections themselves — who talks to whom, how often, and whether the time and routines exist for it.",
    },
    {
      key: "relational" as Dimension,
      heading: "Relational",
      text: "The trust in those connections — whether staff feel safe being honest, asking for help, and admitting difficulty.",
    },
    {
      key: "cognitive" as Dimension,
      heading: "Cognitive",
      text: "The shared understanding — whether staff mean the same things by good teaching and pull in the same direction.",
    },
    {
      key: "efficacy" as Dimension,
      heading: "Efficacy",
      text: "The collective belief — whether staff think that together they can move outcomes for the pupils in front of them.",
    },
  ],
};

export const ACTIONS = {
  title: "Where to Start",
  subtitle:
    "Three moves that follow from these results. Each one targets the thinnest part of the " +
    "structure rather than the loudest symptom.",
  /**
   * `{weakest}` is substituted with the lowest-scoring dimension at render time,
   * so the actions track the data rather than restating a fixed assumption.
   */
  items: [
    {
      heading: "Protect what is load-bearing",
      text: "The strongest dimension is carrying the others. Name it, and defend the time and routines that produce it before adding anything new.",
    },
    {
      heading: "Build the thinnest layer first",
      text: "{weakest} is the lowest score and the least connected. Effort spent elsewhere will not spread on its own until this is in place.",
    },
    {
      heading: "Re-measure in one term",
      text: "Run the scan again as wave 2. The comparison, not the single snapshot, is what tells you whether the change took.",
    },
  ],
};

export const PANEL_COPY = {
  bars: {
    title: "Average of Each Dimension",
    subtitle:
      "How each part of your school's culture scored, 1 to 6. The lowest bar is where the " +
      "foundation is thinnest.",
  },
  network: {
    title: "Network Analysis of the Results",
    subtitle:
      "Which element is load-bearing. Thick lines connect dimensions that rise and fall together " +
      "once the others are held constant; a dimension on the edge is where effort won't spread " +
      "on its own.",
  },
  gap: {
    title: "Efficacy–Structure Gap",
    /**
     * The subtitle branches with the finding. A fixed subtitle asserting
     * "belief runs ahead" would contradict the sentence directly beneath it
     * whenever a school lands in either of the other two readings.
     */
    subtitles: {
      "belief-ahead":
        "When belief runs ahead of the structures meant to carry it, efficacy is resting on " +
        "goodwill, not infrastructure.",
      "structure-ahead":
        "When the structures are in place before the belief, confidence usually follows — " +
        "this is the gap that tends to close on its own.",
      "in-step":
        "When belief and the structures meant to carry it move together, confidence is resting " +
        "on something more durable than goodwill.",
    } satisfies Record<GapCase, string>,
  },
  startHere: {
    title: "Start Here",
    subtitle: "What the results tell you to prioritize.",
  },
};

export const SLIDE_COUNT = 6;
