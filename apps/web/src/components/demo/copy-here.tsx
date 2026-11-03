"use client";

import { useState } from "react";
import { deepLink, type Who } from "@/lib/demo/share-links";

const KEY = process.env.NEXT_PUBLIC_SHARE_KEY ?? "";

/**
 * "Copy link" in the demo bar: copies a link to the page you are on that a teammate can open as they are, with the key in it
 * and the same person selected (principal, Ms. Afiya or Mr. Stefano). Only on hosted demos that have a share key.
 */
export function CopyHere({ who }: { who: Who }) {
  const [done, setDone] = useState(false);
  if (!KEY) return null;
  async function copy() {
    const path = window.location.pathname + window.location.search + window.location.hash;
    const open = path.startsWith("/demo") || path.startsWith("/survey") || path.startsWith("/report");
    const link = deepLink({ base: window.location.origin, key: KEY, who: open ? "none" : who, path });
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copy this link:", link);
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  }
  return (
    <button type="button" onClick={copy} aria-label="Copy a link to this page for a teammate">
      {done ? "Copied" : "Copy link"}
      <small>{done ? "paste it" : "for team"}</small>
    </button>
  );
}
