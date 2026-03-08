import { useEffect, useRef, useState, useCallback } from 'react';
import type { CalibrationData } from './CalibrationAndMeasurements/CalibrationOverlay';

export interface Measurement {
  id: string;
  type: 'distance' | 'angle';
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  pointC?: { x: number; y: number }; // angle vertex: A-B-C, angle at B
  /** Aspect-ratio-corrected normalised distance — recompute meters from this when calibration changes. */
  normDist?: number;
  meters?: number;
  degrees?: number;
  label: string;
  visible: boolean;
}

interface Props {
  active: boolean;
  mode: 'distance' | 'angle';
  transform: { scale: number; x: number; y: number };
  calibration: CalibrationData;
  measurements: Measurement[];
  onMeasurementAdded: (m: Measurement) => void;
}

export const MeasurementOverlay = ({
  active,
  mode,
  transform,
  calibration,
  measurements,
  onMeasurementAdded,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Distance mode: one point placed, waiting for second
  // Angle mode: A placed → B (vertex) placed → C placed → done
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const screenToNorm = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = rect.width;
      const h = rect.height;
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
      const cx = w / 2;
      const cy = h / 2;
      return {
        x: (pt.x * w - cx) * transform.scale + cx + transform.x,
        y: (pt.y * h - cy) * transform.scale + cy + transform.y,
      };
    },
    [transform],
  );

  // Aspect-ratio-corrected distance in normalised space
  const normDist = useCallback(
    (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const ar = calibration.aspectRatio ?? 1;
      const dx = (b.x - a.x) * ar;
      const dy = b.y - a.y;
      return Math.sqrt(dx * dx + dy * dy);
    },
    [calibration.aspectRatio],
  );

  const toMeters = useCallback(
    (a: { x: number; y: number }, b: { x: number; y: number }) => {
      return normDist(a, b) / calibration.pixelsPerMeter;
    },
    [calibration, normDist],
  );

  // Angle at vertex B, formed by rays B→A and B→C (degrees)
  const angleDeg = useCallback(
    (
      a: { x: number; y: number },
      b: { x: number; y: number },
      c: { x: number; y: number },
    ) => {
      const ar = calibration.aspectRatio ?? 1;
      const ax = (a.x - b.x) * ar,
        ay = a.y - b.y;
      const cx = (c.x - b.x) * ar,
        cy = c.y - b.y;
      const dot = ax * cx + ay * cy;
      const magA = Math.sqrt(ax * ax + ay * ay);
      const magC = Math.sqrt(cx * cx + cy * cy);
      if (magA === 0 || magC === 0) return 0;
      return (
        Math.acos(Math.max(-1, Math.min(1, dot / (magA * magC)))) *
        (180 / Math.PI)
      );
    },
    [calibration.aspectRatio],
  );

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = (canvas.width = canvas.offsetWidth);
    const h = (canvas.height = canvas.offsetHeight);
    ctx.clearRect(0, 0, w, h);

    const drawLabel = (x: number, y: number, text: string, color: string) => {
      ctx.font = '10px "DM Mono", monospace';
      const tw = ctx.measureText(text).width;
      const pad = { x: 5, y: 3 };
      ctx.fillStyle = 'rgba(9,9,11,0.85)';
      ctx.fillRect(
        x - tw / 2 - pad.x,
        y - 7 - pad.y,
        tw + pad.x * 2,
        14 + pad.y * 2,
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        x - tw / 2 - pad.x,
        y - 7 - pad.y,
        tw + pad.x * 2,
        14 + pad.y * 2,
      );
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
    };

    const drawLine = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      color: string,
      alpha = 1,
      dashed = false,
    ) => {
      const pa = normToCanvas(a, w, h);
      const pb = normToCanvas(b, w, h);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(dashed ? [4, 3] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      // End caps
      const angle = Math.atan2(pb.y - pa.y, pb.x - pa.x);
      for (const pt of [pa, pb]) {
        ctx.beginPath();
        ctx.moveTo(
          pt.x + Math.cos(angle + Math.PI / 2) * 6,
          pt.y + Math.sin(angle + Math.PI / 2) * 6,
        );
        ctx.lineTo(
          pt.x + Math.cos(angle - Math.PI / 2) * 6,
          pt.y + Math.sin(angle - Math.PI / 2) * 6,
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return { pa, pb };
    };

    const drawDot = (pt: { x: number; y: number }, color: string) => {
      const { x, y } = normToCanvas(pt, w, h);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const drawAngleArc = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      c: { x: number; y: number },
      deg: number,
      color: string,
      alpha = 1,
    ) => {
      const pb = normToCanvas(b, w, h);
      const pa = normToCanvas(a, w, h);
      const pc = normToCanvas(c, w, h);
      const angA = Math.atan2(pa.y - pb.y, pa.x - pb.x);
      const angC = Math.atan2(pc.y - pb.y, pc.x - pb.x);
      const r = 18;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(pb.x, pb.y, r, angA, angC, false);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Label halfway between angles
      const midAng = angA + (angC - angA) / 2;
      const lx = pb.x + Math.cos(midAng) * (r + 14);
      const ly = pb.y + Math.sin(midAng) * (r + 14);
      drawLabel(lx, ly, `${deg.toFixed(1)}°`, color);
    };

    // Draw saved measurements
    measurements.forEach((m) => {
      if (!m.visible) return;
      if (m.type === 'distance') {
        const { pa, pb } = drawLine(m.pointA, m.pointB, '#38bdf8');
        drawLabel(
          (pa.x + pb.x) / 2,
          (pa.y + pb.y) / 2 - 12,
          m.label,
          '#38bdf8',
        );
      } else if (m.type === 'angle' && m.pointC && m.degrees !== undefined) {
        drawLine(m.pointA, m.pointB, '#a78bfa');
        drawLine(m.pointB, m.pointC, '#a78bfa');
        drawAngleArc(m.pointA, m.pointB, m.pointC, m.degrees, '#a78bfa');
      }
    });

    if (!active) return;

    // Calibration reference ghost
    ctx.globalAlpha = 0.2;
    const ca = normToCanvas(calibration.lineStart, w, h);
    const cb = normToCanvas(calibration.lineEnd, w, h);
    ctx.beginPath();
    ctx.moveTo(ca.x, ca.y);
    ctx.lineTo(cb.x, cb.y);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    if (mode === 'distance') {
      // Live distance line
      if (points[0] && mousePos) {
        const m = toMeters(points[0], mousePos);
        const { pa, pb } = drawLine(points[0], mousePos, '#f97316', 0.7);
        drawLabel(
          (pa.x + pb.x) / 2,
          (pa.y + pb.y) / 2 - 12,
          `${m.toFixed(2)}m`,
          '#f97316',
        );
      }
      if (points[0]) drawDot(points[0], '#f97316');
    } else {
      // Angle mode: points[0]=A, points[1]=B (vertex)
      if (points[0]) {
        drawDot(points[0], '#a78bfa');
        if (mousePos && !points[1]) {
          drawLine(points[0], mousePos, '#a78bfa', 0.6, true);
        }
      }
      if (points[1]) {
        drawDot(points[1], '#a78bfa');
        drawLine(points[0], points[1], '#a78bfa');
        if (mousePos) {
          drawLine(points[1], mousePos, '#a78bfa', 0.6, true);
          const deg = angleDeg(points[0], points[1], mousePos);
          drawAngleArc(points[0], points[1], mousePos, deg, '#a78bfa', 0.7);
        }
      }
    }

    // Crosshair
    if (mousePos) {
      const { x, y } = normToCanvas(mousePos, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
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
    mode,
    measurements,
    points,
    mousePos,
    transform,
    normToCanvas,
    calibration,
    toMeters,
    angleDeg,
  ]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!active) return;
      const pt = screenToNorm(e);

      if (mode === 'distance') {
        if (points.length === 0) {
          setPoints([pt]);
        } else {
          const nd = normDist(points[0], pt);
          const meters = nd / calibration.pixelsPerMeter;
          onMeasurementAdded({
            id: crypto.randomUUID(),
            type: 'distance',
            pointA: points[0],
            pointB: pt,
            normDist: nd,
            meters,
            label: `${meters.toFixed(2)}m`,
            visible: true,
          });
          setPoints([]);
        }
      } else {
        // Angle: collect A, B (vertex), C
        if (points.length < 2) {
          setPoints((prev) => [...prev, pt]);
        } else {
          const [a, b] = points;
          const deg = angleDeg(a, b, pt);
          onMeasurementAdded({
            id: crypto.randomUUID(),
            type: 'angle',
            pointA: a,
            pointB: b,
            pointC: pt,
            degrees: deg,
            label: `${deg.toFixed(1)}°`,
            visible: true,
          });
          setPoints([]);
        }
      }
    },
    [
      active,
      mode,
      points,
      screenToNorm,
      toMeters,
      angleDeg,
      onMeasurementAdded,
    ],
  );

  // Reset points when mode changes
  useEffect(() => {
    setPoints([]);
  }, [mode]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!active) return;
      setMousePos(screenToNorm(e));
    },
    [active, screenToNorm],
  );

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{
        pointerEvents: active ? 'auto' : 'none',
        cursor: active ? 'crosshair' : 'default',
      }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setMousePos(null)}
    />
  );
};
