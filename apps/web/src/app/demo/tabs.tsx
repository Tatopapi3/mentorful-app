import Link from "next/link";

const TABS = [
  { href: "/demo", label: "The show" },
  { href: "/demo/script", label: "Script (for us)" },
] as const;

/** The two tabs at the top of the Demo Day pages: the page the audience sees, and the script the team reads. */
export function DemoTabs({ current }: { current: "/demo" | "/demo/script" }) {
  return (
    <nav aria-label="Demo Day pages" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 18px" }}>
      {TABS.map((t) => (
        <Link key={t.href} className={t.href === current ? "ev-btn primary" : "ev-btn"} href={t.href} aria-current={t.href === current ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
