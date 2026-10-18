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
