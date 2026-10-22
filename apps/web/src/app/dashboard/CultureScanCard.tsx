"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const PROGRESS_KEY = "mentorful:culture-scan-v2:progress";
const COMPLETED_KEY = "mentorful:culture-scan-v2:completed";

type Status = "not-started" | "in-progress" | "completed";

export default function CultureScanCard() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    localStorage.removeItem("mentorful:culture-scan:progress");
    localStorage.removeItem("mentorful:culture-scan:completed");

    if (localStorage.getItem(COMPLETED_KEY)) {
      setStatus("completed");
    } else if (localStorage.getItem(PROGRESS_KEY)) {
      setStatus("in-progress");
    } else {
      setStatus("not-started");
    }
  }, []);

  const label =
    status === "completed"
      ? "Completed"
      : status === "in-progress"
      ? "In progress"
      : status === "not-started"
      ? "Not started"
      : "…";

  const cta =
    status === "in-progress" ? "Continue" : status === "not-started" ? "Start" : null;

  return (
    <section className="tch-card tch-scan" style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="tch-card-head">
        <h2 style={{ margin: 0 }}>School Culture Scan</h2>
        <span className="mono">{label}</span>
      </div>
      <p className="tch-lede" style={{ margin: 0 }}>
        A short, anonymous check on how connected your school feels. Your answers are never linked to you.
      </p>
      {cta && (
        <div>
          <Link className="btn" href="/survey" style={{ textDecoration: "none" }}>
            {cta}
          </Link>
        </div>
      )}
    </section>
  );
}
