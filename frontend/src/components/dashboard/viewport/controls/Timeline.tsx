// ─── Multi-Lane Timeline ────────────────────────────────────────────────────
// Replaces the simple scrubber with a zoomable, pannable timeline showing:
//   1. Frame ruler   — tick marks + frame numbers
//   2. Contacts      — coloured blocks for left/right ground contacts
//   3. Events        — dots for CoM events + sprint start/finish markers
//   4. Speed         — mini sparkline of CoM horizontal speed
import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type PointerEvent as RPointerEvent,
  type WheelEvent as RWheelEvent,
} from 'react';
import { useVideoContext } from '../../VideoContext';
import type { GroundContactEvent } from '../../useSprintMetrics';

// ── Constants ───────────────────────────────────────────────────────────────
const RULER_H = 18;
const CONTACT_H = 14;
const EVENT_H = 12;
const SPEED_H = 24;
const TOTAL_H = RULER_H + CONTACT_H + EVENT_H + SPEED_H; // 68px
const MIN_ZOOM = 1;
const MAX_ZOOM = 60;

// ── Props ───────────────────────────────────────────────────────────────────
interface TimelineProps {
  currentFrame: number;
  totalFrames: number;
  startFrame: number | null;
  proposedStartFrame?: number | null;
  onSeekToFrame: (frame: number) => void;
  disabled?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
/** Pick a nice tick interval given the visible frame range and available pixel width. */
function tickInterval(visibleFrames: number, widthPx: number): number {
  const targetTicks = Math.max(4, Math.floor(widthPx / 80));
  const raw = visibleFrames / targetTicks;
  const nice = [1, 2, 5, 10, 15, 30, 60, 90, 120, 150, 300, 600, 1200, 3000, 6000];
  return nice.find((n) => n >= raw) ?? Math.ceil(raw / 1000) * 1000;
}

// ── Component ───────────────────────────────────────────────────────────────
export function Timeline({
  currentFrame,
  totalFrames,
  startFrame,
  proposedStartFrame = null,
  onSeekToFrame,
  disabled = false,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  // Zoom: 1 = see all frames. Higher = zoomed in.
  const [zoom, setZoom] = useState(1);
  // Pan: 0..1 normalised offset of the visible window start within the full range.
  const [pan, setPan] = useState(0);

  // Drag state
  const dragRef = useRef<{
    type: 'seek' | 'pan';
    startX: number;
    startPan: number;
  } | null>(null);

  // ── Data from context ───────────────────────────────────────────────────
  const { metrics, comEvents, showCoMEvents, sprintStart, sprintFinish } =
    useVideoContext();
  const contacts: GroundContactEvent[] = metrics?.groundContacts ?? [];
  const speedData: number[] = metrics?.comSeries?.speed ?? [];
  const events = showCoMEvents ? comEvents : [];

  // ── Measure container ───────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Visible range ─────────────────────────────────────────────────────
  const maxFrame = Math.max(0, totalFrames - 1);
  const visibleFrames = Math.max(1, maxFrame / zoom);
  const maxPan = Math.max(0, maxFrame - visibleFrames);
  const viewStart = pan * maxPan;
  const viewEnd = viewStart + visibleFrames;

  // Frame ↔ pixel mapping
  const frameToX = useCallback(
    (f: number) => ((f - viewStart) / visibleFrames) * width,
    [viewStart, visibleFrames, width],
  );
  const xToFrame = useCallback(
    (x: number) => Math.round((x / width) * visibleFrames + viewStart),
    [viewStart, visibleFrames, width],
  );

  // ── Zoom handler (wheel) ──────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: RWheelEvent) => {
      if (disabled || maxFrame === 0) return;
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (e.shiftKey) {
        // Shift+wheel → pan
        const panDelta = (e.deltaY / width) * visibleFrames * 0.3;
        setPan((prev) => {
          if (maxPan === 0) return 0;
          return Math.max(0, Math.min(1, prev + panDelta / maxPan));
        });
      } else {
        // Wheel → zoom centred on cursor
        const cursorFrac = (e.clientX - rect.left) / rect.width;
        const cursorFrame = viewStart + cursorFrac * visibleFrames;
        const factor = e.deltaY > 0 ? 0.85 : 1.18;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
        const newVisible = maxFrame / newZoom;
        // Keep cursor frame at same screen position
        const newStart = cursorFrame - cursorFrac * newVisible;
        const newMaxPan = Math.max(0, maxFrame - newVisible);
        setZoom(newZoom);
        setPan(newMaxPan > 0 ? Math.max(0, Math.min(1, newStart / newMaxPan)) : 0);
      }
    },
    [disabled, maxFrame, zoom, viewStart, visibleFrames, width, maxPan],
  );

