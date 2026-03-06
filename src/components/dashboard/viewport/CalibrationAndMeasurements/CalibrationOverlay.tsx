import { useEffect, useRef, useState, useCallback } from 'react';

export interface CalibrationData {
  pixelsPerMeter: number;
  lineStart: { x: number; y: number }; // normalized 0-1
  lineEnd: { x: number; y: number };
  realMeters: number;
  aspectRatio: number; // videoWidth / videoHeight, stored so measurements can use same ratio
}

interface Props {
  active: boolean;
  transform: { scale: number; x: number; y: number };
  videoWidth: number;
  videoHeight: number;
  existingCalibration: CalibrationData | null;
  onCalibrationComplete: (data: CalibrationData) => void;
  onCancel: () => void;
}

type Step = 'pick_start' | 'pick_end' | 'enter_distance';

export const CalibrationOverlay = ({
  active,
  transform,
  videoWidth,
  videoHeight,
  existingCalibration,
  onCalibrationComplete,
  onCancel,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>('pick_start');
  const [pointA, setPointA] = useState<{ x: number; y: number } | null>(null);
  const [pointB, setPointB] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [distanceInput, setDistanceInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert screen click → normalized video-space coords (0-1),
  // accounting for the zoom/pan transform on the layer stack
  const screenToNorm = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const rect = canvasRef.current!.getBoundingClientRect();
      // Position within the canvas element
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = rect.width;
      const h = rect.height;
      // Invert the CSS transform: translate then scale from center
      const cx = w / 2;
      const cy = h / 2;
      const nx = ((sx - cx - transform.x) / transform.scale + cx) / w;
      const ny = ((sy - cy - transform.y) / transform.scale + cy) / h;
      return {
        x: Math.max(0, Math.min(1, nx)),
        y: Math.max(0, Math.min(1, ny)),
      };
    },
    [transform],
  );

  const normToCanvas = useCallback(
    (pt: { x: number; y: number }, w: number, h: number) => {
      // Norm → video-space → apply transform → canvas pixels
      const cx = w / 2;
      const cy = h / 2;
      const vx = pt.x * w;
      const vy = pt.y * h;
      return {
        x: (vx - cx) * transform.scale + cx + transform.x,
        y: (vy - cy) * transform.scale + cy + transform.y,
      };
    },
    [transform],
  );

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = (canvas.width = canvas.offsetWidth);
    const h = (canvas.height = canvas.offsetHeight);
    ctx.clearRect(0, 0, w, h);

    if (!active) return;

    const drawPoint = (pt: { x: number; y: number }, color: string) => {
      const { x, y } = normToCanvas(pt, w, h);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const drawLine = (
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => {
      const pa = normToCanvas(a, w, h);
      const pb = normToCanvas(b, w, h);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Draw existing calibration faintly if present
    if (existingCalibration && !pointA) {
      ctx.globalAlpha = 0.3;
      drawLine(existingCalibration.lineStart, existingCalibration.lineEnd);
      drawPoint(existingCalibration.lineStart, '#38bdf8');
      drawPoint(existingCalibration.lineEnd, '#38bdf8');
      ctx.globalAlpha = 1;
    }

    // Draw live line from pointA to mouse
    if (pointA && !pointB && mousePos) drawLine(pointA, mousePos);
    if (pointA && pointB) drawLine(pointA, pointB);
    if (pointA) drawPoint(pointA, '#38bdf8');
    if (pointB) drawPoint(pointB, '#f97316');

    // Crosshair at mouse
    if (mousePos && step !== 'enter_distance') {
      const { x, y } = normToCanvas(mousePos, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
    }
  }, [
    active,
    pointA,
    pointB,
    mousePos,
    step,
    transform,
    normToCanvas,
    existingCalibration,
  ]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!active) return;
      const pt = screenToNorm(e);
      if (step === 'pick_start') {
        setPointA(pt);
        setStep('pick_end');
      } else if (step === 'pick_end') {
        setPointB(pt);
        setStep('enter_distance');
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [active, step, screenToNorm],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!active || step === 'enter_distance') return;
      setMousePos(screenToNorm(e));
    },
    [active, step, screenToNorm],
  );

  const handleConfirm = useCallback(() => {
    if (!pointA || !pointB) return;
    const meters = parseFloat(distanceInput);
    if (isNaN(meters) || meters <= 0) return;
    // Scale dx by aspect ratio so horizontal and vertical units are equal
    const aspect = videoWidth && videoHeight ? videoWidth / videoHeight : 1;
    const dx = (pointB.x - pointA.x) * aspect;
    const dy = pointB.y - pointA.y;
    const normDist = Math.sqrt(dx * dx + dy * dy);
    const pixelsPerMeter = normDist / meters;
    const aspectRatio = aspect;
    onCalibrationComplete({
      pixelsPerMeter,
      lineStart: pointA,
      lineEnd: pointB,
      realMeters: meters,
      aspectRatio,
    });
  }, [
    pointA,
    pointB,
    distanceInput,
    videoWidth,
    videoHeight,
    onCalibrationComplete,
  ]);

  const handleReset = () => {
    setPointA(null);
    setPointB(null);
    setStep('pick_start');
    setDistanceInput('');
  };

  const stepLabel =
    step === 'pick_start'
      ? 'Click to set point A'
      : step === 'pick_end'
        ? 'Click to set point B'
        : 'Enter real-world distance';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ pointerEvents: active ? 'auto' : 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: step === 'enter_distance' ? 'default' : 'crosshair' }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMousePos(null)}
      />

      {/* HUD */}
      {active && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 border border-zinc-600 rounded-sm backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-[9px] uppercase tracking-widest text-zinc-300">
              {stepLabel}
            </span>
          </div>

          {step === 'enter_distance' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-950/90 border border-zinc-600 rounded-sm backdrop-blur-sm">
              <input
                ref={inputRef}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={distanceInput}
                onChange={(e) => setDistanceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                  if (e.key === 'Escape') handleReset();
                }}
                className="w-20 bg-transparent border-b border-zinc-500 text-xs text-sky-300 tabular-nums text-center outline-none focus:border-sky-400 pb-0.5"
              />
              <span className="text-[9px] uppercase tracking-widest text-zinc-400">
                meters
              </span>
              <button
                onClick={handleConfirm}
                disabled={!distanceInput || parseFloat(distanceInput) <= 0}
                className="px-2 py-0.5 text-[9px] uppercase tracking-widest border border-sky-600 text-sky-400 hover:bg-sky-600/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-sm transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={handleReset}
                className="px-2 py-0.5 text-[9px] uppercase tracking-widest border border-zinc-600 text-zinc-400 hover:bg-zinc-700/30 rounded-sm transition-colors"
              >
                Redo
              </button>
            </div>
          )}

          <button
            onClick={onCancel}
            className="text-[9px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
