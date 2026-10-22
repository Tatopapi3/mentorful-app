import type { Activity } from "@/lib/admin/trends";
import { monthLabel } from "@/lib/admin/trends";
import { HiddenGroups } from "@/components/admin/hidden-groups";

/*
 * Small charts for the Trends page, drawn the same in every look. Colors come from whichever look's tokens are
 * present (the --ev-* tokens in Aurora and the blend, Nick's tokens otherwise), so each look keeps its own palette
 * and its own light and dark.
 */
const teal = "var(--ev-teal, var(--teal))";
const muted = "var(--ev-muted, var(--muted))";
const line = "var(--ev-line, var(--line))";
const ink = "var(--ev-ink, var(--ink))";

/** A line through one number per cycle, with the last point marked. One value draws a single dot. */
export function Sparkline({ values, labels, format = (n: number) => String(n) }: { values: number[]; labels: string[]; format?: (n: number) => string }) {
  const W = 240;
  const H = 70;
  const padX = 8;
  const padY = 10;
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values, 1);
  const x = (i: number) => (values.length === 1 ? W / 2 : padX + (i * (W - padX * 2)) / (values.length - 1));
  const y = (v: number) => H - padY - ((v - lo) / (hi - lo || 1)) * (H - padY * 2);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const area = values.length > 1 ? `M${x(0)},${H - padY} L${pts.join(" L")} L${x(values.length - 1)},${H - padY} Z` : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={values.map((v, i) => `${labels[i]}: ${format(v)}`).join(", ")} style={{ width: "100%", height: "auto", display: "block" }}>
      <line x1={padX} x2={W - padX} y1={H - padY} y2={H - padY} stroke={line} strokeWidth="1" />
      {area && <path d={area} fill={teal} opacity="0.12" />}
      {values.length > 1 && <polyline points={pts.join(" ")} fill="none" stroke={teal} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 4.5 : 3} fill={i === values.length - 1 ? teal : "none"} stroke={teal} strokeWidth="2" />
      ))}
    </svg>
  );
}

/** Conversations per month. A month under the floor is drawn as a dashed stub and labelled "<5". */
export function MonthBars({ activity }: { activity: Activity }) {
  const n = activity.totals.length;
  const W = Math.max(360, n * 110);
  const H = 190;
  const base = H - 34;
  const top = 26;
  const bw = Math.min(54, (W / n) * 0.55);
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Conversations by month: ${activity.totals.map((t) => `${monthLabel(t.month)} ${t.n ?? "fewer than 5"}`).join(", ")}`} style={{ width: "100%", minWidth: n * 64, maxWidth: W * 1.35, height: "auto", display: "block" }}>
        <line x1="0" x2={W} y1={base} y2={base} stroke={line} />
        {activity.totals.map((t, i) => {
          const cx = ((i + 0.5) * W) / n;
          const h = t.n === null ? 14 : Math.max(6, (t.n / activity.max) * (base - top));
          return (
            <g key={t.month}>
              <rect x={cx - bw / 2} y={base - h} width={bw} height={h} rx="5" fill={t.n === null ? "none" : teal} opacity={t.n === null ? 1 : 0.85} stroke={t.n === null ? muted : "none"} strokeDasharray={t.n === null ? "4 3" : undefined} />
              <text x={cx} y={base - h - 7} textAnchor="middle" fontSize="13" fontWeight="600" fill={t.n === null ? muted : ink}>
                {t.n === null ? "<5" : t.n}
              </text>
              <text x={cx} y={H - 12} textAnchor="middle" fontSize="12" fill={muted}>
                {monthLabel(t.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Departments down, months across. Darker means more conversations; a cell under the floor says "<5". */
export function HeatGrid({ activity, hidden = [] }: { activity: Activity; hidden?: string[] }) {
  const cellStyle = { padding: "9px 10px", textAlign: "center" as const, border: `1px solid ${line}`, fontSize: 13, minWidth: 74 };
  return (
    <>
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 120 + activity.months.length * 78 }}>
        <thead>
          <tr>
            <th />
            {activity.months.map((m) => (
              <th key={m} scope="col" style={{ ...cellStyle, border: 0, borderBottom: `1px solid ${line}`, fontWeight: 600, color: muted, fontSize: 12 }}>
                {monthLabel(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activity.departments.map((d) => (
            <tr key={d}>
              <th scope="row" style={{ ...cellStyle, border: 0, borderBottom: `1px solid ${line}`, textAlign: "left", fontWeight: 600 }}>
                {d}
              </th>
              {activity.months.map((m) => {
                const n = activity.cell(d, m);
                const pct = n === null ? 0 : Math.round(18 + (n / activity.max) * 62);
                return (
                  <td key={m} style={{ ...cellStyle, background: n === null ? "transparent" : `color-mix(in srgb, ${teal} ${pct}%, transparent)`, color: n === null ? muted : ink, fontWeight: n === null ? 400 : 600 }} title={n === null ? "Fewer than 5 conversations" : `${n} conversations`}>
                    {n === null ? "<5" : n}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <HiddenGroups names={hidden} />
    </>
  );
}
