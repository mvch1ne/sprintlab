// Shared video + metrics state written by Viewport, consumed by Telemetry.
// Avoids prop-drilling through Dashboard for values that change every frame.
import {
  createContext,
  useContext,
  useState,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import type { CalibrationData } from './viewport/CalibrationAndMeasurements/CalibrationOverlay';
import type { SprintMetrics } from './useSprintMetrics';

/** A manually-recorded Centre-of-Mass event (snapshot at one frame). */
export interface CoMEvent {
  frame: number;
  comSite: { x: number; y: number }; // inference-frame pixel coords
}

/** Sprint start/finish marker published from Viewport. */
export interface SprintMarkerCtx {
  frame: number;
  site: { x: number; y: number };
}

interface VideoContextValue {
  currentFrame: number;
  fps: number;
  totalFrames: number;
  calibration: CalibrationData | null;
  metrics: SprintMetrics | null;
  /** Seek the video to a specific frame (published by Viewport). */
  seekToFrame: ((frame: number) => void) | null;
  deleteContact: ((id: string) => void) | null;
  editContact: ((id: string, contactFrame: number, liftFrame: number) => void) | null;
  comEvents: CoMEvent[];
  showCoMEvents: boolean;
  sprintStart: SprintMarkerCtx | null;
  sprintFinish: SprintMarkerCtx | null;

  // Sprint mode: static = block/standing start, flying = fly-zone timing
  sprintMode: 'static' | 'flying';
  setSprintMode: (m: 'static' | 'flying') => void;

  // Sprint direction: ltr = left-to-right, rtl = right-to-left
  // Auto-detected from marker positions; can be overridden manually.
  sprintDirection: 'ltr' | 'rtl';
  setSprintDirection: (d: 'ltr' | 'rtl') => void;

  // Static mode: confirmed first-movement frame (user must explicitly confirm)
  confirmedSprintStart: number | null;
  setConfirmedSprintStart: (f: number | null) => void;

  // Proposed sprint start (auto-detected, shown for confirmation)
  proposedSprintStart: number | null;
  setProposedSprintStart: (f: number | null) => void;

  // Reaction time (static mode only)
  reactionTime: number; // seconds, default 0.150
  setReactionTime: (t: number) => void;
  reactionTimeEnabled: boolean;
  setReactionTimeEnabled: (v: boolean) => void;

  // Setters — called by Viewport
  setCurrentFrame: (f: number) => void;
  setFps: (f: number) => void;
  setTotalFrames: (n: number) => void;
  setCalibration: (c: CalibrationData | null) => void;
  setMetrics: (m: SprintMetrics | null) => void;
  setSeekToFrame: (fn: ((frame: number) => void) | null) => void;
  setDeleteContact: (fn: ((id: string) => void) | null) => void;
  setEditContact: (fn: ((id: string, contactFrame: number, liftFrame: number) => void) | null) => void;
  setComEvents: (events: CoMEvent[]) => void;
  setShowCoMEvents: (v: boolean) => void;
  setSprintStart: (m: SprintMarkerCtx | null) => void;
  setSprintFinish: (m: SprintMarkerCtx | null) => void;
}

const VideoContext = createContext<VideoContextValue | null>(null);

export const VideoProvider = ({ children }: { children: ReactNode }) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [fps, setFps] = useState(30);
  const [totalFrames, setTotalFrames] = useState(0);
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [metrics, setMetrics] = useState<SprintMetrics | null>(null);
  const [seekToFrame, _setSeekToFrame] = useState<((frame: number) => void) | null>(null);
  const [deleteContact, _setDeleteContact] = useState<((id: string) => void) | null>(null);
  const [editContact, _setEditContact] = useState<((id: string, contactFrame: number, liftFrame: number) => void) | null>(null);
  const [comEvents, setComEvents] = useState<CoMEvent[]>([]);
  const [showCoMEvents, setShowCoMEvents] = useState(true);
  const [sprintStart, setSprintStart] = useState<SprintMarkerCtx | null>(null);
  const [sprintFinish, setSprintFinish] = useState<SprintMarkerCtx | null>(null);

  // Sprint mode + direction state
  const [sprintMode, setSprintMode] = useState<'static' | 'flying'>('static');
  const [sprintDirection, setSprintDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [confirmedSprintStart, setConfirmedSprintStart] = useState<number | null>(null);
  const [proposedSprintStart, setProposedSprintStart] = useState<number | null>(null);
  const [reactionTime, setReactionTime] = useState(0.150);
  const [reactionTimeEnabled, setReactionTimeEnabled] = useState(true);

  // Wrap in () => fn to prevent React treating stored functions as updaters
  const setSeekToFrame = useCallback((fn: ((frame: number) => void) | null) => {
    _setSeekToFrame(() => fn);
  }, []);
  const setDeleteContact = useCallback((fn: ((id: string) => void) | null) => {
    _setDeleteContact(() => fn);
  }, []);
  const setEditContact = useCallback((fn: ((id: string, contactFrame: number, liftFrame: number) => void) | null) => {
    _setEditContact(() => fn);
  }, []);

  return (
    <VideoContext.Provider
      value={{
        currentFrame,
        fps,
        totalFrames,
        calibration,
        metrics,
        seekToFrame,
        deleteContact,
        editContact,
        comEvents,
        showCoMEvents,
        sprintStart,
        sprintFinish,
        sprintMode,
        setSprintMode: useCallback((m) => setSprintMode(m), []),
        sprintDirection,
        setSprintDirection: useCallback((d) => setSprintDirection(d), []),
        confirmedSprintStart,
        setConfirmedSprintStart: useCallback((f) => setConfirmedSprintStart(f), []),
        proposedSprintStart,
        setProposedSprintStart: useCallback((f) => setProposedSprintStart(f), []),
        reactionTime,
        setReactionTime: useCallback((t) => setReactionTime(t), []),
        reactionTimeEnabled,
        setReactionTimeEnabled: useCallback((v) => setReactionTimeEnabled(v), []),
        setCurrentFrame: useCallback((f) => setCurrentFrame(f), []),
        setFps: useCallback((f) => setFps(f), []),
        setTotalFrames: useCallback((n) => setTotalFrames(n), []),
        setCalibration: useCallback((c) => setCalibration(c), []),
        setMetrics: useCallback((m) => setMetrics(m), []),
        setSeekToFrame,
        setDeleteContact,
        setEditContact,
        setComEvents: useCallback((events) => setComEvents(events), []),
        setShowCoMEvents: useCallback((v) => setShowCoMEvents(v), []),
        setSprintStart: useCallback((m) => setSprintStart(m), []),
        setSprintFinish: useCallback((m) => setSprintFinish(m), []),
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
