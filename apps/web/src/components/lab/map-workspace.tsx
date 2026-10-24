"use client";

import { useState, type ReactNode } from "react";

export type Signal = { id: string; tone: "warn" | "alert" | "good"; title: string; detail: string; tab: string };
export type Tab = { id: string; label: string; content: ReactNode };

/**
 * The map study's working area: signals on the left, the faculty in the middle, and a drawer on the right whose tab
 * a signal opens. Clicking "pairs are cooling" takes you to the early-warning tab; the panels themselves are
 * rendered on the server and handed in, so this only decides what is showing.
 */
export default function MapWorkspace({ signals, tabs, children }: { signals: Signal[]; tabs: Tab[]; children: ReactNode }) {
  const [tab, setTab] = useState(tabs[0]?.id ?? "");
  return (
    <div className="map-body">
      <aside className="signals" aria-label="Signals">
        <h2>Signals</h2>
        {signals.map((s) => (
          <button key={s.id} type="button" className="signal" data-tone={s.tone} onClick={() => setTab(s.tab)}>
            <strong>{s.title}</strong>
            <span>{s.detail}</span>
            <em>Open {tabs.find((t) => t.id === s.tab)?.label.toLowerCase()} →</em>
          </button>
        ))}
        {signals.length === 0 && <p style={{ color: "var(--ev-muted)", margin: "4px" }}>Nothing needs attention right now.</p>}
      </aside>
      <section className="canvas" aria-label="Faculty map">{children}</section>
      <aside className="drawer" aria-label="Tools">
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`pane-${t.id}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {tabs.map((t) => (
          <div key={t.id} className="pane" role="tabpanel" id={`pane-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={tab !== t.id}>
            {t.content}
          </div>
        ))}
      </aside>
    </div>
  );
}
