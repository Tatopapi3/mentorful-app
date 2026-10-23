import { HeatGrid, MonthBars, Sparkline, WeekHeat } from "@/components/admin/charts";
import { AdminFrame, CycleSwitcher, Muted, Panel, basePath, type Skin } from "@/components/admin/kit";
import { loadActivity, loadCycleTrend } from "@/lib/admin/trend-data";
import { requireAdmin, type AdminContext } from "@/lib/admin/require";
import { loadAdminSnapshot } from "@/lib/admin/snapshot";
import type { AdminSnapshot } from "@/lib/admin/facts";
import { departmentMatrix } from "@/lib/admin/network";
import { GroupSummaryRoot } from "@/components/admin/group-summary";
import { groupSummaries } from "@/lib/admin/summaries";
import { activitySentence, buildActivity, buildWeekly, trendSentence, type CycleMetrics, type Metric } from "@/lib/admin/trends";

type Params = Record<string, string | string[] | undefined>;

const CARDS: { key: Metric; label: string; unit: string; note: string }[] = [
  { key: "partneredPct", label: "Teachers with a partner", unit: "%", note: "of all teachers" },
  { key: "crossPct", label: "Pairs across departments", unit: "%", note: "of approved pairs" },
  { key: "connections", label: "Department connections", unit: "", note: "pairs of departments with a pair between them" },
  { key: "pairs", label: "Approved pairs", unit: "", note: "in the cycle" },
];

function TrendCard({ rows, k, label, unit, note }: { rows: CycleMetrics[]; k: Metric; label: string; unit: string; note: string }) {
  const values = rows.map((r) => r[k]);
  const now = values[values.length - 1];
  const before = values.length > 1 ? values[values.length - 2] : null;
  const delta = before === null ? null : now - before;
  const fmt = (n: number) => `${n}${unit}`;
  return (
    <div style={{ border: "1px solid var(--ev-line, var(--line))", background: "var(--ev-panel-solid, var(--card))", borderRadius: 12, padding: "16px 18px", minWidth: 0 }}>
      <small style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10.5, color: "var(--ev-muted, var(--muted))" }}>{label}</small>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "4px 0 6px", flexWrap: "wrap" }}>
        <strong style={{ font: "600 30px var(--ev-display, var(--font-serif, Georgia, serif))", letterSpacing: "-0.02em" }}>{fmt(now)}</strong>
        {delta !== null && (
          <span style={{ fontSize: 13, fontWeight: 600, color: delta > 0 ? "var(--ev-teal, var(--teal-dk))" : delta < 0 ? "var(--ev-amber, var(--amber))" : "var(--ev-muted, var(--muted))" }}>
            {delta === 0 ? "no change" : `${delta > 0 ? "up" : "down"} ${Math.abs(delta)}${unit === "%" ? " points" : ""}`}
          </span>
        )}
      </div>
      <Sparkline values={values} labels={rows.map((r) => r.name)} format={fmt} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "var(--ev-muted, var(--muted))" }}>
        <span>{rows[0].name}</span>
        {rows.length > 1 && <span>{rows[rows.length - 1].name}</span>}
      </div>
      <small style={{ display: "block", marginTop: 6, color: "var(--ev-muted, var(--muted))" }}>{note}</small>
    </div>
  );
}

// Trends: how the numbers have moved cycle by cycle, and when and where conversations happen. Pairings are read like
// the rest of the dashboard. Conversations are pair-private, so they arrive only as counts from a database function
// (script 016), with anything under 5 hidden and no department under 5 teachers shown.
// The panels live in one component so the Insights page and the stand-alone Trends page show exactly the same thing.
export type TrendsData = {
  rows: CycleMetrics[];
  raw: Awaited<ReturnType<typeof loadActivity>>;
};

export async function loadTrendsData(admin: AdminContext, snap: AdminSnapshot): Promise<TrendsData> {
  const [rows, raw] = await Promise.all([loadCycleTrend(admin), loadActivity(admin, snap.cycle?.id ?? null)]);
  return { rows, raw };
}

