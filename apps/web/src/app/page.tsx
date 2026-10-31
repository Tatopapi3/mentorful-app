import Link from "next/link";
import { AuroraPublic } from "@/components/aurora/public-frame";

/**
 * The landing page, in the Aurora look. Card order and copy follow the prototype; the faculty map now lives inside
 * Reports, so that card points there.
 */

const DEMOS = [
  { href: "/survey", title: "Culture Scan", blurb: "Take the survey a teacher takes." },
  { href: "/report", title: "Scan report", blurb: "The six slides a school gets back." },
  { href: "/admin/reports", title: "Reports and faculty map", blurb: "A staff network, drawn from data." },
  { href: "/dashboard", title: "Dashboard", blurb: "What a teacher sees day to day." },
];

export default function Home() {
  return (
    <AuroraPublic>
      <section className="ap-hero">
        <p className="ev-eyebrow">Mentorful</p>
        <h1>
          The school culture platform for teachers and the people who <em>lead them.</em>
        </h1>
        <p className="ap-lead">Co-mentoring, classroom visits, and a real measure of how your faculty is actually connected.</p>
        <div className="ap-cta">
          <Link className="ev-btn primary" href="/login">
            Sign in
          </Link>
          <a className="ev-btn" href="https://mentorful.co">
            About Mentorful
          </a>
        </div>
      </section>

      <section aria-labelledby="ap-demo-h">
        <p className="ev-eyebrow">Demo</p>
        <h2 id="ap-demo-h">Look around without an account</h2>
        <p className="ap-muted">Everything below runs on synthetic data. No real school responses.</p>
        <div className="ap-demos">
          {DEMOS.map((d) => (
            <Link key={d.href} className="ap-demo" href={d.href}>
              <b>{d.title}</b>
              <span>{d.blurb}</span>
            </Link>
          ))}
        </div>
      </section>
    </AuroraPublic>
  );
}
