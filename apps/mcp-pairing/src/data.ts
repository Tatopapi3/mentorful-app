/**
 * Where the server's three resources come from.
 *
 * MENTORFUL_DATA=demo (the default) reads the teacher dashboard's sample data
 * in apps/web/public/mentortrdash/data, so the server runs with no setup.
 * MENTORFUL_DATA=supabase reads the live project with the service key, which
 * bypasses RLS: so this module, not a policy, is what keeps the privacy
 * invariants, and it refuses the two private tables outright.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { domainsForTags } from "../../web/src/lib/domains.ts";
import type { ExclusionRule, HistoryPair, Teacher } from "./pairing.ts";

/** Never read by this server, by any path. See the prompt's privacy invariants. */
export const FORBIDDEN_TABLES = new Set(["survey_responses", "conversation_logs"]);

export type Source = {
  profiles(schoolId: string): Promise<Teacher[]>;
  exclusionRules(schoolId: string): Promise<ExclusionRule[]>;
  pairingHistory(schoolId: string, cycles: number): Promise<HistoryPair[]>;
};

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** Demo strength tags are "A; B"; the database stores a jsonb array. */
const tagsOf = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(";").map((t) => t.trim()).filter(Boolean);

/** The app's own tag-to-domain lookup; unknown tags are dropped, not guessed. */
const resolveDomains = (raw: unknown) => domainsForTags(tagsOf(raw));

// ----------------------------------------------------------------- demo

export const DEMO_SCHOOL_ID = "mentorful-sandbox";

function demoSource(): Source {
  const read = async <T>(p: string): Promise<T> => JSON.parse(await readFile(here(p), "utf8"));
  const check = (schoolId: string) => {
    if (schoolId !== DEMO_SCHOOL_ID) throw new Error(`Demo data has one school, "${DEMO_SCHOOL_ID}".`);
  };
  return {
    async profiles(schoolId) {
      check(schoolId);
      const rows = await read<{ key: string; name: string; department: string; strength_tags: string; role: string }[]>(
        "../../web/public/mentortrdash/data/profiles.json"
      );
      return rows
        .filter((r) => r.role === "Teacher")
        .map((r) => ({ id: r.key, name: r.name, department: r.department, domains: resolveDomains(r.strength_tags) }));
    },
    async exclusionRules(schoolId) {
      check(schoolId);
      return read<ExclusionRule[]>("../demo/exclusion_rules.json");
    },
    async pairingHistory(schoolId, cycles) {
      check(schoolId);
      // The dashboard's pairings are the current cycle, so cycles_ago = 0.
      if (cycles < 1) return [];
      const rows = await read<{ host: string; visitor: string; status: string }[]>(
        "../../web/public/mentortrdash/data/pairings.json"
      );
      return rows.filter((r) => r.status === "approved").map((r) => ({ host_id: r.host, visitor_id: r.visitor, cycles_ago: 0 }));
    },
  };
}

// ------------------------------------------------------------- supabase

function guarded(db: SupabaseClient) {
  return (table: string) => {
    if (FORBIDDEN_TABLES.has(table)) throw new Error(`The pairing server never reads ${table}.`);
    return db.from(table);
  };
}

function supabaseSource(): Source {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("MENTORFUL_DATA=supabase needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  const from = guarded(createClient(url, key, { auth: { persistSession: false } }));

  return {
    async profiles(schoolId) {
      // Name, department and strengths only: no email, why_teach or big_five.
      const { data, error } = await from("profiles")
        .select("id, first_name, last_name, department, strength_tags")
        .eq("school_id", schoolId)
        .eq("role", "teacher");
      if (error) throw new Error(`profiles: ${error.message}`);
      return (data ?? []).map((p) => ({
        id: p.id as string,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "A colleague",
        department: (p.department as string | null) ?? null,
        domains: resolveDomains(p.strength_tags),
      }));
    },
    async exclusionRules(schoolId) {
      // Pair ids only. The reason for a conflict stays with whoever recorded it.
      const { data, error } = await from("pairing_exclusion_rules")
        .select("teacher_a, teacher_b")
        .eq("school_id", schoolId)
        .eq("active", true);
      if (error) throw new Error(`pairing_exclusion_rules: ${error.message} (apply scripts/015_pairing_exclusion_rules.sql)`);
      return (data ?? []) as ExclusionRule[];
    },
    async pairingHistory(schoolId, cycles) {
      if (cycles < 1) return [];
      // Most recent first, by end date, as /admin/map picks its cycle.
      const { data: cyc, error: e1 } = await from("cycles")
        .select("id, ends_at")
        .eq("school_id", schoolId)
        .order("ends_at", { ascending: false })
        .limit(cycles);
      if (e1) throw new Error(`cycles: ${e1.message}`);
      const order = new Map((cyc ?? []).map((c, i) => [c.id as string, i]));
      if (!order.size) return [];
      const { data, error } = await from("pairings")
        .select("host_id, visitor_id, cycle_id, status")
        .in("cycle_id", [...order.keys()])
        .in("status", ["approved", "pending"]);
      if (error) throw new Error(`pairings: ${error.message}`);
      return (data ?? []).map((p) => ({
        host_id: p.host_id as string,
        visitor_id: p.visitor_id as string,
        cycles_ago: order.get(p.cycle_id as string) ?? 0,
      }));
    },
  };
}

export function source(): Source {
  return (process.env.MENTORFUL_DATA ?? "demo") === "supabase" ? supabaseSource() : demoSource();
}
