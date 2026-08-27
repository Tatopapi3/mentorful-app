import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Scan complete",
};

/**
 * The four dimensions, revealed only now. They are deliberately unlabelled
 * while the teacher answers — seeing the name of a thing changes how people
 * rate it — so this screen is the first time she learns what she was answering.
 *
 * These are the teacher-facing display names and glosses for the v2 instrument's
 * dimensions, in the order the sections are presented (which is the order the
 * dimensions first appear by `position`): structural, relational, cognitive,
 * efficacy. Copy, not data — the survey flow itself never shows a dimension
 * name. If a v3 changes the dimension set, this list has to move with it.
 */
const DIMENSIONS = [
  {
    key: "structural",
    name: "Structure",
    gloss:
      "Whether the connections exist at all. Who you can go to, how often, and whether there's any time built in for it.",
  },
  {
    key: "relational",
    name: "Relationships",
    gloss:
      "Whether those connections are safe. Can someone here say “that didn't work” without it costing them.",
  },
  {
    key: "cognitive",
    name: "Shared understanding",
    gloss:
      "Whether the adults here mean the same things by good teaching and are pulling in the same direction.",
  },
  {
    key: "efficacy",
    name: "Collective belief",
    gloss:
      "Whether this faculty thinks that together it can move the students who are hardest to move.",
  },
] as const;

/**
 * TODO — PLACEHOLDER, NOT REAL DATA. Faculty participation is hardcoded.
 *
 * These numbers are invented and identical for every teacher who finishes.
 * Two things are missing before they can be real:
 *
 *   1. Faculty headcount is not modelled anywhere (no `schools.faculty_count`
 *      or equivalent), so the denominator does not exist. This is the same gap
 *      that blocks the real participation floor — see MIN_RESPONDENTS in
 *      src/lib/report/data.ts.
 *   2. The numerator cannot be read from the browser. `survey_responses` has no
 *      SELECT policy, so only the service-role key can count distinct
 *      respondents; a real count needs a server route returning an aggregate,
 *      never rows.
 *
 * Deliberately not plumbed around tonight. Until both exist, this block is
 * decoration — do not cite it, and do not let it ship to a real school.
 */
const FACULTY_PROGRESS = { finished: 32, total: 50, closes: "Friday" };

export default function SurveyCompletePage() {
  const pct = Math.round((FACULTY_PROGRESS.finished / FACULTY_PROGRESS.total) * 100);

  return (
    <>
      <SiteHeader
        sticky
        right={
          <span className="mono" style={{ color: "var(--teal)" }}>
            Complete
          </span>
        }
      />
      <main className="done">
        <div className="sent-icon" aria-hidden="true">
          ✓
        </div>
        <h1>That’s it. Thank you.</h1>
        <p className="lede">
          Your answers are in, and they’re already unlinked from you. Even we can’t pull them back
          up.
        </p>

        <h2 style={{ marginTop: 44 }}>What you were actually answering</h2>
        <p className="say">
          We didn’t label the sections while you took it, because seeing the name of a thing changes
          how people rate it. Here’s what the four groups measured.
        </p>
        <div className="dims">
          {DIMENSIONS.map((d) => (
            <div key={d.key} className="dim">
              <b>{d.name}</b>
              <span>{d.gloss}</span>
            </div>
          ))}
        </div>

        <div className="partic">
          <div className="mono" style={{ color: "var(--muted)" }}>
            Faculty progress
          </div>
          <div className="barwrap">
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="count">
            <strong>
              {FACULTY_PROGRESS.finished} of {FACULTY_PROGRESS.total}
            </strong>{" "}
            teachers have finished. The scan closes {FACULTY_PROGRESS.closes}.
          </div>
          <p className="caveat">
            We can tell that you finished. We cannot tell what you said. Those are stored separately,
            on purpose.
          </p>
        </div>

        <h2 style={{ marginTop: 42 }}>What happens next</h2>
        <p className="say">
          Once everyone’s in, the whole faculty’s answers get combined into four scores and a map of
          how they hold together. Your school sees that picture, and so will you. Nobody sees an
          individual response, ever.
        </p>
        <Link className="btn" href="/dashboard" style={{ marginTop: 12, textDecoration: "none" }}>
          Back to dashboard
        </Link>
      </main>
    </>
  );
}
