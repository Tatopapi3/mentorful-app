/* The `skin` props are kept so every page and component call site stays as it was; there is one skin now, so most ignore it. */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A few building blocks the leadership pages share. The pages still pass a `skin`, which is now always "aurora"
 * (the leadership area once came in three looks; the choice was made and the others were removed).
 */
export type Skin = "aurora";
export const basePath = (_skin?: Skin) => "/admin" as const;

export function AdminFrame({ skin, eyebrow, title, sub, children }: { skin: Skin; eyebrow: string; title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <main className="ev-main ev-wide">
      <p className="ev-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {sub && <p className="ev-lead">{sub}</p>}
      {children}
    </main>
  );
}

export function Panel({ skin, title, count, eyebrow, children }: { skin: Skin; title: string; count?: ReactNode; eyebrow?: string; children: ReactNode }) {
  return (
    <section className="ev-panel" style={{ marginTop: 22 }}>
      {(eyebrow || count !== undefined) && <p className="ev-eyebrow">{[eyebrow, count].filter((x) => x !== undefined && x !== "").join(" · ")}</p>}
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Chip({ skin, tone, children }: { skin: Skin; tone?: "amber"; children: ReactNode }) {
  return <span className={`ev-badge${tone === "amber" ? " amber" : ""}`}>{children}</span>;
}

export function Row({ skin, chip, title, detail, children }: { skin: Skin; chip?: ReactNode; title: ReactNode; detail?: ReactNode; children?: ReactNode }) {
  return (
    <div className="ev-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ maxWidth: 720 }}>
        {chip}
        <strong style={{ display: "block", fontWeight: 600, margin: "8px 0 2px" }}>{title}</strong>
        {detail && <small>{detail}</small>}
      </div>
      {children && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>}
    </div>
  );
}

const btnClass = (_skin: Skin, primary?: boolean) => `ev-btn sm${primary ? " primary" : ""}`;

export function LinkBtn({ skin, href, primary, children }: { skin: Skin; href: string; primary?: boolean; children: ReactNode }) {
  return (
    <Link href={href} className={btnClass(skin, primary)} prefetch={false}>
      {children}
    </Link>
  );
}

export function SubmitBtn({ skin, primary, children }: { skin: Skin; primary?: boolean; children: ReactNode }) {
  return (
    <button type="submit" className={btnClass(skin, primary)}>
      {children}
    </button>
  );
}

export function Notice({ kind, children }: { skin: Skin; kind: "notice" | "error"; children: ReactNode }) {
  const color = kind === "error" ? "#a3243b" : "var(--ev-teal)";
  return (
    <p role="status" style={{ margin: "0 0 16px", padding: "10px 14px", borderLeft: `4px solid ${color}`, background: "var(--ev-panel)", borderRadius: 4, fontSize: 14 }}>
      {children}
    </p>
  );
}

export function Muted({ children }: { skin?: Skin; children: ReactNode }) {
  return <p className="ev-small">{children}</p>;
}

/** The small shield that says the whole view is privacy-protected. Drawn in each look's own tokens. */
export function PrivacyPill() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 13px", border: "1px solid var(--ev-line, var(--line))", borderRadius: 999, fontSize: 12.5, whiteSpace: "nowrap", color: "var(--ev-teal, var(--teal-dk))", background: "var(--ev-panel-solid, var(--card))" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
      Privacy-protected view · groups under 5 are hidden
    </span>
  );
}

/** Switch which cycle the numbers describe (shown only when the school has more than one), beside the privacy pill. */
export function CycleSwitcher({ skin, cycles, selectedId, path }: { skin: Skin; cycles: { id: string; name: string; status: string }[]; selectedId: string | null; path: string }) {
  const switcher =
    cycles.length < 2 ? null : (
      <div className="ev-tabs" role="group" aria-label="Cycle" style={{ margin: 0 }}>
        {cycles.map((c) => (
          <Link key={c.id} href={`${path}?cycle=${c.id}`} aria-current={c.id === selectedId ? "page" : undefined} prefetch={false}>
            {c.name}
          </Link>
        ))}
      </div>
    );
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "0 0 18px" }}>
      {switcher ?? <span />}
      <PrivacyPill />
    </div>
  );
}

export function StatGrid({ skin, items }: { skin: Skin; items: { label: string; value: string; note: string }[] }) {
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, margin: "6px 0 18px" }}>
      {items.map((i) => (
        <div key={i.label} className="ev-panel" style={{ padding: "16px 18px" }}>
          <small style={{ textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 10.5 }}>{i.label}</small>
          <strong style={{ display: "block", font: "600 28px var(--ev-display)", letterSpacing: "-0.04em", margin: "4px 0 2px" }}>{i.value}</strong>
          <small>{i.note}</small>
        </div>
      ))}
    </section>
  );
}

export function BarList({ skin, rows, max, suffix }: { skin: Skin; rows: { label: string; value: number }[]; max?: number; suffix?: string }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} style={{ margin: "12px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span>{r.label}</span>
            <strong style={{ fontWeight: 600 }}>
              {r.value}
              {suffix ?? ""}
            </strong>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: "var(--ev-soft)", marginTop: 6 }}>
            <div style={{ width: `${Math.round((r.value / top) * 100)}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#5eead4,#818cf8)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
