"use client";

import { useState } from "react";
import { addCtleHours, removeCtleHours, saveCtleSettings } from "@/lib/teacher/ctle-actions";
import { DEFAULTS, PACE_LABEL, ctleProgress, dateLabel, hoursLabel, paceSentence, type CtleEntry, type CtleSettings } from "@/lib/teacher/ctle";
import { Icon } from "./icons";

const NotReady = () => <p className="ev-hold">The CTLE tracker isn&rsquo;t switched on for your school yet. Your school lead needs to apply the update first.</p>;

const Meter = ({ label, value, of, tone }: { label: string; value: number; of: number; tone?: "lang" }) => {
  const pct = of > 0 ? Math.min(100, Math.round((value / of) * 100)) : 0;
  return (
    <div className="ta-ctle-meter" data-tone={tone}>
      <div className="ta-between">
        <strong>{label}</strong>
        <span>
          <strong>{hoursLabel(value)}</strong> of {hoursLabel(of)} hours
        </span>
      </div>
      <div className="ta-ctle-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={of} aria-valuenow={Math.min(value, of)}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

/**
 * The teacher's own record of Continuing Teacher and Leader Education hours. Names the requirement plainly (100 hours
 * per 5-year registration period, 15% language acquisition, approved sponsor) and says just as plainly that it is a
 * personal record, not NYSED's. Private to the teacher; leadership sees only an anonymous reading if they opt in.
 */
export function CtlePanel({ settings, entries, ready, today }: { settings: CtleSettings | null; entries: CtleEntry[]; ready: boolean; today: string }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // settings form
  const [start, setStart] = useState(settings?.period_start ?? "");
  const [years, setYears] = useState(String(settings?.period_years ?? DEFAULTS.periodYears));
  const [required, setRequired] = useState(String(settings?.required_hours ?? DEFAULTS.requiredHours));
  const [langPct, setLangPct] = useState(String(settings?.language_pct ?? DEFAULTS.languagePct));

  // entry form
  const [takenOn, setTakenOn] = useState(today);
  const [hours, setHours] = useState("");
  const [title, setTitle] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [language, setLanguage] = useState(false);
  const [approved, setApproved] = useState(true);
  const [certificate, setCertificate] = useState(false);

  async function saveSettings() {
    setBusy("settings");
    setErr("");
    const r = await saveCtleSettings({ period_start: start, period_years: Number(years), required_hours: Number(required), language_pct: Number(langPct) });
    setBusy(null);
    if (!r.ok) return setErr(r.error);
    setEditing(false);
  }
  async function add() {
    setBusy("new");
    setErr("");
    const r = await addCtleHours({ taken_on: takenOn, hours: Number(hours), title, sponsor, language, approved, certificate });
    setBusy(null);
    if (!r.ok) return setErr(r.error);
    setHours("");
    setTitle("");
    setSponsor("");
    setLanguage(false);
    setCertificate(false);
    setAdding(false);
  }
  async function remove(id: string) {
    setBusy(id);
    const r = await removeCtleHours(id);
    setBusy(null);
    if (!r.ok) setErr(r.error);
  }

  const settingsForm = (
    <form
      className="ta-goalform"
      onSubmit={(e) => {
        e.preventDefault();
        void saveSettings();
      }}
    >
      <div className="ev-field">
        <label htmlFor="ta-ctle-start">
          The day your current registration period started <small>(on your NYSED TEACH account, or your registration card)</small>
        </label>
        <input id="ta-ctle-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
      </div>
      <div className="ta-inline">
        <label className="ta-ctle-num">
          Years in the period
          <input className="ev-input" type="number" min={1} max={5} value={years} onChange={(e) => setYears(e.target.value)} />
        </label>
        <label className="ta-ctle-num">
          Hours required
          <input className="ev-input" type="number" min={1} max={300} value={required} onChange={(e) => setRequired(e.target.value)} />
        </label>
        <label className="ta-ctle-num">
          % language acquisition
          <input className="ev-input" type="number" min={0} max={100} value={langPct} onChange={(e) => setLangPct(e.target.value)} />
        </label>
      </div>
      <p className="ev-muted">The defaults are New York&rsquo;s for a Professional certificate: 100 hours every 5 years, 15% of them language acquisition. If your certificate asks for something else (a Level III teaching assistant needs 75 hours, for example), change the numbers.</p>
      <div className="ta-inline">
        <button className="ev-btn primary" type="submit" disabled={busy === "settings" || !start}>
          {busy === "settings" ? "Saving…" : "Save"}
        </button>
        {settings ? (
          <button className="ev-btn quiet" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );

  const header = (
    <>
      <p className="ev-eyebrow">Professional development hours</p>
      <h2 id="ta-ctle-h">
        Continuing Teacher and Leader Education <em>(CTLE)</em>
      </h2>
      <p className="ev-lead ta-ctle-lead">
        New York asks certified teachers for <strong>100 hours of CTLE every 5 years</strong>, at least 15% of them language acquisition, from an approved sponsor. Keep your count here, privately.
      </p>
    </>
  );

  if (!ready) {
    return (
      <section className="ev-panel" id="ctle" aria-labelledby="ta-ctle-h">
        {header}
        <NotReady />
      </section>
    );
  }

  if (!settings || editing) {
    return (
      <section className="ev-panel" id="ctle" aria-labelledby="ta-ctle-h">
        {header}
        {err ? <p className="ev-alert" role="alert">{err}</p> : null}
        {!settings ? <p className="ev-muted">Start by telling us when your current registration period began, so we can show where you stand.</p> : null}
        {settingsForm}
      </section>
    );
  }

  const p = ctleProgress(entries, settings, today);
  const live = entries.filter((e) => !e.voided_at).sort((a, b) => (a.taken_on < b.taken_on ? 1 : -1));

  return (
    <section className="ev-panel" id="ctle" aria-labelledby="ta-ctle-h">
      <div className="ta-between">
        <div>{header}</div>
        <span className="ev-badge" data-pace={p.pace}>
          {PACE_LABEL[p.pace]}
        </span>
      </div>
      {err ? <p className="ev-alert" role="alert">{err}</p> : null}

      <Meter label="Total CTLE hours" value={p.counted} of={p.required} />
      <Meter label="Language acquisition" value={p.language} of={p.languageRequired} tone="lang" />
      <p className="ta-ctle-says">{paceSentence(p)}</p>
      <p className="ev-muted">
        Your {settings.period_years}-year period runs {dateLabel(p.periodStart)} to {dateLabel(p.periodEnd)}. Language acquisition hours count toward the total, not on top of it.
        {p.personal ? <> {hoursLabel(p.personal)} personal-record {p.personal === 1 ? "hour isn't" : "hours aren't"} counted because {p.personal === 1 ? "it" : "they"} didn&rsquo;t come from an approved sponsor.</> : null}
      </p>

      <div className="ta-inline ta-ctle-actions">
        {!adding ? (
          <button className="ev-btn primary sm" type="button" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} /> Add hours
          </button>
        ) : null}
        <button className="ev-btn quiet sm" type="button" onClick={() => setEditing(true)}>
          Change my period or requirement
        </button>
      </div>

      {adding ? (
        <form
          className="ta-goalform"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <div className="ev-field">
            <label htmlFor="ta-ctle-title">What was it?</label>
            <input id="ta-ctle-title" type="text" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Supporting multilingual learners in math" autoFocus />
          </div>
          <div className="ta-inline">
            <label className="ta-ctle-num">
              Date
              <input className="ev-input" type="date" max={today} value={takenOn} onChange={(e) => setTakenOn(e.target.value)} />
            </label>
            <label className="ta-ctle-num">
              Hours
              <input className="ev-input" type="number" min={0.25} max={100} step={0.25} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="1.5" />
            </label>
            <label className="ta-ctle-num grow">
              Sponsor
              <input className="ev-input" type="text" maxLength={120} value={sponsor} onChange={(e) => setSponsor(e.target.value)} placeholder="District, BOCES, college…" />
            </label>
          </div>
          <div className="ev-chips ta-ctle-checks">
            <label>
              <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} /> From an approved CTLE sponsor
            </label>
            <label>
              <input type="checkbox" checked={language} onChange={(e) => setLanguage(e.target.checked)} /> Language acquisition
            </label>
            <label>
              <input type="checkbox" checked={certificate} onChange={(e) => setCertificate(e.target.checked)} /> I have the certificate
            </label>
          </div>
          {!approved ? <p className="ev-muted">Not from an approved sponsor, so it will be kept as a personal record and won&rsquo;t count toward your {hoursLabel(p.required)} hours.</p> : null}
          <div className="ta-inline">
            <button className="ev-btn primary" type="submit" disabled={busy === "new" || !title.trim() || !hours}>
              {busy === "new" ? "Saving…" : "Save hours"}
            </button>
            <button className="ev-btn quiet" type="button" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {live.length ? (
        <ul className="ta-ctle-list">
          {live.map((e) => (
            <li key={e.id} data-counted={e.approved ? "true" : "false"}>
              <div>
                <strong>{e.title}</strong>
                <span className="ev-muted">
                  {dateLabel(e.taken_on)}
                  {e.sponsor ? ` · ${e.sponsor}` : ""}
                  {e.language ? " · language acquisition" : ""}
                  {e.certificate ? " · certificate on file" : ""}
                </span>
              </div>
              <div className="ta-ctle-right">
                <strong>{hoursLabel(e.hours)} h</strong>
                {e.approved ? null : <span className="ev-badge amber">personal record</span>}
                <button className="ev-btn quiet sm" type="button" onClick={() => void remove(e.id)} disabled={busy === e.id} aria-label={`Remove ${e.title}`}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ev-muted">Nothing logged yet. Add a session when you finish one, with the date, the hours and who ran it.</p>
      )}

      <p className="ev-note">
        <strong>This is your own record, not NYSED&rsquo;s.</strong> Only hours from an approved CTLE sponsor count toward your requirement, and your sponsor&rsquo;s certificate is the proof. Keep your certificates. Only you can see this page. If you choose to be counted in your school&rsquo;s anonymous totals, your school lead sees a rounded percentage of teachers on pace, never your hours or your name.
      </p>
    </section>
  );
}
