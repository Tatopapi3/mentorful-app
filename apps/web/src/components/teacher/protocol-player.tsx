"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { saveEntry } from "@/app/dashboard/aurora/actions";
import { addGrowthEntry, logGameSession } from "@/app/dashboard/aurora/hub-actions";
import { CONCERN_DOMAINS, DOMAIN_LABEL, type ConcernDomain } from "@/lib/domains";
import { MODULES } from "@/lib/teacher/hub";
import { journalFields, summarize, totalMinutes, type Outputs, type Protocol, type Step } from "@/lib/teacher/protocols";
import { Icon } from "./icons";
import { Stamp } from "./stamp";

type Pair = { pairingId: string; partnerFirst: string; partnerName: string; domain: string | null };
type Phase = "intro" | "play" | "done";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Plays one protocol with a co-mentor on a single screen. The player keeps time and takes notes; the two teachers do the
 * talking. Nothing is rated. At the end the pair saves the session (with what they wrote), and a Fishbowl can become a
 * draft conversation entry while an Efficacy Quest can add the win to the teacher's own practice log.
 */
export function ProtocolPlayer({ protocol, ready, pair, myDomains, theirDomains, others, last }: { protocol: Protocol; ready: boolean; pair: Pair; myDomains: ConcernDomain[]; theirDomains: ConcernDomain[]; others: { pairingId: string; first: string }[]; last: { note: string; at: string } | null }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [outputs, setOutputs] = useState<Outputs>({});
  const [left, setLeft] = useState(protocol.steps[0].minutes * 60);
  const [running, setRunning] = useState(false);
  const [minutes, setMinutes] = useState(String(totalMinutes(protocol)));
  const [finished, setFinished] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const step = protocol.steps[idx];
  const mod = MODULES.find((m) => m.name === protocol.name);
  const dirty = Object.keys(outputs).length > 0 && !saved.session;

  const set = (k: string, v: string) => setOutputs((o) => ({ ...o, [k]: v }));
  const goTo = (n: number) => {
    setIdx(n);
    setLeft(protocol.steps[n].minutes * 60);
    setRunning(false);
  };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Don't lose what the pair has written by accident.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const summary = useMemo(() => summarize(protocol, outputs), [protocol, outputs]);
  const written = protocol.steps.flatMap((s) => (s.captures ?? []).filter((c) => outputs[c.key]).map((c) => ({ label: c.label, text: outputs[c.key] })));
  const prefs = protocol.steps.flatMap((s) => (s.choices ?? []).map((c) => ({ label: c.label, me: outputs[`${c.key}.me`], partner: outputs[`${c.key}.partner`] }))).filter((c) => c.me || c.partner);

  async function saveSession() {
    setBusy("session");
    setError("");
    const r = await logGameSession(pair.pairingId, protocol.name, Number(minutes) || null, finished, summary, outputs);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setSaved((s) => ({ ...s, session: "Saved for you and " + pair.partnerFirst + "." }));
  }
  async function saveDraft() {
    const f = journalFields(protocol, outputs);
    if (!f) return;
    setBusy("draft");
    setError("");
    const fd = new FormData();
    fd.set("pairing_id", pair.pairingId);
    fd.set("domain", pair.domain ?? "CLASSROOM");
    for (const [k, v] of Object.entries(f)) fd.set(k, v);
    const r = await saveEntry(fd);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setSaved((s) => ({ ...s, draft: "A draft is waiting in your journal." }));
  }
  async function saveWin() {
    const text = (protocol.practiceKeys ?? []).map((k) => outputs[k]).filter(Boolean).join(" · ");
    if (!text) return setError("Write a win first.");
    setBusy("win");
    setError("");
    const r = await addGrowthEntry("reflection", text.slice(0, 1000), null, null);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setSaved((s) => ({ ...s, win: "Added to your practice log." }));
  }

  /* ------------------------------------------------------------------ intro */
  if (phase === "intro") {
    return (
      <div className="ta-play">
        <p className="ev-eyebrow">Pedagogy games · {mod?.focus}</p>
        <h1>{protocol.name}</h1>
        <p className="ev-lead">{protocol.purpose}</p>
        <div className="ta-play-meta">
          <span className="ev-badge">{totalMinutes(protocol)} minutes</span>
          <span className="ev-badge">{protocol.steps.length} steps</span>
          <span className="ev-badge">With {pair.partnerFirst}</span>
        </div>
        {others.length > 0 ? (
          <p className="ev-small">
            Playing with {pair.partnerFirst}. Switch to:{" "}
            {others.filter((o) => o.pairingId !== pair.pairingId).map((o) => (
              <Link key={o.pairingId} href={`/dashboard/aurora/growth/play/${protocol.slug}?with=${o.pairingId}`}>{o.first}</Link>
            ))}
          </p>
        ) : null}

        <section className="ev-panel">
          <h3>How it goes</h3>
          <ol className="ta-play-steps">
            {protocol.steps.map((s, i) => (
              <li key={s.id}>
                <span className="ta-num">{i + 1}</span>
                <div>
                  <strong>{s.title}</strong>
                  <small className="ev-muted">{s.minutes} min · {s.who}</small>
                </div>
              </li>
            ))}
          </ol>
          <p className="ev-small"><strong>You leave with:</strong> {protocol.outcome}</p>
        </section>

        {last ? (
          <section className="ev-panel ta-play-last">
            <p className="ev-eyebrow">Last time you played this</p>
            <p>{last.note}</p>
            <small className="ev-muted"><Stamp iso={last.at} kind="date" /></small>
          </section>
        ) : null}

        <p className="ev-note">
          <Icon name="lock" size={14} /> Shared with {pair.partnerFirst} only. Nothing here is rated, and your school lead never sees what you write. This is a first draft of the game, written for Mentorful&rsquo;s team to review.
        </p>
        <div className="ta-row">
          <button className="ev-btn primary" type="button" onClick={() => setPhase("play")}>
            Start <Icon name="play" size={15} />
          </button>
          <Link className="ev-btn quiet" href="/dashboard/aurora/growth#games">Back to the games</Link>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------- done */
  if (phase === "done") {
    return (
      <div className="ta-play">
        <p className="ev-eyebrow">{protocol.name}</p>
        <h1>
          Nicely <em>done</em>.
        </h1>
        <p className="ev-lead">{protocol.outcome}</p>

        <section className="ev-panel">
          <h3>What you wrote</h3>
          {written.length === 0 && prefs.length === 0 ? <p className="ev-muted">You didn&rsquo;t write anything down, and that&rsquo;s fine. You can still log the session.</p> : null}
          <dl className="ta-play-out">
            {prefs.map((c) => (
              <div key={c.label}>
                <dt>{c.label}</dt>
                <dd>You: {c.me ?? "—"} · {pair.partnerFirst}: {c.partner ?? "—"}</dd>
              </div>
            ))}
            {written.map((c) => (
              <div key={c.label}>
                <dt>{c.label}</dt>
                <dd>{c.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        {!ready ? <p className="ev-hold">Saving games isn&rsquo;t switched on for your school yet, so this session can&rsquo;t be recorded.</p> : null}
        <section className="ev-panel">
          <h3>Save it</h3>
          <div className="ta-inline">
            <label className="sr-only" htmlFor="ta-pl-min">Minutes</label>
            <input id="ta-pl-min" className="ev-input" type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="How many minutes it took" />
            <label className="ev-check" style={{ padding: 0 }}>
              <input type="checkbox" checked={finished} onChange={(e) => setFinished(e.target.checked)} />
              <span>This finished the module</span>
            </label>
          </div>
          <div className="ta-row">
            <button className="ev-btn primary" type="button" disabled={!ready || busy === "session" || !!saved.session} onClick={() => void saveSession()}>
              {saved.session ? "Saved" : busy === "session" ? "Saving…" : "Save this session"} <Icon name="check" size={16} />
            </button>
            {protocol.logMap ? (
              <button className="ev-btn" type="button" disabled={!ready || busy === "draft" || !!saved.draft} onClick={() => void saveDraft()}>
                <Icon name="pen" size={15} /> {saved.draft ? "Draft saved" : "Save as a draft in my journal"}
              </button>
            ) : null}
            {protocol.practiceKeys ? (
              <button className="ev-btn" type="button" disabled={!ready || busy === "win" || !!saved.win} onClick={() => void saveWin()}>
                <Icon name="growth" size={15} /> {saved.win ? "Added" : "Add my win to my practice log"}
              </button>
            ) : null}
          </div>
          {Object.values(saved).map((m) => (
            <p key={m} className="ev-note" role="status">{m}</p>
          ))}
          {error ? <p className="ev-alert" role="alert">{error}</p> : null}
        </section>
        <div className="ta-row">
          <Link className="ev-btn quiet" href="/dashboard/aurora/growth#games">Back to the games</Link>
          {protocol.logMap && saved.draft ? <Link className="ev-btn quiet" href="/dashboard/aurora/journal#notebook">Open my journal</Link> : null}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------- play */
  const last_ = idx === protocol.steps.length - 1;
  return (
    <div className="ta-play">
      <div className="ta-play-head">
        <p className="ev-eyebrow">{protocol.name} · with {pair.partnerFirst}</p>
        <div className="ta-play-progress" role="progressbar" aria-valuemin={1} aria-valuemax={protocol.steps.length} aria-valuenow={idx + 1} aria-label={`Step ${idx + 1} of ${protocol.steps.length}`}>
          {protocol.steps.map((s, i) => (
            <i key={s.id} data-state={i < idx ? "done" : i === idx ? "now" : "next"} />
          ))}
        </div>
      </div>

      <section className="ev-panel ta-play-step" aria-live="polite">
        <div className="ta-between">
          <p className="ta-label">Step {idx + 1} of {protocol.steps.length} · {step.who}</p>
          <div className="ta-timer" data-up={left === 0}>
            <button type="button" className="ta-iconbtn" onClick={() => setRunning((r) => !r)} aria-label={running ? "Pause the timer" : "Start the timer"}>
              <Icon name={running ? "close" : "play"} size={14} />
            </button>
            <strong>{left === 0 ? "Time" : clock(left)}</strong>
            <button type="button" className="ev-btn quiet sm" onClick={() => setLeft((l) => l + 60)}>+1 min</button>
          </div>
        </div>
        <h2>{step.title}</h2>
        <p className="ta-play-inst">{step.instruction}</p>
        {left === 0 ? <p className="ev-note">Time&rsquo;s up. Wrap up when you&rsquo;re ready; nothing moves on by itself.</p> : null}

        {step.say?.length ? (
          <ul className="ta-say" aria-label="Sentence stems">
            {step.say.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : null}

        {step.kind === "domains" ? <DomainsView mine={myDomains} theirs={theirDomains} first={pair.partnerFirst} /> : null}

        {step.choices?.map((c) => (
          <fieldset key={c.key} className="ta-choice">
            <legend>{c.label}</legend>
            <div className="ta-choice-cols">
              {(["me", "partner"] as const).map((who) => (
                <div key={who}>
                  <p className="ta-label">{who === "me" ? "You" : pair.partnerFirst}</p>
                  <div className="ev-chips" role="radiogroup" aria-label={`${c.label}, ${who === "me" ? "you" : pair.partnerFirst}`}>
                    {c.options.map((o) => (
                      <label key={o}>
                        <input type="radio" name={`${c.key}.${who}`} checked={outputs[`${c.key}.${who}`] === o} onChange={() => set(`${c.key}.${who}`, o)} />
                        {o}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        ))}

        {step.captures?.map((c) => (
          <div className="ev-field" key={c.key}>
            <label htmlFor={`cap-${c.key}`}>
              {c.label} <small className="ev-muted">{(outputs[c.key] ?? "").length}/400</small>
            </label>
            <textarea id={`cap-${c.key}`} rows={c.rows ?? 3} maxLength={400} value={outputs[c.key] ?? ""} placeholder={c.placeholder} onChange={(e) => set(c.key, e.target.value)} />
          </div>
        ))}
      </section>

      <div className="ta-play-nav">
        <button type="button" className="ev-btn" onClick={() => goTo(idx - 1)} disabled={idx === 0}>
          <Icon name="left" size={15} /> Back
        </button>
        <small className="ev-muted">Writing is optional. The talking is the point.</small>
        {last_ ? (
          <button type="button" className="ev-btn primary" onClick={() => { setRunning(false); setPhase("done"); }}>
            Finish <Icon name="check" size={15} />
          </button>
        ) : (
          <button type="button" className="ev-btn primary" onClick={() => goTo(idx + 1)}>
            Next <Icon name="right" size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Both teachers' strengths by area, from their profiles: who is strong where, with no levels and no ranking. */
function DomainsView({ mine, theirs, first }: { mine: ConcernDomain[]; theirs: ConcernDomain[]; first: string }) {
  return (
    <div className="ta-dominoes" aria-label="Strengths by area">
      {CONCERN_DOMAINS.map((d) => {
        const a = mine.includes(d);
        const b = theirs.includes(d);
        const verdict = a && b ? "You're both strong here" : a ? "You can offer this" : b ? `${first} can offer this` : "Open ground to explore";
        return (
          <div key={d} className="ta-domino" data-both={a && b} data-open={!a && !b}>
            <strong>{DOMAIN_LABEL[d]}</strong>
            <div className="ta-domino-who">
              <span data-on={a}>You</span>
              <span data-on={b}>{first}</span>
            </div>
            <small>{verdict}</small>
          </div>
        );
      })}
    </div>
  );
}

export type { Step };
