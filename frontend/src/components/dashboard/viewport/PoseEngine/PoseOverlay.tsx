// ─── Pose Overlay Canvas ──────────────────────────────────────────────────────
import { useEffect, useRef, useCallback } from 'react';
import type { Keypoint } from './usePoseLandmarker';
import type { GroundContactEvent } from '../../useSprintMetrics';
import { LANDMARKS, CONNECTIONS, REGION_COLORS } from './poseConfig';

export type ViewMode = 'video' | 'skeleton' | 'body';

interface Props {
  keypoints: Keypoint[];
  frameWidth: number;
  frameHeight: number;
  videoNatWidth: number;
  videoNatHeight: number;
  visibilityMap: Record<number, boolean>;
  showLabels: boolean;
  viewMode?: ViewMode;
  // Imperative ref — assign to allow rAF loop to call draw() directly
  // without going through React state (eliminates pose lag at non-1x speeds)
  drawRef?: React.MutableRefObject<((kp: Keypoint[]) => void) | null>;
  groundContacts?: GroundContactEvent[]; // stride length annotations
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
  viewMode = 'video',
  drawRef,
  groundContacts = [],
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
  const viewModeRef = useRef(viewMode);
  const groundContactsRef = useRef(groundContacts);
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
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);
  useEffect(() => {
    groundContactsRef.current = groundContacts;
  }, [groundContacts]);

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

    if (viewModeRef.current === 'body') {
      // ── Ralph Mann-style body mode: filled ellipses per segment ────────────
      const get = (idx: number) =>
        isVisible(idx) ? toCanvas(kp[idx]) : null;

      // Filled ellipse along segment pa→pb with half-width hw.
      const seg = (
        pa: { x: number; y: number } | null,
        pb: { x: number; y: number } | null,
        hw: number,
        fill: string,
      ) => {
        if (!pa || !pb) return;
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const len = Math.hypot(dx, dy);
        if (len < 2) return;
        ctx.save();
        ctx.translate((pa.x + pb.x) / 2, (pa.y + pb.y) / 2);
        ctx.rotate(Math.atan2(dy, dx));
        ctx.beginPath();
        ctx.ellipse(0, 0, len / 2 + hw * 0.35, hw, 0, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      };

      const lSho = get(5),  rSho = get(6);
      const lElb = get(7),  rElb = get(8);
      const lWri = get(9),  rWri = get(10);
      const lHip = get(11), rHip = get(12);
      const lKne = get(13), rKne = get(14);
      const lAnk = get(15), rAnk = get(16);
      const lToe = get(17), rToe = get(20);
      const lHeel = get(19), rHeel = get(22);
      const nose  = get(0);

      const shoMid = lSho && rSho
        ? { x: (lSho.x + rSho.x) / 2, y: (lSho.y + rSho.y) / 2 }
        : null;
      const hipMid = lHip && rHip
        ? { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 }
        : null;

      // Fully opaque colors — 3D model look. Blue body, teal left leg, cyan right leg.
      const bC = '#3b82f6';   // body — electric blue
      const lC = '#10b981';   // left leg — emerald green
      const rC = '#06b6d4';   // right leg — cyan

      // Right limbs first (visually "behind")
      seg(rHip, rKne,   8, rC);
      seg(rKne, rAnk,   6, rC);
      seg(rHeel, rToe,  3, rC);
      // Right arm (body color)
      seg(rSho, rElb,   6, bC);
      seg(rElb, rWri,   5, bC);

      // Torso
      seg(lSho, rSho,   5, bC);
      seg(lHip, rHip,   5, bC);
      seg(shoMid, hipMid, 11, bC);

      // Left limbs (visually "in front")
      seg(lHip, lKne,   8, lC);
      seg(lKne, lAnk,   6, lC);
      seg(lHeel, lToe,  3, lC);
      // Left arm (body color)
      seg(lSho, lElb,   6, bC);
      seg(lElb, lWri,   5, bC);

      // Hands
      for (const [wri, col] of [[lWri, bC], [rWri, bC]] as const) {
        if (!wri) continue;
        ctx.beginPath();
        ctx.arc(wri.x, wri.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Head
      if (nose) {
        ctx.beginPath();
        ctx.arc(nose.x, nose.y, 11, 0, Math.PI * 2);
        ctx.fillStyle = bC;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else {
      // ── Standard skeleton mode ──────────────────────────────────────────────
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
        ctx.strokeStyle = color;
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
    }

    // ── Stride length annotations ─────────────────────────────────────────
    const contacts = groundContactsRef.current;
    if (contacts.length > 0 && fw && fh) {
      const toC = (p: { x: number; y: number }) => ({
        x: lb.left + p.x * sx,
        y: lb.top + p.y * sy,
      });

      const drawStridePair = (
        a: GroundContactEvent,
        b: GroundContactEvent,
        color: string,
        labelColor: string,
      ) => {
        const pa = toC(a.contactSite);
        const pb = toC(b.contactSite);
        const groundY = Math.max(pa.y, pb.y) + 18;

        // Horizontal bracket
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(pa.x, groundY);
        ctx.lineTo(pb.x, groundY);
        ctx.stroke();
        // Tick marks
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pa.x, groundY - 4);
        ctx.lineTo(pa.x, groundY + 4);
        ctx.moveTo(pb.x, groundY - 4);
        ctx.lineTo(pb.x, groundY + 4);
        ctx.stroke();
        // Label
        if (b.strideLength !== null) {
          const mid = (pa.x + pb.x) / 2;
          const label = `${b.strideLength.toFixed(2)}m`;
          ctx.font = '9px "DM Mono", monospace';
          ctx.fillStyle = labelColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(label, mid, groundY - 5);
        }
        ctx.restore();
      };

      // Draw step brackets between consecutive contacts of any foot
      for (let i = 1; i < contacts.length; i++) {
        const a = contacts[i - 1];
        const b = contacts[i];
        if (b.strideLength !== null) {
          const col = b.foot === 'left' ? '#10b981' : '#06b6d4';
          drawStridePair(a, b, col + '99', col);
        }
      }

      // ── Ground contact nodes ─────────────────────────────────────────────
      const mx = mousePosRef.current?.x ?? -9999;
      const my = mousePosRef.current?.y ?? -9999;
      const HOVER_R = 16;
      let hoveredContact: GroundContactEvent | null = null;
      for (const c of contacts) {
        const cnx = lb.left + c.contactSite.x * sx;
        const cny = lb.top + c.contactSite.y * sy;
        if (Math.hypot(cnx - mx, cny - my) < HOVER_R) {
          hoveredContact = c;
          break;
        }
      }
      for (const c of contacts) {
        const cnx = lb.left + c.contactSite.x * sx;
        const cny = lb.top + c.contactSite.y * sy;
        const isHov = hoveredContact === c;
        const ncol = c.foot === 'left' ? '#10b981' : '#06b6d4';
        ctx.beginPath();
        ctx.arc(cnx, cny, isHov ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = isHov ? ncol : ncol + '99';
        ctx.fill();
        ctx.strokeStyle = isHov ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.55)';
        ctx.lineWidth = isHov ? 2 : 1.5;
        ctx.stroke();
      }
      // Tooltip
      if (hoveredContact) {
        const hc = hoveredContact;
        const cnx = lb.left + hc.contactSite.x * sx;
        const cny = lb.top + hc.contactSite.y * sy;
        const tcol = hc.foot === 'left' ? '#10b981' : '#06b6d4';
        const lines: string[] = [
          `${hc.foot === 'left' ? 'Left' : 'Right'} foot`,
          `Contact time: ${(hc.contactTime * 1000).toFixed(0)} ms`,
          hc.flightTimeBefore > 0.01
            ? `Flight before: ${(hc.flightTimeBefore * 1000).toFixed(0)} ms`
            : 'Flight before: —',
          hc.strideLength != null
            ? `Step: ${hc.strideLength.toFixed(2)} m`
            : 'Step: — (calibrate first)',
          ...(hc.strideFrequency != null
            ? [`Cadence: ${hc.strideFrequency.toFixed(2)} Hz`]
            : []),
          `Frame: ${hc.contactFrame}`,
        ];
        ctx.font = '10px "DM Mono", monospace';
        const lineH = 15;
        const pad = { x: 9, y: 6 };
        const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
        const bw = maxW + pad.x * 2;
        const bh = lines.length * lineH + pad.y * 2;
        let tx = cnx + 14;
        let ty = cny - bh / 2;
        if (tx + bw > cw - 4) tx = cnx - bw - 14;
        if (ty < 4) ty = 4;
        if (ty + bh > ch - 4) ty = ch - bh - 4;
        ctx.fillStyle = 'rgba(9,9,11,0.92)';
        ctx.fillRect(tx, ty, bw, bh);
        ctx.strokeStyle = tcol;
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, bw, bh);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => {
          ctx.fillStyle = i === 0 ? tcol : '#d4d4d8';
          ctx.fillText(line, tx + pad.x, ty + pad.y + i * lineH);
        });
      }
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
  }, [visibilityMap, showLabels, viewMode, drawKp]);

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
