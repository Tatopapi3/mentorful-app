"use client";

import { useState } from "react";
import type { Skin } from "@/components/admin/kit";

/** Copies text to the clipboard and says so. Falls back to a prompt-free no-op message if the browser refuses. */
export default function CopyButton({ skin, text, label = "Copy as text" }: { skin: Skin; text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  return (
    <button
      type="button"
      className={skin === "nick" ? "nk-btn" : "ev-btn sm"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("done");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2500);
      }}
    >
      {state === "done" ? "Copied" : state === "failed" ? "Couldn't copy, select the text instead" : label}
    </button>
  );
}
