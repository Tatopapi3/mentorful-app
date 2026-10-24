"use client";

import { useState } from "react";
import { sendNudge } from "@/app/admin/pairings/nudge";
import { AUDIENCE_LABEL, audienceSize, countLabel, defaultNudge, type Cooling, type NudgeAudience } from "@/lib/admin/early-warning";
import type { Skin } from "@/components/admin/kit";

const btn = (skin: Skin, primary?: boolean) => (skin === "nick" ? `nk-btn${primary ? " nk-primary" : ""}` : `ev-btn sm${primary ? " primary" : ""}`);

/** Write one message for a group of pairs. The admin picks the group by how long it has been quiet, never by name. */
export default function NudgeComposer({ skin, cooling, cycleId, back }: { skin: Skin; cooling: Cooling; cycleId: string; back: string }) {
  const [audience, setAudience] = useState<NudgeAudience>(cooling.cooling > 0 ? "cooling" : "quiet");
  const [message, setMessage] = useState(defaultNudge(cooling.cooling > 0 ? "cooling" : "quiet"));
  const [touched, setTouched] = useState(false);
  const n = audienceSize(cooling, audience);

  const pick = (a: NudgeAudience) => {
    setAudience(a);
    if (!touched) setMessage(defaultNudge(a));
  };

  return (
    <form action={sendNudge} style={{ display: "grid", gap: 12, maxWidth: 680 }}>
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="cycle" value={cycleId} />
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <legend style={{ fontSize: 13, marginBottom: 6, color: "var(--ev-muted, var(--muted))" }}>Who is it for?</legend>
        {(Object.keys(AUDIENCE_LABEL) as NudgeAudience[]).map((a) => (
          <label key={a} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 14 }}>
            <input type="radio" name="audience" value={a} checked={audience === a} onChange={() => pick(a)} style={{ accentColor: "var(--ev-teal, var(--teal-dk, #0f766e))" }} />
            {AUDIENCE_LABEL[a]} ({countLabel(audienceSize(cooling, a))})
          </label>
        ))}
      </fieldset>
      <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
        <span style={{ color: "var(--ev-muted, var(--muted))" }}>Message to the pairs</span>
        <textarea
          name="message"
          rows={4}
          value={message}
          onChange={(e) => {
            setTouched(true);
            setMessage(e.target.value);
          }}
          style={{ font: "inherit", fontSize: 14.5, color: "inherit", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--ev-line, var(--line))", background: "var(--ev-panel-solid, var(--card))" }}
        />
      </label>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className={btn(skin, true)} disabled={n === 0}>Preview the send</button>
        <small style={{ color: "var(--ev-muted, var(--muted))" }}>Names nobody. You choose the group; the system would deliver it, and you would not see who received it. This prototype sends nothing.</small>
      </div>
    </form>
  );
}
