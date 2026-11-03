# Demo Day run sheet

This build is for the stage. Since Nov 2 it is also `main` (the capstone submission), so the repo's default branch runs the demo.
`team-integration` is still the clean real product and the handoff for Nick and Eric; the demo build is never merged into it.
It runs offline on made-up changes in memory, so there is no database, no email and no internet to go wrong.

## Start it

```
cd apps/web
npm run demo          # http://localhost:3400
```

Open http://localhost:3400/preview once. It lists every screen. First visits compile, so click through every page you will
show once before you go on stage.

The words to say are in `docs/DEMO_SCRIPT.md` (5 minutes) and in the team's Google Doc, "Mentorful Demo Day Script (5 minutes)". `/demo` is the audience-facing first page; the team's "Share links" tab is `/demo/links`.

## How to use it on stage

Use the deployed link, not Sign in. The demo has no accounts: it signs you in as sample people.

1. Open `https://team-mentorful-demo.vercel.app/?key=<key>` once on the stage laptop (the key is in the team's notes, not in the repo).
   The browser remembers it for 14 days. Click **Open the Demo Day stage**.
2. Use **one tab only.** Who you are (the principal, or one of two teachers) is stored in the browser and shared by every tab, so a
   second tab on another role would change the first.
3. The bar at the bottom of every screen shows who you are and switches you in one click: **Juan** (principal),
   **Ms. Afiya** (English teacher), **Mr. Stefano** (Science teacher). **Reset** puts everything back to the start.
4. Press **Reset** before every run, and again after rehearsing.
5. Keep the local copy as a backup: `cd apps/web && npm run demo`, then http://localhost:3400/demo. Same screens, no internet.
   On the local copy, changes live in the server's memory instead of the browser.

Ms. Afiya and Mr. Stefano are the team's two Pursuit teachers, standing in for two sandbox teachers (English and Science). To cast
someone else, change `STAGE_CHARACTERS` and `CAST_SLOTS` in `src/lib/preview/stageTables.ts`, then pick a draft seed again
(`tests/stage-dataset.test.ts` fails until the draft still pairs the two).

## Before every run

Press **Reset**. It forgets everything done on stage: 32 teachers, 12 pairs, 9 logged conversations, English and Science with no
pair between them, Ms. Afiya and Mr. Stefano without a partner ("Your partner is on the way").

## The beats, and what the screen does

1. **Pulse.** The Culture Scan reads 4.2 of 6 and says "Down 0.9 since last year (5.1 to 4.2, 85% to 70%). Structural moved most (down 1.4)", with an orange tick on each bar for last year. Then "Pair the 8 unpaired teachers", 9 logged conversations, the privacy badge.
2. **Constellation.** The scan shows what fell; the map shows where. English and Science are the biggest missing link in the school.
3. **Pairing, Draft new round** (Juan). One click. The map draws four new links between English and Science, and the line above it
   says "This round closes a gap: English and Science. Connected departments go from 7 of 10 to 8 of 10."
   Ms. Afiya and Mr. Stefano are in the first pair. **Approve 4 pairs** saves it; **Reject** throws the draft away.
4. **Switch to Ms. Afiya.** After Approve, Home shows Mr. Stefano as an active partnership. Log a conversation: pick the topic,
   write a line, **Save draft**, then **Submit this entry** (two clicks, as in the real app).
5. **Switch to Mr. Stefano.** Open Chat (bottom right) and send a message; it shows on Ms. Afiya's side.
6. **Switch to Juan, Pulse again.** Logged conversations goes from 9 to 10. The text of the entry is nowhere on the admin side.
7. **Trust page.** The live check shows what leadership can read.
8. **Reports.** The faculty map, and **Download PDF** for the leadership deck, the board summary or the faculty connection (each saves a real PDF file, no print dialog).
   The deck has counts and department totals only, no names. The faculty map does show names, so keep the line to "no names in the deck".

## Limits to know

- On the live link, changes live in the browser (a small compressed cookie); on the local copy, in the server's memory. Reset clears them.
- It is one visitor on one laptop and one tab. Two laptops will not see each other's changes.
- The CTLE tracker is off (a later add-on); the games and video are off too.
- The real database is not used here. Nothing on stage touches Supabase.
