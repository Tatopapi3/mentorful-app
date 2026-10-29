import Link from "next/link";

const TABS = [
  { key: "partnership", label: "My partnership", path: "" },
  { key: "lookbook", label: "Lookbook", path: "/lookbook" },
  { key: "card", label: "My card", path: "/card" },
] as const;

/** The three views inside the My pair tab: your partnership, the lookbook of colleagues, and your own card. */
export function PairTabs({ current, base }: { current: (typeof TABS)[number]["key"]; base: string }) {
  return (
    <nav className="ev-tabs ta-pairtabs" aria-label="My pair sections">
      {TABS.map((t) => (
        <Link key={t.key} href={`${base}/pair${t.path}`} aria-current={t.key === current ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
