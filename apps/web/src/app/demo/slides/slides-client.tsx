"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MentorfulMark } from "@/components/aurora/mentorful-mark";
import { SLIDE_FACTS, pct } from "@/lib/demo/slide-facts";
import "./slides.css";

/**
 * The five Demo Day slides. Arrow keys (or the buttons) move, F is full screen, and "Save all as PDF" prints all five.
 * Slides 1 to 4 carry the story; slide 5 is for questions: a QR code to try the sample school, and how it was built.
 */
const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};
const TOTAL = 5;
// Slides drawn on the dark gradient; the rest are light.
const DARK = new Set([0, 3, 4]);
const AUDIENCE_URL = process.env.NEXT_PUBLIC_AUDIENCE_URL ?? "";

const TEAM = [
  { name: "Eric", initials: "E", role: "Narrator", built: "Owns privacy" },
  { name: "Juan", initials: "J", role: "The principal", built: "Built the principal's dashboard" },
  { name: "Bernard", initials: "B", role: "Ms. Afiya, English", built: "Built the teacher dashboard" },
  { name: "Bertrand", initials: "B", role: "Mr. Stefano, Science", built: "Built pairing and the pair chat" },
] as const;

const STACK = [
  { group: "App", items: ["Next.js 16", "React 19", "TypeScript"] },
  { group: "Data and sign-in", items: ["Supabase", "Postgres", "Row-level security", "Magic-link sign-in"] },
  { group: "Hosting", items: ["Vercel"] },
  { group: "Reports", items: ["PDF", "PowerPoint", "Excel"] },
  { group: "Quality", items: ["160+ automated tests", "Vitest"] },
  { group: "Built with", items: ["Claude Code"] },
] as const;

const TIMELINE = [
  { when: "Oct 6", what: "Kick-off with Nick and Mike" },
  { when: "Oct 23", what: "Midpoint check-in" },
  { when: "Oct 29", what: "Client answers on privacy" },
  { when: "Nov 2", what: "Code freeze" },
  { when: "Nov 9", what: "Demo Day" },
] as const;

/** A donut gauge: `value` percent of the ring is filled. */
function Gauge({ value, label, sub }: { value: number; label: string; sub: string }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <figure className="dd-gauge" aria-label={`${label}: ${value}%`}>
      <svg viewBox="0 0 120 120" role="img" aria-hidden>
        <defs>
          <linearGradient id="dd-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0ea5a4" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e6e4f7" strokeWidth="11" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="url(#dd-g)" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 60 60)" />
      </svg>
      <figcaption>
        <strong>{value}%</strong>
        <span>{label}</span>
        <small>{sub}</small>
      </figcaption>
    </figure>
  );
}

/** Last year to this year, as a line that falls. */
function FallChart({ before, now }: { before: number; now: number }) {
  // 50% sits at the bottom of the plot and 100% at the top.
  const y = (p: number) => 350 - (p - 50) * 5.6;
  const x1 = 150;
  const x2 = 470;
  return (
    <svg className="dd-fall" viewBox="0 0 600 430" role="img" aria-label={`The Culture Scan fell from ${before}% to ${now}%`}>
      <defs>
        <linearGradient id="dd-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d97706" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[50, 70, 85, 100].map((p) => (
        <g key={p}>
          <line x1="90" x2="580" y1={y(p)} y2={y(p)} stroke="#e0def5" strokeWidth="2" strokeDasharray="5 8" />
          <text x="74" y={y(p) + 7} textAnchor="end" className="dd-axis">
            {p}%
          </text>
        </g>
      ))}
      <path d={`M ${x1} ${y(before)} L ${x2} ${y(now)} L ${x2} 350 L ${x1} 350 Z`} fill="url(#dd-area)" />
      <line x1={x1} y1={y(before)} x2={x2} y2={y(now)} stroke="#d97706" strokeWidth="8" strokeLinecap="round" />
      <circle cx={x1} cy={y(before)} r="16" fill="#fff" stroke="#0a7268" strokeWidth="8" />
      <circle cx={x2} cy={y(now)} r="16" fill="#fff" stroke="#d97706" strokeWidth="8" />
      <text x={x1} y={y(before) - 30} textAnchor="middle" className="dd-pt">
        {before}%
      </text>
      <text x={x2} y={y(now) - 30} textAnchor="middle" className="dd-pt amber">
        {now}%
      </text>
      <text x={x1} y="400" textAnchor="middle" className="dd-axis">
        Last year
      </text>
      <text x={x2} y="400" textAnchor="middle" className="dd-axis">
        This year
      </text>
      <g transform={`translate(${(x1 + x2) / 2 - 10} ${(y(before) + y(now)) / 2 + 30})`}>
        <rect width="160" height="50" rx="25" fill="#fdecc8" />
        <text x="80" y="34" textAnchor="middle" className="dd-chip">
          ▼ {before - now} points
        </text>
      </g>
    </svg>
  );
}

