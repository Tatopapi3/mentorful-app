"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "@/components/nick/nick-admin.css";
import { TeacherLookSwitch } from "./teacher-look-switch";

const TABS = [
  { path: "", label: "Home", exact: true },
  { path: "/pair", label: "My pair" },
  { path: "/journal", label: "Journal" },
  { path: "/growth", label: "Growth" },
  { path: "/scan", label: "Culture Scan" },
];

/** The teacher tabs in Nick's look: his mono tab bar (the same one the leadership views use), with a switch to Aurora. */
export function TeacherNickTabs({ base }: { base: string }) {
  const pathname = usePathname();
  return (
    <nav className="nk-tabs ta-nick-tabs" aria-label="Teacher views">
      {TABS.map((t) => {
        const href = `${base}${t.path}`;
        const on = t.exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
      <span className="nk-spacer" />
      <Link className="nk-btn nk-primary" href={`${base}/journal#log`}>
        + Log a conversation
      </Link>
      <TeacherLookSwitch current="nick" />
    </nav>
  );
}
