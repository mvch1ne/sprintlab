import { useState, useCallback } from 'react';
import type { CalibrationData } from '../components/dashboard/viewport/CalibrationAndMeasurements/CalibrationOverlay';

export type { CalibrationData };

/**
 * Manages calibration state (the 2-point scale reference).
 */
export function useCalibration() {
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationKey, setCalibrationKey] = useState(0);

  const startCalibration = useCallback(() => {
    setCalibrationKey((k) => k + 1);
    setCalibrating(true);
  }, []);

  const completeCalibration = useCallback((data: CalibrationData) => {
    setCalibration(data);
    setCalibrating(false);
  }, []);

  const cancelCalibration = useCallback(() => {
    setCalibrating(false);
  }, []);

  const reset = useCallback(() => {
    setCalibration(null);
    setCalibrating(false);
  }, []);

  return {
    calibration,
    calibrating,
    calibrationKey,
    startCalibration,
    completeCalibration,
    cancelCalibration,
    reset,
  };
}