const level = (n: number) => (n < 3.5 ? "low" : n < 4.5 ? "watch" : "ok");

/** The four dimensions, with last year's average as a tick. */
function Dimensions() {
  return (
    <div className="dd-dims">
      {SLIDE_FACTS.dimensions.map((d) => {
        const lv = level(d.now);
        return (
          <div key={d.key} className="dd-dim" data-level={lv}>
            <span className="dd-dim-name">
              <b>{d.label}</b>
              <small>{d.note}</small>
            </span>
            <span className="dd-track" aria-hidden>
              <i style={{ width: `${(d.now / 6) * 100}%` }} />
              <u style={{ left: `${(d.before / 6) * 100}%` }} />
            </span>
            <span className="dd-dim-val">
              <b>{d.now.toFixed(1)}</b>
              <em>{lv === "low" ? "⚠ Low" : lv === "watch" ? "⚠ Watch" : "On track"}</em>
              <em>▼ {(d.before - d.now).toFixed(1)} vs last year</em>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The five departments as dots. A solid line means a pair connects them; a dashed red line means none yet. */
function Constellation() {
  const pos: Record<string, [number, number]> = { Arts: [150, 34], English: [262, 112], History: [219, 222], Math: [81, 222], Science: [38, 112] };
  const key = (a: string, b: string) => [a, b].sort().join("|");
  const missing = new Set(SLIDE_FACTS.gaps.map((g) => key(g[0], g[1])));
  const depts = SLIDE_FACTS.departments;
  return (
    <svg className="dd-const" viewBox="0 0 300 260" role="img" aria-label="English and Science have no connection">
      {depts.flatMap((a, i) =>
        depts.slice(i + 1).map((b) => {
          const miss = missing.has(key(a, b));
          const star = key(a, b) === key("English", "Science");
          return <line key={key(a, b)} x1={pos[a][0]} y1={pos[a][1]} x2={pos[b][0]} y2={pos[b][1]} stroke={miss ? "#a3243b" : "#4f46e5"} strokeWidth={star ? 4 : miss ? 2 : 2.4} strokeDasharray={miss ? "7 6" : undefined} opacity={miss ? 1 : 0.55} />;
        }),
      )}
      {depts.map((d) => (
        <g key={d}>
          <circle cx={pos[d][0]} cy={pos[d][1]} r="21" fill="#fff" stroke={d === "English" || d === "Science" ? "#a3243b" : "#0a7268"} strokeWidth="4" />
          <text x={pos[d][0]} y={pos[d][1] + 4} textAnchor="middle" className="dd-dept">
            {d.slice(0, 3)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** A QR code for the audience, drawn in the browser from NEXT_PUBLIC_AUDIENCE_URL. */
function Qr({ url }: { url: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    if (!url) return;
    let alive = true;
    void import("qrcode").then(async (m) => {
      const s = await m.toString(url, { type: "svg", margin: 1, width: 360, color: { dark: "#14122b", light: "#ffffff" }, errorCorrectionLevel: "M" });
      if (alive) setSvg(s);
    });
    return () => {
      alive = false;
    };
  }, [url]);
  if (!url) return <div className="dd-qr empty">The QR code appears on the hosted stage link.</div>;
  return <div className="dd-qr" role="img" aria-label="QR code to open the sample school on a phone" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Slides() {
  // The slide number lives in the address (#2), so a link opens on that slide and the Back button moves between slides.
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const i = Math.min(TOTAL - 1, Math.max(0, (Number(hash.replace("#", "")) || 1) - 1));
  const stage = useRef<HTMLDivElement>(null);

  const go = useCallback((n: number) => {
    window.location.hash = String(Math.min(TOTAL, Math.max(1, n + 1)));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(i + 1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(i - 1);
      }
      if (e.key === "f" || e.key === "F") void (document.fullscreenElement ? document.exitFullscreen() : stage.current?.requestFullscreen());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);

  return (
    <div className="dd-wrap">
      <div className="dd-bar">
        <span className="dd-count" aria-live="polite">
          Slide {i + 1} of {TOTAL}
        </span>
        <button type="button" className="ev-btn sm" onClick={() => go(i - 1)} disabled={i === 0}>
          Back
        </button>
        <button type="button" className="ev-btn sm primary" onClick={() => go(i + 1)} disabled={i === TOTAL - 1}>
          Next
        </button>
        <button type="button" className="ev-btn sm" onClick={() => void stage.current?.requestFullscreen()}>
          Full screen (F)
        </button>
        <button type="button" className="ev-btn sm" onClick={() => window.print()}>
          Save all as PDF
        </button>
      </div>

      <div className="dd-stage" ref={stage} data-tone={DARK.has(i) ? "dark" : "light"}>
        <div className="dd-chrome" aria-hidden>
          <span className="dd-brand">
            <MentorfulMark size={26} />
            Mentorful
          </span>
          <span className="dd-num">
            {String(i + 1).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
          </span>
        </div>

        {/* 1. Title and team */}
        <section className="dd-slide dark" data-on={i === 0} aria-label="Slide 1: title and team">
          <p className="dd-kick">Demo Day · Pursuit capstone</p>
          <h2 className="dd-title">
            Evidence for principals. <em>Privacy for teachers.</em>
          </h2>
          <p className="dd-lead">The best coach for a teacher is the teacher down the hall. A teacher-led startup, founded by Mike and Nick.</p>
          <div className="dd-team">
            {TEAM.map((m) => (
              <div key={m.name} className="dd-person">
                <span className="dd-avatar">{m.initials}</span>
                <strong>{m.name}</strong>
                <b>{m.role}</b>
                <small>{m.built}</small>
              </div>
            ))}
          </div>
        </section>

        {/* 2. A year ago */}
        <section className="dd-slide" data-on={i === 1} aria-label="Slide 2: Lincoln High, a year ago">
          <span className="dd-tag">Sample school</span>
          <p className="dd-kick">A year ago</p>
          <h2>
            Lincoln High, <em>a year after Mentorful.</em>
          </h2>
          <div className="dd-split">
            <Gauge value={pct(SLIDE_FACTS.cte.before)} label="Culture Scan" sub={`${SLIDE_FACTS.cte.before.toFixed(1)} out of 6`} />
            <ul className="dd-points">
              <li>
                <span className="dd-ico">✓</span>
                <div>
                  <b>Every teacher had a partner</b>
                  <small>Pairs across departments, drafted by the principal in one click and approved by the principal.</small>
                </div>
              </li>
              <li>
                <span className="dd-ico">✓</span>
                <div>
                  <b>The honest answers kept coming</b>
                  <small>The scan is anonymous, and any group under five is hidden.</small>
                </div>
              </li>
              <li>
                <span className="dd-ico">✓</span>
                <div>
                  <b>Private by design</b>
                  <small>The principal saw how many conversations happened, never what was said.</small>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* 3. This year */}
        <section className="dd-slide" data-on={i === 2} aria-label="Slide 3: this year, the scan fell">
          <span className="dd-tag">Sample school</span>
          <p className="dd-kick">This year</p>
          <h2>
            The scan fell. <em>Now find out why.</em>
          </h2>
          <div className="dd-trio">
            <section className="dd-panel">
              <h3>The score</h3>
              <FallChart before={pct(SLIDE_FACTS.cte.before)} now={pct(SLIDE_FACTS.cte.now)} />
            </section>
            <section className="dd-panel">
              <h3>What fell</h3>
              <Dimensions />
              <p className="dd-orange">Orange tick: last year</p>
            </section>
            <section className="dd-panel">
              <h3>Where</h3>
              <Constellation />
              <p className="dd-where">
                <b>{SLIDE_FACTS.unpaired} new teachers</b> with no partner, and <b>zero</b> connections between English and Science.
              </p>
            </section>
          </div>
        </section>

        {/* 4. Where to focus */}
        <section className="dd-slide dark" data-on={i === 3} aria-label="Slide 4: where to focus next year">
          <p className="dd-kick">Next year</p>
          <h2>
            Now the principal knows <em>where to focus.</em>
          </h2>
          <div className="dd-focus">
            <div className="dd-focus-card">
              <span className="dd-focus-n">1</span>
              <b>Structural</b>
              <small>Who talks to whom. Down 1.4, the lowest of the four.</small>
            </div>
            <div className="dd-focus-card">
              <span className="dd-focus-n">2</span>
              <b>English and Science</b>
              <small>Same building, zero connections. One round closes the gap.</small>
            </div>
            <div className="dd-focus-card proof">
              <span className="dd-focus-n">3</span>
              <b>Next spring&rsquo;s scan</b>
              <small>The proof. Evidence for principals, and nobody had to feel watched.</small>
            </div>
          </div>
          <div className="dd-path" aria-hidden>
            <span>{pct(SLIDE_FACTS.cte.before)}%</span>
            <i />
            <span className="now">{pct(SLIDE_FACTS.cte.now)}%</span>
            <i className="dash" />
            <span className="next">next spring</span>
          </div>
        </section>

        {/* 5. Try it, and how it was built (for questions) */}
        <section className="dd-slide dark" data-on={i === 4} aria-label="Slide 5: try it, and how it was built">
          <div className="dd-two">
            <div className="dd-try">
              <p className="dd-kick">Try it</p>
              <h2>
                Open the sample school <em>on your phone.</em>
              </h2>
              <div className="dd-try-row">
                <Qr url={AUDIENCE_URL} />
                <p className="dd-lead">Scan to look around. It runs on made-up data and nothing you click is saved.</p>
              </div>
            </div>
            <div className="dd-build">
              <p className="dd-kick">Under the hood</p>
              <h3>How it was built</h3>
              <ul className="dd-stack">
                {STACK.map((g) => (
                  <li key={g.group}>
                    <small>{g.group}</small>
                    <span>
                      {g.items.map((t) => (
                        <b key={t}>{t}</b>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <ol className="dd-time">
                {TIMELINE.map((t) => (
                  <li key={t.when}>
                    <b>{t.when}</b>
                    <small>{t.what}</small>
                  </li>
                ))}
              </ol>
              <p className="dd-tiny">Four builders, one repo. Privacy is enforced in the database, not just on the screen.</p>
            </div>
          </div>
        </section>

        <div className="dd-progress" aria-hidden>
          <i style={{ width: `${((i + 1) / TOTAL) * 100}%` }} />
        </div>
      </div>
      <p className="ev-muted" style={{ fontSize: 13 }}>
        Arrow keys move between slides. These slides are in the app, so the team opens them from the same link.
      </p>
    </div>
  );
}
