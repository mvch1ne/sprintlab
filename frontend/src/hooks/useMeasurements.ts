import { useState, useCallback, useMemo } from 'react';
import type { Measurement } from '../components/dashboard/viewport/CalibrationAndMeasurements/MeasurementOverlay';
import type { CalibrationData } from '../components/dashboard/viewport/CalibrationAndMeasurements/CalibrationOverlay';

export type { Measurement };

/**
 * Manages measurement state (distance & angle measurements placed on the viewport).
 */
export function useMeasurements(calibration: CalibrationData | null) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [measuringDistance, setMeasuringDistance] = useState(false);
  const [measuringAngle, setMeasuringAngle] = useState(false);
  const [measuringKey, setMeasuringKey] = useState(0);
  const [showMeasurementPanel, setShowMeasurementPanel] = useState(false);

  const toggleMeasuringDistance = useCallback(() => {
    setMeasuringKey((k) => k + 1);
    setMeasuringDistance((m) => !m);
    setMeasuringAngle(false);
  }, []);

  const toggleMeasuringAngle = useCallback(() => {
    setMeasuringKey((k) => k + 1);
    setMeasuringAngle((m) => !m);
    setMeasuringDistance(false);
  }, []);

  const stopMeasuring = useCallback(() => {
    setMeasuringDistance(false);
    setMeasuringAngle(false);
  }, []);

  const addMeasurement = useCallback((m: Measurement) => {
    setMeasurements((prev) => [...prev, m]);
    setShowMeasurementPanel(true);
  }, []);

  const deleteMeasurement = useCallback((id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const deleteAllMeasurements = useCallback(() => {
    setMeasurements([]);
  }, []);

  const toggleMeasurementVisible = useCallback((id: string) => {
    setMeasurements((prev) =>
      prev.map((m) => (m.id === id ? { ...m, visible: !m.visible } : m)),
    );
  }, []);

  const toggleAllVisible = useCallback(() => {
    setMeasurements((prev) => {
      const allVisible = prev.every((m) => m.visible);
      return prev.map((m) => ({ ...m, visible: !allVisible }));
    });
  }, []);

  const toggleSectionVisible = useCallback((type: Measurement['type']) => {
    setMeasurements((prev) => {
      const allVisible = prev.filter((m) => m.type === type).every((m) => m.visible);
      return prev.map((m) =>
        m.type === type ? { ...m, visible: !allVisible } : m,
      );
    });
  }, []);

  const deleteSection = useCallback((type: Measurement['type']) => {
    setMeasurements((prev) => prev.filter((m) => m.type !== type));
  }, []);

  const toggleMeasurementPanel = useCallback(() => {
    setShowMeasurementPanel((v) => !v);
  }, []);

  const closeMeasurementPanel = useCallback(() => {
    setShowMeasurementPanel(false);
  }, []);

  // Derive calibrated metres from normDist + current calibration
  const calibratedMeasurements = useMemo(() => {
    if (!calibration) return measurements;
    return measurements.map((m) => {
      if (m.type !== 'distance' || m.normDist == null) return m;
      const meters = m.normDist / calibration.pixelsPerMeter;
      return { ...m, meters, label: `${meters.toFixed(2)}m` };
    });
  }, [measurements, calibration]);

  const reset = useCallback(() => {
    setMeasurements([]);
    setMeasuringDistance(false);
    setMeasuringAngle(false);
    setShowMeasurementPanel(false);
  }, []);

  return {
    measurements,
    measuringDistance,
    measuringAngle,
    measuringKey,
    showMeasurementPanel,
    calibratedMeasurements,
    toggleMeasuringDistance,
    toggleMeasuringAngle,
    stopMeasuring,
    addMeasurement,
    deleteMeasurement,
    deleteAllMeasurements,
    toggleMeasurementVisible,
    toggleAllVisible,
    toggleSectionVisible,
    deleteSection,
    toggleMeasurementPanel,
    closeMeasurementPanel,
    reset,
  };
}
