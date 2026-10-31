/**
 * Scan notes: the pure side. A teacher photographs handwritten notes (a classroom visit, a planning page), the page is read into
 * text, and the teacher edits and saves it as a private note. Nothing here touches the camera or the database.
 *
 * Reading is a provider behind one server action (scan-actions.ts). Today there is one: a prepared SAMPLE reading, which always
 * returns the same text whatever the photo shows. It is for the demo and says so on screen. Real handwriting recognition is a
 * later provider (after Nov 4); the photo would then leave this app for a recognition service, so that step needs the same
 * privacy review as anything else that sends a teacher's words elsewhere.
 */

export const MAX_NOTE = 1000; // the growth log's limit for one entry
export const MAX_IMAGE_BYTES = 6_000_000;

/** The prepared reading. The sample page photo in public/scan/sample-notes.jpg shows exactly this text. */
export const SAMPLE_NOTE =
  "Visited period 3 today. Students drafted an outline first, then used the AI tool only to check for gaps. Strong move: each pair had to explain one change out loud. Try next: a two-minute share-out on what the tool missed. Follow up Friday with the rubric.";

export type Reading = { ok: true; text: string; source: "sample" | "ai" } | { ok: false; error: string };

const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** Why a photo can't be read, in words a teacher can act on; null when it is fine. */
export function imageProblem(dataUrl: string): string | null {
  if (typeof dataUrl !== "string" || !IMAGE.test(dataUrl)) return "That doesn't look like a photo. Try taking it again.";
  const bytes = Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  if (bytes > MAX_IMAGE_BYTES) return "That photo is too large. Move a little further back, or choose a smaller one.";
  return null;
}

/** Collapse stray spacing from a reading and keep it inside the log's limit, cutting at a word. */
export function tidy(text: string): string {
  const clean = text.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  if (clean.length <= MAX_NOTE) return clean;
  const cut = clean.slice(0, MAX_NOTE);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), MAX_NOTE - 40)).trimEnd();
}
