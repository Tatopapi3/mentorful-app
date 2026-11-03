import Link from "next/link";
import { AuroraPublic } from "@/components/aurora/public-frame";
import { BEATS, CAST, NOTES, STORY, TRIM } from "@/lib/demo/script";
import { DemoTabs } from "../tabs";

export const metadata = { title: "Demo Day script" };
export const dynamic = "force-dynamic";

const TOTAL_SECS = BEATS.reduce((n, b) => n + b.secs, 0);
const TOTAL_LABEL = `${Math.floor(TOTAL_SECS / 60)}:${String(TOTAL_SECS % 60).padStart(2, "0")}`;

export default function DemoScript() {
  return (
    <AuroraPublic>
      <DemoTabs current="/demo/script" />
      <p className="ev-eyebrow">For the team · not for the audience</p>
      <h1>
        The script, <em>word for word.</em>
      </h1>
      <p className="ev-lead">
        No sign-in. Use the bar at the bottom of every screen to change who you are, and <b>Reset</b> before each run. Use one tab: the
        role is shared by every tab in this browser.
      </p>
      <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="ev-btn primary" href="/demo/slides">
          Open the slides (5)
        </Link>
        <Link className="ev-btn" href="/preview/reset?next=/demo/script">
          Reset the demo
        </Link>
      </p>

      <h2 style={{ marginTop: 28 }}>Who speaks when</h2>
      <div className="ap-demos" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {CAST.map((m) => (
          <div key={m.name} className="ap-card" style={{ padding: 18, display: "grid", gap: 6, alignContent: "start" }}>
            <b style={{ fontSize: 20 }}>{m.name}</b>
            <span>
              <b>{m.plays}</b>
            </span>
            <span className="ev-muted">Screen: {m.screen}</span>
            <span className="ev-muted">Speaks at {m.speaks}</span>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 36 }}>The story</h2>
      <p className="ev-lead" style={{ maxWidth: 760 }}>
        {STORY.title}. {STORY.note}
      </p>

      <h2 style={{ marginTop: 36 }}>The script</h2>
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
          Open the slides (5)
        </Link>{" "}
        <Link className="ev-btn" href="/preview/reset?next=/demo/script">
          Reset the demo
        </Link>
      </p>
    </AuroraPublic>
  );
}
