import { StackBar } from "@/components/admin/diagrams";
import { AdminFrame, Chip, CycleSwitcher, LinkBtn, Muted, Notice, Panel, Row, StatGrid, SubmitBtn, basePath, type Skin } from "@/components/admin/kit";
import { decidePairing, publishRound } from "@/app/admin/pairings/actions";
import { buildFacts } from "@/lib/admin/facts";
import { requireAdmin } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";
import { DOMAIN_LABEL } from "@/lib/domains";
import { participationRates, quietLabel } from "@/lib/admin/participation";
import { pairingSplit } from "@/lib/admin/visuals";
import { orientPairs, randomizePairs, seededRandom } from "@/lib/pairing/randomize";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// Pairing review: decide on the pairs teachers asked for, and draft a randomized round for everyone still
// unpaired. A draft is only a proposal until it is published. Teachers are never told how a request was decided.
export default async function PairingsView({ skin, searchParams }: { skin: Skin; searchParams: Params }) {
  const admin = await requireAdmin();
  if (!admin) return null;
  const path = `${basePath(skin)}/pairings`;
  const cycleParam = one(searchParams.cycle);
  const snap = await loadAdminSnapshot(admin, { cycleId: cycleParam });
  const facts = buildFacts(snap);
  const byId = new Map(snap.people.map((p) => [p.id, p]));
  const cycleId = snap.cycle?.id ?? "";

  const paired = new Set(snap.pairs.flatMap((p) => [p.a, p.b]));
  const requested = new Set(snap.requests.flatMap((p) => [p.a, p.b]));
  const pool = snap.people.filter((p) => !paired.has(p.id) && !requested.has(p.id));

  const seed = Number(one(searchParams.seed));
  const drafting = Number.isFinite(seed) && one(searchParams.seed) !== undefined && pool.length >= 2;
  const draft = drafting
    ? (() => {
        const { pairs, unpaired } = randomizePairs({ teachers: pool.map((p) => ({ id: p.id, department: p.dept, gradeLevel: null })), exclusions: [], pastPairs: [], random: seededRandom(seed) });
        return { pairs: orientPairs(pairs, new Map(), seededRandom(seed + 1)), unpaired };
      })()
    : null;

  const crosses = (a: string, b: string) => byId.get(a)?.dept !== byId.get(b)?.dept;
  const crossing = snap.pairs.filter((x) => crosses(x.a, x.b)).length;
  const split = pairingSplit(facts.pairCount, snap.quietPairs ?? null, crossing);
  const q = (extra: Record<string, string>) => `${path}?${new URLSearchParams({ ...(cycleParam ? { cycle: cycleParam } : {}), ...extra }).toString()}`;
  const notice = one(searchParams.notice);
  const error = one(searchParams.error);

  return (
    <AdminFrame skin={skin} eyebrow={`Pairing · ${snap.cycle?.name ?? "No cycle"}`} title="Who works with whom" sub="Approve the pairs teachers asked for, and draft a randomized round for everyone still unpaired. Teachers are never told how a request was decided.">
      <CycleSwitcher skin={skin} cycles={snap.cycles} selectedId={snap.cycle?.id ?? null} path={path} />
      {notice && <Notice skin={skin} kind="notice">{notice}</Notice>}
      {error && <Notice skin={skin} kind="error">{error}</Notice>}
      {!snap.cycle && <Muted skin={skin}>There is no cycle yet, so there is nothing to pair for.</Muted>}

      {snap.cycle && (
        <>
          <StatGrid
            skin={skin}
            items={[
              { label: "Pairs", value: String(facts.pairCount), note: `${facts.faculty} teachers` },
              { label: "Across departments", value: `${facts.crossPct ?? 0}%`, note: `${crossing} of ${facts.pairCount} pairs` },
              { label: "Have talked", value: snap.participation ? `${participationRates(snap.participation).conversationPct ?? 0}%` : "n/a", note: snap.participation ? `${snap.participation.with_conversation} of ${snap.participation.pairs} pairs logged something` : "needs the participation function" },
              { label: "Waiting for you", value: String(snap.requests.length + facts.unpaired), note: `${snap.requests.length} ${snap.requests.length === 1 ? "request" : "requests"} · ${facts.unpaired} unpaired` },
            ]}
          />
          <Panel skin={skin} title="Pairing progress" eyebrow="How pairs are doing" count={`${facts.pairCount} pairs`}>
            <p style={{ margin: "0 0 14px", display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <strong style={{ font: "600 42px var(--ev-display, var(--font-serif, Georgia, serif))", letterSpacing: "-0.02em" }}>{facts.crossPct ?? 0}%</strong>
              <span style={{ color: "var(--ev-muted, var(--muted))" }}>of pairs connect different departments</span>
            </p>
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>How the pairs are doing</h3>
            {split.nudge === null ? (
              <Muted skin={skin}>Whether pairs are active comes from a database function (script 015) that is not applied here yet.</Muted>
            ) : (
              <>
                <StackBar parts={[{ label: "on track", value: split.active, tone: "teal" }, { label: "need a nudge", value: split.nudge, tone: "amber" }]} />
                <Muted skin={skin}>A nudge is a reminder for the pair, not a mark against anyone. You see how many have not logged in 30 days ({quietLabel(split.nudge)}), never which pairs.</Muted>
              </>
            )}
            <h3 style={{ margin: "18px 0 8px", fontSize: 15 }}>Cross-department mix</h3>
            <StackBar parts={[{ label: "across departments", value: split.crossing, tone: "teal" }, { label: "inside one department", value: split.inside, tone: "grey" }]} />
          </Panel>
          <Panel skin={skin} title="Waiting for your decision" count={`${snap.requests.length} ${snap.requests.length === 1 ? "request" : "requests"}`} eyebrow="Requests">
            {snap.requests.length === 0 && <Muted skin={skin}>No requests are waiting.</Muted>}
            {snap.requests.map((r) => {
              const alreadyPaired = paired.has(r.a) || paired.has(r.b);
              return (
                <Row
                  key={r.id}
                  skin={skin}
                  chip={<Chip skin={skin} tone={crosses(r.a, r.b) ? undefined : "amber"}>{crosses(r.a, r.b) ? "Crosses departments" : "Same department"}</Chip>}
                  title={`${byId.get(r.a)?.name ?? "A teacher"} → ${byId.get(r.b)?.name ?? "a colleague"}`}
                  detail={[
                    `${byId.get(r.a)?.dept ?? ""} and ${byId.get(r.b)?.dept ?? ""}`,
                    r.domain ? `wants to work on ${DOMAIN_LABEL[r.domain] ?? r.domain}` : null,
                    alreadyPaired ? "One of them already has a partner this cycle." : null,
                  ].filter(Boolean).join(" · ")}
                >
                  {(["approve", "decline"] as const).map((d) => (
                    <form key={d} action={decidePairing}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="decision" value={d} />
                      <input type="hidden" name="back" value={path} />
                      <input type="hidden" name="cycle" value={cycleParam ?? ""} />
                      <SubmitBtn skin={skin} primary={d === "approve"}>{d === "approve" ? "Approve" : "Decline"}</SubmitBtn>
                    </form>
                  ))}
                </Row>
              );
            })}
          </Panel>

          <Panel skin={skin} title="Everyone still unpaired" count={`${pool.length} ${pool.length === 1 ? "teacher" : "teachers"}`} eyebrow="Randomized round" tone={pool.length > 0 ? "alert" : undefined}>
            {pool.length < 2 ? (
              <Muted skin={skin}>
                {pool.length === 0 ? "Every teacher has a partner or a request waiting." : "Only one teacher is left, so there is nobody to pair them with."}
              </Muted>
            ) : !draft ? (
              <>
                <Muted skin={skin}>
                  A round pairs these {pool.length} teachers across departments and grades, so people who rarely talk end up together. You review it before anyone is paired. Teachers with a request waiting are left out.
                </Muted>
                <LinkBtn skin={skin} href={q({ seed: "1" })} primary>Draft a round</LinkBtn>
              </>
            ) : (
              <>
                <Muted skin={skin}>This is a draft. Nothing is saved until you publish it. The first person is observed, and the second visits.</Muted>
                {draft.pairs.map((p) => (
                  <Row
                    key={`${p.host.id}:${p.visitor.id}`}
                    skin={skin}
                    chip={<Chip skin={skin} tone={crosses(p.host.id, p.visitor.id) ? undefined : "amber"}>{crosses(p.host.id, p.visitor.id) ? "Crosses departments" : "Same department"}</Chip>}
                    title={`${byId.get(p.host.id)?.name} · ${byId.get(p.visitor.id)?.name}`}
                    detail={`${byId.get(p.host.id)?.dept} and ${byId.get(p.visitor.id)?.dept}`}
                  />
                ))}
                {draft.unpaired.length > 0 && (
                  <Muted skin={skin}>Left unpaired: {draft.unpaired.map((u) => byId.get(u.teacher.id)?.name).join(", ")}. {draft.unpaired[0].reason === "odd_count" ? "There is an odd number of teachers." : ""}</Muted>
                )}
                <form action={publishRound} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                  <input type="hidden" name="back" value={path} />
                  <input type="hidden" name="cycle" value={cycleId} />
                  {draft.pairs.map((p) => (
                    <input key={`${p.host.id}:${p.visitor.id}`} type="hidden" name="pair" value={`${p.host.id}:${p.visitor.id}`} />
                  ))}
                  <SubmitBtn skin={skin} primary>Publish {draft.pairs.length} {draft.pairs.length === 1 ? "pair" : "pairs"}</SubmitBtn>
                  <LinkBtn skin={skin} href={q({ seed: String((Number.isFinite(seed) ? seed : 0) + 1) })}>Draft a different round</LinkBtn>
                  <LinkBtn skin={skin} href={q({})}>Discard the draft</LinkBtn>
                </form>
              </>
            )}
          </Panel>

          <Panel skin={skin} title="Current pairs" count={`${facts.pairCount} pairs${facts.crossPct !== null ? ` · ${facts.crossPct}% cross departments` : ""}`} eyebrow="Approved this cycle">
            {snap.pairs.length === 0 && <Muted skin={skin}>No pairs are approved yet.</Muted>}
            {snap.pairs.slice(0, 8).map((p) => (
              <Row key={p.id} skin={skin} title={`${byId.get(p.a)?.name ?? "?"} · ${byId.get(p.b)?.name ?? "?"}`} detail={[byId.get(p.a)?.dept, byId.get(p.b)?.dept].join(" and ") + (p.domain ? ` · ${DOMAIN_LABEL[p.domain] ?? p.domain}` : "")} />
            ))}
            {snap.pairs.length > 8 && <Muted skin={skin}>And {snap.pairs.length - 8} more. Every pair is listed in the overview.</Muted>}
            <LinkBtn skin={skin} href={`${basePath(skin)}/overview`}>Open the overview</LinkBtn>
          </Panel>
        </>
      )}
    </AdminFrame>
  );
}
