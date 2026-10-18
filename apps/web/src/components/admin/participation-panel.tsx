import { BarList, Muted, Panel, StatGrid, type Skin } from "@/components/admin/kit";
import type { AdminSnapshot } from "@/lib/admin/facts";
import { participationRates, quietLabel } from "@/lib/admin/participation";

const show = (n: number | null) => (n === null ? "n/a" : `${n}%`);

/** How much of the program is actually happening: pairs that have talked, held a debrief, or done both. */
export default function ParticipationPanel({ skin, snap }: { skin: Skin; snap: AdminSnapshot }) {
  const p = snap.participation;
  if (!p) {
    return (
      <Panel skin={skin} title="Participation" eyebrow="Pairs in action" count="needs the participation function">
        <Muted skin={skin}>
          Participation comes from a small database function that returns counts and never conversations (script 015, not applied yet). Until then this panel stays empty rather than guessing.
        </Muted>
      </Panel>
    );
  }
  const r = participationRates(p);
  return (
    <Panel skin={skin} title="Participation" eyebrow="Pairs in action" count={`${p.pairs} approved pairs`}>
      <StatGrid
        skin={skin}
        items={[
          { label: "Have talked", value: show(r.conversationPct), note: `${p.with_conversation} of ${p.pairs} pairs logged a conversation` },
          { label: "Held a debrief", value: show(r.debriefPct), note: `${p.with_debrief} of ${p.pairs} pairs` },
          { label: "Fully complete", value: show(r.completePct), note: `${p.complete} pairs did both` },
          { label: "Teachers active", value: show(r.activePct), note: `${p.active_teachers} of ${p.teachers} are in a pair that has talked` },
        ]}
      />
      {r.departments.length > 0 && (
        <>
          <p style={{ margin: "14px 0 4px", fontWeight: 600 }}>Active teachers by department</p>
          <BarList skin={skin} rows={r.departments.map((d) => ({ label: `${d.department} (${d.teachers} teachers)`, value: d.pct ?? 0 }))} max={100} suffix="%" />
        </>
      )}
      <Muted skin={skin}>
        {snap.quietPairs !== null && snap.quietPairs !== undefined ? `${quietLabel(snap.quietPairs)} pairs have logged nothing in the last 30 days. You see a number, never which pairs. ` : ""}
        Departments with fewer than 5 teachers are left out so no one can be picked out. Leadership sees that conversations happened, never what was said.
      </Muted>
    </Panel>
  );
}
