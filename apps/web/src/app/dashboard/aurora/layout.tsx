import { AuroraChrome } from "@/components/aurora/chrome";
import { ChatDrawer } from "@/components/teacher/chat-drawer";
import { MobileTabs } from "@/components/teacher/mobile-tabs";
import { TimeTracker } from "@/components/teacher/time-tracker";
import { CallHost } from "@/components/teacher/video-call";
import { loadHub } from "@/lib/teacher/hub-data";
import { loadTeacher } from "@/lib/teacher/load";
import "@/components/teacher/teacher.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your dashboard" };

const BASE = "/dashboard/aurora";
const NAV = [
  { href: BASE, label: "Home", exact: true },
  { href: `${BASE}/pair`, label: "My pair" },
  { href: `${BASE}/journal`, label: "Journal" },
  { href: `${BASE}/growth`, label: "Growth" },
  { href: `${BASE}/scan`, label: "Culture Scan" },
];
const ACTIONS = [
  { href: `${BASE}/journal#log`, label: "Log a conversation", hint: "Journal" },
  { href: `${BASE}/journal#notebook`, label: "Read my private notebook", hint: "Journal" },
  { href: `${BASE}/journal?tab=future#future`, label: "Write a note to my future self", hint: "Journal" },
  { href: `${BASE}/pair`, label: "See my co-mentor", hint: "My pair" },
  { href: `${BASE}/growth`, label: "Open the growth hub", hint: "Growth" },
  { href: `${BASE}/growth#goals`, label: "Set or review my goals", hint: "Growth" },
  { href: `${BASE}/growth#games`, label: "Play a pedagogy game with my co-mentor", hint: "Growth" },
  { href: `${BASE}/growth#practice`, label: "Add to my practice log", hint: "Growth" },
  { href: "/survey", label: "Take the Culture Scan", hint: "Anonymous" },
];

// The teacher's side in the same Aurora shell as the leadership views: same bar, palette and Day/Night switch, so
// the two halves of the product read as one. Four tabs, and a "+ Log" button that is always one tap away.
export default async function TeacherAuroraLayout({ children }: { children: React.ReactNode }) {
  const data = await loadTeacher();
  if (!data.model) {
    return (
      <main style={{ maxWidth: 640, margin: "64px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Your dashboard</h1>
        <p>No teacher profile is linked to {data.email}. Ask your school lead to add you to the roster.</p>
      </main>
    );
  }
  const { model, schoolName } = data;
  const hub = await loadHub();
  const chatPairs = model.partners.map((p) => ({ pairingId: p.pairingId, partnerName: p.name, partnerFirst: p.first, initials: p.initials }));
  return (
    <AuroraChrome
      schoolName={schoolName}
      displayName={model.me.name}
      roleLabel="Teacher"
      nav={NAV}
      actions={ACTIONS}
      primary={{ href: `${BASE}/journal#log`, label: "+ Log a conversation" }}
    >
      <div className="ta">{children}</div>
      <MobileTabs />
      <ChatDrawer pairs={chatPairs} initial={hub.messages} />
      <CallHost pairs={chatPairs} meId={model.me.id} />
      <TimeTracker />
    </AuroraChrome>
  );
}
