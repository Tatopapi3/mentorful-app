import { Muted, Panel, type Skin } from "@/components/admin/kit";
import NudgeComposer from "@/components/admin/nudge-composer";
import { countLabel, warningFor, type Cooling } from "@/lib/admin/early-warning";

const COLOR = { teal: "var(--ev-teal, var(--teal-dk, #0f766e))", amber: "var(--ev-amber, var(--amber, #b45309))", rose: "#a3243b" };

/**
 * Pairs that are slipping, before they go quiet. Three groups by how long since a pair last logged a conversation, as
 * counts only, a plain sentence about what happens if nothing changes, and a way to write one nudge to a group.
 */
export default function EarlyWarningPanel({ skin, cooling, cycleId, back }: { skin: Skin; cooling: Cooling | null; cycleId: string; back: string }) {
  return (
    <Panel skin={skin} title="Early warning" eyebrow="Pairs drifting quiet" count={cooling ? `${cooling.pairs} pairs` : "needs the participation function"}>
      <EarlyWarningBody skin={skin} cooling={cooling} cycleId={cycleId} back={back} />
    </Panel>
  );
}

/** Everything inside the panel, so a page can put it in its own card. */
export function EarlyWarningBody({ skin, cooling, cycleId, back }: { skin: Skin; cooling: Cooling | null; cycleId: string; back: string }) {
  if (!cooling) {
    return <Muted skin={skin}>This reads the same database function as the &ldquo;need a nudge&rdquo; count (script 015, not applied here yet). Until then it stays empty rather than guessing.</Muted>;
  }
  const w = warningFor(cooling);
  const parts = [
    { label: "talked in the last 14 days", value: cooling.onTrack, color: COLOR.teal },
    { label: "silent 14 to 30 days (cooling)", value: cooling.cooling, color: COLOR.amber },
    { label: "silent 30 days or more", value: cooling.quiet, color: COLOR.rose },
  ];
  const total = cooling.pairs || 1;
  return (
    <>
      <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600 }}>{w.title}</p>
      <p style={{ margin: "0 0 14px", maxWidth: 720 }}>{w.detail}</p>
      <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", gap: 2, background: "var(--ev-soft, var(--paper-2))" }} role="img" aria-label={parts.map((p) => `${countLabel(p.value)} ${p.label}`).join(", ")}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: "6px 20px", flexWrap: "wrap", margin: "10px 0 18px", fontSize: 14 }}>
        {parts.map((p) => (
          <span key={p.label} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <i style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, display: "inline-block" }} />
            <strong>{countLabel(p.value)}</strong> {p.label}
          </span>
        ))}
      </div>
      {cooling.cooling + cooling.quiet > 0 && (
        <>
          <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Send a nudge</h3>
          <NudgeComposer skin={skin} cooling={cooling} cycleId={cycleId} back={back} />
        </>
      )}
      <Muted skin={skin}>Counts only. You see how many pairs are in each group, never which, and a group under five is shown as &ldquo;fewer than 5&rdquo;.</Muted>
    </>
  );
}
