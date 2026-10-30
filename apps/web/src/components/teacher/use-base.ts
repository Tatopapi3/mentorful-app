"use client";

import { teacherBase } from "@/lib/teacher/look";

/** Where the teacher's tabs live, so links built inside a component stay inside the dashboard. */
export function useBase(): string {
  return teacherBase();
}
