"use client";

import { createPortal } from "react-dom";

/**
 * Renders a dialog at the top of the themed root instead of inside the page. The page content fades in with an
 * animation, which gives it its own stacking layer, so a dialog left inside it would sit under the floating top bar.
 * Only used for things the user opens by clicking, so it never runs during server rendering.
 */
export function Overlay({ children }: { children: React.ReactNode }) {
  const root = typeof document !== "undefined" ? (document.querySelector(".ev") ?? document.body) : null;
  return root ? createPortal(children, root) : null;
}
