import { BarList, Muted, Panel, StatGrid, type Skin } from "@/components/admin/kit";
import { ctleNotEnough, notEnough, readCtle, readGrowth, type CtleReadingRaw, type GrowthActivity } from "@/lib/admin/growth";

/**
 * How teachers are using the growth tools, as anonymous school-wide totals. Only teachers who opted in count, nothing
 * is per person, percentages are rounded to 5, and under 5 sharing teachers shows nothing at all (see 019). It says
 * what it is: use of the tools, not a measure of how well anyone teaches, and not growth itself.
 */
export default function GrowthActivityPanel({ skin, data, ctle }: { skin: Skin; data: GrowthActivity | null; ctle?: CtleReadingRaw | null }) {
  return (
    <>
      <GrowthTotals skin={skin} data={data} />
      <CtlePulse skin={skin} data={ctle ?? null} />
    </>
  );
}

function GrowthTotals({ skin, data }: { skin: Skin; data: GrowthActivity | null }) {
  if (!data) {
    return (
      <Panel skin={skin} title="Growth activity" eyebrow="Teachers using the growth tools" count="needs the growth totals function">
        <Muted skin={skin}>
          Growth totals come from a small database function that returns school-wide percentages and never a person (script 019, not applied yet). Until then this panel stays empty rather than guessing.
        </Muted>
      </Panel>
    );
  }
  const r = readGrowth(data);
  if (!r) {
    return (
      <Panel skin={skin} title="Growth activity" eyebrow="Teachers using the growth tools" count="not enough sharing yet">
        <Muted skin={skin}>{notEnough(data)}</Muted>
        <Muted skin={skin}>Teachers choose this for themselves, from the Growth tab. Nothing about a teacher who hasn&rsquo;t chosen it is counted anywhere.</Muted>
      </Panel>
    );
  }
  return (
    <Panel skin={skin} title="Growth activity" eyebrow="Teachers using the growth tools" count={`last ${data.window_days} days`}>
      <StatGrid skin={skin} items={r.headline} />
      <ul style={{ margin: "14px 0 4px", paddingLeft: 18 }}>
        {r.sentences.map((s) => (
          <li key={s} style={{ marginBottom: 4 }}>{s}</li>
        ))}
      </ul>
      {r.buckets.length > 0 && (
        <>
          <p style={{ margin: "14px 0 4px", fontWeight: 600 }}>Days active, of those sharing</p>
          <BarList skin={skin} rows={r.buckets} max={100} suffix="%" />
        </>
      )}
      {r.trend.length > 0 && (
        <>
          <p style={{ margin: "14px 0 4px", fontWeight: 600 }}>Active each week, of those sharing</p>
          <BarList skin={skin} rows={r.trend} max={100} suffix="%" />
        </>
      )}
      <Muted skin={skin}>
        Only teachers who chose to share are counted, and the figures are rounded to the nearest 5%. You see school-wide totals, never a name, a department or one person&rsquo;s minutes.
        Teachers who choose to share are likely more engaged than the rest, so read these as the picture among volunteers, not the whole faculty. This shows whether the growth tools are being used. It does not show how well anyone teaches, and time spent is not the same as growth: the change you can trust is the Culture Scan, taken again later.
      </Muted>
    </Panel>
  );
}

/**
 * Are teachers on pace for the state's Continuing Teacher and Leader Education requirement (100 hours per 5-year
 * registration period in New York)? Only teachers who set the tracker up and opted in to anonymous totals count; the
 * database returns rounded school-wide shares and withholds anything under 5 teachers (script 020).
 */
function CtlePulse({ skin, data }: { skin: Skin; data: CtleReadingRaw | null }) {
  if (!data) {
    return (
      <Panel skin={skin} title="CTLE hours" eyebrow="Professional development requirement" count="needs the CTLE totals function">
        <Muted skin={skin}>
          Teachers can keep a private count of their Continuing Teacher and Leader Education hours. School leaders see only a rounded, anonymous share of teachers on pace, from a small database function (script 020, not applied yet). Until then this panel stays empty rather than guessing.
        </Muted>
      </Panel>
    );
  }
  const r = readCtle(data);
  if (!r) {
    return (
      <Panel skin={skin} title="CTLE hours" eyebrow="Professional development requirement" count="not enough sharing yet">
        <Muted skin={skin}>{ctleNotEnough(data)}</Muted>
      </Panel>
    );
  }
  return (
    <Panel skin={skin} title="CTLE hours" eyebrow="Professional development requirement" count="100 hours per 5-year period">
      <StatGrid skin={skin} items={r.headline} />
      <p style={{ margin: "14px 0 4px", fontWeight: 600 }}>Where the teachers tracking their hours stand</p>
      <BarList skin={skin} rows={r.rows} max={100} suffix="%" />
      <Muted skin={skin}>
        Only teachers who set up the tracker and chose to share are counted, and the figures are rounded to the nearest 5%. You never see a name, a department or one person&rsquo;s hours. &ldquo;On pace&rdquo; means a teacher&rsquo;s approved-sponsor hours, and their language-acquisition hours, are at least what an even pace across their registration period would give by today. Mentorful is the teacher&rsquo;s own record, not the state&rsquo;s, so use this to plan sessions your district sponsors, not to check on individuals.
      </Muted>
    </Panel>
  );
}
