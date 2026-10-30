import { DOMAIN_LABEL } from "@/lib/domains";
import { hueFor, type Card } from "@/lib/teacher/lookbook";

/** A monogram on a colour that stays the same for that name. There are no photos: a teacher's visible profile is name, department and strengths. */
export function CardPhoto({ card, className = "" }: { card: Pick<Card, "name" | "initials">; className?: string }) {
  const h = hueFor(card.name);
  return (
    <div className={`ta-photo ${className}`} style={{ "--h1": h, "--h2": h + 38 } as React.CSSProperties} data-photo="false" aria-hidden>
      <i className="ta-photo-ring r1" />
      <i className="ta-photo-ring r2" />
      <span className="ta-monogram">{card.initials}</span>
    </div>
  );
}

const pill = (n: number, total: number) => (total > n ? `+${total - n}` : null);

/** The card as it appears in the grid: name, department, strengths. */
export function LookbookCard({ card, badge, onOpen }: { card: Card; badge?: string; onOpen?: () => void }) {
  const doms = card.domains.slice(0, 2);
  return (
    <button type="button" className="ta-lb-card" onClick={onOpen} aria-label={`${card.name}${card.department ? `, ${card.department}` : ""}. Open card`} disabled={!onOpen}>
      <CardPhoto card={card} className="fill" />
      {badge ? <span className="ta-lb-badge">{badge}</span> : null}
      <div className="ta-lb-body">
        <h3>{card.name}</h3>
        <p className="ta-lb-role">{card.department || "Teacher"}</p>
        {doms.length ? (
          <div className="ta-lb-chips" aria-label="Strong in">
            {doms.map((d) => (
              <span key={d}>{DOMAIN_LABEL[d]}</span>
            ))}
            {pill(2, card.domains.length) ? <span>{pill(2, card.domains.length)}</span> : null}
          </div>
        ) : null}
      </div>
    </button>
  );
}

/** The full card: the same three things, and nothing more. */
export function CardDetail({ card, note }: { card: Card; note?: React.ReactNode }) {
  return (
    <div className="ta-lb-detail-grid">
      <div className="ta-lb-detail-photo">
        <CardPhoto card={card} className="tall" />
      </div>
      <div className="ta-lb-detail-main">
        <p className="ev-eyebrow">{card.department || "Teacher"}</p>
        <h2>{card.name}</h2>
        {note}
        {card.domains.length || card.strengthTags.length ? (
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
            <p className="ev-small">Strengths are shown as a set, never as a ranking.</p>
          </section>
        ) : (
          <p className="ev-muted">No strengths on this profile yet.</p>
        )}
      </div>
    </div>
  );
}
