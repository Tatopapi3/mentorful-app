import Link from "next/link";
import { cookies } from "next/headers";

const TABS = [
  { href: "/demo", label: "The show" },
  { href: "/demo/links", label: "Share links" },
] as const;

/** The two tabs at the top of the Demo Day pages: the page the audience sees, and the share links the team uses. */
export async function DemoTabs({ current }: { current: "/demo" | "/demo/links" }) {
  // The share links tab is shown only to the team: with TEAM_KEY set, a browser that has not opened it with the key never sees it.
  const key = process.env.TEAM_KEY;
  const team = !key || (await cookies()).get("team_key")?.value === key;
  const tabs = TABS.filter((t) => t.href === "/demo" || team);
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Demo Day pages" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 18px" }}>
      {tabs.map((t) => (
        <Link key={t.href} className={t.href === current ? "ev-btn primary" : "ev-btn"} href={t.href} aria-current={t.href === current ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
