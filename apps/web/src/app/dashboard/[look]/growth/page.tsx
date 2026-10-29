import { Icon } from "@/components/teacher/icons";
import { GamesHub, GoalsPanel, PracticeLog, SharingCard, SuggestionCard } from "@/components/teacher/growth-hub";
import { TimeCard } from "@/components/teacher/time-card";
import { loadHub } from "@/lib/teacher/hub-data";
import { loadTeacher } from "@/lib/teacher/load";
import { practiceTotals, suggestionsFrom } from "@/lib/teacher/hub";

// Bertrand's "Mentorful products", in his words and his order.
const PRODUCTS = [
  { name: "School Culture Scan", text: "Where your faculty stands: structure, relationships, shared knowledge, collective efficacy. Full network report and a findings session.", current: true },
  { name: "Teacher Diagnostic PD", text: "A workshop that gets a faculty to see itself. Teachers leave with a partner and a first conversation scheduled." },
  { name: "Initiative Launch Playbook", text: "Co-mentoring as the infrastructure a rollout travels through. Early adopters paired with skeptics, deliberately." },
  { name: "PLC Facilitator Certification", text: "Six weeks, cohort-based. Clinic, Toolbox, Task Force, Data Dive, with a portfolio of facilitated sessions." },
  { name: "Data Analysis Certification", text: "Read a network report, interpret what it says about your faculty, make decisions you can defend." },
  { name: "Leadership Strategy Consulting", text: "Longer-horizon work across a leadership team or a district. Network architecture and internal capacity." },
];

export default async function GrowthPage() {
  const data = await loadTeacher();
  if (!data.model) return null;
  const { model } = data;
  const hub = await loadHub();
  const serverToday = new Date().toISOString().slice(0, 10);
  const suggestions = suggestionsFrom(model.entries);
  const pairs = model.partners.map((p) => ({ pairingId: p.pairingId, partnerFirst: p.first }));

  return (
    <main className="ev-main ev-wide">
      <header className="ta-hello">
        <p className="ev-eyebrow">Growth hub</p>
        <h1>
          Your work on <em>getting better</em>.
        </h1>
        <p className="ev-lead">A private place to set goals, practise with your co-mentor, see where your time goes, and keep a record of how you&rsquo;re growing. Nothing here is scored, and none of it is evaluative.</p>
      </header>

      {!hub.ready ? (
        <p className="ev-hold">Parts of the hub (chat, games, goals, notes and time) aren&rsquo;t switched on for your school yet. Your school lead needs to apply the update first. Everything else works as usual.</p>
      ) : null}

      <div className="ta-hubgrid">
        <TimeCard rows={hub.time} serverToday={serverToday} ready={hub.ready} sharing={hub.sharing.on} />
        <SuggestionCard items={suggestions} />
      </div>

      <GamesHub pairs={pairs} games={hub.games} ready={hub.ready} />

      <div className="ta-hubgrid">
        <GoalsPanel goals={hub.goals} entries={hub.practice} ready={hub.ready} />
        <PracticeLog entries={hub.practice} goals={hub.goals} ready={hub.ready} totals={practiceTotals(hub.practice, new Date())} />
      </div>

      <SharingCard on={hub.sharing.on} ready={hub.sharing.ready} />

      <section className="ev-panel" aria-labelledby="ta-more-h">
        <div className="ta-between">
          <div>
            <p className="ev-eyebrow">What we offer</p>
            <h2 id="ta-more-h">More from Mentorful</h2>
          </div>
          <a className="ev-btn quiet sm" href="https://mentorful.co/#products" target="_blank" rel="noopener noreferrer">
            mentorful.co <Icon name="external" size={14} />
          </a>
        </div>
        <p className="ev-muted">Start anywhere. Most schools build from left to right. Every one works on its own; together they build.</p>
        <ol className="ta-prods">
          {PRODUCTS.map((p) => (
            <li key={p.name} data-current={p.current ? "true" : undefined}>
              <a href="https://mentorful.co/#products" target="_blank" rel="noopener noreferrer">
                <h3>{p.name}</h3>
                <p>{p.text}</p>
                {p.current ? <span className="ev-badge">You&rsquo;re here</span> : null}
              </a>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
