import Link from "next/link";
import { AuroraPublic } from "@/components/aurora/public-frame";
import { STAGE_CHARACTERS } from "@/lib/preview/stageTables";

export const metadata = { title: "Demo Day" };
export const dynamic = "force-dynamic";

const BEATS: { who: string; what: string }[] = [
  { who: "Juan", what: "Pulse: the focus banner says 8 teachers still need a partner. Point at the privacy badge." },
  { who: "Juan", what: "Constellation: English and Science are the biggest missing link in the school." },
  { who: "Juan", what: "Pairing, then Draft new round. The map draws new links between English and Science. Approve 4 pairs." },
  { who: STAGE_CHARACTERS.first.split(" ")[0], what: "Home now shows a partner. Log a conversation, Save draft, then Submit this entry." },
  { who: STAGE_CHARACTERS.second.split(" ")[0], what: "Open Chat (bottom right) and send a message. It appears on the other teacher's screen." },
  { who: "Juan", what: "Pulse again: logged conversations goes from 9 to 10. The words of the entry are nowhere on this side." },
  { who: "Juan", what: "Trust page: the live check shows what leadership can read." },
  { who: "Juan", what: "Reports: the faculty map and Download PDF for the deck. Then Present." },
];

export default function Demo() {
  return (
    <AuroraPublic>
      <p className="ev-eyebrow">Demo Day stage</p>
      <h1>
        Three screens, <em>one story.</em>
      </h1>
      <p className="ev-lead">
        No sign-in. Use the bar at the bottom of every screen to change who you are, and <b>Reset</b> before each run. Use one tab: the
        role is shared by every tab in this browser.
      </p>

      <div className="ap-demos" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <Link className="ap-demo" href="/preview/as/admin?next=/admin/pulse">
          <b>Juan, the principal</b>
          <span>Pulse, Pairing, Constellation, Reports.</span>
        </Link>
        <Link className="ap-demo" href="/preview/as/teacher?next=/dashboard">
          <b>{STAGE_CHARACTERS.first}, English</b>
          <span>The teacher dashboard: partner, journal, chat.</span>
        </Link>
        <Link className="ap-demo" href="/preview/as/teacher?who=second&next=/dashboard">
          <b>{STAGE_CHARACTERS.second}, Science</b>
          <span>The same dashboard, as the other teacher.</span>
        </Link>
      </div>

      <h2 style={{ marginTop: 32 }}>The scene</h2>
      <ol style={{ paddingLeft: 20, display: "grid", gap: 8 }}>
        {BEATS.map((b, i) => (
          <li key={i}>
            <b>{b.who}.</b> {b.what}
          </li>
        ))}
      </ol>
      <p style={{ marginTop: 24 }}>
        <Link className="ev-btn" href="/preview/reset?next=/demo">
          Reset the demo
        </Link>
      </p>
    </AuroraPublic>
  );
}
