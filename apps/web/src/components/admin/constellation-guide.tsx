import { PairingFlow } from "@/components/admin/diagrams";
import { Chip, LinkBtn, Muted, Panel, Row, StatGrid, basePath, type Skin } from "@/components/admin/kit";
import { HiddenGroups } from "@/components/admin/hidden-groups";
import { DeptLink, GroupSummaryRoot } from "@/components/admin/group-summary";
import { FacultyOrbit } from "@/components/admin/faculty-orbit";
import { facultyOrbit } from "@/lib/admin/faculty-orbit";
import { groupSummaries } from "@/lib/admin/summaries";
import type { AdminSnapshot } from "@/lib/admin/facts";
import { coverage, crossCount, departmentMatrix, directions, progress, suggestions } from "@/lib/admin/network";

const CHIP = { do: "Do next", watch: "Watch", good: "Going well" } as const;

/**
 * What the sky means and what to do about it, for either look. Progress against the last cycle, the three or
 * four things worth doing next (each with a reason), pairs that would close a gap, and a grid of which
 * departments are connected. Works only from who is paired with whom: no survey answers, no conversations.
 */
export function ConstellationGuide({ skin, snap, prev, part }: { skin: Skin; snap: AdminSnapshot; prev: AdminSnapshot | null; part: "top" | "bottom" }) {
  const base = basePath(skin);
  const m = departmentMatrix(snap);
  const prog = progress(snap, prev);
  const dirs = directions(snap, m, prog, prev?.cycle?.name ?? null);
  const paired = new Set(snap.pairs.flatMap((p) => [p.a, p.b]));
  const pairedPct = snap.people.length ? Math.round((paired.size / snap.people.length) * 100) : 0;
  const cov = coverage(m);
  const sug = suggestions(snap, m);
  const by = (label: string) => prog.find((p) => p.label === label);
  const note = (label: string, fallback: string) => {
    const r = by(label);
    return r ? `${r.delta === "same" ? "same as" : r.delta === "up" ? "up from" : "down from"} ${r.before} in ${prev?.cycle?.name ?? "last cycle"}` : fallback;
  };

  if (part === "top") {
    const orbit = facultyOrbit(snap, snap.participation ?? null, prev);
    return (
      <>
        <StatGrid
          skin={skin}
          items={[
            { label: "Teachers with a partner", value: `${pairedPct}%`, note: note("Teachers with a partner", `${paired.size} of ${snap.people.length} teachers`) },
            { label: "Pairs across departments", value: snap.pairs.length ? `${Math.round((snap.pairs.filter((p) => !sameDept(snap, p.a, p.b)).length / snap.pairs.length) * 100)}%` : "0%", note: note("Pairs that cross departments", "the goal is half or more") },
            { label: "Department connections", value: `${cov.connected} of ${cov.possible}`, note: note("Department connections", "pairs of departments with at least one pair between them") },
          ]}
        />
        {orbit.planets.length >= 2 && (
          <GroupSummaryRoot summaries={groupSummaries(snap, m, snap.participation ?? null, null)}>
            <Panel skin={skin} title="Your faculty, in orbit" eyebrow="Faculty orbit">
              <FacultyOrbit planets={orbit.planets} lenses={orbit.lenses} directions={orbit.directions} />
            </Panel>
          </GroupSummaryRoot>
        )}
        <Panel skin={skin} title="Where to head next" eyebrow="Direction">
          {dirs.length === 0 ? (
            <Muted skin={skin}>Everyone has a partner and every department is connected. Nothing needs doing here.</Muted>
          ) : (
            dirs.map((d) => (
              <Row key={d.id} skin={skin} chip={<Chip skin={skin} tone={d.severity === "do" ? "amber" : undefined}>{CHIP[d.severity]}</Chip>} title={d.title} detail={d.detail}>
                {d.id === "unpaired" || d.id === "gaps" ? <LinkBtn skin={skin} href={`${base}/pairings`} primary={d.severity === "do"}>Open pairing</LinkBtn> : null}
              </Row>
            ))
          )}
        </Panel>
      </>
    );
  }

  return (
    <GroupSummaryRoot summaries={groupSummaries(snap, m, snap.participation ?? null, null)}>
      {sug.length > 0 && (
        <Panel skin={skin} title="Pairs that would add a new connection" eyebrow="Suggested" count={sug.length}>
          {sug.map((s) => (
            <Row key={s.host.id + s.visitor.id} skin={skin} title={`${s.host.name} with ${s.visitor.name}`} detail={`Connects ${s.closes[0]} and ${s.closes[1]}, which have no pair between them yet. Neither has a partner or a request waiting.`} />
          ))}
          <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <LinkBtn skin={skin} href={`${base}/pairings`} primary>Open pairing</LinkBtn>
            <Muted skin={skin}>These are suggestions, drawn on the sky as the dotted arcs. Nothing happens until you approve pairs in Pairing.</Muted>
          </div>
        </Panel>
      )}
      {m.depts.length >= 2 && Object.keys(m.cross).length > 0 && (
        <Panel skin={skin} title="How pairs flow between departments" eyebrow="Pairing flow">
          <PairingFlow matrix={m} />
          <Muted skin={skin}>One arc for every two departments that have a pair between them; a thicker arc means more pairs. &ldquo;Within&rdquo; counts pairs that stay inside one department.</Muted>
        </Panel>
      )}
      {m.depts.length >= 2 && (
        <Panel skin={skin} title="Which departments are connected" eyebrow="Departments">
          <div style={{ overflowX: "auto" }} tabIndex={0} role="region" aria-label="Pairs between departments, scrollable">
            <table style={{ borderCollapse: "collapse", minWidth: 420, width: "100%", fontSize: 13.5 }}>
              <thead>
                <tr>
                  <th />
                  {m.depts.map((d) => (
                    <th key={d} style={th}><DeptLink dept={d} /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.depts.map((r) => (
                  <tr key={r}>
                    <th scope="row" style={{ ...th, textAlign: "left" }}><DeptLink dept={r} /></th>
                    {m.depts.map((c) => {
                      if (r === c) return <td key={c} style={{ ...td, color: "var(--muted, var(--ev-muted))" }} title="Pairs inside this department">{m.within[r] ?? 0}<small> within</small></td>;
                      const n = crossCount(m, r, c);
                      return (
                        <td key={c} style={{ ...td, fontWeight: 600, background: n === 0 ? "rgba(245,158,11,0.16)" : "rgba(20,184,166,0.14)" }}>
                          {n === 0 ? "none" : n}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <HiddenGroups names={m.omitted} />
          <Muted skin={skin}>Each cell counts pairs between two departments. &ldquo;None&rdquo; is a connection that doesn&apos;t exist yet.</Muted>
        </Panel>
      )}
    </GroupSummaryRoot>
  );
}

const sameDept = (s: AdminSnapshot, a: string, b: string) => s.people.find((p) => p.id === a)?.dept === s.people.find((p) => p.id === b)?.dept;
const th = { padding: "8px 10px", fontWeight: 600, fontSize: 12.5, textAlign: "center" as const, borderBottom: "1px solid var(--line, var(--ev-line))" };
const td = { padding: "8px 10px", textAlign: "center" as const, border: "1px solid var(--line, var(--ev-line))" };
