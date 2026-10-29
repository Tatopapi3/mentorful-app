"use client";

import { useState, useSyncExternalStore } from "react";
import { openFutureNote, saveFutureNote } from "@/app/dashboard/aurora/hub-actions";
import { dayLabel, deliveryOptions, noteState, type FutureNote } from "@/lib/teacher/hub";
import { Icon } from "./icons";
import { Stamp, localDay } from "./stamp";

const noSubscribe = () => () => {};

/** The teacher's own calendar day, hydration-safe: the server's day until the browser takes over. */
function useToday(serverToday: string) {
  return useSyncExternalStore(noSubscribe, () => localDay(), () => serverToday);
}

/**
 * Write to your future self. The note is sealed until the day you choose, then it turns up on your Home screen and
 * here. The words of a sealed note stay on the server; you can still open one early if you want to. It is private to
 * you: not even your co-mentor sees it.
 */
export function FutureNoteComposer({ serverToday, cycleEnds, ready }: { serverToday: string; cycleEnds: string | null; ready: boolean }) {
  const today = useToday(serverToday);
  const options = deliveryOptions(today, cycleEnds);
  const [body, setBody] = useState("");
  const [choice, setChoice] = useState<string>("month");
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const when = choice === "custom" ? (custom || null) : (options.find((o) => o.key === choice)?.date ?? null);
  const needsDate = choice === "custom" && !custom;

  async function save() {
    setSaving(true);
    setMsg(null);
    const r = await saveFutureNote(body, choice === "keep" ? null : when);
    setSaving(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: choice === "keep" || !when ? "Saved. It's in your notes below." : `Sealed. It will find you on ${dayLabel(when)}.` });
    setBody("");
  }

  return (
    <section className="ev-panel ta-composer" id="future" aria-labelledby="ta-future-h">
      <p className="ev-eyebrow">Note to future self</p>
      <h2 id="ta-future-h">
        Dear <em>future me</em>,
      </h2>
      <p className="ev-muted">Write down what you want to remember, try, or tell yourself. It stays sealed until the day you pick, then turns up on your Home screen.</p>

      {!ready ? (
        <p className="ev-hold">Notes to your future self aren&rsquo;t switched on for your school yet. Your school lead needs to apply the update first.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="ev-field">
            <label htmlFor="ta-fn-body">Your note</label>
            <textarea id="ta-fn-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={4000} placeholder="By the time you read this, I hope…" />
          </div>
          <div className="ta-step flat">
            <div>
              <h3>When should it arrive?</h3>
              <div className="ev-chips" role="radiogroup" aria-label="When it should arrive">
                {options.map((o) => (
                  <label key={o.key}>
                    <input type="radio" name="when" value={o.key} checked={choice === o.key} onChange={() => setChoice(o.key)} />
                    {o.label}
                    {o.date ? <small className="ta-chip-sub"> · {dayLabel(o.date)}</small> : null}
                  </label>
                ))}
                <label>
                  <input type="radio" name="when" value="custom" checked={choice === "custom"} onChange={() => setChoice("custom")} />
                  Pick a date
                </label>
              </div>
              {choice === "custom" ? (
                <div className="ev-field">
                  <label htmlFor="ta-fn-date" className="sr-only">
                    Delivery date
                  </label>
                  <input id="ta-fn-date" type="date" value={custom} min={today} onChange={(e) => setCustom(e.target.value)} />
                </div>
              ) : null}
            </div>
          </div>
          <div className="ta-foot">
            <span className="ev-privacy">
              <Icon name="lock" size={14} /> Only you can read this
            </span>
            <button className="ev-btn primary" type="submit" disabled={saving || !body.trim() || needsDate}>
              {saving ? "Sealing…" : choice === "keep" ? "Save note" : "Seal it"}
              <Icon name="mail" size={16} />
            </button>
          </div>
          {msg ? (
            <p className={msg.ok ? "ev-note" : "ev-alert"} role={msg.ok ? "status" : "alert"}>
              {msg.text}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}

/** The notes themselves: arrived ones first, then those still sealed, then the ones already read. */
export function FutureNoteList({ notes, serverToday }: { notes: FutureNote[]; serverToday: string }) {
  const today = useToday(serverToday);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  if (notes.length === 0) return null;
  const rank = { arrived: 0, sealed: 1, kept: 2, opened: 3 } as const;
  const withState = notes.map((n) => ({ n, state: noteState(n, today) })).sort((a, b) => rank[a.state] - rank[b.state] || Date.parse(b.n.created_at) - Date.parse(a.n.created_at));

  async function open(id: string) {
    setBusy(id);
    setErr("");
    const r = await openFutureNote(id);
    setBusy(null);
    setConfirm(null);
    if (!r.ok) return setErr(r.error);
    setRevealed((cur) => ({ ...cur, [id]: r.body }));
  }

  return (
    <section className="ev-panel ta-notes" aria-labelledby="ta-notes-h">
      <div className="ta-between">
        <h3 id="ta-notes-h">Notes from you, to you</h3>
        <small className="ev-privacy">
          <Icon name="lock" size={12} /> Only you
        </small>
      </div>
      {err ? <p className="ev-alert" role="alert">{err}</p> : null}
      <ul>
        {withState.map(({ n, state }) => {
          const body = revealed[n.id] ?? n.body;
          // Kept and already-opened notes read straight away; an arrived or sealed one waits for the teacher to open it.
          const shown = revealed[n.id] !== undefined || ((state === "kept" || state === "opened") && body !== null);
          return (
            <li key={n.id} data-state={state}>
              <span className="ta-note-ico" aria-hidden>
                <Icon name={state === "sealed" ? "lock" : "mail"} size={16} />
              </span>
              <div>
                <p className="ta-note-meta">
                  {shown ? (
                    <strong>
                      You wrote this on <Stamp iso={n.created_at} kind="date" />
                    </strong>
                  ) : state === "arrived" ? (
                    <strong>A note from past you has arrived</strong>
                  ) : (
                    <strong>Sealed until {n.open_on ? dayLabel(n.open_on) : "later"}</strong>
                  )}
                  {!shown ? (
                    <small className="ev-muted">
                      {" "}
                      · written <Stamp iso={n.created_at} kind="date" />
                    </small>
                  ) : null}
                </p>
                {shown ? <p className="ta-note-body">{body}</p> : null}
                {state === "arrived" && !shown ? (
                  <button className="ev-btn sm primary" type="button" disabled={busy === n.id} onClick={() => void open(n.id)}>
                    {busy === n.id ? "Opening…" : "Open it"}
                  </button>
                ) : null}
                {state === "sealed" ? (
                  confirm === n.id ? (
                    <span className="ta-peek">
                      Open it before its day?{" "}
                      <button className="ev-btn quiet sm" type="button" onClick={() => void open(n.id)}>Yes, open</button>
                      <button className="ev-btn quiet sm" type="button" onClick={() => setConfirm(null)}>Keep it sealed</button>
                    </span>
                  ) : (
                    <button className="ev-btn quiet sm" type="button" onClick={() => setConfirm(n.id)}>Peek early</button>
                  )
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
