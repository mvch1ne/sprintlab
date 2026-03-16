import { useState, useCallback } from 'react';
import type { CropRect, TrimPoints } from '../components/dashboard/viewport/TrimAndCrop/TrimCropPanel';

export type { CropRect, TrimPoints };

/**
 * Manages trim & crop state for the viewport.
 */
export function useTrimCrop(_duration: number) {
  const [showTrimCropPanel, setShowTrimCropPanel] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [drawingCrop, setDrawingCrop] = useState(false);
  const [showCropOverlay, setShowCropOverlay] = useState(false);
  const [trimPoints, setTrimPoints] = useState<TrimPoints>({
    inPoint: 0,
    outPoint: 0,
  });

  const togglePanel = useCallback(() => {
    setShowTrimCropPanel((v) => !v);
  }, []);

  const closePanel = useCallback(() => {
    setShowTrimCropPanel(false);
    setShowCropOverlay(false);
  }, []);

  const startCropDraw = useCallback(() => {
    setDrawingCrop(true);
    setShowCropOverlay(true);
  }, []);

  const clearCrop = useCallback(() => {
    setCropRect(null);
    setShowCropOverlay(false);
    setDrawingCrop(false);
  }, []);

  const onCropComplete = useCallback((rect: CropRect) => {
    setCropRect(rect);
    setDrawingCrop(false);
    setShowCropOverlay(true);
  }, []);

  const reset = useCallback((newDuration: number) => {
    setShowTrimCropPanel(false);
    setCropRect(null);
    setDrawingCrop(false);
    setShowCropOverlay(false);
    setTrimPoints({ inPoint: 0, outPoint: newDuration });
  }, []);

  return {
    showTrimCropPanel,
    cropRect,
    drawingCrop,
    showCropOverlay,
    trimPoints,
    setCropRect,
    setTrimPoints,
    togglePanel,
    closePanel,
    startCropDraw,
    clearCrop,
    onCropComplete,
    reset,
  };
}
