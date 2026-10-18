import Link from "next/link";
import type { ReactNode } from "react";
import { NickPage } from "@/components/nick/page";

/**
 * A few building blocks that draw the same content in either look. Each page is written once and passes its
 * skin; the leadership views come in Nick's look (under /admin) and the Aurora look (under /admin/aurora).
 */
export type Skin = "nick" | "aurora";
export const basePath = (skin: Skin) => (skin === "nick" ? "/admin" : "/admin/aurora");

export function AdminFrame({ skin, eyebrow, title, sub, children }: { skin: Skin; eyebrow: string; title: string; sub?: ReactNode; children: ReactNode }) {
  if (skin === "nick") return <NickPage eyebrow={eyebrow} title={title} sub={sub}>{children}</NickPage>;
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
  if (skin === "nick") {
    return (
      <section className="adm-card">
        <div className="adm-card-head">
          <h2>{title}</h2>
          {count !== undefined && <span className="mono adm-count">{count}</span>}
        </div>
        {children}
      </section>
    );
  }
  return (
    <section className="ev-panel" style={{ marginTop: 22 }}>
      {(eyebrow || count !== undefined) && <p className="ev-eyebrow">{[eyebrow, count].filter((x) => x !== undefined && x !== "").join(" · ")}</p>}
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Chip({ skin, tone, children }: { skin: Skin; tone?: "amber"; children: ReactNode }) {
  if (skin === "nick") return <span className={`nk-chip${tone === "amber" ? " nk-do" : ""}`}>{children}</span>;
  return <span className={`ev-badge${tone === "amber" ? " amber" : ""}`}>{children}</span>;
}

export function Row({ skin, chip, title, detail, children }: { skin: Skin; chip?: ReactNode; title: ReactNode; detail?: ReactNode; children?: ReactNode }) {
  if (skin === "nick") {
    return (
      <div className="nk-row">
        <div>
          {chip}
          <b>{title}</b>
          {detail && <span className="adm-why">{detail}</span>}
        </div>
        {children && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>}
      </div>
    );
  }
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

const btnClass = (skin: Skin, primary?: boolean) => (skin === "nick" ? `nk-btn${primary ? " nk-primary" : ""}` : `ev-btn sm${primary ? " primary" : ""}`);

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

export function Notice({ skin, kind, children }: { skin: Skin; kind: "notice" | "error"; children: ReactNode }) {
  const color = kind === "error" ? "#a3243b" : skin === "nick" ? "var(--teal-dk)" : "var(--ev-teal)";
  return (
    <p role="status" style={{ margin: "0 0 16px", padding: "10px 14px", borderLeft: `4px solid ${color}`, background: skin === "nick" ? "var(--card)" : "var(--ev-panel)", borderRadius: 4, fontSize: 14 }}>
      {children}
    </p>
  );
}

export function Muted({ skin, children }: { skin: Skin; children: ReactNode }) {
  return skin === "nick" ? <p className="adm-foot">{children}</p> : <p className="ev-small">{children}</p>;
}

/** Switch which cycle the numbers describe. Shown only when the school has more than one. */
export function CycleSwitcher({ skin, cycles, selectedId, path }: { skin: Skin; cycles: { id: string; name: string; status: string }[]; selectedId: string | null; path: string }) {
  if (cycles.length < 2) return null;
  if (skin === "nick") {
    return (
      <p style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "0 0 18px" }}>
        <span className="mono adm-eyebrow" style={{ margin: 0 }}>Cycle</span>
        {cycles.map((c) => (
          <Link key={c.id} href={`${path}?cycle=${c.id}`} className={`nk-btn${c.id === selectedId ? " nk-primary" : ""}`} prefetch={false}>
            {c.name}
          </Link>
        ))}
      </p>
    );
  }
  return (
    <div className="ev-tabs" role="group" aria-label="Cycle" style={{ margin: "0 0 18px" }}>
      {cycles.map((c) => (
        <Link key={c.id} href={`${path}?cycle=${c.id}`} aria-current={c.id === selectedId ? "page" : undefined} prefetch={false}>
          {c.name}
        </Link>
      ))}
    </div>
  );
}

export function StatGrid({ skin, items }: { skin: Skin; items: { label: string; value: string; note: string }[] }) {
  if (skin === "nick") {
    return (
      <section className="adm-metrics" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 5)}, 1fr)` }}>
        {items.map((i) => (
          <div key={i.label} className="adm-metric">
            <span className="mono">{i.label}</span>
            <b>{i.value}</b>
            <span className="adm-metric-note">{i.note}</span>
          </div>
        ))}
      </section>
    );
  }
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
  if (skin === "nick") {
    return (
      <ul className="adm-bars">
        {rows.map((r) => (
          <li key={r.label} className="adm-bar">
            <div className="adm-bar-top">
              <span>{r.label}</span>
              <span className="mono">
                {r.value}
                {suffix ?? ""}
              </span>
            </div>
            <div className="adm-track">
              <i style={{ width: `${Math.round((r.value / top) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    );
  }
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
