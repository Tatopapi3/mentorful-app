"use client";

import { useEffect, useMemo, useState } from "react";
import { DOMAIN_LABEL, CONCERN_DOMAINS, type ConcernDomain } from "@/lib/domains";
import { NO_FILTERS, activeFilters, facetCounts, filterCards, paginate, type Card, type Filters } from "@/lib/teacher/lookbook";
import { Icon } from "./icons";
import { CardDetail, CardPhoto, LookbookCard } from "./lookbook-card";
import { OpenChat } from "./open-events";
import { Overlay } from "./overlay";

const PER_PAGE = 9;

type View = "grid" | "list";

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function Lookbook({ cards, meId, partnerByProfile, ready }: { cards: Card[]; meId: string; partnerByProfile: Record<string, string>; ready: boolean }) {
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [view, setView] = useState<View>("grid");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const facets = useMemo(() => facetCounts(cards), [cards]);
  const shown = useMemo(() => filterCards(cards, f), [cards, f]);
  const pg = paginate(shown, page, PER_PAGE);
  const set = (patch: Partial<Filters>) => {
    setF((cur) => ({ ...cur, ...patch }));
    setPage(1);
  };
  const badgeFor = (c: Card) => (c.profileId === meId ? "You" : partnerByProfile[c.profileId] ? "Your co-mentor" : undefined);

  // The detail view steps through whoever is currently shown, so filtering and browsing work together.
  const idx = open ? shown.findIndex((c) => c.profileId === open) : -1;
  const current = idx >= 0 ? shown[idx] : null;
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight" && idx < shown.length - 1) setOpen(shown[idx + 1].profileId);
      if (e.key === "ArrowLeft" && idx > 0) setOpen(shown[idx - 1].profileId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, idx, shown]);

  if (!ready) {
    return (
      <section className="ev-empty">
        <h3>The lookbook isn&rsquo;t switched on for your school yet</h3>
        <p className="ev-muted">Your school lead needs to apply the update first. Once it is, you can browse colleagues by department and strength here.</p>
      </section>
    );
  }
  if (cards.length === 0) {
    return (
      <section className="ev-empty">
        <h3>No colleagues to show yet</h3>
        <p className="ev-muted">The lookbook lists colleagues by name, department and strengths. It fills in as teachers join, and anyone can choose to stay out of it.</p>
      </section>
    );
  }

  const n = activeFilters(f);
  const check = (label: string, on: boolean, count: number, change: () => void) => (
    <label className="ta-lb-check" key={label}>
      <input type="checkbox" checked={on} onChange={change} />
      <span>{label}</span>
      <small>{count}</small>
    </label>
  );

  return (
    <div className="ta-lb">
      <aside className={`ta-lb-filters ev-panel${showFilters ? " open" : ""}`} aria-label="Filters">
        <div className="ta-lb-search">
          <Icon name="search" size={16} />
          <input type="search" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search names, departments, strengths…" aria-label="Search the lookbook" />
        </div>
        {n > 0 ? (
          <button type="button" className="ev-btn quiet sm" onClick={() => { setF(NO_FILTERS); setPage(1); }}>
            Clear all filters ({n})
          </button>
        ) : null}
        <fieldset>
          <legend>Strong in</legend>
          {CONCERN_DOMAINS.map((d: ConcernDomain) => check(DOMAIN_LABEL[d], f.domains.includes(d), facets.domains.get(d) ?? 0, () => set({ domains: toggle(f.domains, d) })))}
        </fieldset>
        <fieldset>
          <legend>Department</legend>
          {facets.departments.map(([d, c]) => check(d, f.departments.includes(d), c, () => set({ departments: toggle(f.departments, d) })))}
        </fieldset>
      </aside>

      <section className="ta-lb-main" aria-label="Teacher cards">
        <div className="ta-lb-bar">
          <button type="button" className="ev-btn sm ta-lb-filterbtn" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            <Icon name="filter" size={14} /> Filters{n ? ` (${n})` : ""}
          </button>
          <p className="ta-lb-count">
            <strong>{shown.length}</strong> {shown.length === 1 ? "teacher" : "teachers"}
            {n ? <span className="ev-muted"> of {cards.length}</span> : null}
          </p>
          <span className="ta-spacer" />
          <div className="ta-lb-pager" aria-label="Pages">
            <button type="button" className="ta-iconbtn" onClick={() => setPage(pg.page - 1)} disabled={pg.page <= 1} aria-label="Previous page">
              <Icon name="left" size={16} />
            </button>
            <span>
              <strong>{String(pg.page).padStart(2, "0")}</strong> / {String(pg.pages).padStart(2, "0")} Pages
            </span>
            <button type="button" className="ta-iconbtn" onClick={() => setPage(pg.page + 1)} disabled={pg.page >= pg.pages} aria-label="Next page">
              <Icon name="right" size={16} />
            </button>
          </div>
          <div className="ta-lb-views" role="group" aria-label="View">
            <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")} aria-label="Grid view">
              <Icon name="grid" size={16} />
            </button>
            <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} aria-label="List view">
              <Icon name="list" size={16} />
            </button>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="ev-empty">
            <h3>No one matches those filters</h3>
            <p className="ev-muted">Try removing one, or search for something broader.</p>
            <button type="button" className="ev-btn" onClick={() => { setF(NO_FILTERS); setPage(1); }}>
              Clear all filters
            </button>
          </div>
        ) : view === "grid" ? (
          <div className="ta-lb-grid">
            {pg.items.map((c) => (
              <LookbookCard key={c.profileId} card={c} badge={badgeFor(c)} onOpen={() => setOpen(c.profileId)} />
            ))}
          </div>
        ) : (
          <ul className="ta-lb-list">
            {pg.items.map((c) => (
              <li key={c.profileId}>
                <button type="button" onClick={() => setOpen(c.profileId)} aria-label={`${c.name}. Open card`}>
                  <CardPhoto card={c} className="sm" />
                  <span className="ta-lb-list-main">
                    <strong>{c.name}</strong>
                    <small className="ev-muted">{c.department}</small>
                  </span>
                  <span className="ta-lb-list-tags">
                    {c.domains.slice(0, 2).map((d) => (
                      <span className="ev-badge" key={d}>{DOMAIN_LABEL[d]}</span>
                    ))}
                  </span>
                  {badgeFor(c) ? <span className="ev-badge">{badgeFor(c)}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {current ? (
        <Overlay>
        <div className="ev-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="ta-lb-detail" role="dialog" aria-modal="true" aria-label={`${current.name}'s profile`}>
            <div className="ta-lb-detail-bar">
              <button type="button" className="ta-iconbtn" disabled={idx <= 0} onClick={() => setOpen(shown[idx - 1].profileId)} aria-label="Previous teacher">
                <Icon name="left" size={16} />
              </button>
              <small className="ev-muted">
                {idx + 1} of {shown.length}
              </small>
              <button type="button" className="ta-iconbtn" disabled={idx >= shown.length - 1} onClick={() => setOpen(shown[idx + 1].profileId)} aria-label="Next teacher">
                <Icon name="right" size={16} />
              </button>
              <span className="ta-spacer" />
              <button type="button" className="ta-iconbtn" onClick={() => setOpen(null)} aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </div>
            <CardDetail
              card={current}
              note={
                partnerByProfile[current.profileId] ? (
                  <div className="ta-lb-actions">
                    <span className="ev-badge">Your co-mentor</span>
                    <OpenChat pairingId={partnerByProfile[current.profileId]}>
                      <Icon name="chat" size={16} /> Message
                    </OpenChat>
                  </div>
                ) : current.profileId === meId ? (
                  <div className="ta-lb-actions">
                    <span className="ev-badge">This is you</span>
                  </div>
                ) : null
              }
            />
          </div>
        </div>
        </Overlay>
      ) : null}
    </div>
  );
}