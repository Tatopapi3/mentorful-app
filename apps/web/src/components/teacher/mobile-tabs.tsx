"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
import { useBase } from "./use-base";

const TABS: { path: string; label: string; icon: IconName; exact?: boolean }[] = [
  { path: "", label: "Home", icon: "home", exact: true },
  { path: "/pair", label: "My pair", icon: "users" },
  { path: "/journal", label: "Journal", icon: "book" },
  { path: "/growth", label: "Growth", icon: "growth" },
  { path: "/scan", label: "Scan", icon: "scan" },
];

/** Between classes a teacher is on a phone, so the four tabs move to the thumb on narrow screens. */
export function MobileTabs() {
  const path = usePathname();
  const base = useBase();
  return (
    <nav aria-label="Primary, mobile" className="ta-tabs">
      {TABS.map((t) => {
        const href = `${base}${t.path}`;
        const on = t.exact ? path === href : path === href || path.startsWith(`${href}/`);
        return (
          <Link key={t.path} href={href} aria-current={on ? "page" : undefined}>
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
