// ─── Pose Overlay Canvas ──────────────────────────────────────────────────────
import { useEffect, useRef, useCallback } from 'react';
import type { Keypoint } from './usePoseLandmarker';
import { LANDMARKS, CONNECTIONS, REGION_COLORS } from './poseConfig';

interface Props {
  keypoints: Keypoint[];
  frameWidth: number;
  frameHeight: number;
  videoNatWidth: number;
  videoNatHeight: number;
  visibilityMap: Record<number, boolean>;
  showLabels: boolean;
  // Imperative ref — assign to allow rAF loop to call draw() directly
  // without going through React state (eliminates pose lag at non-1x speeds)
  drawRef?: React.MutableRefObject<((kp: Keypoint[]) => void) | null>;
}

const SCORE_THRESHOLD = 0.43;
const DOT_RADIUS = 4;
const LINE_WIDTH = 1.5;

function letterboxRect(cw: number, ch: number, nw: number, nh: number) {
  if (!nw || !nh) return { left: 0, top: 0, width: cw, height: ch };
  const scale = Math.min(cw / nw, ch / nh);
  const width = nw * scale;
  const height = nh * scale;
  return { left: (cw - width) / 2, top: (ch - height) / 2, width, height };
}

export const PoseOverlay = ({
  keypoints,
  frameWidth,
  frameHeight,
  videoNatWidth,
  videoNatHeight,
  visibilityMap,
  showLabels,
  drawRef,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Keep latest non-keypoint params in refs so the imperative draw fn is
  // always fresh without needing to be recreated
  const frameWidthRef = useRef(frameWidth);
  const frameHeightRef = useRef(frameHeight);
  const natWidthRef = useRef(videoNatWidth);
  const natHeightRef = useRef(videoNatHeight);
  const visibilityMapRef = useRef(visibilityMap);
  const showLabelsRef = useRef(showLabels);
  useEffect(() => {
    frameWidthRef.current = frameWidth;
  }, [frameWidth]);
  useEffect(() => {
    frameHeightRef.current = frameHeight;
  }, [frameHeight]);
  useEffect(() => {
    natWidthRef.current = videoNatWidth;
  }, [videoNatWidth]);
  useEffect(() => {
    natHeightRef.current = videoNatHeight;
  }, [videoNatHeight]);
  useEffect(() => {
    visibilityMapRef.current = visibilityMap;
  }, [visibilityMap]);
  useEffect(() => {
    showLabelsRef.current = showLabels;
  }, [showLabels]);

  // ── Core imperative draw — accepts keypoints directly ────────────────────
  const drawKp = useCallback((kp: Keypoint[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;
    if (!cw || !ch) return;
    canvas.width = cw;
    canvas.height = ch;
    ctx.clearRect(0, 0, cw, ch);

    const fw = frameWidthRef.current;
    const fh = frameHeightRef.current;
    if (!kp.length || !fw || !fh) return;

    const lb = letterboxRect(cw, ch, natWidthRef.current, natHeightRef.current);
    const sx = lb.width / fw;
    const sy = lb.height / fh;

    const toCanvas = (p: Keypoint) => ({
      x: lb.left + p.x * sx,
      y: lb.top + p.y * sy,
    });
    const vm = visibilityMapRef.current;
    const lmMap = new Map(LANDMARKS.map((l) => [l.index, l]));

    const isVisible = (idx: number) => {
      if (!vm[idx]) return false;
      const p = kp[idx];
      return !!p && p.score >= SCORE_THRESHOLD;
    };

    for (const [a, b] of CONNECTIONS) {
      if (!isVisible(a) || !isVisible(b)) continue;
      const pa = toCanvas(kp[a]);
      const pb = toCanvas(kp[b]);
      const rA = lmMap.get(a)?.region ?? 'upper';
      const rB = lmMap.get(b)?.region ?? 'upper';
      const color = REGION_COLORS[rA === rB ? rA : rB];
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = color + 'cc';
      ctx.lineWidth = LINE_WIDTH;
      ctx.stroke();
    }

    for (const lmDef of LANDMARKS) {
      if (!isVisible(lmDef.index)) continue;
      const { x, y } = toCanvas(kp[lmDef.index]);
      const color = REGION_COLORS[lmDef.region];
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (showLabelsRef.current && mousePosRef.current) {
      const { x: mx, y: my } = mousePosRef.current;
      let closest: {
        dist: number;
        label: string;
        x: number;
        y: number;
      } | null = null;
      for (const lmDef of LANDMARKS) {
        if (!isVisible(lmDef.index)) continue;
        const { x, y } = toCanvas(kp[lmDef.index]);
        const dist = Math.hypot(x - mx, y - my);
        if (dist < 24 && (!closest || dist < closest.dist)) {
          closest = { dist, label: lmDef.name, x, y };
        }
      }
      if (closest) {
        const pad = { x: 6, y: 3 };
        ctx.font = '11px "DM Mono", monospace';
        const tw = ctx.measureText(closest.label).width;
        const bx = closest.x + 12;
        const by = closest.y - 8;
        ctx.fillStyle = 'rgba(9,9,11,0.88)';
        ctx.fillRect(bx - pad.x, by - pad.y, tw + pad.x * 2, 16 + pad.y * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - pad.x, by - pad.y, tw + pad.x * 2, 16 + pad.y * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(closest.label, bx, by + 8);
      }
    }
  }, []); // stable — reads everything from refs

  // ── Expose imperative draw to parent via drawRef ─────────────────────────
  useEffect(() => {
    if (drawRef) drawRef.current = drawKp;
    return () => {
      if (drawRef) drawRef.current = null;
    };
  }, [drawRef, drawKp]);

  // Keep latest keypoints in a ref so resize/visibility redraws always have them
  const currentKpRef = useRef<Keypoint[]>(keypoints);
  useEffect(() => {
    currentKpRef.current = keypoints;
    drawKp(keypoints);
  }, [keypoints, drawKp]);

  // Redraw when any display-affecting prop changes
  useEffect(() => {
    drawKp(currentKpRef.current);
  }, [visibilityMap, showLabels, drawKp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => drawKp(currentKpRef.current));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [drawKp]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    drawKp(keypoints);
  };
  const handleMouseLeave = () => {
    mousePosRef.current = null;
    drawKp(keypoints);
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ cursor: 'default' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
};
