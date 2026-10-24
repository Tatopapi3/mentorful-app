import Link from "next/link";
import "@/app/aurora.css";
import "./lab.css";
import { Notice } from "@/components/admin/kit";

export const STUDIES = [
  { id: "command", href: "/lab/command", label: "Command" },
  { id: "briefing", href: "/lab/briefing", label: "Briefing" },
  { id: "map", href: "/lab/map", label: "Map" },
] as const;
export type StudyId = (typeof STUDIES)[number]["id"];

type Params = Record<string, string | string[] | undefined>;
export const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** The message a publish or a nudge sends back, shown the same way in every study. */
export function LabNotice({ searchParams }: { searchParams: Params }) {
  const notice = first(searchParams.notice);
  const error = first(searchParams.error);
  return (
    <>
      {notice && <Notice skin="aurora" kind="notice">{notice}</Notice>}
      {error && <Notice skin="aurora" kind="error">{error}</Notice>}
    </>
  );
}

/** Which study you are in, and a way to hop to the others without losing the cycle. */
export function StudySwitch({ current, cycle }: { current: StudyId; cycle?: string }) {
  return (
    <nav aria-label="Design study" style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 999, border: "1px solid var(--ev-line)", background: "var(--ev-soft)" }}>
      {STUDIES.map((s) => (
        <Link key={s.id} href={cycle ? `${s.href}?cycle=${cycle}` : s.href} prefetch={false} aria-current={s.id === current ? "page" : undefined} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, textDecoration: "none", color: s.id === current ? "var(--ev-ink)" : "var(--ev-muted)", background: s.id === current ? "var(--ev-panel-solid)" : "transparent" }}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
