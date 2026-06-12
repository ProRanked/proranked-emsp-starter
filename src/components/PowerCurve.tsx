/**
 * Live charging power curve — the signature visual every pro charging app shows
 * during a session. Pure client-side SVG; samples are fed from the polled
 * `currentPowerKw`, so it needs no extra API. Renders an area + line + head dot.
 */
export function PowerCurve({
  points,
  height = 96,
  emptyLabel = 'Gathering live power…',
}: {
  points: number[];
  height?: number;
  emptyLabel?: string;
}) {
  const W = 320; // viewBox width — scales to container via preserveAspectRatio
  const H = height;
  const pad = 6;

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center text-[12px] text-text-faint" style={{ height: H }}>
        {emptyLabel}
      </div>
    );
  }

  // Headroom above the peak so the curve never clips the top edge.
  const peak = Math.max(...points, 0.1);
  const yMax = peak * 1.15;
  const n = points.length;

  const x = (i: number) => pad + (i / (n - 1)) * (W - pad * 2);
  const y = (kw: number) => H - pad - (kw / yMax) * (H - pad * 2);

  const line = points.map((kw, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(kw).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`;
  const headX = x(n - 1);
  const headY = y(points[n - 1]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="pcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-volt)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-volt)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#pcFill)" />
      <path d={line} fill="none" stroke="var(--color-volt)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={headX} cy={headY} r="3.5" fill="var(--color-volt)" />
      <circle cx={headX} cy={headY} r="6" fill="var(--color-volt)" opacity="0.25">
        <animate attributeName="r" values="4;9;4" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.35;0;0.35" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
