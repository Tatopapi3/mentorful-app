"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SwitchLook } from "@/components/aurora/switch-look";
import "./nick-admin.css";

const TABS = [
  { href: "/admin/pulse", label: "Pulse" },
  { href: "/admin/pairings", label: "Pairing" },
  { href: "/admin/overview", label: "Overview" },
  { href: "/admin/constellation", label: "Constellation" },
  { href: "/admin/insights", label: "Insights" },
  { href: "/admin/trends", label: "Trends" },
  { href: "/admin/map", label: "Faculty map" },
  { href: "/admin/reports", label: "Reports" },
];

/** The leadership tabs in Nick's look, with a switch to the Aurora look on the same tab. */
export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="nk-tabs" aria-label="Leadership views">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={pathname === t.href || pathname.startsWith(`${t.href}/`) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
      <span className="nk-spacer" />
      <SwitchLook current="nick" />
    </nav>
  );
}
