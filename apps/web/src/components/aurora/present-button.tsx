"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import "./present.css";

type Item = { href: string; label: string };

/**
 * Present mode: the browser goes full screen, the bar and footer step aside, the type gets larger, and the arrow keys
 * walk through the pages in order (Esc leaves). Made for showing the dashboard to a room.
 */
export function PresentButton({ items }: { items: Item[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [on, setOn] = useState(false);
  const root = () => document.querySelector<HTMLElement>(".ev");

  const start = useCallback(() => {
    root()?.setAttribute("data-present", "1");
    setOn(true);
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);
  const stop = useCallback(() => {
    root()?.removeAttribute("data-present");
    setOn(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
  }, []);

  const at = items.findIndex((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  const go = useCallback((d: number) => {
    const next = items[at + d];
    if (next) router.push(next.href);
  }, [at, items, router]);

  useEffect(() => {
    if (!on) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    const fs = () => !document.fullscreenElement && stop();
    window.addEventListener("keydown", key);
    document.addEventListener("fullscreenchange", fs);
    return () => {
      window.removeEventListener("keydown", key);
      document.removeEventListener("fullscreenchange", fs);
    };
  }, [on, go, stop]);

  // leaving the page area (or unmounting) must never leave the bar hidden
  useEffect(() => () => root()?.removeAttribute("data-present"), []);

  return (
    <>
      <button type="button" className="ev-icon-btn ev-present-btn" onClick={on ? stop : start} aria-pressed={on} title="Present full screen. Arrow keys move between pages, Esc leaves.">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        Present
      </button>
      {on && (
        <div className="ev-present-bar" role="group" aria-label="Presenting">
          <button type="button" onClick={() => go(-1)} disabled={at <= 0} aria-label="Previous page">‹</button>
          <span>{items[at]?.label ?? "Dashboard"} · {at + 1} of {items.length}</span>
          <button type="button" onClick={() => go(1)} disabled={at < 0 || at >= items.length - 1} aria-label="Next page">›</button>
          <button type="button" onClick={stop} className="ev-present-exit">Exit</button>
        </div>
      )}
    </>
  );
}
