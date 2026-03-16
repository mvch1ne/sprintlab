// PoseContext — thin context that Viewport populates with pose status.
// Telemetry reads `status` to know whether to show empty state.
// All actual pose computation stays in Viewport where it's coupled to
// poseEnabled, videoMeta, etc.
import {
  createContext,
  useContext,
  useState,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import type { LandmarkerStatus } from './viewport/PoseEngine/usePoseLandmarker';
export type { LandmarkerStatus };

interface PoseContextValue {
  status: LandmarkerStatus;
  setStatus: (s: LandmarkerStatus) => void;
}

const PoseCtx = createContext<PoseContextValue | null>(null);

export const PoseProvider = ({ children }: { children: ReactNode }) => {
  const [status, _setStatus] = useState<LandmarkerStatus>('idle');
  const setStatus = useCallback((s: LandmarkerStatus) => _setStatus(s), []);
  return (
    <PoseCtx.Provider value={{ status, setStatus }}>
      {children}
    </PoseCtx.Provider>
  );
};

export const usePose = () => {
  const ctx = useContext(PoseCtx);
  if (!ctx) throw new Error('usePose must be inside PoseProvider');
  return ctx;
};
