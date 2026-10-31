"use server";

import { createClient } from "@/lib/supabase/server";
import { SAMPLE_NOTE, imageProblem, type Reading } from "./scan";

/**
 * Read a photographed page into text. The photo is looked at and dropped: it is never stored or logged, and only the text the
 * teacher chooses to save afterwards (as a private growth entry) is kept.
 *
 * SCAN_NOTES_PROVIDER picks the reader. "sample" (the default) returns a prepared reading for the demo. A real recognition
 * provider is added here after Nov 4; until then any other value is refused rather than silently falling back.
 */
export async function readNotes(image: string): Promise<Reading> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };
  const problem = imageProblem(image);
  if (problem) return { ok: false, error: problem };
  const provider = process.env.SCAN_NOTES_PROVIDER ?? "sample";
  if (provider === "sample") return { ok: true, text: SAMPLE_NOTE, source: "sample" };
  return { ok: false, error: "Reading handwriting isn't switched on yet." };
}
