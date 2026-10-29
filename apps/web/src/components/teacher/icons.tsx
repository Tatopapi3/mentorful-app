import type { ReactNode } from "react";

export type IconName = "home" | "users" | "book" | "scan" | "lock" | "check" | "arrow" | "clock" | "shield" | "heart" | "message" | "sliders" | "close" | "spark";

const PATHS: Record<IconName, ReactNode> = {
  home: (<><path d="m3 10.8 9-7.3 9 7.3" /><path d="M5.5 9.8V21h13V9.8M9.5 21v-6.5h5V21" /></>),
  users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>),
  book: (<><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5M9 8h6M9 12h4" /></>),
  scan: (<><path d="M4 4v5M4 4h5M20 4h-5M20 4v5M4 20v-5M4 20h5M20 20h-5M20 20v-5" /><path d="M8.5 12h7M12 8.5v7" /></>),
  lock: (<><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>),
  check: <path d="m5 12 4 4L19 6" />,
  arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  shield: (<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-5" /></>),
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  message: (<><path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2.2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z" /><path d="M8 9h8M8 13h5" /></>),
  sliders: (<><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M1 14h6M9 8h6M17 16h6" /></>),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  spark: (<><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></>),
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" className="ta-icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      {PATHS[name]}
    </svg>
  );
}
