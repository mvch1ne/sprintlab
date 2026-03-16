import { Scissors } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { CalibrationData } from './CalibrationAndMeasurements/CalibrationOverlay';
import type { LandmarkerStatus } from './PoseEngine/usePoseLandmarker';
import { IconBtn, Readout, Separator } from './controls/shared';
import { Scrubber } from './controls/Scrubber';
import { PlaybackControls } from './controls/PlaybackControls';
import { CalibrationControls } from './controls/CalibrationControls';
import { PoseControls } from './controls/PoseControls';
import { SprintStartRow, CoMControls } from './controls/SprintControls';

interface ControlPanelProps {
  currentFrame: number;
  totalFrames: number;
  fps: number;
  isPlaying: boolean;
  setIsPlaying: (v: boolean | ((p: boolean) => boolean)) => void;
  videoEnded: boolean;
  playbackRate: number;
  setPlaybackRate: (v: number) => void;
  onSeekToFrame: (frame: number) => void;
  startFrame: number | null;
  onSetStartFrame: () => void;
  onClearStartFrame: () => void;
  calibration: CalibrationData | null;
  onStartCalibration: () => void;
  measuringDistance: boolean;
  measuringAngle: boolean;
  onToggleMeasuringDistance: () => void;
  onToggleMeasuringAngle: () => void;
  measurementCount: number;
  showMeasurementPanel: boolean;
  onToggleMeasurementPanel: () => void;
  poseEnabled: boolean;
  onTogglePose: () => void;
  poseStatus: LandmarkerStatus;
  backendReachable?: boolean;
  showPosePanel: boolean;
  onTogglePosePanel: () => void;
  showTrimCropPanel: boolean;
  onToggleTrimCropPanel: () => void;
  // CoM controls
  poseReady?: boolean;
  showCoM?: boolean;
  onToggleCoM?: () => void;
  comEventCount?: number;
  showCoMEvents?: boolean;
  onToggleCoMEvents?: () => void;
  onRecordCoMEvent?: () => void;
  onClearCoMEvents?: () => void;
  /** Auto-detected proposed sprint start frame (green dashed marker on scrubber). */
  proposedStartFrame?: number | null;
  disabled?: boolean;
}

