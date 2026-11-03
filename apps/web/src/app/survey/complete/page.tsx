import type { Metadata } from "next";
import Link from "next/link";
import { AuroraPublic } from "@/components/aurora/public-frame";

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

/*
 * This page used to show a faculty progress count and a closing day. Those numbers were invented and the same for
 * everyone, so they are gone: with one-time codes nobody, including us, can say who has finished, and a made-up count
 * must never be shown to a real teacher.
 */
export default function SurveyCompletePage() {
  return (
    <AuroraPublic right={<span className="ap-prog"><span className="lbl" style={{ color: "var(--ev-teal)" }}>Complete</span></span>}>
      <main className="ap-done">
        <div className="ap-sent" aria-hidden="true">
          ✓
        </div>
        <h1>That’s it. Thank you.</h1>
        <p className="ap-lead">
          Your answers are in, and they’re already unlinked from you. Even we can’t pull them back
          up.
        </p>

        <h2 style={{ marginTop: 44 }}>What you were actually answering</h2>
        <p className="ap-muted">
          We didn’t label the sections while you took it, because seeing the name of a thing changes
          how people rate it. Here’s what the four groups measured.
        </p>
        <div className="ap-dims">
          {DIMENSIONS.map((d) => (
            <div key={d.key} className="ap-dim">
              <b>{d.name}</b>
              <span>{d.gloss}</span>
            </div>
          ))}
        </div>

        <div className="ap-partic">
          <div className="ap-label" style={{ marginBottom: 0 }}>
            Your code
          </div>
          <p className="caveat" style={{ marginTop: 8 }}>
            Your one-time code is used up. We keep only a scrambled copy of it, and nothing we store links it to your
            answers, so nobody can tell who said what, or even who has finished.
          </p>
        </div>

        <h2 style={{ marginTop: 42 }}>What happens next</h2>
        <p className="ap-muted">
          Once everyone’s in, the whole faculty’s answers get combined into four scores and a map of
          how they hold together. Your school sees that picture, and so will you. Nobody sees an
          individual response, ever.
        </p>
        <Link className="ev-btn primary" href="/dashboard" style={{ marginTop: 12 }}>
          Back to dashboard
        </Link>
      </main>
    </AuroraPublic>
  );
}
