/** A hatched strip saying which small groups are left out, so the gap is explained instead of silent. */
export function HiddenGroups({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 6px", padding: "11px 16px", border: "1px solid var(--ev-line, var(--line))", borderRadius: 10, background: "repeating-linear-gradient(135deg, transparent 0 7px, var(--ev-line, var(--line)) 7px 8px)", color: "var(--ev-muted, var(--muted))", fontSize: 14 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
      <span>
        <strong style={{ color: "var(--ev-ink, var(--ink))" }}>Hidden to protect anonymity:</strong> {names.join(", ")} (fewer than 5 teachers each).
      </span>
    </div>
  );
}
