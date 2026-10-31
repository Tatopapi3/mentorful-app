import { describe, expect, it } from "vitest";
import { landingPath, safeNext } from "@/lib/auth/landing";

describe("where the sign-in link lands", () => {
  it("sends a school lead to the leadership dashboard and everyone else to the teacher dashboard", () => {
    expect(landingPath("admin", null)).toBe("/admin");
    expect(landingPath("teacher", null)).toBe("/dashboard");
    expect(landingPath(null, null)).toBe("/dashboard");
    expect(landingPath(undefined, undefined)).toBe("/dashboard");
  });
  it("lets a link name a page on this site", () => {
    expect(landingPath("admin", "/dashboard/growth")).toBe("/dashboard/growth");
    expect(landingPath("teacher", "/survey")).toBe("/survey");
  });
  it("never sends anyone to another site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "http://evil.com", "https://evil.com/x", "@evil.com", "evil.com", "/ok\r\nSet-Cookie: x=1", ""]) {
      expect(safeNext(bad)).toBeNull();
      expect(landingPath("teacher", bad)).toBe("/dashboard");
      expect(landingPath("admin", bad)).toBe("/admin");
    }
  });
});
