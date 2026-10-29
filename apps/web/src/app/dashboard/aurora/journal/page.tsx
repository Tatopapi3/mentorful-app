import { LogComposer } from "@/components/teacher/log-composer";
import { Icon } from "@/components/teacher/icons";
import { submitEntry } from "../actions";
import { loadTeacher } from "@/lib/teacher/load";
import type { Entry } from "@/lib/teacher/model";

const dateBlock = (iso: string) => {
  const d = new Date(iso);
  return { m: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(), d: d.getDate(), y: d.getFullYear() };
};

function EntryView({ e }: { e: Entry }) {
  const d = dateBlock(e.at);
  const fields: [string, string | null][] = [
    ["Working toward", e.vision],
    ["Noticed working", e.strength],
    ["More of", e.more],
    ["Less of", e.less],
    ["Swapping", e.resources],
  ];
  return (
    <article className="ev-entry" data-draft={e.status === "draft"}>
      {e.status === "draft" ? <span className="ev-date"><strong>…</strong>DRAFT</span> : <span className="ev-date"><strong>{d.d}</strong>{d.m}</span>}
      <div>
        <div className="ta-entry-head">
          <span className="ev-badge">{e.domainLabel}</span>
          <small className="ev-muted">
            {e.direction === "visitsMe" ? "They observed you" : "You observed them"} · {e.partnerName}
            {e.status === "submitted" ? ` · ${d.y}` : ""}
          </small>
        </div>
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

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const data = await loadTeacher();
  if (!data.model) return null;
  const { model } = data;
  const { with: withPair } = await searchParams;

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
        <LogComposer
          pairs={model.partners.map((p) => ({ id: p.pairingId, partnerName: p.name, partnerFirst: p.first, domain: p.domain, visitsMe: p.visitsMe }))}
          defaultPairing={withPair}
        />

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
            model.entries.map((e) => <EntryView e={e} key={e.id} />)
          )}
        </section>
      </div>
    </main>
  );
}
