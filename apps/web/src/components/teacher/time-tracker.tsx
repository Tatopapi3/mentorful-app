"use client";

import { useEffect, useSyncExternalStore } from "react";
import { recordTime } from "@/app/dashboard/aurora/hub-actions";
import { localDay } from "./stamp";

/**
 * Time on the platform, counted honestly: a second only counts while this tab is visible AND the teacher has done
 * something (moved, typed, scrolled, tapped) in the last minute, so a tab left open overnight adds nothing. Every half
 * minute the unsent seconds go to the server; the teacher's day total is theirs alone (see 017: no admin can read it).
 */
const IDLE_MS = 60_000;
const FLUSH_MS = 30_000;

let visitSeconds = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Seconds of active time in this visit (since the page was opened), for a live "this visit" figure. */
export function useVisitSeconds(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => visitSeconds,
    () => 0,
  );
}

export function TimeTracker() {
  useEffect(() => {
    let pending = 0;
    let last = Date.now();
    let lastInput = Date.now();
    const input = () => {
      lastInput = Date.now();
    };
    const events = ["pointermove", "pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, input, { passive: true }));

    const tick = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(now - last, 2000);
      last = now;
      if (document.visibilityState === "visible" && now - lastInput < IDLE_MS) {
        pending += dt / 1000;
        visitSeconds += dt / 1000;
        notify();
      }
    }, 1000);

    const flush = () => {
      const s = Math.floor(pending);
      if (s < 1) return;
      pending -= s;
      recordTime(localDay(), s).catch(() => {
        pending += s; // try again with the next batch
      });
    };
    const every = setInterval(flush, FLUSH_MS);
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);

    return () => {
      clearInterval(tick);
      clearInterval(every);
      events.forEach((e) => window.removeEventListener(e, input));
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
  return null;
}
