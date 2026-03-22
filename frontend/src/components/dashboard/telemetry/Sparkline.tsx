// ── Sparkline ──────────────────────────────────────────────────────────────────
import { useState, useRef, useCallback } from 'react';

export function Sparkline({
  data,
  color = '#38bdf8',
  height = 24,
  playheadPct,
  onSeek,
  unit,
  precision = 1,
}: {
  data: number[];
  color?: string;
  height?: number;
  playheadPct?: number;
  /** Called with the data-index when the user clicks. */
  onSeek?: (index: number) => void;
  /** Unit label shown in the tooltip (e.g. "°", "m/s"). */
  unit?: string;
  /** Decimal places for the tooltip value. */
  precision?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ xPx: number; pct: number; value: number } | null>(null);

  const indexFromEvent = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container || data.length < 2) return null;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const idx = Math.round(x * (data.length - 1));
      return Math.max(0, Math.min(data.length - 1, idx));
    },
    [data],
  );

  const onPointerMove = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const idx = indexFromEvent(e);
      if (idx === null) return;
      const rect = container.getBoundingClientRect();
      setHover({
        xPx: e.clientX - rect.left,
        pct: (idx / (data.length - 1)) * 100,
        value: data[idx],
      });
    },
    [data, indexFromEvent],
  );

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onSeek) return;
      const idx = indexFromEvent(e);
      if (idx !== null) onSeek(idx);
    },
    [onSeek, indexFromEvent],
  );

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
    <div
      ref={containerRef}
      className={`relative w-full ${onSeek ? 'cursor-crosshair' : 'cursor-default'}`}
      style={{ height }}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHover(null)}
      onClick={onClick}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible absolute inset-0"
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

        {/* Playhead */}
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

        {/* Hover crosshair line + dot (these scale fine since they use vectorEffect) */}
        {hover && (
          <>
            <line
              x1={hover.pct}
              y1={0}
              x2={hover.pct}
              y2={H}
              stroke="#a1a1aa"
              strokeWidth="0.6"
              strokeDasharray="2 1"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={hover.pct}
              cy={H - ((hover.value - min) / range) * H}
              r="2"
              fill={color}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      {/* HTML tooltip — not affected by SVG stretching */}
      {hover && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: hover.xPx,
            top: 0,
            transform: hover.xPx > (containerRef.current?.getBoundingClientRect().width ?? 200) * 0.7
              ? 'translate(-110%, 0)'
              : 'translate(10%, 0)',
          }}
        >
          <div className="bg-zinc-900/90 text-white text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-sm whitespace-nowrap leading-tight">
            {hover.value.toFixed(precision)}{unit ?? ''}
          </div>
        </div>
      )}
    </div>
  );
}
