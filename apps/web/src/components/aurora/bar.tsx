"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { signOut } from "@/lib/auth/actions";

export type NavItem = { href: string; label: string; match?: string[] };
export type QuickAction = { href: string; label: string; hint?: string };

const THEME_KEY = "mentorful-theme";

const THEME_EVENT = "mentorful-theme-change";
const subscribeTheme = (notify: () => void) => {
  window.addEventListener(THEME_EVENT, notify);
  return () => window.removeEventListener(THEME_EVENT, notify);
};
const readTheme = (): "day" | "night" =>
  document.querySelector<HTMLElement>(".ev")?.getAttribute("data-theme") === "dark" ? "night" : "day";

function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "day" as const);
  const toggle = useCallback(() => {
    const next = theme === "day" ? "night" : "day";
    document.querySelector<HTMLElement>(".ev")?.setAttribute("data-theme", next === "night" ? "dark" : "light");
    window.dispatchEvent(new Event(THEME_EVENT));
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be blocked; the choice just won't persist.
    }
  }, [theme]);
  return { theme, toggle };
}

function Palette({ items, onClose }: { items: QuickAction[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((x) => `${x.label} ${x.hint ?? ""}`.toLowerCase().includes(t)) : items;
  }, [q, items]);
  useEffect(() => inputRef.current?.focus(), []);
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return (
    <div className="ev-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="ev-palette">
        <input
          ref={inputRef}
          value={q}
          placeholder="Jump to a page or start something…"
          aria-label="Search commands"
          onChange={(e) => {
            setQ(e.target.value);
            setI(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setI((v) => Math.min(v + 1, shown.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setI((v) => Math.max(v - 1, 0));
            } else if (e.key === "Enter" && shown[i]) go(shown[i].href);
          }}
        />
        <ul role="listbox">
          {shown.length === 0 && <li style={{ padding: 16 }}><small>Nothing matches “{q}”.</small></li>}
          {shown.map((x, idx) => (
            <li key={x.href + x.label}>
              <button type="button" role="option" aria-selected={idx === i} onMouseEnter={() => setI(idx)} onClick={() => go(x.href)}>
                <span>{x.label}</span>
                {x.hint && <small>{x.hint}</small>}
              </button>
            </li>
          ))}
        </ul>
        <footer>
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span>esc to close</span>
        </footer>
      </div>
    </div>
  );
}

// The floating bar: wordmark, one row of pill tabs, the command palette
// (Cmd/Ctrl+K), a Day/Night switch, and a small account menu.
export function AtlasBar({
  items,
  actions,
  primary,
  displayName,
  roleLabel,
  schoolName,
  initials,
}: {
  items: NavItem[];
  actions: QuickAction[];
  primary?: QuickAction;
  displayName: string;
  roleLabel: string;
  schoolName: string;
  initials: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const active = (item: NavItem) => (item.match ?? [item.href]).some((m) => pathname === m || pathname.startsWith(`${m}/`));
  const palette = useMemo(() => [...items.map((n) => ({ href: n.href, label: n.label, hint: "Go to" })), ...actions], [items, actions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="ev-topbar">
        <Link href={items[0]?.href ?? "/"} className="ev-brand" aria-label="Mentorful home">
          <span className="mark" aria-hidden>✳</span>
          <span className="word">mentorful</span>
        </Link>
        <nav className="ev-nav" aria-label="Primary">
          {items.map((item) => (
            <Link key={item.href} href={item.href} aria-current={active(item) ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ev-tools">
          {primary && (
            <Link href={primary.href} className="ev-btn primary sm ev-logbtn">
              {primary.label}
            </Link>
          )}
          <button type="button" className="ev-icon-btn" onClick={() => setOpen(true)} aria-label="Open command palette">
            <span className="label">Jump to…</span> <kbd>⌘K</kbd>
          </button>
          <button type="button" className="ev-icon-btn" onClick={toggle} aria-label={`Switch to ${theme === "day" ? "Night" : "Day"} mode`}>
            {theme === "day" ? "☾" : "☀"}
          </button>
          <details className="ev-me">
            <summary aria-label="Account menu">{initials}</summary>
            <div className="ev-menu">
              <div className="who">
                <strong>{displayName}</strong>
                <small>{roleLabel}</small>
                <small>{schoolName}</small>
              </div>
              <form action={signOut}>
                <button type="submit">Sign out</button>
              </form>
            </div>
          </details>
        </div>
      </header>
      {open && <Palette items={palette} onClose={() => setOpen(false)} />}
    </>
  );
}
