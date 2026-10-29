import { notFound } from "next/navigation";

/**
 * The teacher dashboard comes in two looks, from the same pages and the same features: Aurora (floating pill bar, soft
 * gradients) and Nick's (his header, mono tab bar, paper and serif). Same tabs, same data, different design, so the two
 * can be compared side by side. The look is the second path segment: /dashboard/aurora/... or /dashboard/nick/...
 */
export type TeacherLook = "aurora" | "nick";
export const TEACHER_LOOKS: TeacherLook[] = ["aurora", "nick"];

export const teacherBase = (look: TeacherLook) => `/dashboard/${look}` as const;

export async function teacherLookOf(params: Promise<{ look: string }>): Promise<TeacherLook> {
  const { look } = await params;
  if (look !== "aurora" && look !== "nick") notFound();
  return look;
}
