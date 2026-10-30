/**
 * Made-up rows for the teacher hub's tables (017_teacher_hub.sql), for the offline preview only: a little chat with the
 * preview teacher's partners, some game sessions, three notes to a future self (one sealed, one arrived, one read), a
 * week of time on the platform, two goals and a practice log. Dated relative to now so the screens look lived-in.
 */
import type { Row, Tables } from "./mockQuery";

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const H = 3_600_000;
const D = 24 * H;
const day = (offset: number) => new Date(Date.now() - offset * D).toISOString().slice(0, 10);

export function addHubTables(t: Tables, meId: string): void {
  const latest = [...t.cycles].sort((a, b) => String(b.ends_at).localeCompare(String(a.ends_at)))[0];
  const mine = t.pairings.filter((p) => p.status === "approved" && p.cycle_id === latest?.id && (p.host_id === meId || p.visitor_id === meId));
  const [p1, p2] = mine;
  const other = (p: Row) => (p.host_id === meId ? p.visitor_id : p.host_id);
  const msgs: Row[] = [];
  const m = (pairing: Row | undefined, from: string, body: string, at: number) => pairing && msgs.push({ id: `msg-${msgs.length + 1}`, pairing_id: pairing.id, sender_id: from, body, created_at: ago(at) });
  if (p1) {
    m(p1, other(p1), "Thanks for letting me sit in on Tuesday. The turn-and-talk before the share was exactly what I needed to see.", 3 * D + 2 * H);
    m(p1, meId, "Glad it helped! I'm going to try it with my second period tomorrow too.", 3 * D + H);
    m(p1, other(p1), "I'll send you the discussion-protocol one-pager tonight.", 2 * D);
    m(p1, meId, "Perfect. And I owe you the unit map for the ratios arc. Friday?", 2 * D - H);
    m(p1, other(p1), "Friday works. Want to use the Fishbowl protocol when I visit next week?", 5 * H);
  }
  if (p2) {
    m(p2, other(p2), "Hi! Looking forward to working together this cycle. When are you free to chat about a visit date?", 26 * H);
    m(p2, other(p2), "No rush. Even ten minutes after school would do it.", 25 * H);
  }
  const sess: Row[] = [];
  const s = (pairing: Row | undefined, mod: string, minutes: number | null, completed: boolean, at: number, by = meId) =>
    pairing && sess.push({ id: `gs-${sess.length + 1}`, pairing_id: pairing.id, module: mod, logged_by: by, minutes, completed, note: null, created_at: ago(at) });
  if (p1) {
    s(p1, "PLC Navigator", 25, false, 20 * D);
    s(p1, "PLC Navigator", 30, true, 12 * D, other(p1));
    s(p1, "Trust Calibration Matrix", 15, false, 9 * D);
    s(p1, "Efficacy Quest", 10, false, 4 * D, other(p1));
  }
  t.pair_messages = msgs;
  t.pair_game_sessions = sess;
  t.future_notes = [
    { id: "fn-1", profile_id: meId, body: "In October I wanted to stop re-explaining after a right answer. Did I? Count it once a day for a week and write down what happened.", open_on: day(-21), opened_at: null, created_at: ago(7 * D) },
    { id: "fn-2", profile_id: meId, body: "Remember how it felt when the students ran the discussion without me. That's the target. Keep going.", open_on: day(1), opened_at: null, created_at: ago(30 * D) },
    { id: "fn-3", profile_id: meId, body: "Ask Daniel about the exit-ticket reteach list. It saved him a whole planning period.", open_on: day(40), opened_at: ago(26 * D), created_at: ago(45 * D) },
  ];
  t.platform_time = [[1, 1680], [2, 2460], [3, 0], [4, 960], [5, 2940], [6, 1320]].filter(([, sec]) => sec > 0).map(([o, sec]) => ({ id: `pt-${o}`, profile_id: meId, day: day(o), seconds: sec, updated_at: ago(o * D) }));
  t.growth_goals = [
    { id: "g-1", profile_id: meId, title: "Let students finish before I step in", area: "Classroom Culture", why: "Daniel noticed I re-explain after a correct answer, and it tells the class the answer needed my approval.", target_date: day(-30), status: "active", created_at: ago(14 * D), updated_at: ago(14 * D) },
    { id: "g-2", profile_id: meId, title: "Send one positive note home a week", area: "Communication", why: null, target_date: null, status: "done", created_at: ago(60 * D), updated_at: ago(20 * D) },
  ];
  t.growth_entries = [
    { id: "ge-1", profile_id: meId, goal_id: "g-1", kind: "practice", minutes: 15, body: "Counted three seconds before responding in period 2. It felt long. Two students added to each other's answers.", created_at: ago(2 * D) },
    { id: "ge-2", profile_id: meId, goal_id: null, kind: "learning", minutes: 20, body: "Read the discussion-protocol one-pager Daniel sent. The 'revoice then wait' move is the one to try first.", created_at: ago(5 * D) },
    { id: "ge-3", profile_id: meId, goal_id: "g-1", kind: "reflection", minutes: null, body: "I notice I step in most when the silence goes past about five seconds. That's my cue to count.", created_at: ago(8 * D) },
  ];
}
