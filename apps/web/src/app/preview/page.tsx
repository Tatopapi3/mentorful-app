import Link from "next/link";
import { notFound } from "next/navigation";
import { previewEnabled } from "@/lib/preview";

export const dynamic = "force-dynamic";

const box: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 10, padding: "14px 18px", background: "#fff" };

// What each leadership page is for, in the order the tabs appear. Each exists in both looks.
const TABS: { name: string; path: string; what: string }[] = [
  { name: "Pulse", path: "pulse", what: "The landing page. One sentence on where the school stands, then the few things worth doing this week." },
  { name: "Pairing", path: "pairings", what: "Approve or decline requests, run a randomized round, review it, then publish." },
  { name: "Overview", path: "overview", what: "The detail behind Pulse: the survey results, every pair, every number." },
  { name: "Constellation", path: "constellation", what: "The faculty as a sky, with progress, where to head next, suggested pairs and a department grid." },
  { name: "Insights", path: "insights", what: "What the survey says, in plain language, with the confidence that goes with it." },
  { name: "Faculty map", path: "map", what: "Nick's interactive map of the faculty." },
  { name: "Board summary", path: "summary", what: "One printable page for the board." },
  { name: "Trust", path: "privacy", what: "What leadership can and cannot see, with live counts of the private rows." },
];

const as = (role: string, next: string) => `/preview/as/${role}?next=${next}`;
const href = (look: "nick" | "aurora", path: string) => as("admin", look === "nick" ? `/admin/${path}` : `/admin/aurora/${path}`);

/** A map of every page, for the preview. Made-up data, no database. */
export default function PreviewHub() {
  if (!previewEnabled()) notFound();
  return (
    <main style={{ maxWidth: 940, margin: "40px auto", padding: 24, fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
      <div style={{ ...box, background: "#fdf3dc", borderColor: "#fab219" }}>
        <strong>Preview mode.</strong> These are the real pages running on made-up data (50 invented teachers in 7 departments, two cycles,
        pairings, requests, conversations and 50 synthetic survey respondents). There is no database, nothing is saved, and nothing you do
        here reaches Nick&apos;s app. Restarting the preview resets the data.
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
      <p>The same eight pages come in two looks: <strong>Nick&apos;s look</strong> (his paper-and-teal design and fonts) and the <strong>Aurora look</strong>. Each look is consistent on every tab, and a switch in the top bar moves between them on the same tab.</p>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 15 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
            <th style={{ padding: 8 }}>Page</th>
            <th style={{ padding: 8 }}>Nick&apos;s look</th>
            <th style={{ padding: 8 }}>Aurora look</th>
            <th style={{ padding: 8 }}>What it is for</th>
          </tr>
        </thead>
        <tbody>
          {TABS.map((t) => (
            <tr key={t.path} style={{ borderBottom: "1px solid #eee", verticalAlign: "top" }}>
              <td style={{ padding: 8, fontWeight: 600 }}>{t.name}</td>
              <td style={{ padding: 8 }}><a href={href("nick", t.path)}>Open</a></td>
              <td style={{ padding: 8 }}><a href={href("aurora", t.path)}>Open</a></td>
              <td style={{ padding: 8, color: "#444" }}>{t.what}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>The results spreadsheet downloads from <a href="/admin/export/results.csv">/admin/export/results.csv</a> (open it after you are signed in as the admin).</p>
      <h2>As a teacher</h2>
      <ul>
        <li><a href={as("teacher", "/dashboard")}>Teacher dashboard</a> (Linda Johnson: two pairings, one draft conversation to submit)</li>
      </ul>
      <p style={{ color: "#555" }}>Switching between admin and teacher happens through the links above.</p>
    </main>
  );
}
