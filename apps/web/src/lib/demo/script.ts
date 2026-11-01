/**
 * The Demo Day script as data: one place the /demo page reads, so the team sees the same words they rehearse.
 * docs/DEMO_SCRIPT.md has the same text for the repo; tests/demo-script.test.ts fails if the two drift apart.
 */

export type Beat = {
  /** When the beat starts, m:ss. */
  t: string;
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
  { name: "Eric", plays: "The narrator", built: "Privacy: no teacher can ever be singled out", screen: "Slides (and Mr. Stefano's screen for one line)", speaks: "0:00, 1:54, 2:10, 3:08, 3:50, 4:35" },
  { name: "Juan", plays: "The principal", built: "The principal's dashboard", screen: "Pulse, Constellation, Pairing, Trust, Reports", speaks: "0:30, 2:22, 2:48, 3:54, 4:20" },
  { name: "Bernard", plays: "Ms. Afiya, the English teacher", built: "The teacher dashboard", screen: "Ms. Afiya's screen: log a conversation", speaks: "0:58, 3:18" },
  { name: "Bertrand", plays: "Mr. Stefano, the Science teacher", built: "Pairing and the pair chat", screen: "Mr. Stefano's screen: the pair chat", speaks: "1:26, 3:38" },
];

export const BEATS: Beat[] = [
  {
    t: "0:00",
    who: "Eric",
    screen: "Slide 1",
    say: "Hi everyone, we're the Mentorful team, building for a real client, a teacher-led startup founded by Mike and Nick. Their idea is simple: the best coach for a teacher is the teacher down the hall. Schools pair teachers up, and a short survey, the Culture Scan, measures whether the whole staff is getting stronger together. I'm Eric. [one line about your background]. On Mentorful, I own privacy: no teacher can ever be singled out.",
  },
  {
    t: "0:30",
    who: "Juan",
    screen: "Slide 1",
    say: "I'm Juan. For seven years I was a technical recruiter, matching people to the right teams. Outside work I'm a gamer and a sports fan, and I've always loved a good stat screen, because it shows who's improving. Pursuit is where I learned to build those myself. On Mentorful, I built the principal's dashboard.",
  },
  {
    t: "0:58",
    who: "Bernard",
    screen: "Slide 1",
    say: "I'm Bernard. Before Pursuit, I [what you did, where you're from]. What got me into building was [the moment or reason]. At Pursuit I learned to [one skill you're proud of]. On Mentorful, I built the teacher dashboard, the part teachers use every week.",
  },
  {
    t: "1:26",
    who: "Bertrand",
    screen: "Slide 1",
    say: "I'm Bertrand. Before Pursuit, I [what you did, where you're from]. What pulled me in was [the moment or reason]. At Pursuit I learned to [one skill you're proud of]. On Mentorful, I built pairing and the pair chat. Eric, take it away.",
  },
  {
    t: "1:54",
    who: "Eric",
    screen: "Slide 2",
    say: "Picture a school we'll call Lincoln High. A year ago its Culture Scan came back under fifty percent. Teachers who shared a hallway had never spoken, and the honest answers stopped the moment the principal asked.",
  },
  {
    t: "2:10",
    who: "Eric",
    screen: "Slide 3",
    say: "So the school adopted Mentorful: pairs across departments, and what teachers write stays private. Tonight, the principal is Juan, one year later.",
  },
  {
    t: "2:22",
    who: "Juan",
    screen: "Pulse, then Constellation",
    action: "Switch to Juan. Point at the Culture Scan and the privacy badge. Open Constellation.",
    say: "This year's scan: five point one out of six. Eighty-five percent. Any group under five, I can't see, because I'm not allowed to. But one thing still keeps me up. English and Science. Same building. Zero connections.",
  },
  {
    t: "2:48",
    who: "Juan",
    screen: "Pairing",
    action: "Click Draft new round. The map draws the new links. Click Approve 4 pairs.",
    say: "So I let Mentorful draft a round. One click. English and Science, connected. I still make the call. Approved.",
  },
  {
    t: "3:08",
    who: "Eric",
    screen: "Ms. Afiya's screen",
    say: "Ms. Afiya in English, Mr. Stefano in Science. Strangers a month ago. Today, twenty minutes on essays written by AI.",
  },
  {
    t: "3:18",
    who: "Bernard, as Ms. Afiya",
    screen: "Ms. Afiya's screen",
    action: "Switch to Ms. Afiya. Log a conversation, write a line, Save draft, Submit this entry.",
    say: "That was the most useful conversation I've had all semester. Let me log it. Ten seconds. And this note? Only I can read it.",
  },
  {
    t: "3:38",
    who: "Bertrand, as Mr. Stefano",
    screen: "Mr. Stefano's screen",
    action: "Switch to Mr. Stefano. Open Chat, send the message.",
    say: "Sending you my rubric tonight. Same time next week?",
  },
  {
    t: "3:50",
    who: "Eric",
    screen: "Mr. Stefano's screen",
    say: "So, principal. What do you see?",
  },
  {
    t: "3:54",
    who: "Juan",
    screen: "Pulse, then Trust",
    action: "Switch to Juan. Show Pulse (logged conversations 9 to 10), then the Trust page.",
    say: "One more logged conversation. But what they said? I can't read a word of it. I can count it. I can't read it. That's why teachers tell the truth.",
  },
  {
    t: "4:20",
    who: "Juan",
    screen: "Reports",
    action: "Open Reports. Show the faculty map, then Download PDF for the deck.",
    say: "Tomorrow the board gets evidence, and a deck with no teacher's name in it. One click, a PDF.",
  },
  {
    t: "4:35",
    who: "Eric",
    screen: "Slide 4",
    say: "A year ago, under fifty percent. Today, eighty-five. Two strangers are coaching each other, the principal has proof, and nobody had to feel watched. Evidence for principals. Privacy for teachers. This is Mentorful. Thank you.",
  },
];

export const TRIM = [
  "The Trust page (Juan, 3:54): keep the line, skip the page.",
  "The \"Tomorrow the board gets evidence\" beat (Juan, 4:20).",
  "Slide 3 (Eric, 2:10): say its line over Slide 2.",
  "The \"[one skill you're proud of]\" sentence in each intro.",
];

export const NOTES = [
  "Do not say \"no names anywhere\". The faculty map in Reports shows names; the deck has none. Say \"no teacher's name in the deck\".",
  "Say \"sample school\". The numbers are a story, and the screens run on made-up data.",
  "Use one tab. The bar at the bottom of every screen switches who you are; do not open a second tab.",
  "Press Reset before every run, and after rehearsing.",
];
