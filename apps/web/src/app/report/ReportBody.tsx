import type { ReportLoad } from "@/lib/report/data";
import { buildFindings } from "@/lib/report/findings";
import { SLIDE_COUNT } from "@/lib/report/deck";
import { DeckToolbar, SlideActions } from "./DeckExport";
import IntroSlide from "./slides/IntroSlide";
import BarsSlide from "./slides/BarsSlide";
import NetworkSlide from "./slides/NetworkSlide";
import GapSlide from "./slides/GapSlide";
import StartHereSlide from "./slides/StartHereSlide";
import ActionsSlide from "./slides/ActionsSlide";
import NetworkLockedSlide from "./slides/NetworkLockedSlide";
import { cteScore } from "@/lib/report/headline";
import { gateSentence, NETWORK_FLOOR } from "@/lib/report/gates";
import SiteHeader from "@/components/SiteHeader";

/**
 * The report body: the six 16:9 slides stacked, plus the banners that say how much to trust them.
 * Server component. Only dimension-level aggregates reach the slides; no response row is ever serialized
 * to the client. The caller decides who may see it (see page.tsx and sample-report/page.tsx).
 */
const page: React.CSSProperties = { maxWidth: 1120, margin: "40px auto", padding: 24 };

export default function ReportBody({ load }: { load: ReportLoad }) {
  if (load.status === "misconfigured") {
    return (
      <>
        <SiteHeader />
        <main style={page}>
          <h1>Culture Scan report</h1>
          <p style={{ color: "#d03b3b" }}>{load.message}</p>
        </main>
      </>
    );
  }

  if (load.status === "no-data") {
    return (
      <>
        <SiteHeader />
        <main style={page}>
          <h1>Culture Scan report</h1>
          <p>No responses yet. The report unlocks once staff have taken the scan.</p>
        </main>
      </>
    );
  }

  if (load.status === "below-floor") {
    return (
      <>
        <SiteHeader />
        <main style={page}>
          <h1>Culture Scan report</h1>
          <p>
            {load.n} {load.n === 1 ? "response" : "responses"} so far, below the {load.floor}
            -response floor. Nothing is shown until enough staff have taken the scan to keep
            individual answers unidentifiable.
          </p>
        </main>
      </>
    );
  }

  const { stats, gates } = load;
  const findings = buildFindings(stats);
  const synthetic = load.includesSynthetic;
  const cte = cteScore(stats);
  const footerLeft = `School Culture Scan · wave 1 · ${stats.n} respondents`;

  const slides = [
    {
      name: "intro",
      node: <IntroSlide synthetic={synthetic} footerLeft={footerLeft} />,
    },
    {
      name: "dimension-means",
      node: (
        <BarsSlide
          stats={stats}
          finding={findings.loadBearing.finding.sentence}
          synthetic={synthetic}
          footerLeft={footerLeft}
        />
      ),
    },
    {
      name: "network",
      node: gates.network ? (
        <NetworkSlide
          stats={stats}
          finding={findings.network.finding.sentence}
          synthetic={synthetic}
          footerLeft={footerLeft}
        />
      ) : (
        <NetworkLockedSlide n={stats.n} floor={NETWORK_FLOOR} synthetic={synthetic} footerLeft={footerLeft} />
      ),
    },
    {
      name: "efficacy-structure-gap",
      node: (
        <GapSlide
          gap={findings.gap}
          finding={findings.gap.finding.sentence}
          synthetic={synthetic}
          footerLeft={footerLeft}
        />
      ),
    },
    {
      name: "start-here",
      node: (
        <StartHereSlide
          stats={stats}
          weakest={findings.weakest}
          finding={findings.weakest.finding.sentence}
          synthetic={synthetic}
          footerLeft={footerLeft}
        />
      ),
    },
    {
      name: "actions",
      node: (
        <ActionsSlide
          weakest={findings.weakest.dimension}
          synthetic={synthetic}
          footerLeft={footerLeft}
        />
      ),
    },
  ];

  return (
    <>
      <SiteHeader />
      <main style={page}>
        <h1 style={{ marginBottom: 4 }}>School Culture Scan</h1>
        <p style={{ marginTop: 0, color: "#52514e" }}>
          {stats.n} respondents · {stats.itemTotal} items · wave 1 · {SLIDE_COUNT} slides, 16:9
        </p>

        <div style={{ display: "flex", alignItems: "baseline", gap: 14, margin: "18px 0 0" }}>
          <span style={{ fontSize: 14, color: "#52514e" }}>CTE score</span>
          <strong style={{ fontSize: 34 }}>{cte.score.toFixed(1)}</strong>
          <span style={{ fontSize: 14, color: "#52514e" }}>
            out of 6 · the Efficacy average · ±{cte.ciHalfWidth.toFixed(1)} (95%) · n = {cte.n}
          </span>
        </div>

        {load.status === "early-look" && (
          <div
            role="status"
            style={{
              margin: "20px 0",
              padding: "14px 16px",
              background: "#fdf3dc",
              borderLeft: "6px solid #fab219",
              borderRadius: 4,
              fontSize: 14,
              color: "#0b0b0b",
            }}
          >
            <strong>Early look, not yet representative.</strong> {gateSentence(gates)} Groups under {gates.cellFloor} people are never shown.
          </div>
        )}

        {synthetic && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "20px 0",
              padding: "14px 16px",
              background: "#fdf3dc",
              borderLeft: "6px solid #fab219",
              borderRadius: 4,
            }}
          >
            <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>
              ⚠
            </span>
            <span style={{ fontSize: 14, color: "#0b0b0b" }}>
              <strong>Synthetic demo data — not real staff responses.</strong> Every number and
              finding below is generated. Clear the synthetic rows before showing this to a school.
            </span>
          </div>
        )}

        <div style={{ margin: "24px 0" }}>
          <DeckToolbar count={SLIDE_COUNT} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {slides.map((slide, i) => (
            <section key={slide.name}>
              <div style={{ border: "1px solid rgba(11,11,11,0.10)", borderRadius: 8, overflow: "hidden" }}>
                {slide.node}
              </div>
              <SlideActions index={i + 1} name={slide.name} />
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
