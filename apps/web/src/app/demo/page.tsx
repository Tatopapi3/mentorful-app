import Link from "next/link";
import { AuroraPublic } from "@/components/aurora/public-frame";
import { CAST, STORY } from "@/lib/demo/script";
import { STAGE_CHARACTERS } from "@/lib/preview/stageTables";
import { DemoTabs } from "./tabs";

export const metadata = { title: "Mentorful · Demo Day" };
export const dynamic = "force-dynamic";

export default function Demo() {
  return (
    <AuroraPublic>
      <DemoTabs current="/demo" />
      <p className="ev-eyebrow">Demo Day · Mentorful</p>
      <h1>
        Evidence for principals. <em>Privacy for teachers.</em>
      </h1>
      <p className="ev-lead">
        Schools pair teachers across departments, and a short survey, the Culture Scan, shows whether the staff is getting stronger together.
        Tonight: a school one year in.
      </p>
      <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="ev-btn primary" href="/demo/slides">
          Open the slides
        </Link>
        <Link className="ev-btn" href="/preview/as/admin?next=/admin/pulse">
          Start the demo
        </Link>
      </p>

      <h2 style={{ marginTop: 28 }}>Tonight&rsquo;s cast</h2>
      <div className="ap-demos" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {CAST.map((m) => (
          <div key={m.name} className="ap-card" style={{ padding: 18, display: "grid", gap: 6, alignContent: "start" }}>
            <b style={{ fontSize: 20 }}>{m.name}</b>
            <span>
              <b>{m.plays}</b>
            </span>
            <span className="ev-muted">Built: {m.built}</span>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 36 }}>The story</h2>
      <p className="ev-lead" style={{ maxWidth: 760 }}>
        {STORY.title}.
      </p>
      <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {STORY.arc.map((a) => (
          <li key={a.label} className="ap-card" style={{ padding: 18 }}>
            <p className="ev-eyebrow" style={{ margin: 0 }}>
              {a.label}
            </p>
            <p style={{ margin: "8px 0 0" }}>{a.text}</p>
          </li>
        ))}
      </ol>
      <p className="ev-muted" style={{ marginTop: 14 }}>
        Lincoln High is a sample school. The screens run on made-up data.</p>

      <h2 style={{ marginTop: 28 }}>Three screens</h2>
      <div className="ap-demos" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Link className="ap-demo" href="/preview/as/admin?next=/admin/pulse">
          <b>Juan, the principal</b>
          <span>Pulse, Pairing, Constellation, Reports.</span>
        </Link>
        <Link className="ap-demo" href="/preview/as/teacher?next=/dashboard">
          <b>{STAGE_CHARACTERS.first}, English</b>
          <span>The teacher dashboard: partner, journal, chat.</span>
        </Link>
        <Link className="ap-demo" href="/preview/as/teacher?who=second&next=/dashboard">
          <b>{STAGE_CHARACTERS.second}, Science</b>
          <span>The same dashboard, as the other teacher.</span>
        </Link>
      </div>
    </AuroraPublic>
  );
}
