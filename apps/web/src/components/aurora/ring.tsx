// A progress ring that fills on load. Server-rendered SVG; the number inside
// is always printed, so colour and motion are never the only signal.
export function Ring({ pct, label, sub, display }: { pct: number | null; label: string; sub?: string; display?: string }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  const value = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const id = `g${label.replace(/\W+/g, "")}`;
  return (
    <div className="v3-ring" role="img" aria-label={`${label}: ${pct === null ? "not available yet" : `${value}%`}`}>
      <svg viewBox="0 0 112 112" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#14b8a6" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <circle className="track" cx="56" cy="56" r={r} fill="none" strokeWidth="10" />
        <circle
          className="arc"
          cx="56"
          cy="56"
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - value / 100)}
          style={{ ["--circ" as string]: circ }}
        />
      </svg>
      <div className="num">{display ?? (pct === null ? "—" : `${value}%`)}</div>
      <strong className="t">{label}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
