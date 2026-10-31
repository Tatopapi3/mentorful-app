"use client";

import "@/app/aurora.css";
import "@/app/aurora-public.css";

/** Something went wrong while drawing a page. Same look as the rest of the app, with a way to try again. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="ev ap" data-theme="light">
      <div className="ap-main">
        <div className="ap-card" style={{ maxWidth: 640, margin: "40px auto 0" }}>
          <p className="ev-eyebrow">Something went wrong</p>
          <h1>This page couldn’t load</h1>
          <p className="ap-lead">Nothing you entered was lost. Try again, and if it keeps happening, tell your school lead.</p>
          <div style={{ marginTop: 20 }}>
            <button type="button" className="ev-btn primary" onClick={reset}>
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
