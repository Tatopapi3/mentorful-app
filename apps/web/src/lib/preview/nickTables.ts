/**
 * The demo's other dataset: Nick's own sandbox school, exactly as it is in his database file (db/mentorful_handoff.sql),
 * turned into rows by scripts/build-preview-nick-data.mjs. Chosen with PREVIEW_DATASET=nick. Only the two sign-in links
 * are bent to fit the demo: the admin row is shown as "Preview Admin" (not Nick's own name and address), and one demo
 * teacher is made the signed-in teacher. Nothing else is changed.
 */
import data from "./nick-data.json";
import { IDS } from "./fixtures";
import type { Row, Tables } from "./mockQuery";

const TEACHER_EMAIL = "liam.rivera@demo.mentorful.co";

export function buildNickTables(): Tables {
  const t = structuredClone(data) as unknown as Record<string, Row[]>;
  for (const p of t.profiles) {
    p.auth_user_id = null;
    if (p.role === "admin") Object.assign(p, { auth_user_id: IDS.authAdmin, first_name: "Preview", last_name: "Admin", email: "admin@preview.test" });
    if (p.email === TEACHER_EMAIL) p.auth_user_id = IDS.authTeacher;
  }
  return t as unknown as Tables;
}