export function TrendsSections({ skin, snap, data, withHeading }: { skin: Skin; snap: AdminSnapshot; data: TrendsData; withHeading?: boolean }) {
  const { rows, raw } = data;
  const activity = raw ? buildActivity(raw) : null;
  const sentence = activity ? activitySentence(activity) : null;
  const weekly = raw ? buildWeekly(raw) : null;
  const matrix = departmentMatrix(snap);
  const summaries = groupSummaries(snap, matrix, snap.participation ?? null, activity);

  return (
    <GroupSummaryRoot summaries={summaries}>
      {withHeading && (
        <Panel skin={skin} title="How things are changing" eyebrow="Trends">
          <Muted skin={skin}>{rows.length ? trendSentence(rows) : "Trends appear once the school has a cycle with pairs."}</Muted>
        </Panel>
      )}
      {rows.length > 0 && (
        <Panel skin={skin} title="Cycle by cycle" eyebrow="Progress" count={`${rows.length} ${rows.length === 1 ? "cycle" : "cycles"}`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            {CARDS.map((c) => (
              <TrendCard key={c.key} rows={rows} k={c.key} label={c.label} unit={c.unit} note={c.note} />
            ))}
          </div>
          <Muted skin={skin}>Each line has one point per cycle. The headcount is today&apos;s faculty, so a cycle with fewer teachers than now will look lower than it was.</Muted>
        </Panel>
      )}
      <Panel skin={skin} title="Conversations by month" eyebrow={snap.cycle?.name ?? "Activity"}>
        {activity && activity.months.length > 0 ? (
          <>
            {sentence && <p style={{ margin: "0 0 10px" }}>{sentence}</p>}
            <MonthBars activity={activity} />
          </>
        ) : (
          <Muted skin={skin}>
            {raw ? "No conversations have been submitted in this cycle yet." : "Conversation counts come from a small database function that returns numbers and never conversations (script 016, not applied yet). Until then this stays empty rather than guessing."}
          </Muted>
        )}
      </Panel>
      {activity && activity.departments.length > 0 && (
        <Panel skin={skin} title="Where the activity is" eyebrow="By department">
          <HeatGrid activity={activity} hidden={matrix.omitted} />
          <Muted skin={skin}>
            Darker means more conversations. A conversation counts for each partner&apos;s department. A cell under 5 says &ldquo;&lt;5&rdquo;, and departments with fewer than 5 teachers are left out, so no pair or person can be picked out. Leadership sees that conversations happened, never what was said.
          </Muted>
        </Panel>
      )}
      {weekly && (
        <Panel skin={skin} title="Conversation frequency by week" eyebrow="Week by week">
          <WeekHeat weekly={weekly} hidden={matrix.omitted} />
          <Muted skin={skin}>Each column is a week (it starts on the Monday). Darker means more conversations. A dot means fewer than 5, hidden on purpose. Click a department for its summary.</Muted>
        </Panel>
      )}
    </GroupSummaryRoot>
  );
}

// The stand-alone Trends page, still reachable at its own address. It is no longer a tab: Trends sits inside Insights.
export default async function TrendsView({ skin, searchParams }: { skin: Skin; searchParams: Params }) {
  const admin = await requireAdmin();
  if (!admin) return null;
  const path = `${basePath(skin)}/trends`;
  const cycleParam = typeof searchParams.cycle === "string" ? searchParams.cycle : undefined;
  const snap = await loadAdminSnapshot(admin, { cycleId: cycleParam });
  const data = await loadTrendsData(admin, snap);

  return (
    <AdminFrame skin={skin} eyebrow={`Trends · ${snap.cycle?.name ?? "No cycle"}`} title="How things are changing" sub={data.rows.length ? trendSentence(data.rows) : "Trends appear once the school has a cycle with pairs."}>
      <CycleSwitcher skin={skin} cycles={snap.cycles} selectedId={snap.cycle?.id ?? null} path={path} />
      <TrendsSections skin={skin} snap={snap} data={data} />
    </AdminFrame>
  );
}
