// Stage-based workflow context + cross-component UI state.
// Written by Dashboard/Viewport, consumed by ControlPanel, StageBar, Telemetry.
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import type { ReactNode } from 'react';

/** Workflow stages — ordered from first to last. */
export const STAGES = ['import', 'calibrate', 'analyse', 'measure', 'report'] as const;
export type Stage = (typeof STAGES)[number];

export interface StageCompletion {
  import: boolean;
  calibrate: boolean;
  analyse: boolean;
  measure: boolean;
  report: boolean;
}

interface UIContextValue {
  /** Currently active stage tab. */
  stage: Stage;
  setStage: (s: Stage) => void;

  /** Per-stage completion flags — derived by Viewport from live state. */
  completion: StageCompletion;
  setCompletion: (c: StageCompletion) => void;

  /** Whether a video file has been loaded (enables stages beyond import). */
  hasVideo: boolean;
  setHasVideo: (v: boolean) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [stage, setStage] = useState<Stage>('import');
  const [hasVideo, setHasVideo] = useState(false);
  const [completion, setCompletion] = useState<StageCompletion>({
    import: false,
    calibrate: false,
    analyse: false,
    measure: false,
    report: false,
  });

  const value = useMemo<UIContextValue>(
    () => ({
      stage,
      setStage,
      completion,
      setCompletion,
      hasVideo,
      setHasVideo,
    }),
    [stage, completion, hasVideo],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = (): UIContextValue => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside UIProvider');
  return ctx;
};
