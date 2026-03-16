import { useState, useRef, useCallback, useEffect } from 'react';

export interface Transform {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_SPEED = 0.005;

/**
 * Manages viewport zoom/pan state and pointer interactions.
 * Panning is blocked when an overlay tool is active (calibrating, measuring, etc.).
 */
export function useZoomPan(toolActive: boolean) {
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const mainRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  const clampPan = useCallback(
    (x: number, y: number, scale: number, el: HTMLElement) => {
      const maxX = (el.clientWidth * (scale - 1)) / 2;
      const maxY = (el.clientHeight * (scale - 1)) / 2;
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    [],
  );

  // Wheel zoom
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setTransform((prev) => {
        const newScale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, prev.scale * (1 + -e.deltaY * ZOOM_SPEED)),
        );
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left - rect.width / 2;
        const my = e.clientY - rect.top - rect.height / 2;
        const sf = newScale / prev.scale;
        const { x, y } = clampPan(
          mx + (prev.x - mx) * sf,
          my + (prev.y - my) * sf,
          newScale,
          el,
        );
        return { scale: newScale, x, y };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (toolActive || transform.scale <= 1) return;
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { x: transform.x, y: transform.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [toolActive, transform.scale, transform.x, transform.y],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning.current || !mainRef.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      const { x, y } = clampPan(
        panOrigin.current.x + dx,
        panOrigin.current.y + dy,
        transform.scale,
        mainRef.current,
      );
      setTransform((prev) => ({ ...prev, x, y }));
    },
    [clampPan, transform.scale],
  );

  const onPointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const resetTransform = useCallback(
    () => setTransform({ scale: 1, x: 0, y: 0 }),
    [],
  );

  const zoomLabel = transform.scale > 1 ? `${transform.scale.toFixed(1)}×` : null;

  return {
    transform,
    mainRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    resetTransform,
    zoomLabel,
  };
}
