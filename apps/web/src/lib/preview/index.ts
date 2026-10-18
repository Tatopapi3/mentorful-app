/**
 * Local preview mode: Nick's real pages on made-up data, with no database.
 *
 * It exists so the team can click through the dashboards before the database dump arrives. It is OFF unless
 * PREVIEW_MOCK=1, it refuses to run in a production build, and it never talks to Supabase. Nothing here may
 * be merged into main: this branch is for looking, not for shipping.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildTables, IDS } from "./fixtures";
import { createMockClient, type Row, type Tables, type Visibility } from "./mockQuery";

export type PreviewRole = "admin" | "teacher";

export const previewEnabled = () => process.env.PREVIEW_MOCK === "1" && process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production";

const g = globalThis as unknown as { __previewTables?: Tables };

export function previewTables(): Tables {
  if (!g.__previewTables) g.__previewTables = buildTables(process.env.NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID ?? "preview-survey", process.env.NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID ?? IDS.school);
  return g.__previewTables;
}

export function createPreviewClient(role: PreviewRole, opts: { bypassRls?: boolean } = {}) {
  const tables = previewTables();
  const me = tables.profiles.find((p) => p.auth_user_id === (role === "admin" ? IDS.authAdmin : IDS.authTeacher))!;
  const visible: Visibility = (table, rows) => {
    if (opts.bypassRls) return rows;
    // The few row-level rules that shape what each page can show. The real ones live in Nick's scripts 009 and 011.
    if (table === "conversation_logs") return role === "teacher" ? rows.filter((r: Row) => r.host_id === me.id || r.visitor_id === me.id) : [];
    if (table === "survey_responses") return [];
    return rows;
  };
  return createMockClient({
    tables,
    visible,
    user: { id: me.auth_user_id, email: me.email },
    rpc: {
      // Admins can't read conversation rows by design; they get a count.
      conversation_log_count: (args: { p_cycle: string | null }) => tables.conversation_logs.filter((l) => l.status === "submitted" && (!args?.p_cycle || l.cycle_id === args.p_cycle)).length,
    },
  });
}
