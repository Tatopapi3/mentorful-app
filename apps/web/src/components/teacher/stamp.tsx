"use client";

import { useSyncExternalStore } from "react";

type Kind = "datetime" | "time" | "date" | "long";

const OPTS: Record<Kind, Intl.DateTimeFormatOptions> = {
  datetime: { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  time: { hour: "numeric", minute: "2-digit" },
  date: { month: "short", day: "numeric" },
  long: { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
};
const noSubscribe = () => () => {};

/**
 * A timestamp in the reader's own time zone. The server doesn't know it, so the server render uses UTC and the browser
 * swaps in the local time once hydrated (no mismatch, and nobody sees a time that is hours off for long).
 */
export function Stamp({ iso, kind = "datetime", className }: { iso: string; kind?: Kind; className?: string }) {
  const text = useSyncExternalStore(
    noSubscribe,
    () => new Intl.DateTimeFormat("en-US", OPTS[kind]).format(new Date(iso)),
    () => new Intl.DateTimeFormat("en-US", { ...OPTS[kind], timeZone: "UTC" }).format(new Date(iso)),
  );
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}

/** A live "now" for forms that stamp what you write, ticking once a minute. */
export function useNowStamp(): string {
  return useSyncExternalStore(
    (notify) => {
      const id = setInterval(notify, 30_000);
      return () => clearInterval(id);
    },
    () => new Intl.DateTimeFormat("en-US", OPTS.long).format(new Date()),
    () => "now",
  );
}

/** The browser's local calendar day as YYYY-MM-DD. */
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The calendar block (big day number over the month) in the reader's own time zone. */
export function DateBlock({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    noSubscribe,
    () => {
      const d = new Date(iso);
      return `${d.getDate()}|${d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}`;
    },
    () => {
      const d = new Date(iso);
      return `${d.getUTCDate()}|${d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase()}`;
    },
  );
  const [day, month] = text.split("|");
  return (
    <span className="ev-date" suppressHydrationWarning>
      <strong>{day}</strong>
      {month}
    </span>
  );
}
