// ── CoM tab ────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { Sparkline } from './Sparkline';
import { SectionHead } from './SectionHead';
import type { CoMSeries } from '../useSprintMetrics';

export function CoMTab({
  comSeries,
  com,
  frame,
  fps,
  comEvents,
  sprintStart,
  sprintFinish,
  sprintMode,
  sprintDirection,
  confirmedSprintStart,
  reactionTime,
  reactionTimeEnabled,
  setReactionTime,
  setReactionTimeEnabled,
}: {
  comSeries: CoMSeries;
  com: { frame: number; x: number; y: number }[];
  frame: number;
  fps: number;
  comEvents: { frame: number; comSite: { x: number; y: number } }[];
  sprintStart: { frame: number; site: { x: number; y: number } } | null;
  sprintFinish: { frame: number; site: { x: number; y: number } } | null;
  sprintMode: 'static' | 'flying';
  sprintDirection: 'ltr' | 'rtl';
  confirmedSprintStart: number | null;
  reactionTime: number;
  reactionTimeEnabled: boolean;
  setReactionTime: (t: number) => void;
  setReactionTimeEnabled: (v: boolean) => void;
}) {
  const n = comSeries.x.length;
  const f = Math.min(frame, n - 1);
  const step = Math.max(1, Math.floor(n / 100));
  const spark = (arr: number[]) => arr.filter((_, i) => i % step === 0);
  const pct = n > 1 ? (f / (n - 1)) * 100 : 0;
  const color = '#a78bfa';

  // Manual overrides for crossing frames (null = use auto-detected value).
  const [staticCrossingOverride, setStaticCrossingOverride] = useState<
    number | null
  >(null);
  const [flyEntryOverride, setFlyEntryOverride] = useState<number | null>(null);
  const [flyExitOverride, setFlyExitOverride] = useState<number | null>(null);

  // Sprint direction drives all sign conventions here.
  // Inferred from marker geometry when markers are placed (with user confirmation); overridable via header toggle.
  const movingPositive = sprintDirection === 'ltr';

  // Dismiss-able RTL confirmation banner state (resets when direction changes).
  const [rtlBannerDismissed, setRtlBannerDismissed] = useState(false);
  useEffect(() => { setRtlBannerDismissed(false); }, [sprintDirection]);

  /**
   * Find the fractional frame at which com.x (raw pose pixels — the same
   * coordinates used to draw the marker on screen) crosses markerX.
   * Handles both rightward (increasing x) and leftward (decreasing x) motion.
   * Uses linear interpolation for sub-frame precision.
   */
  const findCrossing = (markerX: number, startFrom = 0): number | null => {
    for (let fi = Math.max(1, startFrom); fi < com.length; fi++) {
      const prev = com[fi - 1].x;
      const curr = com[fi].x;
      const crosses = movingPositive
        ? prev < markerX && curr >= markerX
        : prev > markerX && curr <= markerX;
      if (crosses) {
        const frac = Math.abs((markerX - prev) / (curr - prev));
        return fi - 1 + frac;
      }
      if (curr === markerX) return fi;
    }
    return null;
  };

  /** Interpolate comSeries.x at a fractional frame index. */
  const interpComX = (frac: number): number => {
    const lo = Math.floor(frac);
    const hi = Math.min(lo + 1, n - 1);
    const t = frac - lo;
    return (comSeries.x[lo] ?? 0) * (1 - t) + (comSeries.x[hi] ?? 0) * t;
  };

  // Shared sparklines + events table.
  const renderSpeedAccel = (
    gateSpeed: number[],
    gateAccel: number[],
    relDisp: (fi: number) => number,
    speedSubLabel: string,
    getTime?: (fi: number) => number,
  ) => (
    <>
      <SectionHead label="Displacement (m)" color={color} />
      <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="flex justify-between mb-1">
          <span className="text-xs font-mono text-zinc-500">
            From start line
          </span>
          <span className="text-xs font-mono tabular-nums" style={{ color }}>
            {relDisp(f).toFixed(2)} m
          </span>
        </div>
        <Sparkline
          data={spark(comSeries.x.map((_, i) => relDisp(i)))}
          color={color}
          height={18}
          playheadPct={pct}
        />
      </div>

      <SectionHead label="Speed (m/s)" color={color} />
      <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="flex justify-between mb-1">
          <span className="text-xs font-mono text-zinc-500">
            {speedSubLabel}
          </span>
          <span className="text-xs font-mono tabular-nums" style={{ color }}>
            {relDisp(f) < 0 ? '—' : `${(gateSpeed[f] ?? 0).toFixed(2)} m/s`}
          </span>
        </div>
        <Sparkline
          data={spark(gateSpeed)}
          color={color}
          height={22}
          playheadPct={pct}
        />
      </div>

      <SectionHead label="Acceleration (m/s²)" color={color} />
      <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="flex justify-between mb-1">
          <span className="text-xs font-mono text-zinc-500">Δv/Δt</span>
          <span className="text-xs font-mono tabular-nums" style={{ color }}>
            {relDisp(f) < 0 ? '—' : `${(gateAccel[f] ?? 0).toFixed(2)} m/s²`}
          </span>
        </div>
        <Sparkline
          data={spark(gateAccel)}
          color={color}
          height={18}
          playheadPct={pct}
        />
      </div>

      {comEvents.length > 0 && (
        <>
          <SectionHead label="Recorded Events" color={color} />
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  {[
                    '#',
                    'Frame',
                    ...(getTime ? ['Time (s)'] : []),
                    'Speed (m/s)',
                    'Accel (m/s²)',
                    'Disp (m)',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-1.5 py-1 text-left text-zinc-400 uppercase tracking-wide font-normal"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comEvents.map((evt, i) => {
                  const ef = Math.min(evt.frame, n - 1);
                  return (
                    <tr
                      key={i}
                      className="border-b border-zinc-100 dark:border-zinc-800/40"
                    >
                      <td className="px-1.5 py-0.5 text-zinc-400">E{i + 1}</td>
                      <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                        {evt.frame}
                      </td>
                      {getTime && (
                        <td className="px-1.5 py-0.5 tabular-nums text-violet-300">
                          {relDisp(ef) < 0 ? '—' : getTime(ef).toFixed(3)}
                        </td>
                      )}
                      <td
                        className="px-1.5 py-0.5 tabular-nums"
                        style={{ color }}
                      >
                        {relDisp(ef) < 0 ? '—' : (gateSpeed[ef] ?? 0).toFixed(2)}
                      </td>
                      <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                        {relDisp(ef) < 0 ? '—' : (gateAccel[ef] ?? 0).toFixed(2)}
                      </td>
                      <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                        {relDisp(ef).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );

  // ── STATIC MODE ───────────────────────────────────────────────────────────────
  if (sprintMode === 'static') {
    if (confirmedSprintStart === null) {
      return (
        <div className="px-4 py-8 flex flex-col gap-2 items-center text-center">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-xs uppercase tracking-widest text-amber-500">
            First movement required
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            Seek to the first movement frame and click the Flag button (or
            confirm the proposed frame)
          </span>
        </div>
      );
    }
    if (!sprintStart) {
      return (
        <div className="px-4 py-8 flex flex-col gap-2 items-center text-center">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-xs uppercase tracking-widest text-cyan-500">
            Start line required
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            Use Annotate → Start to place the start line post
          </span>
        </div>
      );
    }

    const startIdx = Math.min(confirmedSprintStart, n - 1);
    const RT = reactionTimeEnabled ? reactionTime : 0;

    // Auto-detect the fractional frame where CoM (raw pixels) crosses the start marker.
    const autoCrossingFrac = findCrossing(sprintStart.site.x);
    const autoCrossingFrame =
      autoCrossingFrac !== null ? Math.round(autoCrossingFrac) : null;

    // Apply manual override if set; clamp to valid range.
    const effectiveCrossingFrac =
      staticCrossingOverride !== null
        ? Math.max(0, Math.min(n - 1, staticCrossingOverride))
        : autoCrossingFrac;
    const effectiveCrossingFrame =
      staticCrossingOverride !== null
        ? Math.max(0, Math.min(n - 1, staticCrossingOverride))
        : autoCrossingFrame;

    // xAtCrossing in comSeries.x metre space — interpolated at the effective crossing frame.
    // Fallback: anchor at first-movement frame if CoM never reaches the start line.
    const xAtCrossing =
      effectiveCrossingFrac !== null
        ? interpComX(effectiveCrossingFrac)
        : (comSeries.x[startIdx] ?? 0);

    // sign: +1 for rightward, -1 for leftward — so relDisp is always ≥ 0 past start.
    const dir = movingPositive ? 1 : -1;

    // Static mode: use instantaneous velocity — frame-by-frame |dCoM/dt| — not d/elapsed.
    // This leverages the per-frame pose data to give true instantaneous speed at every frame,
    // rather than an average that depends on total elapsed time (and hence reaction time).
    const gateSpeed = new Array(n).fill(0) as number[];
    const gateAccel = new Array(n).fill(0) as number[];
    for (let fi = startIdx + 1; fi < n; fi++) {
      const d = ((comSeries.x[fi] ?? 0) - xAtCrossing) * dir;
      if (d < 0) continue; // mask frames before start line
      gateSpeed[fi] = comSeries.speed[fi] ?? 0;
      gateAccel[fi] = comSeries.accel[fi] ?? 0;
    }

    const relDisp = (fi: number) =>
      ((comSeries.x[Math.min(fi, n - 1)] ?? 0) - xAtCrossing) * dir;

    return (
      <div>
        {/* RTL confirmation banner */}
        {sprintDirection === 'rtl' && !rtlBannerDismissed && (
          <div className="px-3 py-1.5 border-b border-amber-500/30 bg-amber-500/10 flex items-center gap-2">
            <span className="text-xs font-mono text-amber-400 flex-1">← Right-to-left sprint detected</span>
            <button
              onClick={() => setRtlBannerDismissed(true)}
              className="text-xs text-zinc-500 hover:text-amber-300 transition-colors cursor-pointer"
            >
              ✓ Ok
            </button>
          </div>
        )}
        {/* RT controls */}
        <div className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-widest text-zinc-500 shrink-0">
            Reaction time
          </span>
          <button
            onClick={() => setReactionTimeEnabled(!reactionTimeEnabled)}
            className={`text-xs font-mono px-1.5 py-0.5 rounded-sm border transition-colors cursor-pointer
              ${reactionTimeEnabled ? 'border-violet-500/50 text-violet-400 bg-violet-500/10' : 'border-zinc-600 text-zinc-500'}`}
          >
            {reactionTimeEnabled ? 'ON' : 'OFF'}
          </button>
          {reactionTimeEnabled && (
            <>
              <input
                type="number"
                value={Math.round(reactionTime * 1000)}
                onChange={(e) =>
                  setReactionTime(
                    Math.max(0, Math.min(500, Number(e.target.value))) / 1000,
                  )
                }
                className="w-12 text-xs font-mono bg-zinc-900 border border-zinc-700 rounded-sm px-1 py-0.5 text-violet-300 tabular-nums text-center"
                min={0}
                max={1000}
                step={10}
              />
              <span className="text-xs text-zinc-500 font-mono">ms</span>
            </>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs font-mono text-zinc-500">Crossed fr</span>
            <input
              type="number"
              min={0}
              max={n - 1}
              value={effectiveCrossingFrame ?? ''}
              placeholder={
                autoCrossingFrame !== null ? String(autoCrossingFrame) : '—'
              }
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setStaticCrossingOverride(!isNaN(v) && v >= 0 ? v : null);
              }}
              className={`w-14 text-xs font-mono rounded-sm px-1 py-0.5 tabular-nums text-center outline-none
                ${
                  staticCrossingOverride !== null
                    ? 'bg-violet-950/60 border border-violet-500/60 text-violet-300'
                    : 'bg-zinc-900 border border-zinc-700 text-cyan-400'
                }`}
            />
            {staticCrossingOverride !== null && (
              <button
                onClick={() => setStaticCrossingOverride(null)}
                title="Reset to auto-detected"
                className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors cursor-pointer leading-none"
              >
                ↺
              </button>
            )}
          </div>
        </div>
        {renderSpeedAccel(
          gateSpeed,
          gateAccel,
          relDisp,
          'Instantaneous |dCoM/dt|',
          (fi) => (fi - startIdx) / fps + RT,
        )}
      </div>
    );
  }

  // ── FLYING MODE ───────────────────────────────────────────────────────────────
  if (sprintMode === 'flying') {
    if (!sprintStart) {
      return (
        <div className="px-4 py-8 flex flex-col gap-2 items-center text-center">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-xs uppercase tracking-widest text-cyan-500">
            Fly zone entry required
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            Use Annotate → Start to mark the entry line
          </span>
        </div>
      );
    }
    if (!sprintFinish) {
      return (
        <div className="px-4 py-8 flex flex-col gap-2 items-center text-center">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-xs uppercase tracking-widest text-orange-500">
            Fly zone exit required
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            Use Annotate → Finish to mark the exit line
          </span>
        </div>
      );
    }

    // Auto-detect fractional frames where CoM (raw pixels) crosses entry/exit markers.
    const autoEntryFrac = findCrossing(sprintStart.site.x);
    const autoExitFrac =
      autoEntryFrac !== null
        ? findCrossing(sprintFinish.site.x, Math.floor(autoEntryFrac))
        : null;

    // Apply manual overrides if set; clamp to valid range.
    const entryFrac: number | null =
      flyEntryOverride !== null
        ? Math.max(0, Math.min(n - 1, flyEntryOverride))
        : autoEntryFrac;
    const exitFrac: number | null =
      flyExitOverride !== null
        ? Math.max(0, Math.min(n - 1, flyExitOverride))
        : autoExitFrac;

    if (entryFrac === null || exitFrac === null || exitFrac <= entryFrac) {
      return (
        <div className="px-4 py-8 flex flex-col gap-2 items-center text-center">
          <div className="w-2 h-2 rounded-full bg-zinc-500" />
          <span className="text-xs uppercase tracking-widest text-zinc-500">
            {entryFrac === null
              ? 'CoM never reaches entry marker'
              : 'CoM never reaches exit marker (or exit before entry)'}
          </span>
          <span className="text-xs text-zinc-600 font-mono">
            Check that Start comes before Finish and markers are within the
            athlete's path — or enter frames manually below
          </span>
          {/* Manual override inputs even when auto fails */}
          <div className="mt-2 flex flex-col gap-2 w-full max-w-50">
            {(['entry', 'exit'] as const).map((side) => {
              const isEntry = side === 'entry';
              const override = isEntry ? flyEntryOverride : flyExitOverride;
              const setOverride = isEntry
                ? setFlyEntryOverride
                : setFlyExitOverride;
              const autoVal = isEntry ? autoEntryFrac : autoExitFrac;
              return (
                <div key={side} className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-zinc-500 w-12 text-right capitalize">
                    {side} fr
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={n - 1}
                    value={override ?? ''}
                    placeholder={autoVal !== null ? autoVal.toFixed(1) : '—'}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setOverride(!isNaN(v) && v >= 0 ? v : null);
                    }}
                    className={`w-16 text-xs font-mono rounded-sm px-1 py-0.5 tabular-nums text-center outline-none
                      ${
                        override !== null
                          ? 'bg-violet-950/60 border border-violet-500/60 text-violet-300'
                          : 'bg-zinc-900 border border-zinc-700 text-orange-400'
                      }`}
                  />
                  {override !== null && (
                    <button
                      onClick={() => setOverride(null)}
                      title="Reset to auto"
                      className="text-xs text-zinc-500 hover:text-orange-400 transition-colors cursor-pointer"
                    >
                      ↺
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const flyTime = (exitFrac - entryFrac) / fps;

    // Fly distance = CoM horizontal travel between entry and exit (metres, already calibrated).
    const interpX = (frac: number) => {
      const lo = Math.floor(frac);
      const hi = Math.min(lo + 1, n - 1);
      const t = frac - lo;
      return (comSeries.x[lo] ?? 0) * (1 - t) + (comSeries.x[hi] ?? 0) * t;
    };
    const flyDistance = Math.abs(interpX(exitFrac) - interpX(entryFrac));
    const flyVelocity = flyTime > 0 ? flyDistance / flyTime : 0;

    return (
      <div>
        {/* RTL confirmation banner */}
        {sprintDirection === 'rtl' && !rtlBannerDismissed && (
          <div className="px-3 py-1.5 border-b border-amber-500/30 bg-amber-500/10 flex items-center gap-2">
            <span className="text-xs font-mono text-amber-400 flex-1">← Right-to-left sprint detected</span>
            <button
              onClick={() => setRtlBannerDismissed(true)}
              className="text-xs text-zinc-500 hover:text-amber-300 transition-colors cursor-pointer"
            >
              ✓ Ok
            </button>
          </div>
        )}
        <SectionHead label="Fly zone result" color="#f97316" />
        <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800/60 border-b border-zinc-100 dark:border-zinc-800/60">
          {[
            { label: 'Fly time', value: flyTime.toFixed(3), unit: 's' },
            { label: 'Distance', value: flyDistance.toFixed(2), unit: 'm' },
            {
              label: 'Avg Zone Velocity',
              value: flyVelocity.toFixed(2),
              unit: 'm/s',
            },
          ].map(({ label, value, unit }) => (
            <div key={label} className="px-2 py-2 flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-widest text-zinc-500">
                {label}
              </span>
              <div className="flex items-baseline gap-0.5">
                <span
                  className="text-base font-mono tabular-nums"
                  style={{ color: '#f97316' }}
                >
                  {value}
                </span>
                <span className="text-xs font-mono text-zinc-500">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Instantaneous velocity sparkline within the fly zone */}
        {(() => {
          const zf0 = Math.max(0, Math.floor(entryFrac));
          const zf1 = Math.min(n - 1, Math.ceil(exitFrac));
          const zoneSpeed = comSeries.speed.slice(zf0, zf1 + 1);
          if (zoneSpeed.length < 2) return null;
          const inZone = f >= zf0 && f <= zf1;
          const instSpeed = inZone ? (comSeries.speed[f] ?? 0) : null;
          const headPct =
            inZone && zoneSpeed.length > 1
              ? ((f - zf0) / (zoneSpeed.length - 1)) * 100
              : undefined;
          return (
            <>
              <SectionHead label="Instantaneous velocity in zone (m/s)" color="#f97316" />
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-mono text-zinc-500">|dCoM/dt|</span>
                  <span
                    className="text-xs font-mono tabular-nums"
                    style={{ color: '#f97316' }}
                  >
                    {instSpeed !== null ? `${instSpeed.toFixed(2)} m/s` : '—'}
                  </span>
                </div>
                <Sparkline
                  data={zoneSpeed}
                  color="#f97316"
                  height={30}
                  playheadPct={headPct}
                />
              </div>
            </>
          );
        })()}

        <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60 flex flex-col gap-1.5">
          {/* Entry frame — editable */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-zinc-500 shrink-0">
              Entry (Annotate → Start)
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={n - 1}
                value={flyEntryOverride ?? Math.round(entryFrac)}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setFlyEntryOverride(!isNaN(v) && v >= 0 ? v : null);
                }}
                className={`w-14 text-xs font-mono rounded-sm px-1 py-0.5 tabular-nums text-center outline-none
                  ${
                    flyEntryOverride !== null
                      ? 'bg-violet-950/60 border border-violet-500/60 text-violet-300'
                      : 'bg-zinc-900 border border-zinc-700 text-cyan-400'
                  }`}
              />
              <span className="text-xs font-mono text-zinc-500">
                · {(entryFrac / fps).toFixed(3)}s
              </span>
              {flyEntryOverride !== null && (
                <button
                  onClick={() => setFlyEntryOverride(null)}
                  title="Reset to auto"
                  className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors cursor-pointer"
                >
                  ↺
                </button>
              )}
            </div>
          </div>
          {/* Exit frame — editable */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-zinc-500 shrink-0">
              Exit (Annotate → Finish)
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={n - 1}
                value={flyExitOverride ?? Math.round(exitFrac)}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setFlyExitOverride(!isNaN(v) && v >= 0 ? v : null);
                }}
                className={`w-14 text-xs font-mono rounded-sm px-1 py-0.5 tabular-nums text-center outline-none
                  ${
                    flyExitOverride !== null
                      ? 'bg-violet-950/60 border border-violet-500/60 text-violet-300'
                      : 'bg-zinc-900 border border-zinc-700 text-orange-400'
                  }`}
              />
              <span className="text-xs font-mono text-zinc-500">
                · {(exitFrac / fps).toFixed(3)}s
              </span>
              {flyExitOverride !== null && (
                <button
                  onClick={() => setFlyExitOverride(null)}
                  title="Reset to auto"
                  className="text-xs text-zinc-500 hover:text-orange-400 transition-colors cursor-pointer"
                >
                  ↺
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-mono text-zinc-500">
              Distance from calibrated CoM
            </span>
            <span className="text-xs font-mono text-zinc-300">
              {flyDistance.toFixed(2)} m
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
