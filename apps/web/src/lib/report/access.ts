/**
 * Who may open the Culture Scan report. Pure, so it is tested without a database (tests/report-access.test.ts).
 *
 *   "not-admin"     signed in, but not the administrator of any school (requireAdmin returned nothing)
 *   "wrong-school"  an administrator, but of a different school than the one this Culture Scan belongs to
 *   "ok"            the administrator of the Culture Scan's school
 *
 * `adminSchoolId` is the school of the signed-in administrator, or null if the person is not one. `scanSchoolId` is the school the
 * Culture Scan belongs to (NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID). The database function checks the same thing again, so this is a
 * clear message for the person, not the only lock.
 */
export type ReportAccess = "ok" | "not-admin" | "wrong-school";

export function reportAccess(adminSchoolId: string | null, scanSchoolId: string | null | undefined): ReportAccess {
  if (!adminSchoolId) return "not-admin";
  if (scanSchoolId && adminSchoolId !== scanSchoolId) return "wrong-school";
  return "ok";
}
