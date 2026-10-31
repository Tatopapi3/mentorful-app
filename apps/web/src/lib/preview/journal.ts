/**
 * Keeps a visitor's changes in the demo (approving a request, publishing a round) in their own browser, so they stay
 * put even though every request may land on a different server. Each request replays the changes on top of the
 * untouched demo data; nothing is shared between visitors, and /preview/reset clears them.
 */
import { cookies } from "next/headers";
import type { Row, Tables, Write } from "./mockQuery";

export const JOURNAL_COOKIE = "demo_changes";

/**
 * PREVIEW_JOURNAL=memory keeps the changes in this server's memory instead of a cookie. That is for running the demo on one
 * machine (Demo Day): a cookie holds about 4 KB, which is too small for approving a round of pairs, and the browser quietly
 * drops one that is too big. There is one visitor then, so one shared list; /preview/reset empties it. Never for the
 * deployed demo, where every request may land on a different server.
 */
const inMemory = () => process.env.PREVIEW_JOURNAL === "memory";
const mem = globalThis as unknown as { __previewJournal?: Write[] };
export const resetMemoryJournal = () => {
  mem.__previewJournal = [];
};
const MAX = 3600;

export async function readJournal(): Promise<Write[]> {
  if (inMemory()) return [...(mem.__previewJournal ?? [])];
  try {
    const v = (await cookies()).get(JOURNAL_COOKIE)?.value;
    const j = v ? JSON.parse(decodeURIComponent(v)) : [];
    return Array.isArray(j) ? (j as Write[]) : [];
  } catch {
    return [];
  }
}

export async function writeJournal(journal: Write[]): Promise<void> {
  if (inMemory()) {
    mem.__previewJournal = [...journal];
    return;
  }
  let j = journal;
  let value = encodeURIComponent(JSON.stringify(j));
  while (value.length > MAX && j.length > 1) {
    j = j.slice(1);
    value = encodeURIComponent(JSON.stringify(j));
  }
  try {
    (await cookies()).set(JOURNAL_COOKIE, value, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 });
  } catch {
    // Not in a place where cookies can be set (a plain page render); nothing was written there anyway.
  }
}

/** Tables as this visitor sees them: copied on first use, with their recorded changes applied. The shared data is never touched. */
export function overlay(base: Tables, journal: Write[]): Tables {
  const copies: Tables = {};
  const load = (name: string) => {
    if (!(name in copies)) {
      const rows: Row[] = (base[name] ?? []).map((r) => ({ ...r }));
      for (const w of journal) {
        if (w.table !== name) continue;
        if (w.t === "u") {
          const ids = new Set(w.ids);
          for (const r of rows) if (ids.has(String(r.id))) Object.assign(r, w.patch);
        } else {
          for (const r of w.rows) if (!rows.some((x) => x.id === r.id)) rows.push({ ...r });
        }
      }
      copies[name] = rows;
    }
    return copies[name];
  };
  return new Proxy({} as Tables, {
    get: (_t, name) => (typeof name === "string" ? load(name) : undefined),
    set: (_t, name, v) => {
      if (typeof name === "string") copies[name] = v as Row[];
      return true;
    },
    has: (_t, name) => typeof name === "string" && (name in copies || name in base),
  });
}
