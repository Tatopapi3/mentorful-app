"use client";

import { useTheme } from "./bar";

/** The Day / Night button, for pages that have the Aurora frame but not the full leadership or teacher bar. */
export function ThemeButton() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" className="ev-icon-btn" onClick={toggle} aria-label={`Switch to ${theme === "day" ? "Night" : "Day"} mode`}>
      {theme === "day" ? "☾" : "☀"}
    </button>
  );
}
