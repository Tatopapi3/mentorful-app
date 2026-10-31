# Demo Day run sheet

This branch (`demo/day`) is for the stage only. It is never merged back: `team-integration` stays the clean handoff for Nick and Eric.
It runs offline on made-up changes in memory, so there is no database, no email and no internet to go wrong.

## Start it

```
cd apps/web
npm run demo          # http://localhost:3400
```

Open http://localhost:3400/preview once. It lists every screen. First visits compile, so click through every page you will
show once before you go on stage.

## The cast (one browser, one laptop)

| Who | Plays | Open |
| --- | --- | --- |
| Juan | the principal | `/preview/as/admin?next=/admin/pulse` |
| Bernard | Henry White, English | `/preview/as/teacher?next=/dashboard` |
| Bertrand | Owen Perez, Science | `/preview/as/teacher?who=second&next=/dashboard` |

Henry White and Owen Perez are real people on the faculty map. To cast someone else, change `STAGE_CHARACTERS` in
`src/lib/preview/stageTables.ts`, then pick a draft seed again (`tests/stage-dataset.test.ts` fails until the draft still
pairs the two). Open the three roles in three browser windows or tabs of the same browser; switching role is a link, not a login.

## Before every run

Open `/preview/reset`. It forgets everything done on stage and puts the numbers back to the start:
32 teachers, 12 pairs, 9 logged conversations, English and Science with no pair between them, Henry and Owen without a partner.

## The beats, and what the screen does

1. **Pulse.** "Pair the 8 unpaired teachers", 9 logged conversations, the privacy badge.
2. **Constellation.** English and Science are the biggest missing link in the school.
3. **Pairing, Draft new round.** One click. The map draws four new links between English and Science, and the line above it
   says "This round closes a gap: English and Science. Connected departments go from 7 of 10 to 8 of 10."
   Henry White and Owen Perez are the first pair. **Approve 4 pairs** saves it; **Reject** throws the draft away.
4. **Henry's screen.** After Approve, Home shows Owen Perez as an active partnership. Log a conversation: pick the topic,
   write a line, **Save draft**, then **Submit this entry** (two clicks, as in the real app).
5. **Owen's screen.** Open Chat (bottom right) and send a message; it shows on Henry's side.
6. **Pulse again.** Logged conversations goes from 9 to 10. The text of the entry is nowhere on the admin side.
7. **Trust page.** The live check shows what leadership can read.
8. **Reports.** The faculty map, and **Download PDF** for the deck (opens the print dialog; choose Save as PDF).
   The deck has counts and department totals only, no names. The faculty map does show names, so keep the line to "no names in the deck".

## Limits to know

- Changes live in this server's memory. Restarting `npm run demo` or `/preview/reset` clears them.
- It is one visitor on one laptop. Two laptops will not see each other's changes.
- The CTLE tracker is off (a later add-on); the games and video are off too.
- The real database is not used here. Nothing on stage touches Supabase.
