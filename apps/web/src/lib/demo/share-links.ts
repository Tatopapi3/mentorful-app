/**
 * Links a teammate can open straight away. A page copied from the address bar has no access key and no "who are you"
 * (the demo has no sign-in; who you are is a cookie), so it opens "private" or on the wrong screen. These links carry both:
 * the key, and a hop through /preview/as/<role> that sets the role and then lands on the page.
 */
export type Who = "admin" | "first" | "second" | "none";

export type Page = { label: string; path: string; note?: string };

export const ADMIN_PAGES: Page[] = [
  { label: "Pulse", path: "/admin/pulse", note: "Where the program stands" },
  { label: "Pairing", path: "/admin/pairings", note: "Draft a round, approve pairs" },
  { label: "Overview", path: "/admin/overview" },
  { label: "Constellation", path: "/admin/constellation", note: "The department map" },
  { label: "Insights", path: "/admin/insights", note: "Culture Scan, trends, growth" },
  { label: "Reports", path: "/admin/reports", note: "Faculty map, PDFs, Excel" },
  { label: "Faculty map, full size", path: "/admin/map" },
  { label: "Board summary", path: "/admin/summary" },
  { label: "Trust (what leadership can't see)", path: "/admin/privacy" },
  { label: "Leadership deck (as a page)", path: "/admin/export/slides" },
  { label: "Download: leadership deck PDF", path: "/admin/export/slides.pdf" },
  { label: "Download: board summary PDF", path: "/admin/export/summary.pdf" },
  { label: "Download: faculty connection PDF", path: "/admin/export/connection.pdf" },
  { label: "Download: results Excel", path: "/admin/export/results.xlsx" },
];

export const TEACHER_PAGES: Page[] = [
  { label: "Home", path: "/dashboard" },
  { label: "Journal", path: "/dashboard/journal", note: "Log a conversation" },
  { label: "My pair", path: "/dashboard/pair", note: "Partner, chat" },
  { label: "Lookbook", path: "/dashboard/pair/lookbook" },
  { label: "Growth", path: "/dashboard/growth" },
  { label: "Culture Scan", path: "/dashboard/scan" },
];

/** Pages that need no role: they open as they are. */
export const OPEN_PAGES: Page[] = [
  { label: "Culture Scan survey", path: "/survey" },
  { label: "Culture Scan report", path: "/report" },
];

const join = (base: string) => base.replace(/\/+$/, "");

/** A link that opens `path` as the given person, with the key in it. `who: "none"` is for pages that need no role. */
export function deepLink({ base, key, who, path }: { base: string; key?: string; who: Who; path: string }): string {
  const k = key ? `key=${encodeURIComponent(key)}` : "";
  if (who === "none") return `${join(base)}${path}${k ? (path.includes("?") ? "&" : "?") + k : ""}`;
  const role = who === "admin" ? "admin" : "teacher";
  const parts = [`next=${encodeURIComponent(path)}`];
  if (who === "second") parts.push("who=second");
  if (k) parts.push(k);
  return `${join(base)}/preview/as/${role}?${parts.join("&")}`;
}
