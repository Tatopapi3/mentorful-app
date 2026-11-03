"use client";

import { useState } from "react";

/** Copies a link and says so for a moment. Falls back to selecting the text when the browser blocks the clipboard. */
export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy this link:", text);
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  }
  return (
    <button type="button" className={className ?? "ev-btn sm"} onClick={copy} aria-live="polite">
      {done ? "Copied" : label}
    </button>
  );
}
