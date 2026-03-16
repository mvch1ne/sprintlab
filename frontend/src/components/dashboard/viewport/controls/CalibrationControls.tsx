import {
  Ruler,
  Crosshair,
  Triangle,
  PanelRight,
} from 'lucide-react';
import { IconBtn } from './shared';
import type { CalibrationData } from '../CalibrationAndMeasurements/CalibrationOverlay';

interface CalibrationControlsProps {
  calibration: CalibrationData | null;
  onStartCalibration: () => void;
  measuringDistance: boolean;
  measuringAngle: boolean;
  onToggleMeasuringDistance: () => void;
  onToggleMeasuringAngle: () => void;
  measurementCount: number;
  showMeasurementPanel: boolean;
  onToggleMeasurementPanel: () => void;
  disabled?: boolean;
}

export function CalibrationControls({
  calibration,
  onStartCalibration,
  measuringDistance,
  measuringAngle,
  onToggleMeasuringDistance,
  onToggleMeasuringAngle,
  measurementCount,
  showMeasurementPanel,
  onToggleMeasurementPanel,
}: CalibrationControlsProps) {
  return (
    <>
      <IconBtn
        onClick={onStartCalibration}
        tooltip={
          calibration
            ? `Calibrated: ${calibration.realMeters}m \u2014 click to redo`
            : 'Calibrate distance'
        }
        active={!!calibration}
      >
        <Ruler size={14} />
      </IconBtn>

      <IconBtn
        onClick={onToggleMeasuringDistance}
        tooltip={
          !calibration
            ? 'Calibrate first to measure'
            : measuringDistance
              ? 'Stop measuring distance'
              : 'Measure distance'
        }
        active={measuringDistance}
        disabled={!calibration}
      >
        <Crosshair size={14} />
      </IconBtn>

      <IconBtn
        onClick={onToggleMeasuringAngle}
        tooltip={
          !calibration
            ? 'Calibrate first to measure angles'
            : measuringAngle
              ? 'Stop measuring angle'
              : 'Measure angle'
        }
        active={measuringAngle}
        disabled={!calibration}
      >
        <Triangle size={14} />
      </IconBtn>

      <IconBtn
        onClick={onToggleMeasurementPanel}
        tooltip={
          showMeasurementPanel
            ? 'Hide measurements'
            : `Show measurements${measurementCount > 0 ? ` (${measurementCount})` : ''}`
        }
        active={showMeasurementPanel}
        disabled={!calibration}
      >
        <PanelRight size={14} />
      </IconBtn>
    </>
  );
}