  // ── Pointer handlers (seek + pan drag) ────────────────────────────────
  const handlePointerDown = useCallback(
    (e: RPointerEvent) => {
      if (disabled || maxFrame === 0) return;
      const el = containerRef.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);

      if (e.button === 1 || e.altKey) {
        // Middle click or alt → pan drag
        dragRef.current = { type: 'pan', startX: e.clientX, startPan: pan };
      } else {
        // Left click → seek + start seek drag
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const frame = Math.max(0, Math.min(maxFrame, xToFrame(x)));
        onSeekToFrame(frame);
        dragRef.current = { type: 'seek', startX: e.clientX, startPan: pan };
      }
    },
    [disabled, maxFrame, pan, xToFrame, onSeekToFrame],
  );

  const handlePointerMove = useCallback(
    (e: RPointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const el = containerRef.current;
      if (!el) return;

      if (d.type === 'seek') {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const frame = Math.max(0, Math.min(maxFrame, xToFrame(x)));
        onSeekToFrame(frame);
      } else {
        // Pan drag
        const dx = e.clientX - d.startX;
        const frameDelta = -(dx / width) * visibleFrames;
        const newMaxPan = Math.max(0, maxFrame - visibleFrames);
        setPan(
          newMaxPan > 0
            ? Math.max(0, Math.min(1, d.startPan + frameDelta / newMaxPan))
            : 0,
        );
      }
    },
    [maxFrame, xToFrame, onSeekToFrame, width, visibleFrames],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ── Auto-pan to keep playhead visible ─────────────────────────────────
  useEffect(() => {
    if (zoom <= 1 || maxFrame === 0) return;
    const margin = visibleFrames * 0.1;
    if (currentFrame < viewStart + margin) {
      const target = Math.max(0, currentFrame - margin);
      const mp = Math.max(0, maxFrame - visibleFrames);
      setPan(mp > 0 ? Math.max(0, target / mp) : 0);
    } else if (currentFrame > viewEnd - margin) {
      const target = currentFrame - visibleFrames + margin;
      const mp = Math.max(0, maxFrame - visibleFrames);
      setPan(mp > 0 ? Math.min(1, target / mp) : 0);
    }
  }, [currentFrame, zoom, maxFrame, visibleFrames, viewStart, viewEnd]);

  // ── Tick marks ────────────────────────────────────────────────────────
  const ticks = useMemo(() => {
    const interval = tickInterval(visibleFrames, width);
    const first = Math.ceil(viewStart / interval) * interval;
    const arr: { frame: number; x: number; major: boolean }[] = [];
    for (let f = first; f <= viewEnd; f += interval) {
      arr.push({ frame: Math.round(f), x: frameToX(f), major: true });
    }
    // Sub-ticks (half-interval)
    if (interval >= 2) {
      const sub = interval / 2;
      const sf = Math.ceil(viewStart / sub) * sub;
      for (let f = sf; f <= viewEnd; f += sub) {
        if (f % interval !== 0) arr.push({ frame: Math.round(f), x: frameToX(f), major: false });
      }
    }
    return arr;
  }, [viewStart, viewEnd, visibleFrames, width, frameToX]);

  // ── Speed polyline ────────────────────────────────────────────────────
  const speedPath = useMemo(() => {
    if (speedData.length < 2) return '';
    const n = speedData.length;
    const maxSpeed = Math.max(...speedData, 0.001);
    const points: string[] = [];
    // Only render points within the visible range (with small margin)
    const f0 = Math.max(0, Math.floor(viewStart) - 1);
    const f1 = Math.min(n - 1, Math.ceil(viewEnd) + 1);
    for (let i = f0; i <= f1; i++) {
      const x = frameToX(i);
      const y = SPEED_H - (speedData[i] / maxSpeed) * (SPEED_H - 2);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return points.length > 1 ? `M${points.join('L')}` : '';
  }, [speedData, viewStart, viewEnd, frameToX]);

  // ── Playhead + markers ────────────────────────────────────────────────
  const playheadX = frameToX(currentFrame);
  const startX = startFrame !== null ? frameToX(startFrame) : null;
  const proposedX =
    proposedStartFrame !== null && proposedStartFrame !== startFrame
      ? frameToX(proposedStartFrame)
      : null;
  const sprintStartX = sprintStart ? frameToX(sprintStart.frame) : null;
  const sprintFinishX = sprintFinish ? frameToX(sprintFinish.frame) : null;

  // ── Minimap (shows zoom region in full range) ─────────────────────────
  const showMinimap = zoom > 1.2;
  const mmLeft = maxFrame > 0 ? (viewStart / maxFrame) * 100 : 0;
  const mmWidth = maxFrame > 0 ? (visibleFrames / maxFrame) * 100 : 100;

  return (
    <div className="TimelineContainer px-2 pt-1.5 pb-0.5 select-none">
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900/60 cursor-crosshair ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
        style={{ height: TOTAL_H }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* ── Frame Ruler ──────────────────────────────────────────────── */}
        <div
          className="relative border-b border-zinc-300/60 dark:border-zinc-700/60"
          style={{ height: RULER_H }}
        >
          {ticks.map((t) =>
            t.major ? (
              <div key={`t${t.frame}`} className="absolute top-0" style={{ left: t.x }}>
                <div className="w-px bg-zinc-400 dark:bg-zinc-600" style={{ height: RULER_H }} />
                <span
                  className="absolute text-[8px] font-mono text-zinc-500 dark:text-zinc-400 leading-none whitespace-nowrap"
                  style={{ top: 1, left: 3 }}
                >
                  {t.frame}
                </span>
              </div>
            ) : (
              <div
                key={`s${t.frame}`}
                className="absolute bottom-0 w-px bg-zinc-300 dark:bg-zinc-700"
                style={{ left: t.x, height: 4 }}
              />
            ),
          )}
        </div>

        {/* ── Contact Lane ─────────────────────────────────────────────── */}
        <div
          className="relative border-b border-zinc-300/40 dark:border-zinc-700/40"
          style={{ height: CONTACT_H }}
        >
          {contacts.map((c, i) => {
            const x1 = frameToX(c.contactFrame);
            const x2 = frameToX(c.liftFrame);
            const w = Math.max(1, x2 - x1);
            // Skip if fully out of view
            if (x2 < -2 || x1 > width + 2) return null;
            const isLeft = c.foot === 'left';
            return (
              <div
                key={c.id ?? `c${i}`}
                className={`absolute rounded-sm ${isLeft ? 'bg-emerald-500/70' : 'bg-orange-400/70'}`}
                style={{
                  left: x1,
                  width: w,
                  top: isLeft ? 1 : CONTACT_H / 2,
                  height: CONTACT_H / 2 - 1,
                }}
                title={`${isLeft ? 'L' : 'R'} foot: ${c.contactFrame}–${c.liftFrame} (${c.contactTime.toFixed(3)}s)`}
              />
            );
          })}
          {/* Lane label */}
          <span className="absolute right-1 top-0 text-[7px] font-mono text-zinc-400 dark:text-zinc-500 leading-none pointer-events-none" style={{ lineHeight: `${CONTACT_H}px` }}>
            GC
          </span>
        </div>

        {/* ── Event Lane ───────────────────────────────────────────────── */}
        <div
          className="relative border-b border-zinc-300/40 dark:border-zinc-700/40"
          style={{ height: EVENT_H }}
        >
          {/* Sprint start marker */}
          {sprintStartX !== null && (
            <div
              className="absolute top-1 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[5px] border-l-transparent border-r-transparent border-t-sky-500"
              style={{ left: sprintStartX - 3 }}
              title={`Sprint start: frame ${sprintStart!.frame}`}
            />
          )}
          {/* Sprint finish marker */}
          {sprintFinishX !== null && (
            <div
              className="absolute top-1 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[5px] border-l-transparent border-r-transparent border-t-red-500"
              style={{ left: sprintFinishX - 3 }}
              title={`Sprint finish: frame ${sprintFinish!.frame}`}
            />
          )}
          {/* CoM events */}
          {events.map((ev, i) => {
            const x = frameToX(ev.frame);
            if (x < -4 || x > width + 4) return null;
            return (
              <div
                key={`ev${i}`}
                className="absolute top-1/2 -translate-y-1/2 w-[5px] h-[5px] rounded-full bg-violet-500 border border-violet-300"
                style={{ left: x - 2.5 }}
                title={`CoM event: frame ${ev.frame}`}
              />
            );
          })}
          <span className="absolute right-1 top-0 text-[7px] font-mono text-zinc-400 dark:text-zinc-500 leading-none pointer-events-none" style={{ lineHeight: `${EVENT_H}px` }}>
            EV
          </span>
        </div>

        {/* ── Speed Lane ───────────────────────────────────────────────── */}
        <div className="relative" style={{ height: SPEED_H }}>
          {speedPath && (
            <svg
              className="absolute inset-0"
              width={width}
              height={SPEED_H}
              viewBox={`0 0 ${width} ${SPEED_H}`}
              preserveAspectRatio="none"
            >
              <path
                d={speedPath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={1.2}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
          <span className="absolute right-1 top-0 text-[7px] font-mono text-zinc-400 dark:text-zinc-500 leading-none pointer-events-none" style={{ lineHeight: `${SPEED_H}px` }}>
            SPD
          </span>
        </div>

        {/* ── Playhead (spans all lanes) ───────────────────────────────── */}
        {playheadX >= -1 && playheadX <= width + 1 && (
          <div
            className="absolute top-0 w-px pointer-events-none"
            style={{
              left: playheadX,
              height: TOTAL_H,
              background: 'linear-gradient(to bottom, #0ea5e9, #0ea5e9)',
              boxShadow: '0 0 4px rgba(14,165,233,0.5)',
            }}
          />
        )}

        {/* ── Start frame marker ───────────────────────────────────────── */}
        {startX !== null && startX >= -1 && startX <= width + 1 && (
          <div
            className="absolute top-0 w-px bg-orange-400 pointer-events-none"
            style={{ left: startX, height: TOTAL_H }}
          />
        )}

        {/* ── Proposed start marker ────────────────────────────────────── */}
        {proposedX !== null && proposedX >= -1 && proposedX <= width + 1 && (
          <div
            className="absolute top-0 w-px pointer-events-none"
            style={{
              left: proposedX,
              height: TOTAL_H,
              borderLeft: '1px dashed rgba(52,211,153,0.6)',
            }}
          />
        )}
      </div>

      {/* ── Minimap (visible when zoomed) ────────────────────────────── */}
      {showMinimap && (
        <div className="relative h-1.5 mt-0.5 mx-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          <div
            className="absolute top-0 h-full rounded-full bg-sky-500/40"
            style={{ left: `${mmLeft}%`, width: `${Math.max(2, mmWidth)}%` }}
          />
        </div>
      )}
    </div>
  );
}
