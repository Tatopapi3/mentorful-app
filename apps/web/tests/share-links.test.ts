import { describe, expect, it } from "vitest";
import { ADMIN_PAGES, TEACHER_PAGES, deepLink } from "@/lib/demo/share-links";

describe("links a teammate can open straight away", () => {
  const base = "https://demo.example/";
  it("carries the key and sets who you are before landing on the page", () => {
    const l = deepLink({ base, key: "k1", who: "admin", path: "/admin/insights" });
    expect(l).toBe("https://demo.example/preview/as/admin?next=%2Fadmin%2Finsights&key=k1");
  });
  it("opens a teacher page as the second teacher", () => {
    expect(deepLink({ base, key: "k1", who: "second", path: "/dashboard/pair" })).toBe("https://demo.example/preview/as/teacher?next=%2Fdashboard%2Fpair&who=second&key=k1");
  });
  it("opens a page that needs no role as it is", () => {
    expect(deepLink({ base, key: "k1", who: "none", path: "/demo/slides" })).toBe("https://demo.example/demo/slides?key=k1");
    expect(deepLink({ base, who: "none", path: "/survey" })).toBe("https://demo.example/survey");
  });
  it("keeps a fragment inside the next page", () => {
    expect(deepLink({ base, who: "admin", path: "/admin/insights#trends" })).toBe("https://demo.example/preview/as/admin?next=%2Fadmin%2Finsights%23trends");
  });
  it("lists only paths that exist as pages or export routes", () => {
    for (const p of [...ADMIN_PAGES, ...TEACHER_PAGES]) expect(p.path).toMatch(/^\/(admin|dashboard)/);
  });
});
