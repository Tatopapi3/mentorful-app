"use client";

import { useState } from "react";
import { FutureNoteComposer } from "./future-notes";
import { LogComposer, type PairOption } from "./log-composer";

/** One place to write: a conversation, or a note to your future self. */
export function Composers({ pairs, defaultPairing, prefill, initialTab, serverToday, cycleEnds, hubReady }: { pairs: PairOption[]; defaultPairing?: string; prefill?: string; initialTab: "log" | "future"; serverToday: string; cycleEnds: string | null; hubReady: boolean }) {
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
      </div>
      {tab === "log" ? <LogComposer pairs={pairs} defaultPairing={defaultPairing} prefill={prefill} /> : <FutureNoteComposer serverToday={serverToday} cycleEnds={cycleEnds} ready={hubReady} />}
    </div>
  );
}
