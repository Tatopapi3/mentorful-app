"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Jumps between the two looks of the leadership views, staying on the same tab. Nick's look lives under
 * /admin and Aurora under /admin/aurora, so it is the same path with that prefix added or removed.
 */
export function SwitchLook({ current }: { current: "nick" | "aurora" }) {
  const pathname = usePathname();
  const href =
    current === "aurora"
      ? pathname.replace(/^\/admin\/aurora/, "/admin") || "/admin"
      : pathname === "/admin"
        ? "/admin/aurora"
        : pathname.replace(/^\/admin/, "/admin/aurora");
  return (
    <Link href={href} className={current === "aurora" ? "ev-icon-btn" : "nk-switch"} prefetch={false}>
      {current === "aurora" ? "Nick’s look" : "Aurora look"}
    </Link>
  );
}
