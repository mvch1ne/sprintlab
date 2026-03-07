// Shared video + metrics state written by Viewport, consumed by Telemetry.
// Avoids prop-drilling through Dashboard for values that change every frame.
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import type { CalibrationData } from './viewport/CalibrationAndMeasurements/CalibrationOverlay';
import type { SprintMetrics } from './useSprintMetrics';

interface VideoContextValue {
  currentFrame: number;
  fps: number;
  totalFrames: number;
  calibration: CalibrationData | null;
  metrics: SprintMetrics | null;
  // Setters — called by Viewport
  setCurrentFrame: (f: number) => void;
  setFps: (f: number) => void;
  setTotalFrames: (n: number) => void;
  setCalibration: (c: CalibrationData | null) => void;
  setMetrics: (m: SprintMetrics | null) => void;
}

const VideoContext = createContext<VideoContextValue | null>(null);

export const VideoProvider = ({ children }: { children: ReactNode }) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [fps, setFps] = useState(30);
  const [totalFrames, setTotalFrames] = useState(0);
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [metrics, setMetrics] = useState<SprintMetrics | null>(null);

  return (
    <VideoContext.Provider
      value={{
        currentFrame,
        fps,
        totalFrames,
        calibration,
        metrics,
        setCurrentFrame: useCallback((f) => setCurrentFrame(f), []),
        setFps: useCallback((f) => setFps(f), []),
        setTotalFrames: useCallback((n) => setTotalFrames(n), []),
        setCalibration: useCallback((c) => setCalibration(c), []),
        setMetrics: useCallback((m) => setMetrics(m), []),
      }}
    >
      {children}
    </VideoContext.Provider>
  );
};

export const useVideoContext = (): VideoContextValue => {
  const ctx = useContext(VideoContext);
  if (!ctx)
    throw new Error('useVideoContext must be used inside VideoProvider');
  return ctx;
};
