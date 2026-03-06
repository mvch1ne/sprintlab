import { useEffect, useRef, useCallback } from 'react';
import type { CropRect } from './TrimCropPanel';

interface Props {
  active: boolean;
  cropRect: CropRect | null;
  videoWidth: number;
  videoHeight: number;
  transform: { scale: number; x: number; y: number };
  onCropChange: (rect: CropRect) => void;
  onCropComplete: (rect: CropRect) => void;
}

type HandleId =
  | 'tl'
  | 'tr'
  | 'bl'
  | 'br'
  | 'tm'
  | 'bm'
  | 'ml'
  | 'mr'
  | 'body'
  | 'none';

const HR = 7; // handle hit radius px
const HS = 8; // handle drawn size px

// Returns the pixel rect of the video content inside a container,
// matching CSS object-fit:contain behaviour exactly.
function containRect(cw: number, ch: number, vw: number, vh: number) {
  if (!vw || !vh) return { left: 0, top: 0, width: cw, height: ch };
  const scale = Math.min(cw / vw, ch / vh);
  const width = vw * scale;
  const height = vh * scale;
  return {
    left: (cw - width) / 2,
    top: (ch - height) / 2,
    width,
    height,
  };
}

export const CropOverlay = ({
  active,
  cropRect,
  videoWidth,
  videoHeight,
  transform,
  onCropChange,
  onCropComplete,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<HandleId>('none');
  const dragStart = useRef<{ nx: number; ny: number; rect: CropRect } | null>(
    null,
  );
  const isNewDraw = useRef(false);
  const newDrawStart = useRef<{ x: number; y: number } | null>(null);

  // ── Coord helpers ───────────────────────────────────────────────────────
  // All normalised coords are 0-1 WITHIN the video frame (not the canvas).
  // IMPORTANT: use offsetWidth/offsetHeight (natural layout size, pre-transform)
  // not getBoundingClientRect (which returns post-transform scaled size).

  const getContain = useCallback((): ReturnType<typeof containRect> => {
    const el = canvasRef.current;
    if (!el) return { left: 0, top: 0, width: 1, height: 1 };
    return containRect(
      el.offsetWidth,
      el.offsetHeight,
      videoWidth,
      videoHeight,
    );
  }, [videoWidth, videoHeight]);

  // screen px (relative to viewport) → normalised video coord 0-1
  const screenToNorm = useCallback(
    (clientX: number, clientY: number) => {
      const el = canvasRef.current;
      if (!el) return { x: 0, y: 0 };

      // Screen position of the canvas element (post-transform, used for origin only)
      const rect = el.getBoundingClientRect();

      // Natural (pre-transform) canvas dimensions
      const cw = el.offsetWidth;
      const ch = el.offsetHeight;

      // Convert screen coords to pre-transform canvas space by undoing CSS scale+translate.
      // getBoundingClientRect gives the scaled rect; we find the canvas center in screen space,
      // subtract to get offset from center, divide by scale to get pre-transform offset.
      const screenCx = rect.left + rect.width / 2;
      const screenCy = rect.top + rect.height / 2;
      const ux = (clientX - screenCx) / transform.scale + cw / 2;
      const uy = (clientY - screenCy) / transform.scale + ch / 2;

      // Undo letterboxing using natural canvas size
      const c = containRect(cw, ch, videoWidth, videoHeight);
      return {
        x: Math.max(0, Math.min(1, (ux - c.left) / c.width)),
        y: Math.max(0, Math.min(1, (uy - c.top) / c.height)),
      };
    },
    [transform, videoWidth, videoHeight],
  );

  // normalised video coord → canvas px (in natural/pre-transform space)
  const normToCanvas = useCallback(
    (nx: number, ny: number): { x: number; y: number } => {
      const el = canvasRef.current;
      if (!el) return { x: 0, y: 0 };
      const cw = el.offsetWidth;
      const ch = el.offsetHeight;
      const c = containRect(cw, ch, videoWidth, videoHeight);
      return {
        x: c.left + nx * c.width,
        y: c.top + ny * c.height,
      };
    },
    [videoWidth, videoHeight],
  );

  // ── Hit testing ─────────────────────────────────────────────────────────
  const hitHandle = useCallback(
    (sx: number, sy: number, rect: CropRect): HandleId => {
      // sx/sy relative to canvas top-left (already subtracted getBCR.left/top)
      const tl = normToCanvas(rect.x, rect.y);
      const br = normToCanvas(rect.x + rect.w, rect.y + rect.h);
      const mx = (tl.x + br.x) / 2,
        my = (tl.y + br.y) / 2;
      const near = (ax: number, ay: number) =>
        Math.hypot(sx - ax, sy - ay) < HR;
      if (near(tl.x, tl.y)) return 'tl';
      if (near(br.x, tl.y)) return 'tr';
      if (near(tl.x, br.y)) return 'bl';
      if (near(br.x, br.y)) return 'br';
      if (near(mx, tl.y)) return 'tm';
      if (near(mx, br.y)) return 'bm';
      if (near(tl.x, my)) return 'ml';
      if (near(br.x, my)) return 'mr';
      if (sx > tl.x && sx < br.x && sy > tl.y && sy < br.y) return 'body';
      return 'none';
    },
    [normToCanvas],
  );

  const cursorFor = (h: HandleId) => {
    if (h === 'tl' || h === 'br') return 'nwse-resize';
    if (h === 'tr' || h === 'bl') return 'nesw-resize';
    if (h === 'tm' || h === 'bm') return 'ns-resize';
    if (h === 'ml' || h === 'mr') return 'ew-resize';
    if (h === 'body') return 'move';
    return 'crosshair';
  };

  // ── Draw ────────────────────────────────────────────────────────────────
  const draw = useCallback(
    (rect: CropRect | null) => {
      const el = canvasRef.current;
      if (!el) return;
      const ctx = el.getContext('2d')!;
      // Always sync canvas buffer size to CSS size
      el.width = el.offsetWidth;
      el.height = el.offsetHeight;
      const w = el.width,
        h = el.height;
      ctx.clearRect(0, 0, w, h);
      if (!rect) return;

      const tl = normToCanvas(rect.x, rect.y);
      const br = normToCanvas(rect.x + rect.w, rect.y + rect.h);
      const rw = br.x - tl.x,
        rh = br.y - tl.y;
      const mx = (tl.x + br.x) / 2,
        my = (tl.y + br.y) / 2;

      // Darken outside
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, w, tl.y); // top
      ctx.fillRect(0, br.y, w, h - br.y); // bottom
      ctx.fillRect(0, tl.y, tl.x, rh); // left
      ctx.fillRect(br.x, tl.y, w - br.x, rh); // right

      // Border
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tl.x, tl.y, rw, rh);

      // Rule of thirds
      ctx.strokeStyle = 'rgba(16,185,129,0.3)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(tl.x + (rw * i) / 3, tl.y);
        ctx.lineTo(tl.x + (rw * i) / 3, br.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tl.x, tl.y + (rh * i) / 3);
        ctx.lineTo(br.x, tl.y + (rh * i) / 3);
        ctx.stroke();
      }

      // Handles
      ctx.fillStyle = '#10b981';
      const handles: [number, number][] = [
        [tl.x, tl.y],
        [br.x, tl.y],
        [tl.x, br.y],
        [br.x, br.y],
        [mx, tl.y],
        [mx, br.y],
        [tl.x, my],
        [br.x, my],
      ];
      for (const [hx, hy] of handles) {
        ctx.fillRect(hx - HS / 2, hy - HS / 2, HS, HS);
      }
    },
    [normToCanvas],
  );

  useEffect(() => {
    draw(active ? cropRect : null);
  }, [active, cropRect, draw]);

  // ── Handle drag math ────────────────────────────────────────────────────
  const applyHandle = (
    h: HandleId,
    orig: CropRect,
    dx: number,
    dy: number,
  ): CropRect => {
    const cl = (v: number) => Math.max(0, Math.min(1, v));
    const r = { ...orig };
    switch (h) {
      case 'body':
        r.x = cl(orig.x + dx);
        r.y = cl(orig.y + dy);
        break;
      case 'tl':
        r.x = cl(orig.x + dx);
        r.y = cl(orig.y + dy);
        r.w = Math.max(0.01, orig.w - dx);
        r.h = Math.max(0.01, orig.h - dy);
        break;
      case 'tr':
        r.y = cl(orig.y + dy);
        r.w = Math.max(0.01, orig.w + dx);
        r.h = Math.max(0.01, orig.h - dy);
        break;
      case 'bl':
        r.x = cl(orig.x + dx);
        r.w = Math.max(0.01, orig.w - dx);
        r.h = Math.max(0.01, orig.h + dy);
        break;
      case 'br':
        r.w = Math.max(0.01, orig.w + dx);
        r.h = Math.max(0.01, orig.h + dy);
        break;
      case 'tm':
        r.y = cl(orig.y + dy);
        r.h = Math.max(0.01, orig.h - dy);
        break;
      case 'bm':
        r.h = Math.max(0.01, orig.h + dy);
        break;
      case 'ml':
        r.x = cl(orig.x + dx);
        r.w = Math.max(0.01, orig.w - dx);
        break;
      case 'mr':
        r.w = Math.max(0.01, orig.w + dx);
        break;
    }
    return r;
  };

  // ── Pointer events ──────────────────────────────────────────────────────
  // localXY converts screen coords to pre-transform canvas space (same space
  // as normToCanvas output), so hitHandle comparisons work correctly when zoomed.
  const localXY = (e: React.PointerEvent) => {
    const el = canvasRef.current!;
    const rect = el.getBoundingClientRect();
    const screenCx = rect.left + rect.width / 2;
    const screenCy = rect.top + rect.height / 2;
    return {
      lx: (e.clientX - screenCx) / transform.scale + el.offsetWidth / 2,
      ly: (e.clientY - screenCy) / transform.scale + el.offsetHeight / 2,
    };
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!active) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const pt = screenToNorm(e.clientX, e.clientY);
      const { lx, ly } = localXY(e);

      if (cropRect) {
        const h = hitHandle(lx, ly, cropRect);
        if (h !== 'none') {
          dragging.current = h;
          dragStart.current = { nx: pt.x, ny: pt.y, rect: { ...cropRect } };
          isNewDraw.current = false;
          return;
        }
      }
      // Start fresh draw
      isNewDraw.current = true;
      newDrawStart.current = pt;
      dragging.current = 'br';
      dragStart.current = {
        nx: pt.x,
        ny: pt.y,
        rect: { x: pt.x, y: pt.y, w: 0, h: 0 },
      };
      onCropChange({ x: pt.x, y: pt.y, w: 0, h: 0 });
    },
    [active, cropRect, hitHandle, screenToNorm, onCropChange],
  );

  const buildRect = useCallback(
    (pt: { x: number; y: number }): CropRect => {
      if (isNewDraw.current && newDrawStart.current) {
        const s = newDrawStart.current;
        return {
          x: Math.max(0, Math.min(s.x, pt.x)),
          y: Math.max(0, Math.min(s.y, pt.y)),
          w: Math.min(1, Math.abs(pt.x - s.x)),
          h: Math.min(1, Math.abs(pt.y - s.y)),
        };
      }
      if (!dragStart.current) return cropRect ?? { x: 0, y: 0, w: 1, h: 1 };
      const dx = pt.x - dragStart.current.nx;
      const dy = pt.y - dragStart.current.ny;
      return applyHandle(dragging.current, dragStart.current.rect, dx, dy);
    },
    [cropRect],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!active) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { lx, ly } = localXY(e);

      if (dragging.current === 'none') {
        if (cropRect)
          canvas.style.cursor = cursorFor(hitHandle(lx, ly, cropRect));
        return;
      }

      const pt = screenToNorm(e.clientX, e.clientY);
      const r = buildRect(pt);
      onCropChange(r);
      draw(r);
    },
    [active, cropRect, hitHandle, screenToNorm, buildRect, onCropChange, draw],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!active || dragging.current === 'none') return;
      const pt = screenToNorm(e.clientX, e.clientY);
      const r = buildRect(pt);
      if (r.w > 0.005 && r.h > 0.005) onCropComplete(r);
      dragging.current = 'none';
      dragStart.current = null;
      isNewDraw.current = false;
    },
    [active, screenToNorm, buildRect, onCropComplete],
  );

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: active ? 'auto' : 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
};
