import type { ReactNode } from "react";

export type IconName =
  | "home" | "users" | "book" | "scan" | "lock" | "check" | "arrow" | "clock" | "shield" | "heart" | "message" | "sliders" | "close" | "spark"
  | "growth" | "chat" | "send" | "paperclip" | "video" | "upload" | "file" | "expand" | "shrink" | "mail" | "target" | "play" | "grid" | "compass" | "eye" | "trophy" | "swap" | "plus" | "pen" | "external";

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
  growth: (<><path d="M4 20h16" /><path d="M7 20v-5M12 20V9M17 20V4" /><path d="m5 11 4-3 3 2 6-6" /></>),
  chat: (<><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>),
  send: (<><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>),
  paperclip: <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  video: (<><path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11" /><rect x="2" y="6" width="14" height="12" rx="2" /></>),
  upload: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></>),
  file: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>),
  expand: <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />,
  shrink: <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />,
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  target: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>),
  play: <path d="M7 4v16l13-8z" />,
  grid: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>),
  compass: (<><circle cx="12" cy="12" r="9" /><path d="m16 8-2 6-6 2 2-6z" /></>),
  eye: (<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  trophy: (<><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0z" /><path d="M7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5" /></>),
  swap: (<><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  pen: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
  external: (<><path d="M14 4h6v6M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>),
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" className="ta-icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      {PATHS[name]}
    </svg>
  );
}
