import type { ReactNode } from "react";
import SiteHeader from "@/components/SiteHeader";
import AdminTabs from "./admin-tabs";

/** The frame of a leadership page in Nick's look: his header, the tabs, and his page heading. */
export function NickPage({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="wrap adm">
        <AdminTabs />
        <header className="adm-head" style={{ marginTop: 22 }}>
          <p className="mono adm-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {sub && <p className="adm-sub">{sub}</p>}
        </header>
        {children}
      </main>
    </>
  );
}

export function NickDenied() {
  return (
    <>
      <SiteHeader />
      <main className="wrap adm-denied">
        <h1>Leadership dashboard</h1>
        <p>This page is for school leadership. Your account doesn’t have admin access.</p>
      </main>
    </>
  );
}

export function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="adm-metric">
      <span className="mono">{label}</span>
      <b>{value}</b>
      <span className="adm-metric-note">{note}</span>
    </div>
  );
}

export function Bar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <li className="adm-bar">
      <div className="adm-bar-top">
        <span>{label}</span>
        <span className="mono">
          {value}
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      <div className="adm-track">
        <i style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}
