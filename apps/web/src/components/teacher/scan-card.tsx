"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icons";

// The same keys the survey writes, so the card knows where the teacher is without asking the server. The scan is
// anonymous by design, so there is nothing server-side to ask.
const PROGRESS_KEY = "mentorful:culture-scan-v2:progress";
const COMPLETED_KEY = "mentorful:culture-scan-v2:completed";

type Status = "unknown" | "not-started" | "in-progress" | "completed";

export function useScanStatus(): Status {
  const [status, setStatus] = useState<Status>("unknown");
  useEffect(() => {
    try {
      setStatus(localStorage.getItem(COMPLETED_KEY) ? "completed" : localStorage.getItem(PROGRESS_KEY) ? "in-progress" : "not-started");
    } catch {
      setStatus("not-started");
    }
  }, []);
  return status;
}

const WORDS: Record<Status, { label: string; cta: string | null }> = {
  unknown: { label: "", cta: null },
  "not-started": { label: "Not started", cta: "Start the scan" },
  "in-progress": { label: "In progress", cta: "Continue the scan" },
  completed: { label: "Completed on this device", cta: null },
};

export function ScanLink({ className = "ev-btn primary" }: { className?: string }) {
  const status = useScanStatus();
  const { cta } = WORDS[status];
  if (!cta) {
    return status === "completed" ? (
      <span className="ev-badge">
        <Icon name="check" size={12} /> Completed on this device
      </span>
    ) : null;
  }
  return (
    <Link className={className} href="/survey">
      {cta}
      <Icon name="arrow" size={16} />
    </Link>
  );
}

export function ScanStatusLabel() {
  const status = useScanStatus();
  return <>{WORDS[status].label}</>;
}

/** The home-screen entry: a short, calm invitation, never a to-do with a deadline. */
export function ScanEntry() {
  return (
    <section className="ev-panel ta-scan-entry">
      <span className="ta-iconchip" aria-hidden>
        <Icon name="scan" size={22} />
      </span>
      <div>
        <p className="ta-label">Your voice matters</p>
        <h3>The Culture Scan</h3>
        <p className="ev-muted">Twenty-six questions about the school around you, about six minutes. Anonymous by design: your answers are never connected to your login.</p>
        <div className="ta-row">
          <ScanLink />
          <small className="ev-muted">
            <ScanStatusLabel />
          </small>
        </div>
      </div>
    </section>
  );
}
