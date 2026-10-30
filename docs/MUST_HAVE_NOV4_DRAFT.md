# Mentorful: must-have by Nov 4 vs. after

Draft for Nick to sign off. Everything below runs on the sample school until the database scripts are applied to a real project.

## Must-have by Nov 4 (Demo Day)

| | What | Where it stands |
|---|---|---|
| 1 | **One admin look (Aurora), privacy floors in.** Pulse, Pairing, Overview, Constellation, Insights, Reports. Groups under 5 are hidden everywhere; Overview names no teacher. | Built |
| 2 | **One teacher dashboard (Aurora).** Home, My pair (partner and lookbook), Journal, Growth (goals, practice log, notes to your future self, hour logging), Culture Scan. | Built |
| 3 | **Survey flow with anonymity intact.** One-time codes. Results release only after the survey closes. Report opens at 60% of the roster; network needs 25 respondents; demo and real responses never mixed in one number. | 60%, 25 and the real-vs-demo labels are built. **One-time codes and release-after-close are still to build** (Eric) |
| 4 | **Profile visibility.** Name, department and strengths only; admins keep email for roster work. | Built |
| 5 | **Running on a real project with real sign-in.** | The five database scripts are ready as one tested file; they still need to be applied and tried with a few real test teachers |

## After Demo Day

- Pedagogy games and video calls (built, switched off)
- Partnership Pulse Check
- Triads / pods of three (changes the data model)
- Content-sharing feed for Google Docs, PDFs and resources between co-mentors (pair chat file sharing is the start)
- Per-field profile toggles
- Reports reading from the database instead of the master key (hardening roadmap)

## Decided on our side

1. **Design:** Aurora for both dashboards.
2. **Hour logging:** kept, as the teacher's own record. Nothing promises credit; "design the logging, don't promise the credit yet".
3. **Faculty map:** lives in Reports, next to the deck and the spreadsheet that show the same picture as department totals.
4. **Archetype panel:** kept, with the floor applied and a plain explanation (it counts three teaching styles; it is not a score).
5. **Reports for a principal's meeting:** the leadership deck gains a "Teacher growth" slide (anonymous, only when enough teachers share) and a faculty-connection spreadsheet joins the downloads.
