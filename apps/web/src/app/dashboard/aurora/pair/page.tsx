import Link from "next/link";
import { AdjustRequest } from "@/components/teacher/adjust-request";
import { Icon } from "@/components/teacher/icons";
import { OpenChat, OpenVisit } from "@/components/teacher/open-events";
import { PairTabs } from "@/components/teacher/pair-tabs";
import { DateBlock, Stamp } from "@/components/teacher/stamp";
import { loadTeacher } from "@/lib/teacher/load";
import { agoLabel, daysSince } from "@/lib/teacher/model";
import { DOMAIN_LABEL } from "@/lib/domains";

const BASE = "/dashboard/aurora";

export default async function PairPage() {
  const data = await loadTeacher();
  if (!data.model) return null;
  const { model } = data;
  const now = new Date();

  return (
    <main className="ev-main">
      <header className="ta-hello">
        <p className="ev-eyebrow">My partnership</p>
        <h1>
          Support works <em>better together</em>.
        </h1>
        <p className="ev-lead">A quiet place to understand and look after your mentoring partnership.</p>
      </header>
      <PairTabs current="partnership" />

      {model.partners.length === 0 ? (
        <section className="ev-empty">
          <h3>No partner yet</h3>
          <p className="ev-muted">Your school lead is still pairing the faculty. When your partner is confirmed they will appear here, with what you two have in common.</p>
        </section>
      ) : (
        model.partners.map((p) => {
          const together = model.entries.filter((e) => e.status === "submitted" && (e.pairingId ? e.pairingId === p.pairingId : e.partnerName === p.name)).slice(0, 3);
          return (
            <div className="ta-pairgrid" key={p.pairingId}>
              <section className="ev-panel ta-pair">
                <div className="ta-pair-top">
                  <span className="ta-avatar-lg" aria-hidden>{p.initials}</span>
                  <div>
                    <span className="ev-badge">Active partnership</span>
                    <h2>{p.name}</h2>
                    <p className="ev-muted">{p.department}</p>
                  </div>
                  <div className="ta-pair-actions">
                    <Link className="ev-btn primary" href={`${BASE}/journal?with=${p.pairingId}#log`}>
                      <Icon name="message" size={16} /> Log a conversation
                    </Link>
                    <OpenChat pairingId={p.pairingId}><Icon name="chat" size={16} /> Message {p.first}</OpenChat>
                    <OpenVisit pairingId={p.pairingId}><Icon name="video" size={16} /> Visit screen</OpenVisit>
                  </div>
                </div>

                <dl className="ta-facts">
                  <div><dt>How you work together</dt><dd>{p.visitsMe ? `${p.first} visits your classroom` : `You visit ${p.first}'s classroom`}</dd></div>
                  <div><dt>Shared focus</dt><dd>{p.domainLabel ?? "Not set yet"}</dd></div>
                  <div><dt>Entries together</dt><dd>{p.conversations}</dd></div>
                  <div><dt>Last entry</dt><dd>{agoLabel(daysSince(p.lastAt, now))}</dd></div>
                </dl>

                <div className="ta-common">
                  <p className="ev-eyebrow">What you have in common</p>
                  {p.shared.length > 0 ? (
                    <p>
                      You&rsquo;re both strong in <b>{p.shared.map((d) => DOMAIN_LABEL[d]).join(" and ")}</b>, so this is peer coaching rather than teaching.
                      {p.contrast ? <> You come at it as a <b>{model.me.archetype}</b>; {p.first} comes at it as a <b>{p.archetype}</b>.</> : null}
                    </p>
                  ) : p.contrast ? (
                    <p>
                      You come at it as a <b>{model.me.archetype}</b>; {p.first} comes at it as a <b>{p.archetype}</b>. Different angles are what make a pair useful.
                    </p>
                  ) : (
                    <p className="ev-muted">Your strengths don&rsquo;t overlap, which makes for a lot to learn from each other.</p>
                  )}
                  <div className="ta-chiprow">
                    <span className="ta-label">{p.first} is strong in</span>
                    {p.theirDomains.map((d) => <span className="ev-tag" key={d}>{DOMAIN_LABEL[d]}</span>)}
                  </div>
                  {p.styleLine ? <p className="ev-small">Teaching style: {p.styleLine}</p> : null}
                </div>

                <div className="ta-recent">
                  <div className="ta-between">
                    <p className="ev-eyebrow">Recent connections</p>
                    <small className="ev-muted"><Icon name="lock" size={12} /> Visible only to you</small>
                  </div>
                  {together.length === 0 ? (
                    <p className="ev-muted">Nothing written down yet. Your first entry will show up here.</p>
                  ) : (
                    <ul>
                      {together.map((e) => {
                        return (
                          <li key={e.id}>
                            <DateBlock iso={e.at} />
                            <div>
                              <strong>{e.domainLabel}</strong>
                              <small className="ev-muted">{e.direction === "visitsMe" ? "They observed you" : "You observed them"} · <Stamp iso={e.at} kind="time" /></small>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
              <AdjustRequest partnerFirst={p.first} />
            </div>
          );
        })
      )}

      <section className="ev-panel ta-you">
        <p className="ev-eyebrow">How you show up</p>
        <p className="ev-muted">This is what your co-mentors see. Strengths are tags you chose, not scores.</p>
        <dl className="ta-facts">
          <div><dt>Strong in</dt><dd>{model.me.domains.length ? model.me.domains.map((d) => DOMAIN_LABEL[d]).join(", ") : "Not set yet"}</dd></div>
          <div><dt>Teaching style</dt><dd>{model.me.style ? `${model.me.style.label}: ${model.me.style.tagline}` : "Not set yet"}</dd></div>
          <div><dt>Archetype</dt><dd>{model.me.archetype ?? "Not set yet"}</dd></div>
        </dl>
        {model.me.inspiration ? <blockquote className="ta-quote sm">{model.me.inspiration}</blockquote> : null}
      </section>
    </main>
  );
}
