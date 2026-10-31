# After November 4

Work that is built or planned for after Demo Day. This branch (`future/after-nov-4`) starts from `team-integration`; things land here
first and move into `team-integration` when the team decides.

## Scan notes (built, demo-ready)

A third tab in the teacher Journal: photograph a handwritten page, check the text, save it as a private note.

- Turn it on with `NEXT_PUBLIC_FEATURE_SCAN_NOTES=1` (build time). Off by default.
- The tab offers the camera, a photo picker (on a phone it opens the camera), and a sample page for demos.
- Saving writes a private growth entry of kind "observation" through `addGrowthEntry` (only the teacher can read it; leadership
  never can). The photo is never stored or logged.
- **Reading is a prepared sample for now**: `readNotes` in `src/lib/teacher/scan-actions.ts` returns the same text whatever the
  photo shows, and the screen labels it "Sample reading". The sample page photo is `public/scan/sample-notes.jpg`.

### What real recognition needs (after Nov 4)

1. A provider in `readNotes` (set `SCAN_NOTES_PROVIDER`), for example a vision model. Any other value is refused today.
2. A privacy review first. The photo would leave this app for the provider, so teachers need to be told, the provider must not keep
   or train on it, and the page copy ("The photo isn't kept") has to describe exactly what happens. Photos of other people's
   classrooms (students) should be discouraged on the screen.
3. A key kept on the server only, never in the browser.
4. Handwriting is read imperfectly, so the edit step stays: a teacher always checks the text before saving.

## Partnership Pulse Check

Planned for after November 4 (Nick's list).

## Per-field lookbook choices

Teachers choosing which of name, department and strengths show to colleagues (Nick named this as the later improvement).
