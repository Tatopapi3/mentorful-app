"use client";

import { useSyncExternalStore } from "react";
import { formatDuration, timeTotals, weekBars, type PlatformDay } from "@/lib/teacher/hub";
import { Icon } from "./icons";
import { localDay } from "./stamp";
import { useVisitSeconds } from "./time-tracker";

const noSubscribe = () => () => {};

/**
 * How long the teacher has spent on Mentorful, for their own reflection. Counts only: no target, no streak, no
 * comparison with anyone. Private to them (017 gives no one else a way to read it), and only active time counts.
 */
export function TimeCard({ rows, serverToday, ready }: { rows: PlatformDay[]; serverToday: string; ready: boolean }) {
  const today = useSyncExternalStore(noSubscribe, () => localDay(), () => serverToday);
  const visit = useVisitSeconds();
  const bars = weekBars(rows, today);
  const t = timeTotals(rows, today);
  const max = Math.max(...bars.map((b) => b.seconds), 60);

  return (
    <section className="ev-panel ta-time" aria-labelledby="ta-time-h">
      <p className="ev-eyebrow">Time on Mentorful</p>
      <h2 id="ta-time-h">
        <span className="ta-bignum">{formatDuration(t.week)}</span> <em>this week</em>
      </h2>
      <div className="ta-bars" role="img" aria-label={`Active time over the last seven days: ${bars.map((b) => `${b.label} ${formatDuration(b.seconds)}`).join(", ")}`}>
        {bars.map((b) => (
          <div key={b.day} className="ta-bar" data-today={b.today}>
            <span className="ta-bar-fill" style={{ height: `${Math.max(4, (b.seconds / max) * 100)}%` }} data-empty={b.seconds === 0} />
            <small>{b.label}</small>
          </div>
        ))}
      </div>
      <dl className="ta-mini">
        <div><dt>Today</dt><dd>{formatDuration(t.today)}</dd></div>
        <div><dt>This visit</dt><dd>{formatDuration(visit)}</dd></div>
        <div><dt>Last 30 days</dt><dd>{formatDuration(t.month)}</dd></div>
        <div><dt>Active days</dt><dd>{t.daysActive}</dd></div>
      </dl>
      <p className="ta-privnote">
        <Icon name="lock" size={15} />
        <span>
          <strong>Only you can see this.</strong> It counts the time you are actively using Mentorful, not a tab left open, and your school lead never sees it.
          {!ready ? " (Time tracking isn't switched on for your school yet.)" : ""}
        </span>
      </p>
    </section>
  );
}
