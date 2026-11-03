import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

const req = (path: string, cookie?: string) => new NextRequest(`https://staging.example${path}`, cookie ? { headers: { cookie } } : undefined);

afterEach(() => {
  delete process.env.SITE_ACCESS_KEY;
});

describe("the private test site gate", () => {
  it("does nothing when no key is set (production)", () => {
    const res = proxy(req("/admin/pulse"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
  it("closes every page to a visitor without the key", () => {
    process.env.SITE_ACCESS_KEY = "k123";
    expect(proxy(req("/")).status).toBe(401);
    expect(proxy(req("/admin/pulse")).status).toBe(401);
    expect(proxy(req("/survey?key=wrong")).status).toBe(401);
  });
  it("asks for the access code on the closed page, keeping where the visitor was going", async () => {
    process.env.SITE_ACCESS_KEY = "k123";
    const res = proxy(req("/admin/insights?x=1"));
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain('action="/admin/insights"');
    expect(html).toContain('name="key"');
    expect(html).toContain('name="x" value="1"');
    expect(html).not.toContain("k123");
  });
  it("lets the key in once, remembers it in a cookie and takes it out of the address", () => {
    process.env.SITE_ACCESS_KEY = "k123";
    const res = proxy(req("/login?key=k123"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://staging.example/login");
    expect(res.headers.get("set-cookie")).toMatch(/site_key=k123/);
  });
  it("lets a browser with the cookie through", () => {
    process.env.SITE_ACCESS_KEY = "k123";
    expect(proxy(req("/admin/pulse", "site_key=k123")).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(req("/admin/pulse", "site_key=nope")).status).toBe(401);
  });
  it("leaves the sign-in link's landing page open", () => {
    process.env.SITE_ACCESS_KEY = "k123";
    expect(proxy(req("/auth/callback?code=abc")).headers.get("x-middleware-next")).toBe("1");
  });
});
