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
  title: "A school one year into Mentorful",
  arc: [
    { label: "A year ago", text: "Lincoln High, a sample school. Its Culture Scan came back under 50%. Teachers who shared a hallway had never spoken." },
    { label: "The turn", text: "The school adopted Mentorful: pairs across departments, and what teachers write stays private." },
    { label: "Tonight", text: "One year later the scan reads 85%. The principal closes the last gap, English and Science, and shows the board evidence with no teacher's name in the deck." },
  ],
  note: "The story's numbers belong to a sample school: say \"a school we'll call Lincoln High\". The 85% is on screen (the sample scan reads 5.1 out of 6 for collective efficacy); the \"a year ago\" numbers are in the story and on Slide 2 only.",
} as const;

export type Member = { name: string; plays: string; built: string; screen: string; speaks: string };

/** Everyone on stage: who they play, what they built, which screen is theirs, and when they speak. */
export const CAST: Member[] = [
  { name: "Eric", plays: "The narrator", built: "Privacy: no teacher can ever be singled out", screen: "Slides (and Mr. Stefano's screen for one line)", speaks: "0:00, 1:55, 2:13, 3:10, 3:48, 4:32" },
  { name: "Juan", plays: "The principal", built: "The principal's dashboard", screen: "Pulse, Constellation, Pairing, Trust, Reports", speaks: "0:40, 2:24, 2:50, 3:52, 4:18" },
  { name: "Bernard", plays: "Ms. Afiya, the English teacher", built: "The teacher dashboard", screen: "Ms. Afiya's screen: log a conversation", speaks: "1:05, 3:20" },
  { name: "Bertrand", plays: "Mr. Stefano, the Science teacher", built: "Pairing and the pair chat", screen: "Mr. Stefano's screen: the pair chat", speaks: "1:30, 3:38" },
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
    say: "Picture a school we'll call Lincoln High. A year ago its Culture Scan came back under fifty percent. Teachers who shared a hallway had never spoken, and the honest answers stopped the moment the principal asked.",
  },
  {
    secs: 11,
    who: "Eric",
    screen: "Slide 3",
    say: "So the school adopted Mentorful: pairs across departments, and what teachers write stays private. Tonight, the principal is Juan, one year later.",
  },
  {
    secs: 26,
    who: "Juan",
    screen: "Pulse, then Constellation",
    action: "Switch to Juan. Point at the Culture Scan and the privacy badge. Open Constellation.",
    say: "This year's scan: five point one out of six. Eighty-five percent. Any group under five, I can't see, because I'm not allowed to. But one thing still keeps me up. English and Science. Same building. Zero connections.",
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
    action: "Switch to Juan. Show Pulse (logged conversations 9 to 10), then the Trust page.",
    say: "One more logged conversation. But what they said? I can't read a word of it. I can count it. I can't read it. That's why teachers tell the truth.",
  },
  {
    secs: 14,
    who: "Juan",
    screen: "Reports",
    action: "Open Reports. Show the faculty map, then Download PDF for the deck.",
    say: "Tomorrow the board gets evidence, and a deck with no teacher's name in it. One click, a PDF.",
  },
  {
    secs: 20,
    who: "Eric",
    screen: "Slide 4",
    say: "A year ago, under fifty percent. Today, eighty-five. Two strangers are coaching each other, the principal has proof, and nobody had to feel watched. Evidence for principals. Privacy for teachers. This is Mentorful. Thank you.",
  },
];

export const BEATS: Beat[] = BEAT_DATA.map((b, i, all) => ({ ...b, t: startOf(all, i) }));

export const TRIM = [
  "The Trust page (Juan, 3:44): keep the line, skip the page.",
  "The \"Tomorrow the board gets evidence\" beat (Juan, 4:18).",
  "Slide 3 (Eric, 1:48): say its line over Slide 2.",
  "The \"[one skill you're proud of]\" sentence in each intro.",
];

export const NOTES = [
  "Do not say \"no names anywhere\". The faculty map in Reports shows names; the deck has none. Say \"no teacher's name in the deck\".",
  "Say \"sample school\". The numbers are a story, and the screens run on made-up data.",
  "Use one tab. The bar at the bottom of every screen switches who you are; do not open a second tab.",
  "Press Reset before every run, and after rehearsing.",
];
