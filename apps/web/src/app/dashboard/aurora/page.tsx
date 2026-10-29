import Link from "next/link";
import { Greeting, Today } from "@/components/teacher/greeting";
import { Icon } from "@/components/teacher/icons";
import { ScanEntry } from "@/components/teacher/scan-card";
import { loadTeacher } from "@/lib/teacher/load";
import { agoLabel, daysSince, nextStep } from "@/lib/teacher/model";
import { DOMAIN_LABEL } from "@/lib/domains";

const BASE = "/dashboard/aurora";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function TeacherHome() {
  const data = await loadTeacher();
  if (!data.model) return null;
  const { model } = data;
  const now = new Date();
  const step = nextStep(model, now);
  const partner = "partner" in step ? step.partner : model.partners[0];
  const ends = model.cycle?.ends ? new Date(model.cycle.ends).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
  const last = daysSince(model.lastAt, now);

  return (
    <main className="ev-main">
      <header className="ta-hello">
        <p className="ev-eyebrow">
          <Today />
          {model.cycle ? ` · ${model.cycle.name}` : ""}
        </p>
        <h1>
          <Greeting first={model.me.first} />
        </h1>
        <p className="ev-lead">What would feel supportive today?</p>
      </header>

      <p className="ev-note ta-privacy">
        <Icon name="lock" size={16} />
        <span>
          <strong>Your conversations are private.</strong> Your school lead sees how many conversations happened and in which areas, never what was said.
        </span>
      </p>

      <section className="ta-hero" aria-labelledby="ta-next">
        <div className="ta-hero-copy">
          <p className="ev-eyebrow">Your next step</p>
          <h2 id="ta-next">{step.title}</h2>
          <p>{step.body}</p>
          {step.kind === "none" ? null : step.kind === "draft" ? (
            <Link className="ev-btn" href={`${BASE}/journal#notebook`}>
              {step.cta} <Icon name="arrow" size={16} />
            </Link>
          ) : (
            <Link className="ev-btn" href={`${BASE}/journal?with=${step.partner.pairingId}#log`}>
              {step.cta} <Icon name="arrow" size={16} />
            </Link>
          )}
        </div>
        <div className="ta-orbit" aria-hidden>
          <i className="ta-ring r1" />
          <i className="ta-ring r2" />
          <span className="ta-bubble a">{model.me.initials}</span>
          {partner ? <span className="ta-bubble b">{partner.initials}</span> : <span className="ta-bubble b ghost">?</span>}
          <span className="ta-orbit-check">
            <Icon name="check" size={16} />
          </span>
        </div>
      </section>

      <div className="ta-kpis">
        <div>
          <strong>{model.conversations}</strong>
          <span>{model.conversations === 1 ? "conversation" : "conversations"} logged this cycle</span>
        </div>
        <div>
          <strong>{model.partners.length}</strong>
          <span>{model.partners.length === 1 ? "co-mentor" : "co-mentors"}</span>
        </div>
        <div>
          <strong>{last === null ? "—" : agoLabel(last)}</strong>
          <span>last entry</span>
        </div>
      </div>

      <div className="ta-grid">
        <section className="ev-panel">
          <p className="ev-eyebrow">A strength noticed in you</p>
          {model.noticed ? (
            <>
              <blockquote className="ta-quote">{model.noticed.text}</blockquote>
              <p className="ev-small">
                {model.noticed.byFirst} wrote this after visiting your classroom on {day(model.noticed.at)}. Only the two of you can see it.
              </p>
            </>
          ) : (
            <p className="ev-muted">When a colleague writes up a visit to your classroom, the strength they noticed appears here first. It is the part that matters most.</p>
          )}
          {model.focus ? (
            <div className="ta-focus">
              <p className="ta-label">How {model.focus.byFirst} described what you&rsquo;re working toward</p>
              <p>{model.focus.text}</p>
            </div>
          ) : null}
        </section>

        <section className="ev-panel">
          <p className="ev-eyebrow">This cycle{ends ? ` · ends ${ends}` : ""}</p>
          <ul className="ta-steps">
            <li data-done={model.steps.hosted}>
              <span><Icon name="check" size={14} /></span>
              <div><strong>A colleague visited you</strong><small>A submitted entry from someone who came to your classroom</small></div>
            </li>
            <li data-done={model.steps.visited}>
              <span><Icon name="check" size={14} /></span>
              <div><strong>You visited a colleague</strong><small>A submitted entry from a visit you made</small></div>
            </li>
            <li data-done={model.steps.debrief}>
              <span><Icon name="check" size={14} /></span>
              <div><strong>You wrote a debrief</strong><small>What you saw working, written down</small></div>
            </li>
          </ul>
          <p className="ev-small">Based on your submitted entries. Nothing here is scored.</p>
        </section>

        <section className="ev-panel">
          <div className="ta-between">
            <p className="ev-eyebrow">Your mentoring partner{model.partners.length > 1 ? "s" : ""}</p>
            <Link className="ev-btn quiet sm" href={`${BASE}/pair`}>
              View partnership
            </Link>
          </div>
          {model.partners.length === 0 ? (
            <p className="ev-muted">Your partner will appear here once your school lead has confirmed the pairing.</p>
          ) : (
            <ul className="ta-people">
              {model.partners.map((p) => (
                <li key={p.pairingId}>
                  <span className="ev-avatar">{p.initials}</span>
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.department}
                      {p.department && p.domainLabel ? " · " : ""}
                      {p.domainLabel ? `Focus: ${p.domainLabel}` : ""}
                    </small>
                    <small>{p.visitsMe ? "Visits your classroom" : "You visit their classroom"}</small>
                  </div>
                  <span className="ev-badge">Active</span>
                </li>
              ))}
            </ul>
          )}
          {partner && partner.shared.length > 0 ? (
            <p className="ta-insight">
              You&rsquo;re both strong in <b>{partner.shared.map((d) => DOMAIN_LABEL[d]).join(" and ")}</b>, so this is peer coaching rather than teaching.
            </p>
          ) : null}
        </section>

        <ScanEntry />
      </div>
    </main>
  );
}
