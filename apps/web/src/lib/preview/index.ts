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
      participation_summary: (args: { p_cycle: string }) => {
        const pr = tables.pairings.filter((p) => p.cycle_id === args.p_cycle && p.status === "approved");
        const logs = tables.conversation_logs.filter((l) => l.cycle_id === args.p_cycle && l.status === "submitted");
        const conv = (id: string) => logs.some((l) => l.pairing_id === id && !l.is_visit_debrief);
        const deb = (id: string) => logs.some((l) => l.pairing_id === id && l.is_visit_debrief);
        const teachers = tables.profiles.filter((p) => p.role === "teacher");
        const activeIds = new Set(pr.filter((p) => conv(p.id) || deb(p.id)).flatMap((p) => [p.host_id, p.visitor_id]));
        const byDept = new Map<string, { teachers: number; active: number }>();
        for (const t of teachers) {
          const d = t.department ?? "Unassigned";
          const e = byDept.get(d) ?? { teachers: 0, active: 0 };
          e.teachers++;
          if (activeIds.has(t.id)) e.active++;
          byDept.set(d, e);
        }
        return {
          pairs: pr.length,
          with_conversation: pr.filter((p) => conv(p.id)).length,
          with_debrief: pr.filter((p) => deb(p.id)).length,
          complete: pr.filter((p) => conv(p.id) && deb(p.id)).length,
          teachers: teachers.length,
          active_teachers: teachers.filter((t) => activeIds.has(t.id)).length,
          by_department: [...byDept.entries()].filter(([, v]) => v.teachers >= 5).map(([department, v]) => ({ department, ...v })).sort((a, b) => a.department.localeCompare(b.department)),
        };
      },
      quiet_pair_count: (args: { p_cycle: string; p_days: number }) => {
        const since = Date.now() - (args.p_days ?? 30) * 86400000;
        const pr = tables.pairings.filter((p) => p.cycle_id === args.p_cycle && p.status === "approved");
        return pr.filter((p) => !tables.conversation_logs.some((l) => l.pairing_id === p.id && l.status === "submitted" && new Date(l.submitted_at).getTime() >= since)).length;
      },
      conversation_activity: (args: { p_cycle: string }) => {
        const MIN = 5;
        const pr = new Map(tables.pairings.map((p) => [p.id, p]));
        const prof = new Map(tables.profiles.map((p) => [p.id, p]));
        const logs = tables.conversation_logs.filter((l) => l.cycle_id === args.p_cycle && l.status === "submitted" && !l.is_visit_debrief && l.submitted_at);
        const size = new Map<string, number>();
        for (const t of tables.profiles.filter((p) => p.role === "teacher")) size.set(t.department ?? "Unassigned", (size.get(t.department ?? "Unassigned") ?? 0) + 1);
        const months = new Map<string, number>();
        const heat = new Map<string, number>();
        for (const l of logs) {
          const month = String(l.submitted_at).slice(0, 7);
          months.set(month, (months.get(month) ?? 0) + 1);
          const p = pr.get(l.pairing_id);
          if (!p) continue;
          const depts = new Set([p.host_id, p.visitor_id].map((id) => prof.get(id)?.department ?? "Unassigned"));
          for (const d of depts) if ((size.get(d) ?? 0) >= MIN) heat.set(`${d}|${month}`, (heat.get(`${d}|${month}`) ?? 0) + 1);
        }
        const hide = (n: number) => (n >= MIN ? n : null);
        return {
          months: [...months.entries()].sort().map(([month, n]) => ({ month, n: hide(n) })),
          heat: [...heat.entries()].sort().map(([k, n]) => ({ department: k.split("|")[0], month: k.split("|")[1], n: hide(n) })),
        };
      },
      conversation_log_count: (args: { p_cycle: string | null }) => tables.conversation_logs.filter((l) => l.status === "submitted" && (!args?.p_cycle || l.cycle_id === args.p_cycle)).length,
    },
  });
}
