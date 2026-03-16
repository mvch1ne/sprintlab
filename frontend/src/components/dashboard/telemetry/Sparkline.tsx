// ── Sparkline ──────────────────────────────────────────────────────────────────
export function Sparkline({
  data,
  color = '#38bdf8',
  height = 24,
  playheadPct,
}: {
  data: number[];
  color?: string;
  height?: number;
  playheadPct?: number;
}) {
  if (data.length < 2) return <div style={{ height }} className="w-full" />;
  const min = Math.min(...data),
    max = Math.max(...data);
  const range = max - min || 1;
  const W = 100,
    H = height;
  const pts = data
    .map(
      (v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`,
    )
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full overflow-visible"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
      {playheadPct != null && (
        <line
          x1={playheadPct}
          y1={0}
          x2={playheadPct}
          y2={H}
          stroke={color}
          strokeWidth="0.8"
          opacity="0.7"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
