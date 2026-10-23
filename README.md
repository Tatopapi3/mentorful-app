# Mentorful-Bertrandc artifact (source)

The files of the claude.ai Dashboard artifact "Mentorful Teacher Dashboard",
https://claude.ai/artifact/4tD28CDa5xajoG2969LUvo, exported as they are stored
there. Kept for reference and diffing; the app does not read this folder.

| File | What it is |
|---|---|
| `index.html` | The dashboard's page code, unmodified. |
| `dash/meta.json` | Dashboard title. |
| `dash/params.json` | Default parameter values (`teacher`). |
| `datasets/*.json` | One descriptor per dataset: title, description and where its rows live. |

The dataset **rows** are not here. They are sample files stored in the
artifact's own file storage (the `source.url` `/_blob/…` paths), which this
export can't download. The app gets the same shapes from Supabase instead.

The running version is the app's copy, `apps/web/public/dashboard-v2/dashboard.html`,
mounted at `/dashboard/v2`. It differs from `index.html` here only where noted in
its header comment: fonts, runtime tokens, the cohort line, saving through the
app's server actions, and empty-state messages.
