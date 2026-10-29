/**
 * Made-up lookbook cards for the offline preview: about thirty of the fifty demo teachers have chosen to share a card
 * (the preview teacher included), the rest have not. All text is invented. Preview only; never merged.
 */
import type { Row, Tables } from "./mockQuery";

const HEADLINES = [
  "Loves labs and student-led talk",
  "Turning quiet rooms into thinking rooms",
  "Routines first, then the fun",
  "Writing coach at heart",
  "Data nerd, reteach believer",
  "Makes abstract ideas concrete",
  "Warm, firm, and always prepared",
  "Project-based everything",
  "Building readers one conference at a time",
  "Curious about how kids think",
];
const GRADES = ["6th grade", "7th grade", "8th grade", "9th grade", "10th grade", "11th grade", "12th grade", "5th grade"];
const BIOS = [
  "I came to teaching after a first career in a lab, and I still start every unit with a question I don't know the answer to. My best days are the ones where students argue with each other, politely, and I stay out of it.",
  "Ten minutes of routine at the start saves forty minutes of chaos later. I like a room where everyone knows what happens next so the thinking can be the hard part.",
  "I teach the way I wish I had been taught: show me the thinking, not just the answer. I keep a folder of student explanations that surprised me.",
  "I'm happiest when a student who said 'I'm not a math person' catches themselves explaining it to a friend. I'm here to learn how other teachers make that happen.",
  "New to this building but not to the work. I'm looking for colleagues who will actually come watch a lesson and tell me what they saw working.",
  "Family communication is my quiet superpower: a good-news call home changes the whole year. I'd love to swap what works with someone who plans differently than I do.",
];
const ROLES: [string, string][] = [["Instructional coach", "Riverside Academy"], ["Grade-level lead", "Maple Grove Middle"], ["Student-teacher mentor", "Cedar Hill High"], ["Curriculum writer", "Lincoln District"], ["Classroom teacher", "Oak Park Elementary"], ["Department co-chair", "Harbor Prep"], ["Teaching fellow", "Eastside Charter"]];
const ACH = [
  "Department lead, 2024",
  "Built the school's first student-run discussion routine",
  "Cut reteach time by a third with same-day exit tickets",
  "Mentored three student teachers",
  "Presented at the district summit",
  "National Board candidate",
  "Launched a family reading night that now runs monthly",
  "Teacher of the Year nominee",
  "Wrote the unit our whole grade now uses",
  "Raised mastery on the unit assessment by 14 points",
];
const GROW = ["Wait time", "Student-led discussion", "Feedback in fewer words", "Family communication", "Differentiated planning", "Letting silence work", "Using data without drowning in it", "Transitions"];
const WANTS = ["A thinking partner", "Feedback on my lessons", "Ideas for classroom culture", "Help with planning", "Better family communication", "Sharper assessment and feedback", "To see great teaching up close", "To share what works"];
const WANT_TEXT = [
  "Someone who will actually visit and tell me what they noticed, not just what to fix.",
  "A co-mentor who plans very differently from me, so I have to explain what I do.",
  "Honest, kind conversations about the lessons that didn't land.",
  "A few good ideas a month I can use the next day. Small beats grand.",
  "",
];

export function addLookbookTables(t: Tables, meId: string): void {
  const teachers = t.profiles.filter((p) => p.role === "teacher");
  const cards: Row[] = [];
  teachers.forEach((p, i) => {
    const mine = p.id === meId;
    if (!mine && i % 5 === 4) return; // about one in five hasn't shared a card
    const n = (k: number) => (i * 7 + k * 13 + 3) % 97;
    const pick = <T,>(xs: T[], k: number) => xs[n(k) % xs.length];
    const pickN = <T,>(xs: T[], count: number, k: number) => [...new Set(Array.from({ length: count }, (_, j) => pick(xs, k + j)))];
    const dept = String(p.department ?? "Teacher");
    cards.push({
      profile_id: p.id,
      school_id: p.school_id,
      headline: `${pick(GRADES, 1)} ${dept} · ${pick(HEADLINES, 2).toLowerCase()}`,
      bio: pick(BIOS, 3),
      photo_path: null,
      experience: pickN(ROLES, 1 + (n(4) % 3), 4).map((r, j) => ({ role: r[0], place: r[1], years: `${2024 - 3 * (j + 1)}–${2024 - 3 * j}` })),
      achievements: pickN(ACH, 1 + (n(5) % 3), 5),
      growing_in: pickN(GROW, 1 + (n(6) % 3), 6),
      wants: pickN(WANTS, 1 + (n(7) % 3), 7),
      wants_text: pick(WANT_TEXT, 8),
      show_growth: n(9) % 3 === 0,
      published: true,
      updated_at: new Date(Date.now() - n(10) * 86_400_000).toISOString(),
    });
  });
  t.teacher_cards = cards;
}

/** What lookbook_cards() returns: published cards in the school, joined to a few profile fields. Admins get nothing. */
export function lookbookRows(t: Tables): Row[] {
  const by = new Map(t.profiles.map((p) => [p.id, p]));
  return (t.teacher_cards ?? [])
    .filter((c) => c.published)
    .map((c) => {
      const p = by.get(c.profile_id);
      if (!p) return null;
      const years = 1 + ((String(p.id).charCodeAt(String(p.id).length - 1) * 7 + String(p.last_name).length * 3) % 24);
      return {
        profile_id: c.profile_id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" "),
        department: p.department,
        years_teaching: years,
        strength_tags: p.strength_tags,
        teaching_style: p.teaching_style,
        archetype_id: p.archetype_id,
        inspiration: p.inspiration,
        headline: c.headline,
        bio: c.bio,
        photo_path: c.photo_path,
        experience: c.experience,
        achievements: c.achievements,
        growing_in: c.show_growth ? c.growing_in : [],
        wants: c.wants,
        wants_text: c.wants_text,
        updated_at: c.updated_at,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => String(a.name).split(" ").slice(-1)[0].localeCompare(String(b.name).split(" ").slice(-1)[0]));
}
