/**
 * Local preview mode: Nick's real pages on made-up data, with no database.
 *
 * It exists so the team can click through the dashboards before the database dump arrives. It is OFF unless
 * PREVIEW_MOCK=1, it refuses to run in a production build, and it never talks to Supabase. Nothing here may
 * be merged into main: this branch is for looking, not for shipping.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildTables, IDS } from "./fixtures";
import { buildNickTables } from "./nickTables";
import { overlay } from "./journal";
import { addHubTables } from "./hubTables";
import { addLookbookTables, lookbookRows } from "./lookbookTables";
import { addGrowthSeeds, growthActivity } from "./growthTotals";
import { addCtleTables, ctleReading } from "./ctleTables";
import { createMockClient, type Row, type Tables, type Visibility, type Write } from "./mockQuery";

export type PreviewRole = "admin" | "teacher";

// Preview mode refuses to run in a production build, so it can never reach a real school by accident. The one exception
// is the demo deployment, which sets PREVIEW_DEPLOY=1 on its own Vercel project (never anywhere else), runs on made-up
// data only, and is closed to anyone without the access key (see src/proxy.ts).
export const previewEnabled = () =>
  process.env.PREVIEW_MOCK === "1" && (process.env.PREVIEW_DEPLOY === "1" || (process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production"));

const g = globalThis as unknown as { __previewTables?: Tables };

export function previewTables(): Tables {
  if (!g.__previewTables && process.env.PREVIEW_DATASET === "nick") g.__previewTables = buildNickTables();
  if (!g.__previewTables) g.__previewTables = buildTables(process.env.NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID ?? "preview-survey", process.env.NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID ?? IDS.school);
  if (!(g.__previewTables as Tables).pair_messages) {
    const me = g.__previewTables.profiles.find((p) => p.auth_user_id === IDS.authTeacher);
    if (me) addHubTables(g.__previewTables, me.id);
  }
  if (!(g.__previewTables as Tables).teacher_cards) {
    const me = g.__previewTables.profiles.find((p) => p.auth_user_id === IDS.authTeacher);
    if (me) addLookbookTables(g.__previewTables, me.id);
  }
  if (!(g.__previewTables as Tables).growth_sharing) {
    const me = g.__previewTables.profiles.find((p) => p.auth_user_id === IDS.authTeacher);
    if (me) addGrowthSeeds(g.__previewTables, me.id);
  }
  if (!(g.__previewTables as Tables).ctle_settings) {
    const me = g.__previewTables.profiles.find((p) => p.auth_user_id === IDS.authTeacher);
    if (me) addCtleTables(g.__previewTables, me.id);
  }
  return g.__previewTables;
}

export function createPreviewClient(role: PreviewRole, opts: { bypassRls?: boolean; journal?: Write[]; onWrite?: (w: Write) => void | Promise<void> } = {}) {
  // With a journal the visitor gets their own copy of the data; without one they share the process's data (the local preview).
  const base = previewTables();
  const journaled = opts.journal ? overlay(base, opts.journal) : base;
  // Time on the platform is written every half minute, which would swamp a visitor's cookie journal, so it lives in
  // the shared tables and is never journaled (it is only harmless demo numbers).
  const tables = opts.journal ? (new Proxy(journaled, { get: (t, n) => (n === "platform_time" ? base.platform_time : (t as Tables)[n as string]), set: (t, n, v) => ((t as Tables)[n as string] = v, true) }) as Tables) : base;
  const onWrite = opts.onWrite ? (w: Write) => (w.table === "platform_time" ? undefined : opts.onWrite!(w)) : undefined;
  const me = tables.profiles.find((p) => p.auth_user_id === (role === "admin" ? IDS.authAdmin : IDS.authTeacher))!;
  const visible: Visibility = (table, rows) => {
    if (opts.bypassRls) return rows;
    // The few row-level rules that shape what each page can show. The real ones live in Nick's scripts 009 and 011.
    if (table === "conversation_logs") return role === "teacher" ? rows.filter((r: Row) => r.host_id === me.id || r.visitor_id === me.id) : [];
    if (table === "survey_responses") return [];
    // The hub's tables: pair tables for the two people in the pairing, the rest for their owner only.
    if (table === "pair_messages" || table === "pair_game_sessions") {
      const mine = new Set(tables.pairings.filter((p: Row) => p.status === "approved" && (p.host_id === me.id || p.visitor_id === me.id)).map((p: Row) => p.id));
      return role === "teacher" ? rows.filter((r: Row) => mine.has(r.pairing_id)) : [];
    }
    if (table === "teacher_cards" || table === "growth_sharing") return rows.filter((r: Row) => r.profile_id === me.id);
    if (["future_notes", "platform_time", "growth_goals", "growth_entries", "ctle_settings", "ctle_hours"].includes(table)) return rows.filter((r: Row) => r.profile_id === me.id);
    return rows;
  };
  return createMockClient({
    onWrite,
    tables,
    visible,
    user: { id: me.auth_user_id, email: me.email },
    rpc: {
      growth_activity: (args: { p_days?: number }) => (role === "admin" ? growthActivity(tables, args?.p_days ?? 30) : null),
      ctle_progress: () => (role === "admin" ? ctleReading(tables) : null),
      lookbook_cards: () => (role === "teacher" ? lookbookRows(tables) : []),
      // Admins can't read conversation rows by design; they get a count.
      participation_summary: (args: { p_cycle: string }) => {
        const pr = tables.pairings.filter((p) => p.cycle_id === args.p_cycle && p.status === "approved");
        const logs = tables.conversation_logs.filter((l) => l.cycle_id === args.p_cycle && l.status === "submitted");
        const conv = (id: string) => logs.some((l) => l.pairing_id === id);
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
          complete: pr.filter((p) => logs.some((l) => l.pairing_id === p.id && !l.is_visit_debrief) && deb(p.id)).length,
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
        const logs = tables.conversation_logs.filter((l) => l.cycle_id === args.p_cycle && l.status === "submitted" && l.submitted_at);
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
        // The same counts by week (the Monday of each submission), so the weekly heat map has something to show.
        const monday = (iso: string) => { const d = new Date(iso); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); };
        const weeks = new Map<string, number>();
        const heatWeeks = new Map<string, number>();
        for (const l of logs) {
          const wk = monday(String(l.submitted_at));
          weeks.set(wk, (weeks.get(wk) ?? 0) + 1);
          const p = pr.get(l.pairing_id);
          if (!p) continue;
          for (const d of new Set([p.host_id, p.visitor_id].map((id) => prof.get(id)?.department ?? "Unassigned"))) if ((size.get(d) ?? 0) >= MIN) heatWeeks.set(`${d}|${wk}`, (heatWeeks.get(`${d}|${wk}`) ?? 0) + 1);
        }
        return {
          months: [...months.entries()].sort().map(([month, n]) => ({ month, n: hide(n) })),
          heat: [...heat.entries()].sort().map(([k, n]) => ({ department: k.split("|")[0], month: k.split("|")[1], n: hide(n) })),
          weeks: [...weeks.entries()].sort().map(([week, n]) => ({ week, n: hide(n) })),
          heat_weeks: [...heatWeeks.entries()].sort().map(([k, n]) => ({ department: k.split("|")[0], week: k.split("|")[1], n: hide(n) })),
        };
      },
      conversation_log_count: (args: { p_cycle: string | null }) => tables.conversation_logs.filter((l) => l.status === "submitted" && (!args?.p_cycle || l.cycle_id === args.p_cycle)).length,
    },
  });
}
