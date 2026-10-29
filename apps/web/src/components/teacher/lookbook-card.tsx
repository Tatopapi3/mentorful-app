import { DOMAIN_LABEL } from "@/lib/domains";
import { hueFor, type Card } from "@/lib/teacher/lookbook";
import { Icon } from "./icons";

/** A teacher's photo, or, when they haven't shared one, a monogram on a colour that stays the same for that name. */
export function CardPhoto({ card, className = "" }: { card: Pick<Card, "name" | "initials" | "photoUrl">; className?: string }) {
  const h = hueFor(card.name);
  return (
    <div
      className={`ta-photo ${className}`}
      style={card.photoUrl ? { backgroundImage: `url(${card.photoUrl})` } : ({ "--h1": h, "--h2": h + 38 } as React.CSSProperties)}
      data-photo={card.photoUrl ? "true" : "false"}
      aria-hidden
    >
      {card.photoUrl ? null : (
        <>
          <i className="ta-photo-ring r1" />
          <i className="ta-photo-ring r2" />
          <span className="ta-monogram">{card.initials}</span>
        </>
      )}
    </div>
  );
}

const pill = (n: number, total: number) => (total > n ? `+${total - n}` : null);

/** The card as it appears in the grid. Used for real cards and for the editor's live preview. */
export function LookbookCard({ card, badge, onOpen, selected }: { card: Card; badge?: string; onOpen?: () => void; selected?: boolean }) {
  const doms = card.domains.slice(0, 3);
  return (
    <button type="button" className="ta-lb-card" onClick={onOpen} aria-label={`${card.name}${card.headline ? `, ${card.headline}` : ""}. Open card`} data-selected={selected} disabled={!onOpen}>
      <CardPhoto card={card} className="fill" />
      {badge ? <span className="ta-lb-badge">{badge}</span> : null}
      <div className="ta-lb-body">
        <h3>{card.name}</h3>
        <p className="ta-lb-role">
          {card.headline || card.department || "Teacher"}
          {card.headline && card.department ? <span> · {card.department}</span> : null}
        </p>
        {card.bio ? <p className="ta-lb-bio">{card.bio}</p> : null}
        {doms.length ? (
          <div className="ta-lb-chips" aria-label="Strong in">
            {doms.map((d) => (
              <span key={d}>{DOMAIN_LABEL[d]}</span>
            ))}
            {pill(3, card.domains.length) ? <span>{pill(3, card.domains.length)}</span> : null}
          </div>
        ) : null}
        {card.wants.length ? (
          <div className="ta-lb-wants" aria-label="Looking for">
            {card.wants.slice(0, 2).map((w) => (
              <span key={w}>{w}</span>
            ))}
            {pill(2, card.wants.length) ? <span>{pill(2, card.wants.length)}</span> : null}
          </div>
        ) : null}
      </div>
    </button>
  );
}

/** The full card: everything a teacher chose to share. */
export function CardDetail({ card, note }: { card: Card; note?: React.ReactNode }) {
  return (
    <div className="ta-lb-detail-grid">
      <div className="ta-lb-detail-photo">
        <CardPhoto card={card} className="tall" />
        {card.inspiration ? <blockquote className="ta-quote sm">{card.inspiration}</blockquote> : null}
      </div>
      <div className="ta-lb-detail-main">
        <p className="ev-eyebrow">{card.department || "Teacher"}{card.yearsTeaching !== null ? ` · ${card.yearsTeaching} ${card.yearsTeaching === 1 ? "year" : "years"} teaching` : ""}</p>
        <h2>{card.name}</h2>
        {card.headline ? <p className="ta-lb-headline">{card.headline}</p> : null}
        {card.bio ? <p className="ta-lb-longbio">{card.bio}</p> : null}
        {note}

        {card.domains.length || card.strengthTags.length || card.style ? (
          <section>
            <h3>Strengths</h3>
            <div className="ta-lb-tags">
              {card.domains.map((d) => (
                <span className="ev-badge" key={d}>{DOMAIN_LABEL[d]}</span>
              ))}
              {card.strengthTags.map((t) => (
                <span className="ev-tag" key={t}>{t}</span>
              ))}
            </div>
            {card.style || card.archetype ? <p className="ev-small">{card.style ? `${card.style.label}: ${card.style.tagline}` : ""}{card.style && card.archetype ? " · " : ""}{card.archetype ? `${card.archetype}` : ""}</p> : null}
          </section>
        ) : null}

        {card.experience.length ? (
          <section>
            <h3>Experience</h3>
            <ol className="ta-lb-exp">
              {card.experience.map((e, i) => (
                <li key={i}>
                  <strong>{e.role || e.place}</strong>
                  <small className="ev-muted">{[e.role ? e.place : "", e.years].filter(Boolean).join(" · ")}</small>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {card.achievements.length ? (
          <section>
            <h3>Achievements</h3>
            <ul className="ta-lb-ach">
              {card.achievements.map((a) => (
                <li key={a}>
                  <Icon name="trophy" size={15} />
                  {a}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {card.growingIn.length ? (
          <section>
            <h3>Currently growing in</h3>
            <div className="ta-lb-tags">
              {card.growingIn.map((g) => (
                <span className="ev-tag" key={g}>{g}</span>
              ))}
            </div>
            <p className="ev-small">In their own words, shared by them.</p>
          </section>
        ) : null}

        {card.wants.length || card.wantsText ? (
          <section>
            <h3>What I want out of Mentorful</h3>
            {card.wants.length ? (
              <div className="ta-lb-tags">
                {card.wants.map((w) => (
                  <span className="ev-badge amber" key={w}>{w}</span>
                ))}
              </div>
            ) : null}
            {card.wantsText ? <p className="ta-lb-wants-text">{card.wantsText}</p> : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
