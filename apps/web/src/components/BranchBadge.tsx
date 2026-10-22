import { branchLabel } from "@/lib/branch";

/** A small label in the corner that names the branch being viewed. Renders nothing outside the viewing project. */
export default function BranchBadge() {
  const label = branchLabel();
  if (!label) return null;
  return (
    <div style={{ position: "fixed", left: 12, bottom: 12, zIndex: 9999, display: "flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 10px", borderRadius: 999, background: "#16283c", color: "#f6f3ec", font: "500 12px var(--font-mono), ui-monospace, monospace", letterSpacing: "0.04em", boxShadow: "0 8px 22px -8px rgba(0,0,0,0.5)", pointerEvents: "none" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#5ed4c4" }} />
      branch: {label}
    </div>
  );
}
