"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ENABLED_LOOKS, type LookName } from "@/lib/admin/looks";
import "./looks.css";

const LOOKS: { id: LookName; label: string }[] = ([
  { id: "nick", label: "Nick" },
  { id: "aurora", label: "Aurora" },
  { id: "blend", label: "Blend" },
] as { id: LookName; label: string }[]).filter((l) => ENABLED_LOOKS.includes(l.id));

/**
 * Jumps between the three looks of the leadership views, staying on the same tab. Nick's look lives under /admin,
 * Aurora under /admin/aurora and the blend under /admin/blend, so it is the same tab path with a different prefix.
 */
export function SwitchLook({ current }: { current: LookName }) {
  const pathname = usePathname();
  if (LOOKS.length < 2) return null;
  const tab = pathname.replace(/^\/admin(\/(aurora|blend))?/, "") || "/pulse";
  const href = (id: LookName) => (id === "nick" ? `/admin${tab}` : `/admin/${id}${tab}`);
  return (
    <span className={`looks looks-${current === "nick" ? "nick" : "ev"}`} role="group" aria-label="Look">
      {LOOKS.map((l) => (
        <Link key={l.id} href={href(l.id)} aria-current={l.id === current ? "true" : undefined} prefetch={false}>
          {l.label}
        </Link>
      ))}
    </span>
  );
}
