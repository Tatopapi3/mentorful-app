import Link from "next/link";
import { AuroraPublic } from "@/components/aurora/public-frame";

/**
 * The landing page, in the Aurora look. Card order and copy follow the prototype; the faculty map now lives inside
 * Reports, so that card points there.
 */

// Only the survey and the report open without signing in. The other two need an account, and are shown only in the demo
// builds (PREVIEW_MOCK=1), where the app runs on made-up data and signs you in as a sample person.
const OPEN = [
  { href: "/survey", title: "Culture Scan", blurb: "Take the survey a teacher takes." },
  { href: "/report", title: "Scan report", blurb: "The six slides a school gets back." },
];
const SIGNED_IN = [
  { href: "/admin/reports", title: "Reports and faculty map", blurb: "A staff network, drawn from data." },
  { href: "/dashboard", title: "Dashboard", blurb: "What a teacher sees day to day." },
];
const DEMO = process.env.PREVIEW_MOCK === "1";
// Demo Day: no sign-in on the stage, one door to the launcher instead.
const STAGE = DEMO && process.env.PREVIEW_DATASET === "stage";
const DEMOS = DEMO ? [...OPEN, ...SIGNED_IN] : OPEN;

export default function Home() {
  return (
    <AuroraPublic>
      <section className="ap-hero">
        <h1>The school culture platform for teachers and the people who lead them.</h1>
        <p className="ap-lead">Co-mentoring, classroom visits, and a real measure of how your faculty is actually connected.</p>
        <div className="ap-cta">
          {STAGE ? (
            <Link className="ev-btn primary" href="/demo">
              Open the Demo Day stage
            </Link>
          ) : (
            <Link className="ev-btn primary" href="/login">
              Sign in
            </Link>
          )}
          <a className="ev-btn" href="https://mentorful.co">
            About Mentorful
          </a>
        </div>
      </section>

      {STAGE ? null : (
      <section aria-labelledby="ap-demo-h">
        <h2 id="ap-demo-h">{DEMO ? "Look around without an account" : "Take a look"}</h2>
        <p className="ap-muted">{DEMO ? "Everything below runs on synthetic data. No real school responses." : "No account needed. Both use sample data, not a real school\u2019s answers."}</p>
        <div className="ap-demos">
          {DEMOS.map((d) => (
            <Link key={d.href} className="ap-demo" href={d.href}>
              <b>{d.title}</b>
              <span>{d.blurb}</span>
            </Link>
          ))}
        </div>
      </section>
      )}
    </AuroraPublic>
  );
}
