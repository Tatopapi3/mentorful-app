import Link from "next/link";
import { AuroraPublic } from "@/components/aurora/public-frame";
import { BEATS, CAST, NOTES, STORY, TRIM } from "@/lib/demo/script";
import { STAGE_CHARACTERS } from "@/lib/preview/stageTables";

export const metadata = { title: "Demo Day" };
export const dynamic = "force-dynamic";

const TOTAL_SECS = BEATS.reduce((n, b) => n + b.secs, 0);
const TOTAL_LABEL = `${Math.floor(TOTAL_SECS / 60)}:${String(TOTAL_SECS % 60).padStart(2, "0")}`;

export default function Demo() {
  return (
    <AuroraPublic>
      <p className="ev-eyebrow">Demo Day stage · Nov 9 · 5 minutes</p>
      <h1>
        Three screens, <em>one story.</em>
      </h1>
      <p className="ev-lead">
        No sign-in. Use the bar at the bottom of every screen to change who you are, and <b>Reset</b> before each run. Use one tab: the
        role is shared by every tab in this browser.
      </p>
      <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="ev-btn primary" href="/demo/slides">
          Open the slides (4)
        </Link>
        <Link className="ev-btn" href="/preview/reset?next=/demo">
          Reset the demo
        </Link>
      </p>

      <h2 style={{ marginTop: 28 }}>The cast</h2>
      <div className="ap-demos" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {CAST.map((m) => (
          <div key={m.name} className="ap-card" style={{ padding: 18, display: "grid", gap: 6, alignContent: "start" }}>
            <b style={{ fontSize: 20 }}>{m.name}</b>
            <span>
              <b>{m.plays}</b>
            </span>
            <span className="ev-muted">Built: {m.built}</span>
            <span className="ev-muted">Screen: {m.screen}</span>
            <span className="ev-muted">Speaks at {m.speaks}</span>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 28 }}>Open a screen</h2>
      <div className="ap-demos" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <Link className="ap-demo" href="/preview/as/admin?next=/admin/pulse">
          <b>Juan, the principal</b>
          <span>Pulse, Pairing, Constellation, Reports.</span>
        </Link>
        <Link className="ap-demo" href="/preview/as/teacher?next=/dashboard">
          <b>{STAGE_CHARACTERS.first}, English</b>
          <span>The teacher dashboard: partner, journal, chat. Bernard.</span>
        </Link>
        <Link className="ap-demo" href="/preview/as/teacher?who=second&next=/dashboard">
          <b>{STAGE_CHARACTERS.second}, Science</b>
          <span>The same dashboard, as the other teacher. Bertrand.</span>
        </Link>
      </div>

      <h2 style={{ marginTop: 36 }}>The story</h2>
      <p className="ev-lead" style={{ maxWidth: 760 }}>
        {STORY.title}. {STORY.note}
      </p>
      <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {STORY.arc.map((a) => (
          <li key={a.label} className="ap-card" style={{ padding: 18 }}>
            <p className="ev-eyebrow" style={{ margin: 0 }}>
              {a.label}
            </p>
            <p style={{ margin: "8px 0 0" }}>{a.text}</p>
          </li>
        ))}
      </ol>

      <h2 style={{ marginTop: 36 }}>The script, word for word</h2>
      <p className="ev-muted">
        {TOTAL_LABEL} in all. Every block shows when it starts and how many seconds it gets, speaking and clicking together. Juan, Bernard and Bertrand get 25 seconds (about 50 words) for their intros; Eric gets about 40 because he also says what Mentorful is. Fill the [brackets] with your own words; each says how many words it should be.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {BEATS.map((b) => (
          <article key={`${b.t}-${b.who}`} className="ap-card" style={{ padding: 18 }}>
            <p style={{ margin: 0, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <span className="ev-badge">
                {b.t} · {b.secs}s
              </span>
              <b>{b.who}</b>
              <span className="ev-muted">on {b.screen}</span>
            </p>
            {b.action ? (
              <p className="ev-muted" style={{ margin: "8px 0 0", fontStyle: "italic" }}>
                {b.action}
              </p>
            ) : null}
            <p style={{ margin: "8px 0 0", fontSize: 17 }}>&ldquo;{b.say}&rdquo;</p>
          </article>
        ))}
      </div>

      <h2 style={{ marginTop: 36 }}>If you run long, cut in this order</h2>
      <ol>
        {TRIM.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>

      <h2 style={{ marginTop: 28 }}>Remember</h2>
      <ul>
        {NOTES.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>

      <p style={{ marginTop: 24 }}>
        <Link className="ev-btn primary" href="/demo/slides">
          Open the slides (4)
        </Link>{" "}
        <Link className="ev-btn" href="/preview/reset?next=/demo">
          Reset the demo
        </Link>
      </p>
    </AuroraPublic>
  );
}
