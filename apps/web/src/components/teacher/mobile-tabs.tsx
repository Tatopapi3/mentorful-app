"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

const TABS: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: "/dashboard/aurora", label: "Home", icon: "home", exact: true },
  { href: "/dashboard/aurora/pair", label: "My pair", icon: "users" },
  { href: "/dashboard/aurora/journal", label: "Journal", icon: "book" },
  { href: "/dashboard/aurora/growth", label: "Growth", icon: "growth" },
  { href: "/dashboard/aurora/scan", label: "Scan", icon: "scan" },
];

/** Between classes a teacher is on a phone, so the four tabs move to the thumb on narrow screens. */
export function MobileTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Primary, mobile" className="ta-tabs">
      {TABS.map((t) => {
        const on = t.exact ? path === t.href : path === t.href || path.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}>
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
