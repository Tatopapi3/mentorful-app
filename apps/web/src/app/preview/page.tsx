import Link from "next/link";
import { notFound } from "next/navigation";
import { previewEnabled } from "@/lib/preview";

export const dynamic = "force-dynamic";

const box: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 10, padding: "14px 18px", background: "#fff" };

/** A map of every page Nick's app has, for the local preview. Made-up data, no database. */
export default function PreviewHub() {
  if (!previewEnabled()) notFound();
  return (
    <main style={{ maxWidth: 860, margin: "40px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ ...box, background: "#fdf3dc", borderColor: "#fab219" }}>
        <strong>Preview mode.</strong>{" "}
        {process.env.PREVIEW_DATASET === "nick" ? (
          <>These are the real pages running on the sandbox school from Nick&apos;s database file (50 demo teachers, 32 pairings, 32 conversation logs, 56 survey respondents of whom 50 are synthetic). Nothing here is a real school. There is no live database, nothing is saved, and nothing you do here reaches Nick&apos;s app. Restarting resets the data.</>
        ) : (
          <>These are the real pages running on made-up data (50 invented teachers in 7 departments, two cycles, pairings, requests, conversations and 50 synthetic survey respondents). There is no database, nothing is saved, and nothing you do here reaches Nick&apos;s app. Restarting the preview resets the data.</>
        )}
      </div>
      <h1>Every page in the app</h1>
      <h2>Public pages</h2>
      <ul>
        <li><Link href="/">Landing</Link></li>
        <li><Link href="/login">Sign in</Link></li>
        <li><Link href="/survey">The Culture Scan survey</Link> (26 questions; answers are discarded)</li>
        <li><Link href="/report">The six-slide report</Link> (on the synthetic respondents)</li>
      </ul>
      <h2>As the school admin</h2>
      <ul>
        <li><a href="/preview/as/admin?next=/admin/pulse">Pulse</a> (landing page) · <a href="/preview/as/admin?next=/admin/pairings">Pairing</a> · <a href="/preview/as/admin?next=/admin/overview">Overview</a> · <a href="/preview/as/admin?next=/admin/constellation">Constellation</a> · <a href="/preview/as/admin?next=/admin/insights">Insights</a> · <a href="/preview/as/admin?next=/admin/reports">Reports</a> (with the faculty map)</li>
        <li><a href="/preview/as/admin?next=/admin/summary">Board summary</a> · <a href="/preview/as/admin?next=/admin/privacy">Trust page</a> · <a href="/preview/as/admin?next=/admin/map">Faculty map, full size</a></li>
      </ul>
      <h2>As a teacher</h2>
      <ul>
        <li><a href="/preview/as/teacher?next=/dashboard">Home</a> · <a href="/preview/as/teacher?next=/dashboard/pair">My pair</a> · <a href="/preview/as/teacher?next=/dashboard/pair/lookbook">Lookbook</a> · <a href="/preview/as/teacher?next=/dashboard/journal">Journal</a> · <a href="/preview/as/teacher?next=/dashboard/growth">Growth</a> (with the CTLE tracker) · <a href="/preview/as/teacher?next=/dashboard/scan">Culture Scan</a> (the sample teacher is Linda Johnson: two pairings, one draft conversation to submit)</li>
      </ul>
      <p style={{ color: "#555" }}>Approvals and declines you make are kept in your own browser only. <a href="/preview/reset">Reset my changes</a> to start over.</p>
      <p style={{ color: "#555" }}>Switching between admin and teacher happens through the links above. Restarting the preview resets the data.</p>
    </main>
  );
}
