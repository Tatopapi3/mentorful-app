"use client";

import { useState } from "react";
import { FutureNoteComposer } from "./future-notes";
import { LogComposer, type PairOption } from "./log-composer";
import { ScanNotes } from "./scan-notes";

/** One place to write: a conversation, or a note to your future self. */
export function Composers({ pairs, defaultPairing, prefill, initialTab, serverToday, cycleEnds, hubReady, scanEnabled = false }: { pairs: PairOption[]; defaultPairing?: string; prefill?: string; initialTab: "log" | "future" | "scan"; serverToday: string; cycleEnds: string | null; hubReady: boolean; scanEnabled?: boolean }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div className="ta-composers">
      <div className="ev-tabs" role="tablist" aria-label="What would you like to write?">
        <button role="tab" aria-selected={tab === "log"} className={tab === "log" ? "on" : ""} onClick={() => setTab("log")}>
          Log a conversation
        </button>
        <button role="tab" aria-selected={tab === "future"} className={tab === "future" ? "on" : ""} onClick={() => setTab("future")}>
          Note to future self
        </button>
        {scanEnabled ? (
          <button role="tab" aria-selected={tab === "scan"} className={tab === "scan" ? "on" : ""} onClick={() => setTab("scan")}>
            Scan notes
          </button>
        ) : null}
      </div>
      {tab === "log" ? <LogComposer pairs={pairs} defaultPairing={defaultPairing} prefill={prefill} /> : tab === "scan" && scanEnabled ? <ScanNotes ready={hubReady} /> : <FutureNoteComposer serverToday={serverToday} cycleEnds={cycleEnds} ready={hubReady} />}
    </div>
  );
}
