/**
 * The Demo Day script as data: one place the /demo page reads, so the team sees the same words they rehearse.
 * docs/DEMO_SCRIPT.md has the same text for the repo; tests/demo-script.test.ts fails if the two drift apart.
 */

export type Beat = {
  /** When the beat starts, m:ss. Worked out from the seconds before it, so the times always add up. */
  t: string;
  /** How many seconds the beat takes, speaking and clicking. */
  secs: number;
  who: string;
  /** What is on screen. */
  screen: string;
  /** What is said, word for word. */
  say: string;
  /** What the speaker does while saying it. */
  action?: string;
};

export const STORY = {
  title: "A school whose Culture Scan fell, one year into Mentorful",
  arc: [
    { label: "A year ago", text: "Pursuit, a sample school, adopted Mentorful: pairs across departments, and what teachers write stays private. Its Culture Scan reached 85%." },
    { label: "This year", text: "Eight new teachers joined with no partner. The scan fell to 70%, most in Structural, and English and Science still have zero connections." },
    { label: "Tonight", text: "The principal finds where, closes the English and Science gap, and takes next year's focus to the board, with no teacher's name in the deck." },
  ],
  note: "The story's numbers belong to a sample school: say \"a school we'll call Pursuit\". Both numbers are on screen: Pulse shows this year's scan (4.2 of 6, 70%) with last year's (5.1, 85%) as an orange tick on each bar. The scan is anonymous and has no departments, so it shows what fell (Structural) and the Constellation shows where (English and Science).",
} as const;

export type Member = { name: string; plays: string; built: string; screen: string; speaks: string };

/** Everyone on stage: who they play, what they built, which screen is theirs, and when they speak. */
export const CAST: Member[] = [
  { name: "Eric", plays: "The narrator", built: "Privacy: no teacher can ever be singled out", screen: "Slides (and Mr. Stefano's screen for one line)", speaks: "0:00, 1:55, 2:13, 3:11, 3:49, 4:33" },
  { name: "Juan", plays: "Mr. David, the principal", built: "The principal's dashboard", screen: "Pulse, Constellation, Pairing, Trust, Reports", speaks: "0:40, 2:25, 2:51, 3:53, 4:19" },
  { name: "Bernard", plays: "Ms. Afiya, the English teacher", built: "The teacher dashboard", screen: "Ms. Afiya's screen: log a conversation", speaks: "1:05, 3:21" },
  { name: "Bertrand", plays: "Mr. Stefano, the Science teacher", built: "Pairing and the pair chat", screen: "Mr. Stefano's screen: the pair chat", speaks: "1:30, 3:39" },
];

const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
const startOf = (all: { secs: number }[], i: number) => mmss(all.slice(0, i).reduce((n, b) => n + b.secs, 0));

