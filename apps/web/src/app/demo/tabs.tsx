import Link from "next/link";
import { cookies } from "next/headers";

const TABS = [
  { href: "/demo", label: "The show" },
  { href: "/demo/script", label: "Script (for us)" },
  { href: "/demo/links", label: "Share links (for us)" },
] as const;

/** The two tabs at the top of the Demo Day pages: the page the audience sees, and the script and share links the team uses. */
export async function DemoTabs({ current }: { current: "/demo" | "/demo/script" | "/demo/links" }) {
  // The script tab is shown only to the team: with TEAM_KEY set, a browser that has not opened the script with the key never sees it.
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
