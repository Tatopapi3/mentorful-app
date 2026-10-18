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
        <strong>Preview mode.</strong> These are Nick&apos;s real pages running on made-up data (50 invented teachers, 32 pairings, 32
        conversations, 50 synthetic survey respondents). There is no database, nothing is saved, and nothing you do here reaches Nick&apos;s app.
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
        <li><a href="/preview/as/admin?next=/admin">Leadership dashboard</a></li>
        <li><a href="/preview/as/admin?next=/admin/map">Faculty map</a></li>
      </ul>
      <h2>As a teacher</h2>
      <ul>
        <li><a href="/preview/as/teacher?next=/dashboard">Teacher dashboard</a> (Linda Johnson: two pairings, one draft conversation to submit)</li>
      </ul>
      <p style={{ color: "#555" }}>Switching between admin and teacher happens through the links above. Restarting the preview resets the data.</p>
    </main>
  );
}
