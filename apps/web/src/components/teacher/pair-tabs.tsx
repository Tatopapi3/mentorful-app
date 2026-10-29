import Link from "next/link";

const BASE = "/dashboard/aurora/pair";
const TABS = [
  { key: "partnership", label: "My partnership", href: BASE },
  { key: "lookbook", label: "Lookbook", href: `${BASE}/lookbook` },
  { key: "card", label: "My card", href: `${BASE}/card` },
] as const;

/** The three views inside the My pair tab: your partnership, the lookbook of colleagues, and your own card. */
export function PairTabs({ current }: { current: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="ev-tabs ta-pairtabs" aria-label="My pair sections">
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} aria-current={t.key === current ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
