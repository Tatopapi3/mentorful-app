/**
 * Demo Day only: a small bar at the bottom of every screen that says who you are right now and switches you to someone else
 * in one click. The demo has no sign-in. Who you are is kept in a browser cookie, shared by every tab, so the bar is how you
 * move between the principal and the two teachers without opening the wrong screen. It is hidden when printing.
 */
import { STAGE_CHARACTERS } from "@/lib/preview/stageTables";

export type StageRole = "admin" | "first" | "second";

const PEOPLE: { role: StageRole; label: string; sub: string; href: string }[] = [
  { role: "admin", label: "Juan", sub: "principal", href: "/preview/as/admin?next=/admin/pulse" },
  { role: "first", label: STAGE_CHARACTERS.first.split(" ")[0], sub: "English", href: "/preview/as/teacher?next=/dashboard" },
  { role: "second", label: STAGE_CHARACTERS.second.split(" ")[0], sub: "Science", href: "/preview/as/teacher?who=second&next=/dashboard" },
];

export function DemoSwitcher({ current }: { current: StageRole }) {
  return (
    <nav className="demo-switcher" aria-label="Demo Day: who you are">
      <style>{`
        .demo-switcher{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483000;display:flex;gap:4px;align-items:center;padding:5px;border-radius:999px;background:#14122b;color:#f2f1ff;font:500 13px/1 system-ui,sans-serif;box-shadow:0 10px 30px -10px rgba(20,18,43,.7)}
        .demo-switcher a{display:inline-flex;flex-direction:column;align-items:center;gap:2px;padding:7px 14px;border-radius:999px;color:#f2f1ff;text-decoration:none;min-width:84px}
        .demo-switcher a small{font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:#a5a3c6}
        .demo-switcher a[aria-current=true]{background:linear-gradient(135deg,#0ea5a4,#4f46e5)}
        .demo-switcher a[aria-current=true] small{color:#e6e5ff}
        .demo-switcher a:hover:not([aria-current=true]){background:rgba(255,255,255,.12)}
        .demo-switcher a:focus-visible{outline:2px solid #5eead4;outline-offset:2px}
        .demo-switcher .sep{width:1px;height:26px;background:rgba(255,255,255,.2);margin:0 4px}
        @media print{.demo-switcher{display:none}}
      `}</style>
      {PEOPLE.map((p) => (
        <a key={p.role} href={p.href} aria-current={p.role === current}>
          {p.label}
          <small>{p.sub}</small>
        </a>
      ))}
      <span className="sep" aria-hidden />
      <a href="/preview/reset?next=/demo" aria-label="Reset the demo to its starting point">
        Reset
        <small>start over</small>
      </a>
    </nav>
  );
}
