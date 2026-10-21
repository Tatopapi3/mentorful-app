/**
 * The browser side of preview mode: the survey page reads the 26 items and inserts answers. Answers are kept
 * in memory and thrown away on refresh. No network.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PREVIEW_ITEMS } from "./items";
import { createMockClient, type Tables } from "./mockQuery";

const tables: Tables = { survey_items: PREVIEW_ITEMS.map((i) => ({ ...i })), survey_responses: [] };

export const previewBrowserEnabled = () => process.env.NEXT_PUBLIC_PREVIEW_MOCK === "1" && (process.env.NEXT_PUBLIC_PREVIEW_DEPLOY === "1" || process.env.NODE_ENV !== "production");

export function createPreviewBrowserClient() {
  return createMockClient({ tables, visible: (_t, rows) => rows, user: null });
}
