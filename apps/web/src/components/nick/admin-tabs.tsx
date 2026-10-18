"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SwitchLook } from "@/components/aurora/switch-look";
import "./nick-admin.css";

const TABS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/pulse", label: "Pulse" },
  { href: "/admin/constellation", label: "Constellation" },
  { href: "/admin/insights", label: "Insights" },
  { href: "/admin/map", label: "Faculty map" },
];

/** The leadership tabs in Nick's look, with a switch to the Aurora look on the same tab. */
export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="nk-tabs" aria-label="Leadership views">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={(t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`)) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
      <span className="nk-spacer" />
      <SwitchLook current="nick" />
    </nav>
  );
}
