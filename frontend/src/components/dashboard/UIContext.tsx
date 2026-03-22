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

/** Accent color tokens per stage (Tailwind class fragments). */
export const STAGE_ACCENT: Record<Stage, { bg: string; text: string; border: string; ring: string }> = {
  import:    { bg: 'bg-sky-500',     text: 'text-sky-500',     border: 'border-sky-500',     ring: 'ring-sky-500/30' },
  calibrate: { bg: 'bg-amber-500',   text: 'text-amber-500',   border: 'border-amber-500',   ring: 'ring-amber-500/30' },
  analyse:   { bg: 'bg-violet-500',  text: 'text-violet-500',  border: 'border-violet-500',  ring: 'ring-violet-500/30' },
  measure:   { bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500', ring: 'ring-emerald-500/30' },
  report:    { bg: 'bg-orange-500',  text: 'text-orange-500',  border: 'border-orange-500',  ring: 'ring-orange-500/30' },
};

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
  const [completion, _setCompletion] = useState<StageCompletion>({
    import: false,
    calibrate: false,
    analyse: false,
    measure: false,
    report: false,
  });

  // Shallow-compare before setting to avoid infinite re-render loops.
  const setCompletion = useCallback((next: StageCompletion) => {
    _setCompletion((prev) => {
      if (
        prev.import === next.import &&
        prev.calibrate === next.calibrate &&
        prev.analyse === next.analyse &&
        prev.measure === next.measure &&
        prev.report === next.report
      ) return prev;
      return next;
    });
  }, []);

  const value = useMemo<UIContextValue>(
    () => ({
      stage,
      setStage,
      completion,
      setCompletion,
      hasVideo,
      setHasVideo,
    }),
    [stage, completion, hasVideo, setCompletion],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = (): UIContextValue => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside UIProvider');
  return ctx;
};
