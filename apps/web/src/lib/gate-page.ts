/**
 * The page a visitor sees when a private site is closed to them: a short explanation and a box for the access code, so a
 * teammate who opened a plain link (no key in it) can type the code once instead of hitting a dead end. The form sends the
 * code back to the same address as ?key=..., and the gate turns that into a cookie and opens the page they asked for.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function gatePage(pathname: string, params: URLSearchParams, what = "site"): string {
  const hidden = [...params.entries()]
    .filter(([k]) => k !== "key")
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Mentorful · private</title>
<style>
:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;background:#f3f2fb;color:#14122b}
main{width:min(100%,420px);background:#fff;border:1px solid #e0def5;border-radius:20px;padding:28px;box-shadow:0 20px 50px -30px rgba(79,70,229,.5)}
h1{margin:0 0 6px;font-size:22px;letter-spacing:-.02em}
p{margin:0 0 16px;color:#65627f}
label{display:block;font-weight:600;font-size:14px;margin-bottom:6px}
input[type=password],input[type=text]{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #c9c8f0;border-radius:12px;font:inherit}
button{margin-top:12px;width:100%;padding:12px;border:0;border-radius:999px;font:600 15px inherit;color:#fff;background:linear-gradient(135deg,#0ea5a4,#4f46e5);cursor:pointer}
small{display:block;margin-top:14px;color:#8b89a8}
@media (prefers-color-scheme:dark){body{background:#0a0a1f;color:#f2f1ff}main{background:#15152f;border-color:rgba(255,255,255,.14)}p,small{color:#a5a3c6}input{background:#0a0a1f;color:#f2f1ff;border-color:rgba(255,255,255,.25)}}
</style></head><body><main>
<h1>This ${esc(what)} is private</h1>
<p>Enter the access code you were given. You only need to do this once in this browser.</p>
<form method="get" action="${esc(pathname)}">${hidden}
<label for="k">Access code</label>
<input id="k" name="key" type="password" autocomplete="off" autofocus required>
<button type="submit">Open</button>
</form>
<small>No code? Ask Juan. Links that already contain the code, ending in ?key=..., open straight away.</small>
</main></body></html>`;
}
