import type { Severity } from "@/lib/admin/actions";
import { LEVEL_WORD, type ScanLevel } from "@/lib/admin/scan-level";

const LABEL: Record<Severity, string> = { do: "Do this", watch: "Keep an eye on", good: "Going well" };

export function SeverityTag({ severity }: { severity: Severity }) {
  return <span className={`ev-badge${severity === "do" ? " amber" : ""}`}>{LABEL[severity]}</span>;
}

/** A caution triangle. Always paired with a word, so colour is never the only signal. */
export function WarnIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

const TAG_COLOR = {
  light: { low: "#a3243b", watch: "#8f5106", ok: "#0a7268" },
  dark: { low: "#fda4af", watch: "#fbbf24", ok: "#5eead4" },
} as const;

/** "Low", "Watch" or "On track" for a Culture Scan average, with a caution icon when it needs attention. */
export function LevelTag({ level, dark = false, small = false }: { level: ScanLevel; dark?: boolean; small?: boolean }) {
  const color = TAG_COLOR[dark ? "dark" : "light"][level];
  const flagged = level !== "ok";
  return (
    <span
      data-level={level}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, color, fontWeight: 700, fontSize: small ? 11.5 : 13, lineHeight: 1.2, padding: flagged ? (small ? "2px 8px" : "3px 11px") : 0, border: flagged ? `1.5px solid ${color}` : 0, borderRadius: 999, whiteSpace: "nowrap" }}
    >
      {flagged && <WarnIcon size={small ? 12 : 15} />}
      {LEVEL_WORD[level]}
    </span>
  );
}
