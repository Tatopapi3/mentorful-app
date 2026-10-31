/**
 * Preview only. The lookbook shows a fixed set about each teacher (name, department, strengths), so there is almost
 * nothing to invent: a few teachers have chosen to hide themselves, and that is all. Never merged.
 */
import type { Row, Tables } from "./mockQuery";

export function addLookbookTables(t: Tables, meId: string): void {
  const teachers = t.profiles.filter((p) => p.role === "teacher");
  const choices: Row[] = [];
  teachers.forEach((p, i) => {
    // About one in ten has chosen to stay out of the lookbook; the preview teacher has not.
    if (p.id !== meId && i % 10 === 9) choices.push({ profile_id: p.id, school_id: p.school_id, hidden: true, updated_at: new Date().toISOString() });
  });
  t.lookbook_choices = choices;
}

/** What lookbook_cards() returns: exactly profile_id, name, department, strength_tags, for teachers who have not hidden. Admins get nothing. */
export function lookbookRows(t: Tables): Row[] {
  const hidden = new Set((t.lookbook_choices ?? []).filter((c) => c.hidden).map((c) => c.profile_id));
  return t.profiles
    .filter((p) => (p.role ?? "teacher") === "teacher" && !hidden.has(p.id))
    .map((p) => ({ profile_id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(" "), department: p.department, strength_tags: p.strength_tags }))
    .sort((a, b) => String(a.name).split(" ").slice(-1)[0].localeCompare(String(b.name).split(" ").slice(-1)[0]));
}
