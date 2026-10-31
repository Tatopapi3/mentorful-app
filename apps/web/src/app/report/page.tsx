import { loadReportStats } from "@/lib/report/data";
import { buildFindings } from "@/lib/report/findings";
import { SLIDE_COUNT } from "@/lib/report/deck";
import { DeckToolbar, SlideActions } from "./DeckExport";
import IntroSlide from "./slides/IntroSlide";
import BarsSlide from "./slides/BarsSlide";
import NetworkSlide from "./slides/NetworkSlide";
import GapSlide from "./slides/GapSlide";
import StartHereSlide from "./slides/StartHereSlide";
import ActionsSlide from "./slides/ActionsSlide";
import { AuroraPublic } from "@/components/aurora/public-frame";

/**
 * Culture Scan report — previews the six 16:9 deck slides stacked.
 *
 * Server component: the service-key read and the whole stats computation happen
 * here, and only the aggregate reaches the slides. No response row is ever
 * serialized to the client — only dimension-level aggregates.
 *
 * ⚠️ DEMO/PILOT: this page is intentionally PUBLIC (no auth gate) so principals
 * can open it during a demo and it just works. It currently shows SYNTHETIC data
 * behind the amber banner. Before any real school's data goes live this MUST be
 * re-gated (auth + school/role scoping) and the synthetic rows wiped — see the
 * "Demo/pilot open access" section in CLAUDE.md.
 */

// Reads the DB on every request; never prerender at build time.
export const dynamic = "force-dynamic";

export const metadata = { title: "Culture Scan report" };


export default async function ReportPage() {
  const load = await loadReportStats();

  if (load.status === "misconfigured") {
    return (
      <AuroraPublic>
        <Heading />
        <p className="ap-error">{load.message}</p>
      </AuroraPublic>
    );
  }

  if (load.status === "no-data") {
    return (
      <AuroraPublic>
        <Heading />
        <p className="ev-lead">No responses yet. The report unlocks once staff have taken the scan.</p>
      </AuroraPublic>
    );
  }

  if (load.status === "below-floor") {
    return (
      <AuroraPublic>
        <Heading />
        <div className="ap-card">
          {load.reason === "no-headcount" ? (
            <p>
              {load.n} {load.n === 1 ? "response" : "responses"} so far, but the school record has no faculty headcount.
              The report opens once 60% of the roster has responded, so it needs the headcount to know what 60% is.
            </p>
          ) : (
            <p>
              {load.n} {load.n === 1 ? "response" : "responses"} so far, below the {load.floor}
              {load.reason === "participation" ? " needed (60% of the roster)" : "-response floor"}. The report stays closed
              until enough staff have taken the scan to keep individual answers unidentifiable and the picture representative.
            </p>
          )}
        </div>
      </AuroraPublic>
    );
  }

  const { stats } = load;
  const findings = buildFindings(stats);
  const synthetic = load.includesSynthetic;
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
      node: (
        <NetworkSlide
          stats={stats}
          finding={findings.network.finding.sentence}
          synthetic={synthetic}
          footerLeft={footerLeft}
        />
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
    <AuroraPublic>
      <p className="ev-eyebrow">Culture Scan report</p>
      <h1>
        School <em>Culture Scan</em>
      </h1>
      <p className="ev-lead">
        {stats.n} respondents · {stats.itemTotal} items · wave 1 · {SLIDE_COUNT} slides, 16:9
      </p>

      {synthetic && (
        <div className="ap-notice" role="note">
          <span aria-hidden>⚠</span>
          <span>
            <strong>Synthetic demo data — not real staff responses.</strong> Every number and finding below is generated. Clear the synthetic rows before
            showing this to a school.
          </span>
        </div>
      )}

      <div style={{ margin: "24px 0" }}>
        <DeckToolbar count={SLIDE_COUNT} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        {slides.map((slide, i) => (
          <section key={slide.name}>
            <div className="ap-slide">{slide.node}</div>
            <SlideActions index={i + 1} name={slide.name} />
          </section>
        ))}
      </div>
    </AuroraPublic>
  );
}

function Heading() {
  return (
    <>
      <p className="ev-eyebrow">Culture Scan report</p>
      <h1>
        School <em>Culture Scan</em>
      </h1>
    </>
  );
}
