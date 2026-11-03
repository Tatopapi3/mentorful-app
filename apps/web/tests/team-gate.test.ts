import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

const req = (path: string, cookie?: string) => new NextRequest(`https://demo.example${path}`, cookie ? { headers: { cookie } } : undefined);
const rewritten = (res: Response) => res.headers.get("x-middleware-rewrite") ?? "";
const passed = (res: Response) => res.headers.get("x-middleware-next") === "1";

afterEach(() => {
  delete process.env.TEAM_KEY;
  delete process.env.PREVIEW_DEPLOY;
});

describe("the script is for the team only", () => {
  it("is open when no team key is set (local development)", () => {
    expect(passed(proxy(req("/demo/script")))).toBe(true);
  });
  it("answers not found without the team key", () => {
    process.env.TEAM_KEY = "team123";
    expect(rewritten(proxy(req("/demo/script")))).toMatch(/closed-for-walkthrough/);
    expect(rewritten(proxy(req("/demo/script?team=wrong")))).toMatch(/closed-for-walkthrough/);
  });
  it("lets the team in once, leaves a cookie and takes the key out of the address", () => {
    process.env.TEAM_KEY = "team123";
    const res = proxy(req("/demo/script?team=team123"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://demo.example/demo/script");
    expect(res.headers.get("set-cookie")).toMatch(/team_key=team123/);
  });
  it("lets a browser with the cookie through", () => {
    process.env.TEAM_KEY = "team123";
    expect(passed(proxy(req("/demo/script", "team_key=team123")))).toBe(true);
    expect(rewritten(proxy(req("/demo/script", "team_key=nope")))).toMatch(/closed-for-walkthrough/);
  });
  it("keeps the share links page for the team too", () => {
    process.env.TEAM_KEY = "team123";
    expect(rewritten(proxy(req("/demo/links")))).toMatch(/closed-for-walkthrough/);
    expect(passed(proxy(req("/demo/links", "team_key=team123")))).toBe(true);
  });
  it("never touches the audience pages", () => {
    process.env.TEAM_KEY = "team123";
    expect(passed(proxy(req("/demo")))).toBe(true);
    expect(passed(proxy(req("/demo/slides")))).toBe(true);
  });
});
