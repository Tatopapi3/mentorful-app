import { useId } from "react";

// The Mentorful badge as on mentorful.co: a square with irregular spikes (two on top, two on each side, one long point
// at the bottom) around a bold serif capital M. Redrawn as a clean vector from that logo (the PNG in /public is a noisy
// export), filled with the Aurora gradient instead of navy. The M is white.
const BADGE =
  "37,1 47,10 59,0.5 65,16 82,15.5 82,31 93,36.5 84,47.5 94.5,58 82,64 82,84 66,83 48,99.5 32,83 15,84 15,64 2,58 15,48 1.5,36 15,31 15,15.5 32,16";

export function MentorfulMark({ size = 28, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Mentorful" focusable="false">
      <defs>
        <linearGradient id={`mm-${id}`} x1="8%" y1="0%" x2="92%" y2="100%">
          <stop offset="0%" stopColor="#0ea5a4" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <polygon points={BADGE} fill={`url(#mm-${id})`} stroke={`url(#mm-${id})`} strokeWidth="2.5" strokeLinejoin="round" />
      <text x="48.5" y="66" textAnchor="middle" fontSize="46" fontWeight="700" fill="#fff" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        M
      </text>
    </svg>
  );
}
