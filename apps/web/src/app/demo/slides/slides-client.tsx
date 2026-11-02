"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import "./slides.css";

/** The four Demo Day slides. Arrow keys (or the buttons) move, F is full screen, and "Save as PDF" prints all four. */
const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};
const TOTAL = 4;

export function Slides() {
  // The slide number lives in the address (#2), so a link opens on that slide and the Back button moves between slides.
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const total = TOTAL;
  const i = Math.min(total - 1, Math.max(0, (Number(hash.replace("#", "")) || 1) - 1));
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
          Slide {i + 1} of {total}
        </span>
        <button type="button" className="ev-btn sm" onClick={() => go(i - 1)} disabled={i === 0}>
          Back
        </button>
        <button type="button" className="ev-btn sm primary" onClick={() => go(i + 1)} disabled={i === total - 1}>
          Next
        </button>
        <button type="button" className="ev-btn sm" onClick={() => void stage.current?.requestFullscreen()}>
          Full screen (F)
        </button>
        <button type="button" className="ev-btn sm" onClick={() => window.print()}>
          Save all as PDF
        </button>
      </div>

      <div className="dd-stage" ref={stage}>
        <section className="dd-slide dark" data-on={i === 0} aria-label="Slide 1: title and team">
          <p className="dd-kick">Mentorful · Demo Day</p>
          <h2>
            Evidence for principals. <em>Privacy for teachers.</em>
          </h2>
          <p className="dd-lead">The best coach for a teacher is the teacher down the hall. A teacher-led startup, founded by Mike and Nick.</p>
          <div className="dd-grid four dd-roster">
            <div className="dd-card">
              <strong>Eric</strong>
              <b>Narrator</b>
              <span>Owns privacy</span>
            </div>
            <div className="dd-card">
              <strong>Juan</strong>
              <b>The principal</b>
              <span>Built the principal&rsquo;s dashboard</span>
            </div>
            <div className="dd-card">
              <strong>Bernard</strong>
              <b>Ms. Afiya, English</b>
              <span>Built the teacher dashboard</span>
            </div>
            <div className="dd-card">
              <strong>Bertrand</strong>
              <b>Mr. Stefano, Science</b>
              <span>Built pairing and the pair chat</span>
            </div>
          </div>
        </section>

        <section className="dd-slide" data-on={i === 1} aria-label="Slide 2: Lincoln High, a year ago">
          <span className="dd-tag">Sample school</span>
          <p className="dd-kick">A year ago</p>
          <h2>
            Lincoln High, <em>a year ago.</em>
          </h2>
          <div className="dd-grid">
            <div className="dd-card">
              <strong>85%</strong>
              <b>Culture Scan</b>
              <span>5.1 out of 6. The staff said the school felt like a place to learn from each other.</span>
            </div>
            <div className="dd-card">
              <strong>Every</strong>
              <b>teacher had a partner</b>
              <span>Pairs across departments, drafted by the principal in one click and approved by the principal.</span>
            </div>
            <div className="dd-card">
              <strong>Private</strong>
              <b>by design</b>
              <span>The principal saw how many conversations happened, never what was said. The honest answers kept coming.</span>
            </div>
          </div>
        </section>

        <section className="dd-slide" data-on={i === 2} aria-label="Slide 3: this year, the scan fell">
          <span className="dd-tag">Sample school</span>
          <p className="dd-kick">This year</p>
          <div className="dd-versus">
            <span className="big before">85%</span>
            <span className="arrow" aria-hidden>
              →
            </span>
            <span className="big after">70%</span>
          </div>
          <h2>
            The scan fell. <em>Now find out why.</em>
          </h2>
          <div className="dd-grid">
            <div className="dd-card">
              <strong>Structural</strong>
              <b>fell the most</b>
              <span>Who talks to whom. Down 1.4 points since last year, the lowest of the four dimensions.</span>
            </div>
            <div className="dd-card">
              <strong>8</strong>
              <b>new teachers, no partner</b>
              <span>Four in English and four in Science. Nobody has paired them yet.</span>
            </div>
            <div className="dd-card">
              <strong>Zero</strong>
              <b>English and Science</b>
              <span>Same building, same students, no conversations between the two departments.</span>
            </div>
          </div>
        </section>

        <section className="dd-slide dark" data-on={i === 3} aria-label="Slide 4: where to focus next year">
          <p className="dd-kick">Next year</p>
          <div className="dd-versus">
            <span className="big before">85%</span>
            <span className="arrow" aria-hidden>
              →
            </span>
            <span className="big after">70%</span>
          </div>
          <h2>
            Now the principal knows <em>where to focus.</em>
          </h2>
          <p className="dd-lead">Structural, and the gap between English and Science. Two strangers are coaching each other, and nobody had to feel watched. Next spring&rsquo;s scan is the proof.</p>
          <div className="dd-foot">
            <span>Mentorful · Evidence for principals. Privacy for teachers.</span>
            <span>Sample school. Thank you.</span>
          </div>
        </section>
      </div>
      <p className="ev-muted" style={{ fontSize: 13 }}>
        Arrow keys move between slides. These slides are in the app, so the team opens them from the same link.
      </p>
    </div>
  );
}
