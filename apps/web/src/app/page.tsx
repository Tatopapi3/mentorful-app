import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

/**
 * Landing screen, ported from the app-screens prototype.
 *
 * The prototype repeated the logo inside the navy hero; here the shared
 * SiteHeader sits above it instead, so the mark isn't rendered twice.
 *
 * Card order and copy follow the prototype. The teacher card opens the
 * redesigned dashboard. The signed-in journal remains at /dashboard.
 */

const DEMOS = [
  { href: "/survey", title: "Culture Scan", blurb: "Take the survey a teacher takes." },
  { href: "/report", title: "Scan report", blurb: "The six slides a school gets back." },
  { href: "/admin/map", title: "Faculty map", blurb: "A staff network, drawn from data." },
  { href: "/dashboard/preview", title: "Teacher dashboard", blurb: "Home, a scan, conversations, and a partner." },
];

export default function Home() {
  return (
    <>
      <SiteHeader />

      <div className="land-hero">
        <div className="wrap">
          <h1>The school culture platform for teachers and the people who lead them.</h1>
          <p>
            Co-mentoring, classroom visits, and a real measure of how your faculty is actually
            connected.
          </p>
          <div className="land-cta">
            <Link className="btn" href="/login">
              Sign in
            </Link>
            <a
              className="btn btn-ghost"
              href="https://mentorful.co"
              style={{ textDecoration: "none", padding: "11.5px 24px" }}
            >
              About Mentorful
            </a>
          </div>
        </div>
      </div>

      <main className="wrap land-demo">
        <p className="mono" style={{ color: "var(--muted)", marginBottom: 4 }}>
          Demo
        </p>
        <h2 style={{ fontSize: 21, marginBottom: 6 }}>Look around without an account</h2>
        <p style={{ fontSize: 15.5, color: "#6B6459", maxWidth: 560 }}>
          Everything below runs on synthetic data. No real school responses.
        </p>
        <div className="demo-row">
          {DEMOS.map((d) => (
            <Link key={d.href} className="demo" href={d.href}>
              <b>{d.title}</b>
              <span>{d.blurb}</span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
