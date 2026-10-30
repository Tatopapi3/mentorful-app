"use client";

import { useState } from "react";
import { setLookbookHidden } from "@/lib/teacher/card-actions";
import { Icon } from "./icons";

/**
 * The one choice a teacher has about the lookbook: appear in it or not. What a colleague sees is fixed (name,
 * department, strengths); per-field choices are a later enhancement.
 */
export function LookbookSwitch({ hidden, ready }: { hidden: boolean; ready: boolean }) {
  const [off, setOff] = useState(hidden);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!ready) return null;

  async function flip() {
    const next = !off;
    setBusy(true);
    setErr("");
    setOff(next);
    const r = await setLookbookHidden(next);
    setBusy(false);
    if (!r.ok) {
      setOff(!next);
      setErr(r.error);
    }
  }

  return (
    <section className="ev-panel ta-lb-switch" aria-labelledby="ta-lbs-h">
      <div className="ta-between">
        <div>
          <p className="ev-eyebrow">What colleagues see of you</p>
          <h2 id="ta-lbs-h">
            Your name, your department and your <em>strengths</em>.
          </h2>
          <p className="ev-muted">That is all the lookbook ever shows about anyone: no photo, no biography, no email. Your school lead keeps your email for the roster only. {off ? "You are hidden from the lookbook right now." : "You appear in the lookbook."}</p>
        </div>
        <button className={off ? "ev-btn primary" : "ev-btn"} type="button" onClick={() => void flip()} disabled={busy} aria-pressed={!off}>
          <Icon name={off ? "users" : "lock"} size={16} /> {off ? "Show me in the lookbook" : "Hide me from the lookbook"}
        </button>
      </div>
      {err ? <p className="ev-alert" role="alert">{err}</p> : null}
    </section>
  );
}
