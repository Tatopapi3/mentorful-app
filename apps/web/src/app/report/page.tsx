import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

/**
 * Culture Scan report — previews the six 16:9 deck slides stacked.
 *
 * Server component: the service-key read and the whole stats computation happen
 * here, and only the aggregate reaches the slides. No response row is ever
 * serialized to the client.
 *
 * Signed-in only. The gate runs before loadReportStats, so an anonymous request
 * never reaches the service-key read at all — the redirect is the cheap path,
 * not an afterthought applied to already-fetched data.
 *
 * TODO: this is authentication, not authorization — any signed-in user can read
 * any school's aggregate. Scope to the user's school membership (and to
 * leadership roles) once memberships are modelled.
 */

// Reads the DB on every request; never prerender at build time.
export const dynamic = "force-dynamic";

export const metadata = { title: "Culture Scan report" };

const page: React.CSSProperties = { maxWidth: 1120, margin: "40px auto", padding: 24 };

export default async function ReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const load = await loadReportStats();

  if (load.status === "misconfigured") {
    return (
      <main style={page}>
        <h1>Culture Scan report</h1>
        <p style={{ color: "#d03b3b" }}>{load.message}</p>
      </main>
    );
  }

  if (load.status === "no-data") {
    return (
      <main style={page}>
        <h1>Culture Scan report</h1>
        <p>No responses yet. The report unlocks once staff have taken the scan.</p>
      </main>
    );
  }

  if (load.status === "below-floor") {
    return (
      <main style={page}>
        <h1>Culture Scan report</h1>
        <p>
          {load.n} {load.n === 1 ? "response" : "responses"} so far — below the {load.floor}
          -response floor. The report stays closed until enough staff have taken the scan to
          keep individual answers unidentifiable.
        </p>
      </main>
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
    <main style={page}>
      <h1 style={{ marginBottom: 4 }}>School Culture Scan</h1>
      <p style={{ marginTop: 0, color: "#52514e" }}>
        {stats.n} respondents · {stats.itemTotal} items · wave 1 · {SLIDE_COUNT} slides, 16:9
      </p>

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
  );
}
