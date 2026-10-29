import { Composers } from "@/components/teacher/composers";
import { FutureNoteList } from "@/components/teacher/future-notes";
import { DateBlock, Stamp } from "@/components/teacher/stamp";
import { loadHub } from "@/lib/teacher/hub-data";
import { Icon } from "@/components/teacher/icons";
import { submitEntry } from "../actions";
import { loadTeacher } from "@/lib/teacher/load";
import type { Entry } from "@/lib/teacher/model";

// The notebook opens on the latest few entries; the rest are one tap away.
const RECENT = 4;

function EntryView({ e }: { e: Entry }) {
  const submittedLater = e.submittedAt && Date.parse(e.submittedAt) - Date.parse(e.createdAt) > 120_000;
  const fields: [string, string | null][] = [
    ["Working toward", e.vision],
    ["Noticed working", e.strength],
    ["More of", e.more],
    ["Less of", e.less],
    ["Swapping", e.resources],
  ];
  return (
    <article className="ev-entry" data-draft={e.status === "draft"}>
      {e.status === "draft" ? <span className="ev-date"><strong>…</strong>DRAFT</span> : <DateBlock iso={e.at} />}
      <div>
        <div className="ta-entry-head">
          <span className="ev-badge">{e.domainLabel}</span>
          <small className="ev-muted">
            {e.direction === "visitsMe" ? "They observed you" : "You observed them"} · {e.partnerName}
          </small>
        </div>
        <p className="ta-stamps">
          {e.status === "draft" ? (
            <>Started <Stamp iso={e.createdAt} kind="long" /></>
          ) : (
            <>
              Logged <Stamp iso={e.createdAt} kind="long" />
              {submittedLater ? <> · submitted <Stamp iso={e.submittedAt!} kind="datetime" /></> : null}
            </>
          )}
        </p>
        {fields.filter(([, v]) => v).map(([k, v]) => (
          <div className="ta-field" key={k}>
            <span className="ta-label">{k}</span>
            <p>{v}</p>
          </div>
        ))}
        {e.status === "draft" && e.mine ? (
          <form action={submitEntry}>
            <input type="hidden" name="log_id" value={e.id} />
            <button className="ev-btn sm primary" type="submit">Submit this entry</button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ with?: string; prefill?: string; tab?: string }> }) {
  const data = await loadTeacher();
  if (!data.model) return null;
  const { model } = data;
  const { with: withPair, prefill, tab } = await searchParams;
  const hub = await loadHub();
  const serverToday = new Date().toISOString().slice(0, 10);

  return (
    <main className="ev-main ev-wide">
      <header className="ta-hello">
        <p className="ev-eyebrow">Journal</p>
        <h1>
          Write it down while it&rsquo;s <em>fresh</em>.
        </h1>
        <p className="ev-lead">Private to you and the colleague in each conversation. Your school lead sees how many conversations happened and in which areas, never what was said.</p>
      </header>

      <div className="ta-journal">
        <Composers
          pairs={model.partners.map((p) => ({ id: p.pairingId, partnerName: p.name, partnerFirst: p.first, domain: p.domain, visitsMe: p.visitsMe }))}
          defaultPairing={withPair}
          prefill={prefill?.slice(0, 400)}
          initialTab={tab === "future" ? "future" : "log"}
          serverToday={serverToday}
          cycleEnds={model.cycle?.ends?.slice(0, 10) ?? null}
          hubReady={hub.ready}
        />

        <div className="ta-journal-side">
        <FutureNoteList notes={hub.notes} serverToday={serverToday} />
        <section className="ev-notebook" id="notebook" aria-labelledby="ta-nb">
          <div className="ev-notebook-head">
            <div>
              <h2 id="ta-nb">Your private notebook</h2>
              <p className="ev-privacy">
                <Icon name="lock" size={13} /> {model.entries.length} {model.entries.length === 1 ? "entry" : "entries"}, visible only to you and your co-mentors
              </p>
            </div>
          </div>
          {model.byDomain.length > 0 ? (
            <div className="ta-bydomain" aria-label="Conversations this cycle by area">
              {model.byDomain.map((b) => (
                <span className="ev-tag" key={b.domain}>{b.label} · {b.n}</span>
              ))}
            </div>
          ) : null}
          {model.entries.length === 0 ? (
            <p className="ev-empty ta-nb-empty">Nothing written down yet. Your first entry will appear here.</p>
          ) : (
            <>
              {model.entries.slice(0, RECENT).map((e) => <EntryView e={e} key={e.id} />)}
              {model.entries.length > RECENT ? (
                <details className="ta-older">
                  <summary>Show {model.entries.length - RECENT} older {model.entries.length - RECENT === 1 ? "entry" : "entries"}</summary>
                  {model.entries.slice(RECENT).map((e) => <EntryView e={e} key={e.id} />)}
                </details>
              ) : null}
            </>
          )}
        </section>
        </div>
      </div>
    </main>
  );
}
