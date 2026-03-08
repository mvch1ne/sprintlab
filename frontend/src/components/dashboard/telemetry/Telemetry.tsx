// ─── Telemetry Panel ──────────────────────────────────────────────────────────
// Reads all state from VideoContext and PoseContext — no props needed.
import { useState } from 'react';
import { useVideoContext } from '../VideoContext';
import { usePose } from '../PoseContext';
import type { JointTimeSeries, GroundContactEvent } from '../useSprintMetrics';

// ── Sparkline ──────────────────────────────────────────────────────────────────
function Sparkline({
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

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHead({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
}

// ── Summary stat ───────────────────────────────────────────────────────────────
function Stat({
  label,
  value,
  unit,
  dim,
}: {
  label: string;
  value: string;
  unit?: string;
  dim?: string;
}) {
  return (
    <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60 flex flex-col gap-0.5">
      <span className="text-[8px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-mono text-sky-500 dark:text-sky-400 tabular-nums leading-none">
          {value}
        </span>
        {unit && (
          <span className="text-[9px] font-mono text-zinc-500">{unit}</span>
        )}
      </div>
      {dim && <span className="text-[8px] font-mono text-zinc-500">{dim}</span>}
    </div>
  );
}

// ── Joint row ──────────────────────────────────────────────────────────────────
function JointRow({
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
        <span className="text-[9px] font-mono text-zinc-500">{label}</span>
        <div className="flex gap-2 items-baseline">
          <span
            className="text-[10px] font-mono tabular-nums font-medium"
            style={{ color }}
          >
            {series.angle[f]?.toFixed(1) ?? '—'}°
          </span>
          <span className="text-[9px] font-mono tabular-nums text-zinc-500">
            {series.velocity[f]?.toFixed(0) ?? '—'}°/s
          </span>
          <span className="text-[8px] font-mono tabular-nums text-zinc-400">
            {series.accel[f]?.toFixed(0) ?? '—'}°/s²
          </span>
        </div>
      </div>
      <Sparkline data={spark} color={color} height={18} playheadPct={pct} />
    </div>
  );
}

// ── Ground contact table ───────────────────────────────────────────────────────
function ContactsTab({
  contacts,
  fps,
  calibrated,
}: {
  contacts: GroundContactEvent[];
  fps: number;
  calibrated: boolean;
}) {
  if (!contacts.length)
    return (
      <p className="px-3 py-4 text-[9px] font-mono text-zinc-500 italic">
        No contacts detected.
      </p>
    );

  const unit = calibrated ? 'm' : 'px';
  const L = '#4ade80',
    R = '#fb923c';

  // Symmetry summary
  const lContacts = contacts.filter((c) => c.foot === 'left');
  const rContacts = contacts.filter((c) => c.foot === 'right');
  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b) / arr.length : 0;
  const lGCT = avg(lContacts.map((c) => c.contactTime)) * 1000;
  const rGCT = avg(rContacts.map((c) => c.contactTime)) * 1000;
  const lFT =
    avg(lContacts.map((c) => c.flightTimeBefore).filter((t) => t > 0)) * 1000;
  const rFT =
    avg(rContacts.map((c) => c.flightTimeBefore).filter((t) => t > 0)) * 1000;

  return (
    <div>
      {/* Symmetry summary */}
      <SectionHead label="Symmetry" color="#38bdf8" />
      <div className="grid grid-cols-3 text-[9px] font-mono">
        <div className="px-3 py-1.5 border-b border-r border-zinc-100 dark:border-zinc-800/60 text-zinc-500 uppercase tracking-wide" />
        <div
          className="px-3 py-1.5 border-b border-r border-zinc-100 dark:border-zinc-800/60 font-bold"
          style={{ color: L }}
        >
          Left
        </div>
        <div
          className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800/60 font-bold"
          style={{ color: R }}
        >
          Right
        </div>
        {[
          ['GCT avg', `${lGCT.toFixed(0)}ms`, `${rGCT.toFixed(0)}ms`],
          ['Flight avg', `${lFT.toFixed(0)}ms`, `${rFT.toFixed(0)}ms`],
          ['Steps', String(lContacts.length), String(rContacts.length)],
        ].map(([k, l, r]) => (
          <>
            <div
              key={k + '-k'}
              className="px-3 py-1 border-b border-r border-zinc-100 dark:border-zinc-800/60 text-zinc-500"
            >
              {k}
            </div>
            <div
              key={k + '-l'}
              className="px-3 py-1 border-b border-r border-zinc-100 dark:border-zinc-800/60 tabular-nums"
            >
              {l}
            </div>
            <div
              key={k + '-r'}
              className="px-3 py-1 border-b border-zinc-100 dark:border-zinc-800/60 tabular-nums"
            >
              {r}
            </div>
          </>
        ))}
      </div>

      {/* Step-by-step table */}
      <SectionHead label="Per-step detail" color="#38bdf8" />
      <div className="overflow-x-auto">
        <table className="w-full text-[8px] font-mono border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              {[
                '#',
                'Ft',
                'Fr',
                'GCT',
                'Flight',
                'Stride',
                'Freq',
                'CoM↔gnd',
              ].map((h) => (
                <th
                  key={h}
                  className="px-1.5 py-1 text-left text-zinc-400 uppercase tracking-wide font-normal whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c, i) => {
              const color = c.foot === 'left' ? L : R;
              return (
                <tr
                  key={i}
                  className="border-b border-zinc-100 dark:border-zinc-800/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-1.5 py-0.5 text-zinc-400 tabular-nums">
                    {i + 1}
                  </td>
                  <td
                    className="px-1.5 py-0.5 font-bold tabular-nums"
                    style={{ color }}
                  >
                    {c.foot === 'left' ? 'L' : 'R'}
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                    {c.contactFrame}
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-sky-500">
                    {(c.contactTime * 1000).toFixed(0)}ms
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                    {c.flightTimeBefore > 0.01
                      ? `${(c.flightTimeBefore * 1000).toFixed(0)}ms`
                      : '—'}
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                    {c.strideLength !== null
                      ? `${c.strideLength.toFixed(calibrated ? 2 : 0)}${unit}`
                      : '—'}
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                    {c.strideFrequency !== null
                      ? `${c.strideFrequency.toFixed(2)}Hz`
                      : '—'}
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                    {c.comDistance > 0
                      ? `${c.comDistance.toFixed(calibrated ? 2 : 0)}${unit}`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
type Tab = 'summary' | 'steps' | 'lower' | 'upper';

const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'steps', label: 'Steps' },
  { key: 'lower', label: 'Lower' },
  { key: 'upper', label: 'Upper' },
];

// ── Main component ─────────────────────────────────────────────────────────────
export const Telemetry = () => {
  const { currentFrame, fps, calibration, metrics } = useVideoContext();
  const { status } = usePose();
  const [tab, setTab] = useState<Tab>('summary');

  // Empty / loading state
  if (status !== 'ready' || !metrics) {
    const isUncalibrated = status === 'ready' && !calibration;
    const msg = isUncalibrated
      ? 'Calibrate to unlock telemetry'
      : status === 'idle'
        ? 'Enable pose analysis to compute metrics'
        : status === 'loading'
          ? 'Analysing video…'
          : status === 'error'
            ? 'Pose error — check backend'
            : 'Waiting for metrics…';
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 px-4 text-center">
        {status === 'loading' && (
          <div className="w-4 h-4 border border-zinc-600 border-t-sky-400 rounded-full animate-spin" />
        )}
        <span
          className={`text-[9px] uppercase tracking-widest font-mono ${isUncalibrated ? 'text-amber-500' : 'text-zinc-500'}`}
        >
          {msg}
        </span>
        {isUncalibrated && (
          <span className="text-[8px] text-zinc-600 font-mono">
            Use the calibration tool in the control panel
          </span>
        )}
      </div>
    );
  }

  const cal = calibration !== null;
  const unit = cal ? 'm' : 'px';
  const f = currentFrame;

  const calLineDir = (() => {
    if (!calibration) return null;
    const a = calibration.lineAngleDeg;
    if (a < 20) return 'Horizontal';
    if (a > 70) return 'Vertical';
    return `Diagonal (${a.toFixed(0)}°)`;
  })();

  // Left = green, Right = amber — consistent throughout
  const LC = '#4ade80',
    RC = '#fb923c';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 text-[8px] uppercase tracking-widest transition-colors cursor-pointer
              border-r border-zinc-200 dark:border-zinc-800 last:border-r-0
              ${
                tab === t.key
                  ? 'text-sky-500 bg-zinc-50 dark:bg-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
        {/* ── Summary ─────────────────────────────────────────────────── */}
        {tab === 'summary' && (
          <>
            <SectionHead label="Calibration" color="#f97316" />
            {cal ? (
              <>
                <Stat
                  label="Reference distance"
                  value={calibration!.realMeters.toFixed(2)}
                  unit="m"
                  dim={`Line direction: ${calLineDir}`}
                />
                <Stat
                  label="Scale"
                  value={calibration!.pixelsPerMeter.toFixed(4)}
                  unit="norm-units/m"
                  dim="Stride lengths and CoM distances in metres"
                />
              </>
            ) : (
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[8px] uppercase tracking-widest text-amber-500">
                  No calibration — distances shown in pixels
                </span>
              </div>
            )}

            <SectionHead label="Temporal" color="#38bdf8" />
            <Stat
              label="Ground contact time (avg)"
              value={(metrics.avgContactTime * 1000).toFixed(0)}
              unit="ms"
              dim={`${metrics.groundContacts.length} contacts detected`}
            />
            <Stat
              label="Flight time (avg)"
              value={(metrics.avgFlightTime * 1000).toFixed(0)}
              unit="ms"
            />
            {metrics.avgStrideLength !== null && (
              <Stat
                label={`Stride length (avg)`}
                value={metrics.avgStrideLength.toFixed(cal ? 2 : 0)}
                unit={unit}
              />
            )}
            {metrics.avgStrideFreq !== null && (
              <Stat
                label="Stride frequency (avg)"
                value={metrics.avgStrideFreq.toFixed(2)}
                unit="Hz"
                dim={`${(metrics.avgStrideFreq * 60).toFixed(1)} strides / min`}
              />
            )}

            <SectionHead label="Trunk" color="#fb923c" />
            <JointRow
              label="Torso lean (from vertical)"
              series={metrics.torso}
              frame={f}
              color="#fb923c"
            />

            <SectionHead label="Centre of mass" color="#a78bfa" />
            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
              <div className="flex justify-between mb-1">
                <span className="text-[9px] font-mono text-zinc-500">
                  Vertical CoM oscillation
                </span>
                <span className="text-[9px] font-mono text-zinc-500 tabular-nums">
                  y={metrics.com[f]?.y.toFixed(0) ?? '—'}px
                </span>
              </div>
              <Sparkline
                data={metrics.com
                  .filter(
                    (_, i) =>
                      i % Math.max(1, Math.floor(metrics.com.length / 100)) ===
                      0,
                  )
                  .map((p) => p.y)}
                color="#a78bfa"
                height={28}
                playheadPct={
                  metrics.com.length > 1
                    ? (f / (metrics.com.length - 1)) * 100
                    : 0
                }
              />
            </div>
          </>
        )}

        {/* ── Steps ───────────────────────────────────────────────────── */}
        {tab === 'steps' && (
          <ContactsTab
            contacts={metrics.groundContacts}
            fps={fps}
            calibrated={cal}
          />
        )}

        {/* ── Lower body ──────────────────────────────────────────────── */}
        {tab === 'lower' && (
          <>
            <SectionHead label="Hip" color={LC} />
            <JointRow
              label="Left hip"
              series={metrics.leftHip}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right hip"
              series={metrics.rightHip}
              frame={f}
              color={RC}
            />

            <SectionHead label="Knee" color={LC} />
            <JointRow
              label="Left knee"
              series={metrics.leftKnee}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right knee"
              series={metrics.rightKnee}
              frame={f}
              color={RC}
            />

            <SectionHead label="Ankle" color={LC} />
            <JointRow
              label="Left ankle"
              series={metrics.leftAnkle}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right ankle"
              series={metrics.rightAnkle}
              frame={f}
              color={RC}
            />

            <SectionHead label="Segment angles (from vertical)" color={LC} />
            <JointRow
              label="Left thigh"
              series={metrics.leftThigh}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right thigh"
              series={metrics.rightThigh}
              frame={f}
              color={RC}
            />
            <JointRow
              label="Left shin"
              series={metrics.leftShin}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right shin"
              series={metrics.rightShin}
              frame={f}
              color={RC}
            />
          </>
        )}

        {/* ── Upper body ──────────────────────────────────────────────── */}
        {tab === 'upper' && (
          <>
            <SectionHead label="Shoulder" color="#38bdf8" />
            <JointRow
              label="Left shoulder"
              series={metrics.leftShoulder}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right shoulder"
              series={metrics.rightShoulder}
              frame={f}
              color={RC}
            />

            <SectionHead label="Elbow" color="#38bdf8" />
            <JointRow
              label="Left elbow"
              series={metrics.leftElbow}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right elbow"
              series={metrics.rightElbow}
              frame={f}
              color={RC}
            />

            <SectionHead label="Wrist" color="#38bdf8" />
            <JointRow
              label="Left wrist"
              series={metrics.leftWrist}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right wrist"
              series={metrics.rightWrist}
              frame={f}
              color={RC}
            />

            <SectionHead label="Trunk" color="#fb923c" />
            <JointRow
              label="Torso lean"
              series={metrics.torso}
              frame={f}
              color="#fb923c"
            />
          </>
        )}
      </div>
    </div>
  );
};
