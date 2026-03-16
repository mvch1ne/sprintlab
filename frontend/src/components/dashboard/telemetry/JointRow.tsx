// ── Joint row ──────────────────────────────────────────────────────────────────
import { Sparkline } from './Sparkline';
import type { JointTimeSeries } from '../useSprintMetrics';

export function JointRow({
  label,
  series,
  frame,
  color,
}: {
  label: string;
  series: JointTimeSeries;
  frame: number;
  color: string;
}) {
  const n = series.angle.length;
  const f = Math.min(frame, n - 1);
  const step = Math.max(1, Math.floor(n / 100));
  const spark = series.angle.filter((_, i) => i % step === 0);
  const pct = n > 1 ? (f / (n - 1)) * 100 : 0;

  return (
    <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-zinc-500">{label}</span>
        <div className="flex gap-2 items-baseline">
          <span
            className="text-xs font-mono tabular-nums font-medium"
            style={{ color }}
          >
            {series.angle[f]?.toFixed(1) ?? '—'}°
          </span>
          <span className="text-xs font-mono tabular-nums text-zinc-500">
            {series.velocity[f]?.toFixed(0) ?? '—'}°/s
          </span>
          <span className="text-xs font-mono tabular-nums text-zinc-400">
            {series.accel[f]?.toFixed(0) ?? '—'}°/s²
          </span>
        </div>
      </div>
      <Sparkline data={spark} color={color} height={18} playheadPct={pct} />
    </div>
  );
}
