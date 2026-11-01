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

export const BEATS: Beat[] = [
  {
    t: "0:00",
    who: "Eric",
    screen: "Slide 1",
    say: "Hi everyone, we're the Mentorful team, and we built this for a real client, a teacher-led startup founded by Mike and Nick. Their idea is simple: the best coach for a teacher is the teacher down the hall. Schools pair teachers up, and a short survey, the Culture Scan, measures whether the whole staff is getting stronger together. I'm Eric, and I own privacy: no teacher can ever be singled out.",
  },
  { t: "0:40", who: "Juan", screen: "Slide 1", say: "I'm Juan, a former technical recruiter. I built the principal's dashboard." },
  { t: "0:50", who: "Bernard", screen: "Slide 1", say: "I'm Bernard. [one line about you]. I built the teacher dashboard." },
  { t: "1:00", who: "Bertrand", screen: "Slide 1", say: "I'm Bertrand. [one line about you]. I built pairing and the pair chat." },
  {
    t: "1:10",
    who: "Eric",
    screen: "Slide 2",
    say: "Picture a school we'll call Lincoln High. A year ago its Culture Scan came back under fifty percent. Teachers who shared a hallway had never spoken. Most said they would not admit a mistake to a colleague. The principal wanted to help, but the moment she asked, the honest answers stopped.",
  },
  {
    t: "1:30",
    who: "Eric",
    screen: "Slide 3",
    say: "So the school adopted Mentorful. It pairs teachers across departments, and what they write stays private by design. Tonight, the principal is Juan, one year later.",
  },
  {
    t: "1:45",
    who: "Juan",
    screen: "Pulse, then Constellation",
    action: "Switch to Juan. Point at the Culture Scan and the privacy badge. Open Constellation.",
    say: "This year's scan: five point one out of six. Eighty-five percent. And see this? Any group under five, I can't see. Not because I didn't click. Because I'm not allowed to. But one thing still keeps me up. English and Science. Same building, same kids. Zero connections.",
  },
  {
    t: "2:10",
    who: "Juan",
    screen: "Pairing",
    action: "Click Draft new round. The map draws the new links. Click Approve 4 pairs.",
    say: "So I let Mentorful draft a round across departments. One click. English and Science, connected. I still make the call. Approved.",
  },
  {
    t: "2:30",
    who: "Eric",
    screen: "Ms. Afiya's screen",
    say: "One of those new pairs: Ms. Afiya in English and Mr. Stefano in Science. A month ago they had never spoken. Today they spent twenty minutes on essays written by AI.",
  },
  {
    t: "2:45",
    who: "Bernard, as Ms. Afiya",
    screen: "Ms. Afiya's screen",
    action: "Switch to Ms. Afiya. Log a conversation, write a line, Save draft, Submit this entry.",
    say: "That was the most useful conversation I've had all semester. Let me log it. Ten seconds. And this note? Only I can read it.",
  },
  {
    t: "3:05",
    who: "Bertrand, as Mr. Stefano",
    screen: "Mr. Stefano's screen",
    action: "Switch to Mr. Stefano. Open Chat, send the message.",
    say: "Sending you my rubric tonight. Same time next week?",
  },
  { t: "3:20", who: "Eric", screen: "Mr. Stefano's screen", say: "So, principal. What do you see?" },
  {
    t: "3:25",
    who: "Juan",
    screen: "Pulse, then Trust",
    action: "Switch to Juan. Show Pulse (logged conversations 9 to 10), then the Trust page.",
    say: "One more logged conversation. But what they said? I can't read a word of it. I can count it. I can't read it. That's why teachers tell the truth.",
  },
  {
    t: "4:00",
    who: "Juan",
    screen: "Reports",
    action: "Open Reports. Show the faculty map, then Download PDF for the deck.",
    say: "Tomorrow I walk into the board meeting with evidence: who is connected, and a deck with no teacher's name in it. One click, a PDF.",
  },
  {
    t: "4:25",
    who: "Eric",
    screen: "Slide 4",
    say: "A year ago, under fifty percent. Today, eighty-five. Two teachers who were strangers are coaching each other, the principal has proof, and nobody had to feel watched. Evidence for principals. Privacy for teachers. This is Mentorful. Thank you.",
  },
];

export const TRIM = [
  "The \"Tomorrow I walk into the board meeting\" beat (Juan, 4:00).",
  "The Trust page (Juan, 3:25): keep the line, skip the page.",
  "Each person's one-line intro.",
];

export const NOTES = [
  "Do not say \"no names anywhere\". The faculty map in Reports shows names; the deck has none. Say \"no teacher's name in the deck\".",
  "Say \"sample school\". The numbers are a story, and the screens run on made-up data.",
  "Use one tab. The bar at the bottom of every screen switches who you are; do not open a second tab.",
  "Press Reset before every run, and after rehearsing.",
];
