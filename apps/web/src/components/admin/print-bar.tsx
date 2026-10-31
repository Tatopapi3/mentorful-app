"use client";

import { useEffect } from "react";

/**
 * "Download PDF" for pages that are made to print: it opens the browser's print dialog with Save as PDF ready, so a
 * leader never has to know the shortcut. The page's print styles do the layout (see the deck and board summary).
 */
export function PrintButton({ className, children = "Download PDF" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {children}
    </button>
  );
}

/** Opens the print dialog as soon as the page has drawn, for links that say "Download PDF" (?print=1). */
export function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [enabled]);
  return null;
}
