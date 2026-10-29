"use client";

import { usePathname } from "next/navigation";

/** "/dashboard/aurora" or "/dashboard/nick", whichever look the teacher is in, so links stay inside it. */
export function useBase(): string {
  const path = usePathname();
  const m = path.match(/^\/dashboard\/(aurora|nick)(?=\/|$)/);
  return `/dashboard/${m ? m[1] : "aurora"}`;
}
