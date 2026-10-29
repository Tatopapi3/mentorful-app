import { AuroraChrome } from "@/components/aurora/chrome";
import { CallHost } from "@/components/teacher/video-call";
import { ChatDrawer } from "@/components/teacher/chat-drawer";
import { MobileTabs } from "@/components/teacher/mobile-tabs";
import { NickTeacherChrome } from "@/components/teacher/nick-chrome";
import { TeacherLookSwitch } from "@/components/teacher/teacher-look-switch";
import { TimeTracker } from "@/components/teacher/time-tracker";
import { loadHub } from "@/lib/teacher/hub-data";
import { loadTeacher } from "@/lib/teacher/load";
import { teacherBase, teacherLookOf } from "@/lib/teacher/look";
import "@/components/teacher/teacher.css";
import { FEATURES } from "@/lib/teacher/features";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your dashboard" };

// The teacher's side in two looks from one set of pages: Aurora (the same shell as the leadership views: floating bar,
// palette, Day/Night) and Nick's (his header and tab bar, paper and serif). Same tabs, same features; only the design
// differs, so the two can be compared side by side. The look is /dashboard/aurora/... or /dashboard/nick/...
export default async function TeacherLayout({ children, params }: { children: React.ReactNode; params: Promise<{ look: string }> }) {
  const look = await teacherLookOf(params);
  const BASE = teacherBase(look);
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

  const body = (
    <>
      <div className="ta">{children}</div>
      {look === "aurora" ? <MobileTabs /> : null}
      <ChatDrawer pairs={chatPairs} initial={hub.messages} />
      {FEATURES.videoCalls ? <CallHost pairs={chatPairs} meId={model.me.id} /> : null}
      <TimeTracker />
    </>
  );

  if (look === "nick") {
    return (
      <NickTeacherChrome base={BASE} displayName={model.me.name} schoolName={schoolName}>
        {body}
      </NickTeacherChrome>
    );
  }

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
    { href: "/dashboard/nick", label: "Switch to Nick’s look", hint: "Look" },
  ];
  return (
    <AuroraChrome schoolName={schoolName} displayName={model.me.name} roleLabel="Teacher" nav={NAV} actions={ACTIONS} primary={{ href: `${BASE}/journal#log`, label: "+ Log a conversation" }} tools={<TeacherLookSwitch current="aurora" />}>
      {body}
    </AuroraChrome>
  );
}
