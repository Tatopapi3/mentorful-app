"use client";

import Link from "next/link";
import { useState } from "react";
import { addGrowthEntry, logGameSession, saveGoal, setGoalStatus, setGrowthSharing } from "@/lib/teacher/hub-actions";
import {
  GOAL_AREAS,
  MODULES,
  KIND_LABEL,
  dayLabel,
  formatDuration,
  moduleStatuses,
  prefillFor,
  type GameSession,
  type Goal,
  type GrowthEntry,
  type GrowthKind,
  type Suggestion,
} from "@/lib/teacher/hub";
import { Icon, type IconName } from "./icons";
import { Stamp } from "./stamp";
import { useBase } from "./use-base";

const NotReady = () => <p className="ev-hold">This part of the hub isn&rsquo;t switched on for your school yet. Your school lead needs to apply the update first.</p>;

/* ------------------------------------------------------------ suggestions */

export function SuggestionCard({ items }: { items: Suggestion[] }) {
  const base = useBase();
  const [i, setI] = useState(0);
  if (items.length === 0) {
    return (
      <section className="ev-panel ta-suggest">
        <p className="ev-eyebrow">Suggested focus</p>
        <p className="ev-muted">Once you and your co-mentor have written up a visit, ideas for what to try next show up here, drawn from your own words and theirs.</p>
      </section>
    );
  }
  const s = items[i % items.length];
  return (
    <section className="ev-panel ta-suggest" aria-live="polite">
      <div className="ta-between">
        <p className="ev-eyebrow">
          <Icon name="spark" size={13} /> Suggested focus
        </p>
        <small className="ev-muted">
          {(i % items.length) + 1} of {items.length}
        </small>
      </div>
      <h3 className="ta-focus-h">{s.focus}</h3>
      <p className="ev-muted">{s.why}</p>
      <blockquote className="ta-quote sm">{s.prompt}</blockquote>
      <p className="ev-small">
        Try it with: <a href={`${base}/growth/play/${MODULES.find((m) => m.name === s.module)?.slug ?? ""}`}>{s.module}</a>
      </p>
      <div className="ta-row">
        {items.length > 1 ? (
          <button type="button" className="ev-btn" onClick={() => setI((n) => n + 1)}>
            Next suggestion
          </button>
        ) : null}
        <Link className="ev-btn primary" href={`${base}/journal?prefill=${encodeURIComponent(prefillFor(s))}#log`}>
          Use in a log <Icon name="arrow" size={16} />
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ games */

type PairLite = { pairingId: string; partnerFirst: string };

export function GamesHub({ pairs, games, ready }: { pairs: PairLite[]; games: GameSession[]; ready: boolean }) {
  const base = useBase();
  const [pairId, setPairId] = useState(pairs[0]?.pairingId ?? "");
  const [openMod, setOpenMod] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("");
  const [done, setDone] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (pairs.length === 0) {
    return (
      <section className="ev-panel" id="games">
        <p className="ev-eyebrow">Pedagogy games</p>
        <h2>Play it with your <em>co-mentor</em>.</h2>
        <p className="ev-muted">Short protocols you run together. They unlock once your school lead has confirmed your pairing.</p>
      </section>
    );
  }
  const pair = pairs.find((p) => p.pairingId === pairId) ?? pairs[0];
  const statuses = moduleStatuses(games, pair.pairingId);
  const finished = statuses.filter((s) => s.state === "done").length;

  const ICON: Record<string, IconName> = { shield: "shield", grid: "grid", compass: "compass", eye: "eye", trophy: "trophy", swap: "swap" };

  async function log(moduleName: string) {
    setBusy(true);
    setMsg(null);
    const r = await logGameSession(pair.pairingId, moduleName, minutes ? Number(minutes) : null, done, note);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: done ? "Marked complete. Nice work, both of you." : "Session logged." });
    setOpenMod(null);
    setMinutes("");
    setDone(false);
    setNote("");
  }

  return (
    <section className="ev-panel" id="games" aria-labelledby="ta-games-h">
      <div className="ta-between">
        <div>
          <p className="ev-eyebrow">Pedagogy games</p>
          <h2 id="ta-games-h">
            Play it with <em>{pair.partnerFirst}</em>.
          </h2>
        </div>
        <span className="ev-badge">
          {finished} of {statuses.length} complete
        </span>
      </div>
      <p className="ev-muted">Short guided protocols the two of you play together: a timer, prompts, and notes you keep. Each one ends with something you made. Shared with {pair.partnerFirst} only.</p>

      {pairs.length > 1 ? (
        <div className="ev-tabs" role="tablist" aria-label="Choose a co-mentor">
          {pairs.map((p) => (
            <button key={p.pairingId} role="tab" aria-selected={p.pairingId === pair.pairingId} className={p.pairingId === pair.pairingId ? "on" : ""} onClick={() => setPairId(p.pairingId)}>
              {p.partnerFirst}
            </button>
          ))}
        </div>
      ) : null}

      {!ready ? <NotReady /> : null}
      {msg ? (
        <p className={msg.ok ? "ev-note" : "ev-alert"} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </p>
      ) : null}

      <div className="ta-games">
        {statuses.map(({ module: m, state, sessions, minutes: mins, lastAt, lastNote }) => (
          <article key={m.slug} className="ta-game" data-state={state}>
            <span className="ta-iconchip" aria-hidden>
              <Icon name={ICON[m.icon]} size={20} />
            </span>
            <h3>{m.name}</h3>
            <p className="ev-muted">
              {m.focus} · {m.minutes} min
            </p>
            <div className="ta-gstate">
              <span className={`ev-badge${state === "new" ? " amber" : ""}`}>{state === "done" ? "Complete" : state === "started" ? "In progress" : "Not started"}</span>
              <small className="ev-muted">
                {sessions} {sessions === 1 ? "session" : "sessions"}
                {mins ? ` · ${formatDuration(mins * 60)}` : ""}
              </small>
            </div>
            {lastAt ? (
              <small className="ev-muted">
                Last played <Stamp iso={lastAt} kind="date" />
              </small>
            ) : null}
            {lastNote ? <p className="ta-game-last">{lastNote}</p> : null}
            <Link className="ev-btn sm primary ta-game-play" href={`${base}/growth/play/${m.slug}?with=${pair.pairingId}`}>
              <Icon name="play" size={13} /> {state === "new" ? "Play" : "Play again"}
            </Link>
            {ready ? (
              openMod === m.name ? (
                <form
                  className="ta-minform"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void log(m.name);
                  }}
                >
                  <label className="sr-only" htmlFor={`min-${m.slug}`}>
                    Minutes
                  </label>
                  <input id={`min-${m.slug}`} className="ev-input" type="number" min={1} max={600} placeholder={`Minutes (about ${m.minutes})`} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                  <label className="sr-only" htmlFor={`note-${m.slug}`}>
                    Note
                  </label>
                  <input id={`note-${m.slug}`} className="ev-input" maxLength={500} placeholder="A line on how it went (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <label className="ev-check">
                    <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
                    <span>This finished the module</span>
                  </label>
                  <div className="ta-row">
                    <button className="ev-btn sm primary" type="submit" disabled={busy}>
                      {busy ? "Saving…" : "Log session"}
                    </button>
                    <button className="ev-btn sm quiet" type="button" onClick={() => setOpenMod(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button className="ev-btn sm" type="button" onClick={() => { setOpenMod(m.name); setMsg(null); }}>
                  <Icon name="plus" size={14} /> Log one you played offline
                </button>
              )
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ goals & log */

export function GoalsPanel({ goals, entries, ready }: { goals: Goal[]; entries: GrowthEntry[]; ready: boolean }) {
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const active = goals.filter((g) => g.status === "active");
  const closed = goals.filter((g) => g.status !== "active");

  async function add() {
    setBusy("new");
    setErr("");
    const r = await saveGoal(title, area, why, target || null);
    setBusy(null);
    if (!r.ok) return setErr(r.error);
    setTitle("");
    setArea(null);
    setWhy("");
    setTarget("");
    setAdding(false);
  }
  async function status(id: string, s: "active" | "done" | "dropped") {
    setBusy(id);
    const r = await setGoalStatus(id, s);
    setBusy(null);
    if (!r.ok) setErr(r.error);
  }
  const count = (id: string) => entries.filter((e) => e.goal_id === id).length;

  return (
    <section className="ev-panel" id="goals" aria-labelledby="ta-goals-h">
      <div className="ta-between">
        <div>
          <p className="ev-eyebrow">My goals</p>
          <h2 id="ta-goals-h">
            What I&rsquo;m working on <em>for me</em>.
          </h2>
        </div>
        {ready && !adding ? (
          <button className="ev-btn sm" type="button" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} /> New goal
          </button>
        ) : null}
      </div>
      <p className="ev-muted">One to three things you want to get better at. Private to you: not shared with your co-mentor or your school lead, and never scored. (If you choose to be counted in anonymous school totals, only a number goes in, never your words.)</p>
      {!ready ? <NotReady /> : null}
      {err ? <p className="ev-alert" role="alert">{err}</p> : null}

      {adding ? (
        <form
          className="ta-goalform"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <div className="ev-field">
            <label htmlFor="ta-goal-t">What do you want to get better at?</label>
            <input id="ta-goal-t" type="text" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Let students finish before I step in" autoFocus />
          </div>
          <div className="ev-chips" role="radiogroup" aria-label="Area">
            {GOAL_AREAS.map((a) => (
              <label key={a}>
                <input type="radio" name="area" checked={area === a} onChange={() => setArea(a)} />
                {a}
              </label>
            ))}
          </div>
          <div className="ev-field">
            <label htmlFor="ta-goal-w">
              Why it matters <small className="ev-muted">Optional</small>
            </label>
            <textarea id="ta-goal-w" rows={2} maxLength={600} value={why} onChange={(e) => setWhy(e.target.value)} />
          </div>
          <div className="ev-field">
            <label htmlFor="ta-goal-d">
              Check back by <small className="ev-muted">Optional</small>
            </label>
            <input id="ta-goal-d" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div className="ta-row">
            <button className="ev-btn primary" type="submit" disabled={busy === "new" || !title.trim()}>
              {busy === "new" ? "Saving…" : "Save goal"}
            </button>
            <button className="ev-btn quiet" type="button" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {active.length === 0 && !adding ? (
        <p className="ev-empty ta-small-empty">No goals yet. A good first one is small and specific: something you could try in tomorrow&rsquo;s lesson.</p>
      ) : (
        <ul className="ta-goals">
          {active.map((g) => (
            <li key={g.id}>
              <span className="ta-iconchip" aria-hidden>
                <Icon name="target" size={18} />
              </span>
              <div>
                <strong>{g.title}</strong>
                <small className="ev-muted">
                  {g.area ? `${g.area} · ` : ""}
                  {count(g.id)} {count(g.id) === 1 ? "check-in" : "check-ins"}
                  {g.target_date ? ` · check back by ${dayLabel(g.target_date)}` : ""}
                </small>
                {g.why ? <p className="ev-small">{g.why}</p> : null}
              </div>
              <div className="ta-goal-actions">
                <button className="ev-btn sm" type="button" disabled={busy === g.id} onClick={() => void status(g.id, "done")}>
                  <Icon name="check" size={14} /> Done
                </button>
                <button className="ev-btn quiet sm" type="button" disabled={busy === g.id} onClick={() => void status(g.id, "dropped")}>
                  Let it go
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {closed.length > 0 ? (
        <details className="ta-closed">
          <summary>
            Finished or set aside ({closed.length})
          </summary>
          <ul>
            {closed.map((g) => (
              <li key={g.id}>
                <span>
                  <Icon name={g.status === "done" ? "check" : "close"} size={13} /> {g.title}
                </span>
                <button className="ev-btn quiet sm" type="button" disabled={busy === g.id} onClick={() => void status(g.id, "active")}>
                  Reopen
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

const KINDS: GrowthKind[] = ["practice", "learning", "reflection", "observation"];

export function PracticeLog({ entries, goals, ready, totals }: { entries: GrowthEntry[]; goals: Goal[]; ready: boolean; totals: { entries: number; minutes: number } }) {
  const [kind, setKind] = useState<GrowthKind>("practice");
  const [body, setBody] = useState("");
  const [minutes, setMinutes] = useState("");
  const [goalId, setGoalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const activeGoals = goals.filter((g) => g.status === "active");
  const goalName = (id: string | null) => goals.find((g) => g.id === id)?.title ?? null;

  async function add() {
    setBusy(true);
    setMsg(null);
    const r = await addGrowthEntry(kind, body, minutes ? Number(minutes) : null, goalId || null);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setBody("");
    setMinutes("");
    setMsg({ ok: true, text: "Logged." });
  }

  return (
    <section className="ev-panel" id="practice" aria-labelledby="ta-practice-h">
      <p className="ev-eyebrow">Practice log</p>
      <h2 id="ta-practice-h">
        What I did to <em>grow</em>.
      </h2>
      <p className="ev-muted">A dated line each time you try something, learn something, reflect or watch a colleague teach. Add the minutes if you like; it all stays with you.</p>
      {totals.entries > 0 ? (
        <p className="ta-totals">
          <strong>{totals.entries}</strong> {totals.entries === 1 ? "entry" : "entries"} in the last 30 days{totals.minutes ? <> · <strong>{formatDuration(totals.minutes * 60)}</strong> of practice</> : null}
        </p>
      ) : null}
      {!ready ? (
        <NotReady />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <div className="ev-chips" role="radiogroup" aria-label="What kind of entry">
            {KINDS.map((k) => (
              <label key={k}>
                <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
                {KIND_LABEL[k]}
              </label>
            ))}
          </div>
          <div className="ev-field">
            <label htmlFor="ta-pl-b" className="sr-only">
              What happened
            </label>
            <textarea id="ta-pl-b" rows={2} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you try, learn, notice or think about?" />
          </div>
          <div className="ta-inline">
            <input className="ev-input" type="number" min={1} max={600} placeholder="Minutes (optional)" aria-label="Minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            {activeGoals.length ? (
              <select className="ev-input" value={goalId} onChange={(e) => setGoalId(e.target.value)} aria-label="Which goal this is for">
                <option value="">Not tied to a goal</option>
                {activeGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    For: {g.title}
                  </option>
                ))}
              </select>
            ) : null}
            <button className="ev-btn primary" type="submit" disabled={busy || !body.trim()}>
              {busy ? "Saving…" : "Log it"}
            </button>
          </div>
          {msg ? (
            <p className={msg.ok ? "ev-note" : "ev-alert"} role={msg.ok ? "status" : "alert"}>
              {msg.text}
            </p>
          ) : null}
        </form>
      )}

      {entries.length > 0 ? (
        <ol className="ta-timeline">
          {entries.slice(0, 8).map((e) => (
            <li key={e.id}>
              <div>
                <span className="ev-badge">{KIND_LABEL[e.kind]}</span>
                <Stamp iso={e.created_at} className="ev-muted ta-when" />
                {e.minutes ? <small className="ev-muted">{formatDuration(e.minutes * 60)}</small> : null}
              </div>
              <p>{e.body}</p>
              {goalName(e.goal_id) ? <small className="ev-muted">For: {goalName(e.goal_id)}</small> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------- anonymous school totals */

/**
 * The teacher's choice to be counted in their school's anonymous growth totals. Off by default; says plainly what
 * leadership can and can't see; changing it takes effect at the next reading.
 */
export function SharingCard({ on: initial, ready }: { on: boolean; ready: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function change(next: boolean) {
    setOn(next); // flip at once; put it back if saving fails
    setBusy(true);
    setMsg(null);
    const r = await setGrowthSharing(next);
    setBusy(false);
    if (!r.ok) {
      setOn(!next);
      return setMsg({ ok: false, text: r.error });
    }
    setMsg({ ok: true, text: next ? "Thanks. You'll be counted in your school's anonymous totals from the next reading." : "Done. You're no longer counted." });
  }

  return (
    <section className="ev-panel ta-sharing" aria-labelledby="ta-sharing-h">
      <p className="ev-eyebrow">Your choice</p>
      <h2 id="ta-sharing-h">
        Count me in my school&rsquo;s <em>anonymous totals</em>.
      </h2>
      <p className="ev-muted">Your school lead can see whether the growth tools are being used across the faculty, but only as totals, and only from teachers who choose to be counted. It is off unless you turn it on.</p>
      <div className="ta-sharing-cols">
        <div>
          <p className="ta-label">What your school lead sees</p>
          <ul>
            <li>School-wide percentages, like &ldquo;about 60% of teachers who share used Mentorful last week&rdquo;</li>
            <li>Rounded to the nearest 5%, and only once at least 5 teachers have chosen this</li>
          </ul>
        </div>
        <div>
          <p className="ta-label">What they never see</p>
          <ul>
            <li>Your name, your department, or whether you chose this</li>
            <li>How long <em>you</em> spent, or any figure about you</li>
            <li>Your goals, practice log, notes, chat, or anything you write in a game</li>
          </ul>
        </div>
      </div>
      {!ready ? (
        <p className="ev-hold">Anonymous totals aren&rsquo;t switched on for your school yet.</p>
      ) : (
        <label className="ev-check">
          <input type="checkbox" checked={on} disabled={busy} onChange={(e) => void change(e.target.checked)} />
          <span>
            <strong>Yes, count my activity in anonymous school totals</strong>
            <small className="ev-muted">You can switch this off at any time. Time on a platform isn&rsquo;t the same as growth, and it will never be used to judge you.</small>
          </span>
        </label>
      )}
      {msg ? (
        <p className={msg.ok ? "ev-note" : "ev-alert"} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}
