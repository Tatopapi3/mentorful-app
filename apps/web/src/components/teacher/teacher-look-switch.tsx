"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "@/components/aurora/looks.css";

/**
 * Hops between the two looks of the teacher dashboard, staying on the same tab: /dashboard/aurora/growth and
 * /dashboard/nick/growth are the same page in two designs.
 */
export function TeacherLookSwitch({ current }: { current: "aurora" | "nick" }) {
  const pathname = usePathname();
  const rest = pathname.replace(/^\/dashboard\/(aurora|nick)/, "");
  return (
    <span className={`looks looks-${current === "nick" ? "nick" : "ev"}`} role="group" aria-label="Look">
      <Link href={`/dashboard/nick${rest}`} aria-current={current === "nick" ? "true" : undefined} prefetch={false}>
        Nick
      </Link>
      <Link href={`/dashboard/aurora${rest}`} aria-current={current === "aurora" ? "true" : undefined} prefetch={false}>
        Aurora
      </Link>
    </span>
  );
}
