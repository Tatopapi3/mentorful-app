import { NoticePage } from "@/components/aurora/notice-page";
import { AuroraChrome } from "@/components/aurora/chrome";
import { CallHost } from "@/components/teacher/video-call";
import { ChatDrawer } from "@/components/teacher/chat-drawer";
import { MobileTabs } from "@/components/teacher/mobile-tabs";
import { TimeTracker } from "@/components/teacher/time-tracker";
import { loadHub } from "@/lib/teacher/hub-data";
import { loadTeacher } from "@/lib/teacher/load";
import { teacherBase } from "@/lib/teacher/look";
import "@/components/teacher/teacher.css";
import { FEATURES } from "@/lib/teacher/features";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your dashboard" };

// The teacher's side in the Aurora shell, the same as the leadership views: floating bar, palette, Day and Night.
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const BASE = teacherBase();
  const data = await loadTeacher();
  if (!data.model) {
    return (
      <NoticePage eyebrow="Your dashboard" title="No teacher profile is linked yet" signedIn>
        <p>No teacher profile is linked to {data.email}. Ask your school lead to add you to the roster.</p>
      </NoticePage>
    );
  }
  const { model, schoolName } = data;
  const hub = await loadHub();
  const chatPairs = model.partners.map((p) => ({ pairingId: p.pairingId, partnerName: p.name, partnerFirst: p.first, initials: p.initials }));

  const body = (
    <>
      <div className="ta">{children}</div>
      <MobileTabs />
      <ChatDrawer pairs={chatPairs} initial={hub.messages} />
      {FEATURES.videoCalls ? <CallHost pairs={chatPairs} meId={model.me.id} /> : null}
      <TimeTracker />
    </>
  );

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
    ...(FEATURES.games ? [{ href: `${BASE}/growth#games`, label: "Play a pedagogy game with my co-mentor", hint: "Growth" }] : []),
    { href: `${BASE}/growth#practice`, label: "Add to my practice log", hint: "Growth" },
    { href: "/survey", label: "Take the Culture Scan", hint: "Anonymous" },
  ];
  return (
    <AuroraChrome schoolName={schoolName} displayName={model.me.name} roleLabel="Teacher" nav={NAV} actions={ACTIONS} primary={{ href: `${BASE}/journal#log`, label: "+ Log a conversation" }}>
      {body}
    </AuroraChrome>
  );
}