const BEAT_DATA: Omit<Beat, "t">[] = [
  {
    secs: 40,
    who: "Eric",
    screen: "Slide 1",
    say: "Hi everyone, we're the Mentorful team, building for a real client, a teacher-led startup founded by Mike and Nick. Their idea: the best coach for a teacher is the teacher down the hall. Schools pair teachers up, and a short survey, the Culture Scan, measures whether the staff is getting stronger together. I'm Eric. [one line about you, about 12 words]. I own privacy: no teacher can ever be singled out.",
  },
  {
    secs: 25,
    who: "Juan",
    screen: "Slide 1",
    say: "I'm Juan. For seven years I was a technical recruiter, matching people to the right teams. Outside work I'm a gamer and a sports fan, and I've always loved a good stat screen, because it shows who's improving. Pursuit is where I learned to build those myself. On Mentorful, I built the principal's dashboard.",
  },
  {
    secs: 25,
    who: "Bernard",
    screen: "Slide 1",
    say: "I'm Bernard. Before Pursuit, I [what you did and where you're from, about 9 words]. What got me into building was [the moment or reason, about 7 words]. At Pursuit I learned to [one skill you're proud of, about 5 words]. On Mentorful, I built the teacher dashboard, the part teachers use every week.",
  },
  {
    secs: 25,
    who: "Bertrand",
    screen: "Slide 1",
    say: "I'm Bertrand. Before Pursuit, I [what you did and where you're from, about 8 words]. What pulled me in was [the moment or reason, about 7 words]. At Pursuit I learned to [one skill you're proud of, about 5 words]. On Mentorful, I built pairing and the pair chat. Eric, take it away.",
  },
  {
    secs: 18,
    who: "Eric",
    screen: "Slide 2",
    say: "Picture a school we'll call Pursuit. A year after adopting Mentorful, its Culture Scan hit eighty-five percent. Every teacher had a partner, and the honest answers kept coming.",
  },
  {
    secs: 12,
    who: "Eric",
    screen: "Slide 3",
    say: "Then this year it fell to seventy percent. Eight new teachers, no partners. Tonight the principal is Mr. David, and he has to find out why.",
  },
  {
    secs: 26,
    who: "Juan",
    screen: "Pulse, then Constellation",
    action: "Switch to Mr. David. Point at the Culture Scan (4.2, down 0.9) and the orange last-year ticks. Open Constellation.",
    say: "This year's scan: four point two out of six. Seventy percent, down from eighty-five. Structural fell the most. Any group under five, I can't see, because I'm not allowed to. But the map shows me where. English and Science. Same building. Zero connections.",
  },
  {
    secs: 20,
    who: "Juan",
    screen: "Pairing",
    action: "Click Draft new round. The map draws the new links. Click Approve 4 pairs.",
    say: "So I let Mentorful draft a round. One click. English and Science, connected. I still make the call. Approved.",
  },
  {
    secs: 10,
    who: "Eric",
    screen: "Ms. Afiya's screen",
    say: "Ms. Afiya in English, Mr. Stefano in Science. Strangers a month ago. Today, twenty minutes on essays written by AI.",
  },
  {
    secs: 18,
    who: "Bernard, as Ms. Afiya",
    screen: "Ms. Afiya's screen",
    action: "Switch to Ms. Afiya. Log a conversation, write a line, Save draft, Submit this entry.",
    say: "That was the most useful conversation I've had all semester. Let me log it. Ten seconds. And this note? Only I can read it.",
  },
  {
    secs: 10,
    who: "Bertrand, as Mr. Stefano",
    screen: "Mr. Stefano's screen",
    action: "Switch to Mr. Stefano. Open Chat, send the message.",
    say: "Sending you my rubric tonight. Same time next week?",
  },
  {
    secs: 4,
    who: "Eric",
    screen: "Mr. Stefano's screen",
    say: "So, principal. What do you see?",
  },
  {
    secs: 26,
    who: "Juan",
    screen: "Pulse, then Trust",
    action: "Switch to Mr. David. Show Pulse (logged conversations 9 to 10), then the Trust page.",
    say: "One more logged conversation. But what they said? I can't read a word of it. I can count it. I can't read it. That's why teachers tell the truth.",
  },
  {
    secs: 14,
    who: "Juan",
    screen: "Reports",
    action: "Open Reports. Show the faculty map, then Download PDF for the deck.",
    say: "Tomorrow the board gets evidence: where we fell, and where we focus next year. No teacher's name in the deck. One click, a PDF.",
  },
  {
    secs: 20,
    who: "Eric",
    screen: "Slide 4",
    say: "A year ago, eighty-five. This year, seventy. Now the principal knows where to focus. Two strangers are coaching each other, and nobody had to feel watched. Next spring's scan is the proof. Evidence for principals. Privacy for teachers. This is Mentorful. Thank you.",
  },
];

export const BEATS: Beat[] = BEAT_DATA.map((b, i, all) => ({ ...b, t: startOf(all, i) }));

const at = (who: string, screen: string) => BEATS.find((b) => b.who === who && b.screen === screen)?.t ?? "?";

export const TRIM = [
  `The Trust page (Juan, ${at("Juan", "Pulse, then Trust")}): keep the line, skip the page.`,
  `The "Tomorrow the board gets evidence" beat (Juan, ${at("Juan", "Reports")}).`,
  `Slide 3 (Eric, ${at("Eric", "Slide 3")}): say its line over Slide 2.`,
  "The \"[one skill you're proud of]\" sentence in each intro.",
];

export const NOTES = [
  "Do not say \"no names anywhere\". The faculty map in Reports shows names; the deck has none. Say \"no teacher's name in the deck\".",
  "Say \"sample school\". The numbers are a story, and the screens run on made-up data.",
  "The scan is anonymous and has no departments. Say the scan shows what fell and the map shows where; never say a department scored low.",
  "Use one tab. The bar at the bottom of every screen switches who you are; do not open a second tab.",
  "Slide 5 (the QR code and how it was built) is for questions after the close. Do not show it while you present, so nobody looks down at a phone.",
  "Press Reset before every run, and after rehearsing.",
];