export function ControlPanel({
  currentFrame,
  totalFrames,
  fps,
  isPlaying,
  setIsPlaying,
  videoEnded,
  playbackRate,
  setPlaybackRate,
  onSeekToFrame,
  startFrame,
  onSetStartFrame,
  onClearStartFrame,
  calibration,
  onStartCalibration,
  measuringDistance,
  measuringAngle,
  onToggleMeasuringDistance,
  onToggleMeasuringAngle,
  measurementCount,
  showMeasurementPanel,
  onToggleMeasurementPanel,
  poseEnabled,
  onTogglePose,
  poseStatus,
  backendReachable = false,
  showPosePanel,
  onTogglePosePanel,
  showTrimCropPanel,
  onToggleTrimCropPanel,
  poseReady = false,
  showCoM = true,
  onToggleCoM,
  comEventCount = 0,
  showCoMEvents = true,
  onToggleCoMEvents,
  onRecordCoMEvent,
  onClearCoMEvents,
  proposedStartFrame = null,
  disabled = false,
}: ControlPanelProps) {
  const effectiveFps = (fps || 30) * (playbackRate || 1);
  const frameDuration = 1 / (fps || 30);
  const fpsDisplay = disabled ? '\u2014' : `${effectiveFps}`;
  const deltaDisplay = disabled ? '\u2014' : `${frameDuration.toFixed(4)}s`;

  const frameToTimecode = (frame: number) => {
    const f = Math.max(0, frame);
    const totalSecs = f / (fps || 30);
    const mins = Math.floor(totalSecs / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSecs % 60).toFixed(4).padStart(7, '0');
    return `${mins}:${secs}`;
  };

  const relativeFrame = startFrame !== null ? currentFrame - startFrame : null;
  const absRelFrame = relativeFrame !== null ? Math.abs(relativeFrame) : null;
  const timePrefix = relativeFrame !== null && relativeFrame < 0 ? '\u2212' : '';

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className={`ControlPanelContainer h-full w-full flex flex-col bg-white dark:bg-zinc-950 dark:text-zinc-200 transition-opacity ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      >
        <div className="TopBar h-5 shrink-0 border border-b-0 border-zinc-400 dark:border-zinc-600 flex items-center px-3 gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
            Playback Control
          </span>
          <div className="ml-auto flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600"
              />
            ))}
          </div>
        </div>

        <div className="MainControls flex-1 border border-t-0 border-zinc-400 dark:border-zinc-600 flex flex-col overflow-hidden">
          {/* Scrubber */}
          <Scrubber
            currentFrame={currentFrame}
            totalFrames={totalFrames}
            startFrame={startFrame}
            proposedStartFrame={proposedStartFrame}
            onSeekToFrame={onSeekToFrame}
            disabled={disabled}
          />

          {/* Sprint start row */}
          <SprintStartRow
            startFrame={startFrame}
            proposedStartFrame={proposedStartFrame}
            onSetStartFrame={onSetStartFrame}
            onClearStartFrame={onClearStartFrame}
          />

          {/* Readouts */}
          <div className="ReadoutsRow flex justify-between items-center px-4 pt-1 pb-0.5">
            <Readout
              label={startFrame !== null ? 'Rel. Frame' : 'Frame'}
              value={`${relativeFrame !== null ? relativeFrame : currentFrame} / ${totalFrames > 0 ? totalFrames - 1 : 0}`}
            />
            <Readout
              label={startFrame !== null ? 'Rel. Time' : 'Timecode'}
              value={`${timePrefix}${frameToTimecode(absRelFrame !== null ? absRelFrame : currentFrame)}`}
            />
            <Readout
              label="Duration"
              value={totalFrames > 1 ? frameToTimecode(totalFrames - 1) : '\u2014'}
            />
            <Readout label="FPS" value={fpsDisplay} />
            <Readout label="\u2206/frame" value={deltaDisplay} />
          </div>

          <div className="mx-4 border-t border-zinc-400 dark:border-zinc-600/60" />

          {/* Transport */}
          <div className="ControlInputSection flex flex-1 items-center px-4 gap-2 flex-wrap">
            <PlaybackControls
              currentFrame={currentFrame}
              totalFrames={totalFrames}
              fps={fps}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              videoEnded={videoEnded}
              playbackRate={playbackRate}
              setPlaybackRate={setPlaybackRate}
              onSeekToFrame={onSeekToFrame}
              disabled={disabled}
            />

            <Separator />

            <CalibrationControls
              calibration={calibration}
              onStartCalibration={onStartCalibration}
              measuringDistance={measuringDistance}
              measuringAngle={measuringAngle}
              onToggleMeasuringDistance={onToggleMeasuringDistance}
              onToggleMeasuringAngle={onToggleMeasuringAngle}
              measurementCount={measurementCount}
              showMeasurementPanel={showMeasurementPanel}
              onToggleMeasurementPanel={onToggleMeasurementPanel}
            />

            <Separator />

            <PoseControls
              poseEnabled={poseEnabled}
              onTogglePose={onTogglePose}
              poseStatus={poseStatus}
              backendReachable={backendReachable}
              showPosePanel={showPosePanel}
              onTogglePosePanel={onTogglePosePanel}
            />

            <Separator />

            <IconBtn
              onClick={onToggleTrimCropPanel}
              tooltip={showTrimCropPanel ? 'Hide trim & crop' : 'Trim & crop'}
              active={showTrimCropPanel}
            >
              <Scissors size={14} />
            </IconBtn>

            <CoMControls
              poseReady={poseReady}
              showCoM={showCoM}
              onToggleCoM={onToggleCoM}
              comEventCount={comEventCount}
              showCoMEvents={showCoMEvents}
              onToggleCoMEvents={onToggleCoMEvents}
              onRecordCoMEvent={onRecordCoMEvent}
              onClearCoMEvents={onClearCoMEvents}
            />

            <div className="ml-auto flex items-center gap-2">
              {[
                ['\u2190\u2192', 'step'],
                ['Space', 'play'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className="text-[11px] px-1 py-0.5 bg-zinc-100 border border-zinc-400 dark:bg-zinc-950 dark:border-zinc-600 rounded-sm text-zinc-700 dark:text-zinc-300 leading-none">
                    {key}
                  </span>
                  <span className="text-[11px] text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
