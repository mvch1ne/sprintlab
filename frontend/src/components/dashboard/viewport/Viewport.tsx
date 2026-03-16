import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { FilePlayIcon, Clock, Upload, Layers, Box, Pencil, Eye, EyeOff, Zap, Activity } from 'lucide-react';
import { IconDimensions } from '@tabler/icons-react';
import { VideoLayer } from './VideoLayer';
import { ControlPanel } from './ControlPanel';
import { CalibrationOverlay } from './CalibrationAndMeasurements/CalibrationOverlay';
import { MeasurementOverlay } from './CalibrationAndMeasurements/MeasurementOverlay';
import { MeasurementPanel } from './CalibrationAndMeasurements/MeasurementPanel';
import { PoseOverlay } from './PoseEngine/PoseOverlay';
import type { ViewMode, SprintMarker } from './PoseEngine/PoseOverlay';
import { PosePanel } from './PoseEngine/PosePanel';
import { usePoseLandmarker } from './PoseEngine/usePoseLandmarker';
import type { Keypoint } from './PoseEngine/usePoseLandmarker';
import { LANDMARKS, buildDefaultVisibility } from './PoseEngine/poseConfig';
import type { LandmarkDef } from './PoseEngine/poseConfig';
import { TrimCropPanel } from './TrimAndCrop/TrimCropPanel';
import { CropOverlay } from './TrimAndCrop/CropOverlay';
import { useExport } from './videoUtilities/useExport';
import { useStatus } from './StatusBar/StatusContext';
import { useVideoContext } from '../VideoContext';
import { usePose } from '../PoseContext';
import { useSprintMetrics } from '../useSprintMetrics';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';

// ── Hooks ─────────────────────────────────────────────────────────────────────
import { useVideoPlayback } from '../../../hooks/useVideoPlayback';
import type { VideoMeta } from '../../../hooks/useVideoPlayback';
import { useZoomPan } from '../../../hooks/useZoomPan';
import { useCalibration } from '../../../hooks/useCalibration';
import { useMeasurements } from '../../../hooks/useMeasurements';
import { useSprintMarkers } from '../../../hooks/useSprintMarkers';
import { useCoM } from '../../../hooks/useCoM';
import { useTrimCrop } from '../../../hooks/useTrimCrop';

export const Viewport = () => {
  const sectionHeights = { header: '1.25rem', controlSection: '12rem' };
  const exportingRef = useRef(false);

  // ── Pose ──────────────────────────────────────────────────────────────────
  const [poseEnabled, setPoseEnabled] = useState(false);
  const [showPosePanel, setShowPosePanel] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('video');
  const [skeletonHidden, setSkeletonHidden] = useState(false);
  const [flipH, setFlipH] = useState(false);
  const [startFrame, setStartFrame] = useState<number | null>(null);
  const [sprintStart, setSprintStart] = useState<SprintMarker | null>(null);
  const [sprintFinish, setSprintFinish] = useState<SprintMarker | null>(null);
  const [pendingDirection, setPendingDirection] = useState<'ltr' | 'rtl' | null>(null);
  const [landmarkVisibility, setLandmarkVisibility] = useState<Record<number, boolean>>(buildDefaultVisibility);
  const poseDrawRef = useRef<((kp: Keypoint[]) => void) | null>(null);

  const {
    status: poseStatus,
    progress: poseProgress,
    frameWidth: poseFrameW,
    frameHeight: poseFrameH,
    totalFrames: poseTotalFrames,
    poseFps,
    backendReachable,
    getKeypoints,
    analyseVideo,
    reset: resetPose,
  } = usePoseLandmarker();

  // ── Calibration ─────────────────────────────────────────────────────────
  const cal = useCalibration();

  // ── Video playback ──────────────────────────────────────────────────────
  // Use a ref so the resetAll callback always sees the latest hook references
  // (several hooks are declared after `video`).
  const resetAllRef = useRef<(meta: VideoMeta) => void>(() => {});
  const video = useVideoPlayback(
    useCallback((meta: VideoMeta) => resetAllRef.current(meta), []),
  );

  // ── Derived frame values ────────────────────────────────────────────────
  const fps = poseFps > 0 ? poseFps : (video.videoMeta?.fps ?? 30);
  const totalFrames = poseTotalFrames > 0 ? poseTotalFrames : (video.videoMeta?.totalFrames ?? 0);
  const currentTime = totalFrames > 0 ? video.currentFrame / fps : 0;

  // ── Sprint metrics ──────────────────────────────────────────────────────
  const metrics = useSprintMetrics(
    getKeypoints,
    poseStatus === 'ready' ? totalFrames : 0,
    fps,
    cal.calibration,
    poseFrameW,
    poseFrameH,
    flipH,
  );

  // ── Sprint markers & contacts ───────────────────────────────────────────
  const sprint = useSprintMarkers({
    metrics,
    fps,
    calibration: cal.calibration,
    poseFrameW,
    sprintStart,
  });

  // ── CoM ─────────────────────────────────────────────────────────────────
  const com = useCoM(getKeypoints, video.currentFrameRef);

  // ── Measurements ────────────────────────────────────────────────────────
  const meas = useMeasurements(cal.calibration);

  // ── Trim & Crop ─────────────────────────────────────────────────────────
  const trimCrop = useTrimCrop(video.videoMeta?.duration ?? 0);

  // ── Zoom & Pan ──────────────────────────────────────────────────────────
  const toolActive =
    cal.calibrating ||
    meas.measuringDistance ||
    meas.measuringAngle ||
    trimCrop.drawingCrop ||
    sprint.annotateMode !== 'off';

  const zoom = useZoomPan(toolActive);

  // ── Wire up resetAll now that all hooks are available ───────────────────
  resetAllRef.current = (meta: VideoMeta) => {
    setStartFrame(null);
    cal.reset();
    meas.reset();
    setPoseEnabled(false);
    setShowPosePanel(false);
    setViewMode('video');
    setSprintStart(null);
    setSprintFinish(null);
    sprint.reset();
    com.reset();
    resetPose();
    setLandmarkVisibility(buildDefaultVisibility());
    trimCrop.reset(meta.duration);
    zoom.resetTransform();
  };

  // ── Publish to VideoContext ─────────────────────────────────────────────
  const {
    setCurrentFrame: ctxSetFrame,
    setFps: ctxSetFps,
    setTotalFrames: ctxSetTotal,
    setCalibration: ctxSetCal,
    setMetrics: ctxSetMetrics,
    setDeleteContact: ctxSetDeleteContact,
    setEditContact: ctxSetEditContact,
    setComEvents: ctxSetComEvents,
    setShowCoMEvents: ctxSetShowCoMEvents,
    setSprintStart: ctxSetSprintStart,
    setSprintFinish: ctxSetSprintFinish,
    setSprintMode: ctxSetSprintMode,
    setConfirmedSprintStart: ctxSetConfirmedSprintStart,
    setProposedSprintStart: ctxSetProposedSprintStart,
    setReactionTime: ctxSetReactionTime,
    setReactionTimeEnabled: ctxSetReactionTimeEnabled,
    sprintMode,
    sprintDirection,
    setSprintDirection: ctxSetSprintDirection,
  } = useVideoContext();

  // Suppress unused setter warnings
  void ctxSetReactionTime;
  void ctxSetReactionTimeEnabled;

  useEffect(() => { ctxSetDeleteContact(sprint.deleteContact); return () => ctxSetDeleteContact(null); }, [sprint.deleteContact, ctxSetDeleteContact]);
  useEffect(() => { ctxSetEditContact(sprint.editContact); return () => ctxSetEditContact(null); }, [sprint.editContact, ctxSetEditContact]);
  useEffect(() => { ctxSetFrame(video.currentFrame); }, [video.currentFrame, ctxSetFrame]);
  useEffect(() => { ctxSetFps(fps); }, [fps, ctxSetFps]);
  useEffect(() => { ctxSetTotal(totalFrames); }, [totalFrames, ctxSetTotal]);
  useEffect(() => { ctxSetCal(cal.calibration); }, [cal.calibration, ctxSetCal]);
  useEffect(() => { ctxSetMetrics(sprint.metricsWithMerged); }, [sprint.metricsWithMerged, ctxSetMetrics]);
  useEffect(() => { ctxSetComEvents(com.comEvents); }, [com.comEvents, ctxSetComEvents]);
  useEffect(() => { ctxSetShowCoMEvents(com.showCoMEvents); }, [com.showCoMEvents, ctxSetShowCoMEvents]);
  useEffect(() => { ctxSetSprintStart(sprintStart); }, [sprintStart, ctxSetSprintStart]);
  useEffect(() => { ctxSetSprintFinish(sprintFinish); }, [sprintFinish, ctxSetSprintFinish]);

  // Auto-detect first significant movement from CoM data
  const proposedSprintStartFrame = useMemo(() => {
    const comData = sprint.metricsWithMerged?.com;
    if (!comData || comData.length < 5) return null;
    const baselineX = comData[0].x;
    const thresholdPx = poseFrameW > 0 ? poseFrameW * 0.01 : 5;
    for (let fi = 1; fi < comData.length; fi++) {
      if (Math.abs(comData[fi].x - baselineX) > thresholdPx) return fi;
    }
    return null;
  }, [sprint.metricsWithMerged, poseFrameW]);

  useEffect(() => { ctxSetProposedSprintStart(proposedSprintStartFrame); }, [proposedSprintStartFrame, ctxSetProposedSprintStart]);

  // Publish pose status into PoseContext
  const { setStatus: ctxSetPoseStatus } = usePose();
  useEffect(() => { ctxSetPoseStatus(poseEnabled ? poseStatus : 'idle'); }, [poseEnabled, poseStatus, ctxSetPoseStatus]);

  // ── Export ──────────────────────────────────────────────────────────────
  const { exportStatus, exportProgress, lastExportUrl, lastExportTitle, startExport } = useExport({
    videoElRef: video.videoElRef,
    exportingRef,
    videoWidth: video.videoMeta?.width ?? 0,
    videoHeight: video.videoMeta?.height ?? 0,
    fps,
    trimPoints: trimCrop.trimPoints,
    cropRect: trimCrop.cropRect,
    title: video.videoMeta?.title ?? 'clip',
  });

  // ── Trigger pose analysis when enabled ─────────────────────────────────
  useEffect(() => {
    if (!poseEnabled || !video.videoMeta?.src) return;
    analyseVideo(video.videoMeta.src);
    return () => resetPose();
  }, [poseEnabled, video.videoMeta?.src, analyseVideo, resetPose]);

  // ── Reset sprint analysis ──────────────────────────────────────────────
  const resetSprintAnalysis = useCallback(() => {
    setSprintStart(null);
    setSprintFinish(null);
    com.clearEvents();
    sprint.setAnnotateMode('off');
  }, [com, sprint]);

  // ── Status bar ─────────────────────────────────────────────────────────
  const { set: setStatus, clear: clearStatus } = useStatus();

  useEffect(() => {
    if (!video.videoMeta) { clearStatus('video'); clearStatus('fps'); clearStatus('frame'); return; }
    setStatus('video', 'file', video.videoMeta.title, { accent: 'sky' });
    setStatus('fps', 'fps', `${fps % 1 === 0 ? fps : fps.toFixed(3)}`);
  }, [video.videoMeta, fps, setStatus, clearStatus]);

  useEffect(() => {
    if (!video.videoMeta) return;
    const secs = currentTime;
    const tc = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${(secs % 60).toFixed(2).padStart(5, '0')}`;
    setStatus('frame', 'frame', `${video.currentFrame} / ${totalFrames - 1}  ${tc}`);
  }, [video.currentFrame, currentTime, totalFrames, video.videoMeta, setStatus]);

  useEffect(() => {
    if (!video.videoMeta) { clearStatus('playback'); return; }
    if (video.videoEnded) setStatus('playback', 'state', 'ended', { accent: 'amber' });
    else if (video.isPlaying) setStatus('playback', 'state', 'playing', { accent: 'emerald', pulse: true });
    else setStatus('playback', 'state', 'paused', { accent: 'default' });
  }, [video.isPlaying, video.videoEnded, video.videoMeta, setStatus, clearStatus]);

  useEffect(() => {
    if (video.videoProbing) setStatus('probe', 'analysing', 'fps…', { accent: 'amber', pulse: true });
    else clearStatus('probe');
  }, [video.videoProbing, setStatus, clearStatus]);

  useEffect(() => {
    if (exportStatus === 'idle') clearStatus('export');
    else if (exportStatus === 'loading') setStatus('export', 'export', 'loading ffmpeg…', { accent: 'amber', pulse: true });
    else if (exportStatus === 'running') setStatus('export', 'export', `encoding ${Math.round(exportProgress * 100)}%`, { accent: 'sky', pulse: true });
    else if (exportStatus === 'done') {
      setStatus('export', 'export', 'complete', { accent: 'emerald' });
      const t = setTimeout(() => clearStatus('export'), 3000);
      return () => clearTimeout(t);
    } else if (exportStatus === 'error') {
      setStatus('export', 'export', 'error', { accent: 'red' });
      const t = setTimeout(() => clearStatus('export'), 5000);
      return () => clearTimeout(t);
    }
  }, [exportStatus, exportProgress, setStatus, clearStatus]);

  useEffect(() => {
    if (!poseEnabled) { clearStatus('pose'); return; }
    if (poseStatus === 'ready') setStatus('pose', 'pose', 'active', { accent: 'emerald' });
    else if (poseStatus === 'error') setStatus('pose', 'pose', 'error — is the server running?', { accent: 'red' });
    else if (poseProgress) {
      const { frame, total, pct, fps: ifps, eta } = poseProgress;
      const etaStr = eta < 60 ? `${Math.round(eta)}s` : `${Math.floor(eta / 60)}m ${Math.round(eta % 60)}s`;
      setStatus('pose', 'pose', `analysing  ${frame} / ${total}  (${pct}%)  ·  ${ifps} fps  ·  eta ${etaStr}`, { accent: 'amber', pulse: true });
    } else setStatus('pose', 'pose', 'uploading…', { accent: 'amber', pulse: true });
  }, [poseEnabled, poseStatus, poseProgress, setStatus, clearStatus]);

  useEffect(() => {
    if (zoom.transform.scale > 1) setStatus('zoom', 'zoom', `${zoom.transform.scale.toFixed(1)}×`, { accent: 'sky' });
    else clearStatus('zoom');
  }, [zoom.transform.scale, setStatus, clearStatus]);

  // ── Refs for pointer guards ─────────────────────────────────────────────
  const calibratingRef = useRef(cal.calibrating);
  const measuringRef = useRef(false);
  const annotateActiveRef = useRef(false);
  useEffect(() => { measuringRef.current = meas.measuringDistance || meas.measuringAngle; }, [meas.measuringDistance, meas.measuringAngle]);
  useEffect(() => { calibratingRef.current = cal.calibrating; }, [cal.calibrating]);
  useEffect(() => { annotateActiveRef.current = sprint.annotateMode !== 'off'; }, [sprint.annotateMode]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSeekToFrame = useCallback(
    (frame: number) => video.seekToFrame(frame, totalFrames),
    [video, totalFrames],
  );

  const stopWheel = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: false });
  }, []);

  const handleToggleLandmark = useCallback((index: number) => {
    setLandmarkVisibility((prev) => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const handleToggleRegion = useCallback((region: LandmarkDef['region']) => {
    const regionLandmarks = LANDMARKS.filter((l) => l.region === region);
    setLandmarkVisibility((prev) => {
      const allOn = regionLandmarks.every((l) => prev[l.index]);
      const next = { ...prev };
      for (const l of regionLandmarks) next[l.index] = !allOn;
      return next;
    });
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="viewport-container flex flex-col h-full">
      <header className="shrink-0 border border-t-0 border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950">
        {/* Row 1 — video metadata */}
        <div className="flex items-center px-3 h-5 gap-3 border-b border-zinc-200 dark:border-zinc-800/60">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 font-sans">
              Viewport
            </span>
          </div>
          <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
          <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <FilePlayIcon className="h-2.5 w-2.5" />
              {video.videoMeta ? video.videoMeta.title : 'No Video'}
            </span>
            {video.videoMeta && (
              <>
                <span className="flex items-center gap-1">
                  <IconDimensions className="h-2.5 w-2.5" />
                  {video.videoMeta.width}×{video.videoMeta.height}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {fps % 1 === 0 ? fps : fps.toFixed(3)} fps
                </span>
                {zoom.zoomLabel && (
                  <button
                    onClick={zoom.resetTransform}
                    className="text-sky-500 hover:text-sky-400 border border-sky-600/40 px-1 py-px rounded-sm transition-colors cursor-pointer"
                  >
                    {zoom.zoomLabel} ✕
                  </button>
                )}
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {video.videoMeta && (
              <button
                onClick={video.handleUploadClick}
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <Upload className="h-2.5 w-2.5" />
                <span className="font-sans">Replace</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2 — pose controls (only when pose is active) */}
        {video.videoMeta && poseEnabled && poseStatus === 'ready' && (
          <div className="flex items-center px-3 h-5 gap-2">
            {/* View mode */}
            <div className="flex items-center border border-zinc-300 dark:border-zinc-700 rounded-sm overflow-hidden">
              {(['video', 'skeleton', 'body', 'neon', 'grad', 'analytics', 'bio'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1 px-1.5 h-4.5 text-[9px] uppercase tracking-widest transition-colors cursor-pointer border-r border-zinc-300 dark:border-zinc-700 last:border-r-0
                    ${viewMode === mode
                      ? 'bg-zinc-800 dark:bg-zinc-200 text-zinc-100 dark:text-zinc-900'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                >
                  {mode === 'video' ? <Layers className="w-2 h-2" />
                    : mode === 'neon' ? <Zap className="w-2 h-2" />
                    : mode === 'analytics' || mode === 'bio' ? <Activity className="w-2 h-2" />
                    : <Box className="w-2 h-2" />}
                  <span>{mode}</span>
                </button>
              ))}
            </div>

            {/* Hide skeleton toggle */}
            {viewMode === 'video' && (
              <>
                <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
                <button
                  onClick={() => setSkeletonHidden((v) => !v)}
                  className={`flex items-center gap-1 h-4.5 px-1.5 text-[9px] uppercase tracking-widest border rounded-sm transition-colors cursor-pointer
                    ${skeletonHidden
                      ? 'bg-zinc-800 dark:bg-zinc-200 border-zinc-600 text-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                >
                  {skeletonHidden ? <EyeOff className="w-2 h-2" /> : <Eye className="w-2 h-2" />}
                  <span>Skeleton</span>
                </button>
              </>
            )}

            <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />

            {/* Annotate */}
            <button
              onClick={sprint.toggleAnnotateMode}
              className={`flex items-center gap-1 h-4.5 px-1.5 text-[9px] uppercase tracking-widest border rounded-sm transition-colors cursor-pointer
                ${sprint.annotateMode !== 'off'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
            >
              <Pencil className="w-2 h-2" />
              <span>Annotate{sprintStart || sprintFinish ? ' ●' : ''}</span>
            </button>

            {/* Sprint mode */}
            <div className="flex items-center border border-zinc-300 dark:border-zinc-700 rounded-sm overflow-hidden">
              {(['static', 'flying'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => ctxSetSprintMode(mode)}
                  className={`px-1.5 h-4.5 text-[9px] uppercase tracking-widest transition-colors cursor-pointer border-r border-zinc-300 dark:border-zinc-700 last:border-r-0
                    ${sprintMode === mode
                      ? 'bg-zinc-800 dark:bg-zinc-200 text-zinc-100 dark:text-zinc-900'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                >
                  {mode === 'static' ? 'Static Start' : 'Flying Start'}
                </button>
              ))}
            </div>

            {/* Sprint direction */}
            <div className="flex items-center border border-zinc-300 dark:border-zinc-700 rounded-sm overflow-hidden">
              {(['ltr', 'rtl'] as const).map((dir) => (
                <button
                  key={dir}
                  onClick={() => {
                    if (dir !== sprintDirection) {
                      ctxSetSprintDirection(dir);
                      resetSprintAnalysis();
                    }
                  }}
                  title={dir === 'ltr' ? 'Left-to-right sprint' : 'Right-to-left sprint'}
                  className={`px-1.5 h-4.5 text-[9px] uppercase tracking-widest transition-colors cursor-pointer border-r border-zinc-300 dark:border-zinc-700 last:border-r-0
                    ${sprintDirection === dir
                      ? 'bg-zinc-800 dark:bg-zinc-200 text-zinc-100 dark:text-zinc-900'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                >
                  {dir === 'ltr' ? '→ LTR' : '← RTL'}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main
        ref={zoom.mainRef}
        className="flex-1 border border-zinc-400 dark:border-zinc-600 overflow-hidden relative bg-black select-none"
        style={{
          cursor: toolActive ? 'crosshair' : zoom.transform.scale > 1 ? 'grab' : 'default',
          touchAction: 'none',
        }}
        onPointerDown={zoom.onPointerDown}
        onPointerMove={zoom.onPointerMove}
        onPointerUp={zoom.onPointerUp}
        onPointerCancel={zoom.onPointerUp}
      >
        {video.videoMeta ? (
          <>
            {viewMode !== 'video' && viewMode !== 'analytics' && (
              <div className="absolute inset-0 bg-zinc-950" />
            )}
            <div
              className="absolute inset-0"
              style={{
                transform: `${flipH ? 'scaleX(-1) ' : ''}translate(${zoom.transform.x}px, ${zoom.transform.y}px) scale(${zoom.transform.scale})`,
                transformOrigin: 'center center',
                willChange: 'transform',
              }}
            >
              <VideoLayer
                src={video.videoMeta.src}
                fps={fps}
                totalFrames={totalFrames}
                currentFrame={video.currentFrame}
                playbackRate={video.playbackRate}
                isPlaying={video.isPlaying}
                skeletonOnly={viewMode !== 'video' && viewMode !== 'analytics'}
                onFrameChange={video.setCurrentFrame}
                onEnded={video.onEnded}
                onReady={(el) => { video.videoElRef.current = el; }}
                getKeypoints={poseEnabled && poseStatus === 'ready' ? getKeypoints : undefined}
                onKeypoints={poseEnabled && poseStatus === 'ready' ? (kp) => { poseDrawRef.current?.(kp); } : undefined}
              />
              {poseEnabled && poseStatus === 'ready' && (
                <PoseOverlay
                  keypoints={getKeypoints(video.currentFrame)}
                  frameWidth={poseFrameW}
                  frameHeight={poseFrameH}
                  videoNatWidth={video.videoMeta.width}
                  videoNatHeight={video.videoMeta.height}
                  visibilityMap={skeletonHidden && viewMode === 'video'
                    ? Object.fromEntries(LANDMARKS.map((l) => [l.index, false]))
                    : landmarkVisibility}
                  showLabels={true}
                  viewMode={viewMode}
                  drawRef={poseDrawRef}
                  groundContacts={sprint.mergedContacts}
                  annotateMode={sprint.annotateMode}
                  flipH={flipH}
                  currentFrame={video.currentFrame}
                  onAddContact={sprint.addContact}
                  onMoveContact={sprint.moveContact}
                  onDeleteContact={sprint.deleteContact}
                  sprintStart={sprintStart}
                  sprintFinish={sprintFinish}
                  onSetMarker={(type, frame, site) => {
                    const nextStart = type === 'start' ? { frame, site } : sprintStart;
                    const nextFinish = type === 'finish' ? { frame, site } : sprintFinish;
                    if (type === 'start') setSprintStart({ frame, site });
                    else setSprintFinish({ frame, site });

                    let suggested: 'ltr' | 'rtl' | null = null;
                    if (nextStart && nextFinish) {
                      suggested = nextStart.site.x > nextFinish.site.x ? 'rtl' : 'ltr';
                    } else if (nextStart) {
                      const comData = sprint.metricsWithMerged?.com;
                      const firstCoM = comData?.find(Boolean)?.x ?? null;
                      if (firstCoM !== null) {
                        suggested = firstCoM > nextStart.site.x ? 'rtl' : 'ltr';
                      }
                    }
                    if (suggested !== null && suggested !== sprintDirection) {
                      setPendingDirection(suggested);
                    }
                  }}
                  onClearMarker={(type) => {
                    if (type === 'start') setSprintStart(null);
                    else setSprintFinish(null);
                  }}
                  showCoM={com.showCoM}
                  comEvents={com.comEvents}
                  showCoMEvents={com.showCoMEvents}
                />
              )}
            </div>

            {video.videoProbing && exportStatus === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-zinc-600 border-t-sky-400 rounded-full animate-spin" />
                  <span className="text-[8px] uppercase tracking-widest text-zinc-500">Analysing…</span>
                </div>
              </div>
            )}

            <CropOverlay
              active={trimCrop.drawingCrop || trimCrop.showCropOverlay}
              cropRect={trimCrop.cropRect}
              videoWidth={video.videoMeta.width}
              videoHeight={video.videoMeta.height}
              transform={zoom.transform}
              onCropChange={(rect) => trimCrop.setCropRect(rect)}
              onCropComplete={trimCrop.onCropComplete}
            />

            <CalibrationOverlay
              key={cal.calibrationKey}
              active={cal.calibrating}
              transform={zoom.transform}
              videoWidth={video.videoMeta.width}
              videoHeight={video.videoMeta.height}
              existingCalibration={cal.calibration}
              onCalibrationComplete={cal.completeCalibration}
              onCancel={cal.cancelCalibration}
              flipH={flipH}
            />

            {cal.calibration && !cal.calibrating && (
              <CalibrationOverlay
                active={false}
                transform={zoom.transform}
                videoWidth={video.videoMeta.width}
                videoHeight={video.videoMeta.height}
                existingCalibration={cal.calibration}
                onCalibrationComplete={() => {}}
                onCancel={() => {}}
              />
            )}

            {cal.calibration && (
              <MeasurementOverlay
                key={meas.measuringKey}
                active={meas.measuringDistance || meas.measuringAngle}
                mode={meas.measuringAngle ? 'angle' : 'distance'}
                transform={zoom.transform}
                calibration={cal.calibration}
                measurements={meas.calibratedMeasurements}
                onMeasurementAdded={meas.addMeasurement}
                flipH={flipH}
              />
            )}

            {(meas.measuringDistance || meas.measuringAngle) && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 border border-zinc-600 rounded-sm backdrop-blur-sm pointer-events-auto">
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${meas.measuringAngle ? 'bg-violet-400' : 'bg-sky-400'}`} />
                  <span className={`text-[11px] uppercase tracking-widest ${meas.measuringAngle ? 'text-violet-300' : 'text-zinc-300'}`}>
                    {meas.measuringAngle ? 'Click: ray A → vertex → ray B' : 'Click two points to measure'}
                  </span>
                  <button onClick={meas.stopMeasuring} className="ml-2 text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors">
                    Done
                  </button>
                </div>
              </div>
            )}

            {sprint.annotateMode !== 'off' && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 border border-amber-600/50 rounded-sm backdrop-blur-sm pointer-events-auto">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-amber-400" />
                  <div className="flex items-center border border-zinc-600 rounded-sm overflow-hidden">
                    {([
                      { key: 'left', label: 'Left', color: 'text-emerald-400' },
                      { key: 'right', label: 'Right', color: 'text-cyan-400' },
                      { key: 'start', label: 'Start', color: 'text-sky-400' },
                      { key: 'finish', label: 'Finish', color: 'text-orange-400' },
                    ] as const).map(({ key, label, color }) => (
                      <button
                        key={key}
                        onClick={() => sprint.setAnnotateMode(key)}
                        className={`px-1.5 py-0.5 text-[10px] uppercase tracking-widest border-r border-zinc-600 last:border-r-0 transition-colors cursor-pointer
                          ${sprint.annotateMode === key ? `bg-zinc-700 ${color}` : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {sprint.manualContacts.length > 0 && (
                    <button onClick={sprint.clearManualContacts} className="text-[11px] uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors">
                      Clear steps
                    </button>
                  )}
                  {(sprintStart || sprintFinish) && (
                    <button
                      onClick={() => { setSprintStart(null); setSprintFinish(null); }}
                      className="text-[11px] uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors"
                    >
                      Clear markers
                    </button>
                  )}
                  <button onClick={() => sprint.setAnnotateMode('off')} className="ml-1 text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors">
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Coordinate system indicator */}
            <div className="absolute bottom-3 left-3 pointer-events-none select-none">
              <div className="bg-zinc-950/70 border border-zinc-700 rounded-sm px-2 py-1.5 backdrop-blur-sm">
                <svg width="56" height="52" viewBox="0 0 56 52">
                  <circle cx="28" cy="28" r="2" fill="#71717a" />
                  <line x1="28" y1="28" x2="50" y2="28" stroke={sprintDirection === 'ltr' ? '#38bdf8' : '#f87171'} strokeWidth="1.2" />
                  <polygon points="50,25 56,28 50,31" fill={sprintDirection === 'ltr' ? '#38bdf8' : '#f87171'} />
                  <line x1="28" y1="28" x2="6" y2="28" stroke={sprintDirection === 'ltr' ? '#f87171' : '#38bdf8'} strokeWidth="1.2" />
                  <polygon points="6,25 0,28 6,31" fill={sprintDirection === 'ltr' ? '#f87171' : '#38bdf8'} />
                  <line x1="28" y1="28" x2="28" y2="48" stroke="#a3e635" strokeWidth="1.2" />
                  <polygon points="25,48 28,54 31,48" fill="#a3e635" />
                  <line x1="28" y1="28" x2="28" y2="8" stroke="#a78bfa" strokeWidth="1.2" />
                  <polygon points="25,8 28,2 31,8" fill="#a78bfa" />
                  <text x="53" y="26" fontSize="6" fill={sprintDirection === 'ltr' ? '#38bdf8' : '#f87171'} textAnchor="middle" fontFamily="monospace">{sprintDirection === 'ltr' ? '+x' : '−x'}</text>
                  <text x="3" y="26" fontSize="6" fill={sprintDirection === 'ltr' ? '#f87171' : '#38bdf8'} textAnchor="middle" fontFamily="monospace">{sprintDirection === 'ltr' ? '−x' : '+x'}</text>
                  <text x="38" y="51" fontSize="6" fill="#a3e635" textAnchor="middle" fontFamily="monospace">+y</text>
                  <text x="38" y="8" fontSize="6" fill="#a78bfa" textAnchor="middle" fontFamily="monospace">−y</text>
                </svg>
                <div className="text-[7px] text-zinc-500 tracking-wide text-center mt-0.5 leading-tight">
                  {sprintDirection === 'rtl' ? 'RTL · screen coords' : 'screen coords'}
                </div>
              </div>
            </div>

            {trimCrop.showTrimCropPanel && video.videoMeta && (
              <div
                className="absolute top-0 bottom-0 w-56 border-l border-zinc-400 dark:border-zinc-600 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm"
                style={{ right: (showPosePanel ? 224 : 0) + (meas.showMeasurementPanel ? 224 : 0) }}
                ref={stopWheel}
              >
                <TrimCropPanel
                  duration={video.videoMeta.duration}
                  fps={fps}
                  currentTime={currentTime}
                  cropRect={trimCrop.cropRect}
                  trimPoints={trimCrop.trimPoints}
                  videoMeta={{ width: video.videoMeta.width, height: video.videoMeta.height, title: video.videoMeta.title }}
                  onSetTrimIn={() => trimCrop.setTrimPoints((p) => ({ inPoint: currentTime, outPoint: Math.max(p.outPoint, currentTime) }))}
                  onSetTrimOut={() => trimCrop.setTrimPoints((p) => ({ inPoint: Math.min(p.inPoint, currentTime), outPoint: currentTime }))}
                  onClearTrim={() => trimCrop.setTrimPoints({ inPoint: 0, outPoint: video.videoMeta!.duration })}
                  onSeekTo={(t) => handleSeekToFrame(Math.round(t * fps))}
                  onSetTrimInTo={(t) => trimCrop.setTrimPoints((p) => ({ inPoint: Math.max(0, Math.min(t, p.outPoint - 1 / fps)), outPoint: p.outPoint }))}
                  onSetTrimOutTo={(t) => trimCrop.setTrimPoints((p) => ({ inPoint: p.inPoint, outPoint: Math.min(video.videoMeta!.duration, Math.max(t, p.inPoint + 1 / fps)) }))}
                  onStartCropDraw={() => { video.setPlaying(false); trimCrop.startCropDraw(); }}
                  onClearCrop={trimCrop.clearCrop}
                  flipH={flipH}
                  onToggleFlipH={() => setFlipH((v) => !v)}
                  onExport={(mode) =>
                    startExport(mode, (url, w, h) => {
                      trimCrop.clearCrop();
                      if (video.videoMeta?.src) URL.revokeObjectURL(video.videoMeta.src);
                      const tmp = document.createElement('video');
                      tmp.src = url;
                      tmp.muted = true;
                      tmp.preload = 'auto';
                      tmp.onloadedmetadata = () => {
                        if (isFinite(tmp.duration) && tmp.duration > 0) {
                          applyReplace(url, w, h, tmp.duration);
                        } else {
                          tmp.currentTime = 1e10;
                          tmp.onseeked = () => { tmp.onseeked = null; applyReplace(url, w, h, tmp.duration); };
                        }
                      };
                      const applyReplace = (src: string, rw: number, rh: number, dur: number) => {
                        const safeDur = isFinite(dur) ? dur : trimCrop.trimPoints.outPoint - trimCrop.trimPoints.inPoint;
                        video.replaceVideoMeta({
                          src, fps, title: video.videoMeta!.title + '_clip', width: rw, height: rh,
                          totalFrames: Math.floor(safeDur * fps), duration: safeDur,
                        });
                        setStartFrame(null);
                        cal.reset();
                        meas.reset();
                        trimCrop.setTrimPoints({ inPoint: 0, outPoint: safeDur });
                        zoom.resetTransform();
                      };
                    })
                  }
                  exportStatus={exportStatus}
                  exportProgress={exportProgress}
                  lastExportUrl={lastExportUrl}
                  lastExportTitle={lastExportTitle}
                  onClose={trimCrop.closePanel}
                />
              </div>
            )}

            {showPosePanel && (
              <div
                className="absolute top-0 right-0 bottom-0 w-56 border-l border-zinc-400 dark:border-zinc-600 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm"
                style={{ right: meas.showMeasurementPanel ? '224px' : '0' }}
                ref={stopWheel}
              >
                <PosePanel
                  visibilityMap={landmarkVisibility}
                  onToggleLandmark={handleToggleLandmark}
                  onToggleRegion={handleToggleRegion}
                  onClose={() => setShowPosePanel(false)}
                />
              </div>
            )}

            {meas.showMeasurementPanel && (
              <div
                className="absolute top-0 right-0 bottom-0 w-56 border-l border-zinc-400 dark:border-zinc-600 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm"
                ref={stopWheel}
              >
                <MeasurementPanel
                  measurements={meas.calibratedMeasurements}
                  onDelete={meas.deleteMeasurement}
                  onDeleteAll={meas.deleteAllMeasurements}
                  onToggleVisible={meas.toggleMeasurementVisible}
                  onToggleAllVisible={meas.toggleAllVisible}
                  onToggleSectionVisible={meas.toggleSectionVisible}
                  onDeleteSection={meas.deleteSection}
                  onClose={meas.closeMeasurementPanel}
                />
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-5">
              <div className="w-28 h-28 rounded-sm border border-zinc-500 flex items-center justify-center">
                <Upload className="h-14 w-14 text-zinc-200" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-base uppercase tracking-[0.2em] text-white font-sans">No video loaded</span>
                <span className="text-sm text-zinc-300 font-sans">Upload a video to begin analysis</span>
              </div>
              <button
                onClick={video.handleUploadClick}
                className="mt-1 px-5 py-2.5 rounded-sm border border-zinc-500 text-sm uppercase tracking-widest text-white hover:border-sky-400 hover:text-sky-400 transition-all duration-150 cursor-pointer font-sans"
              >
                Upload Video
              </button>
            </div>
          </div>
        )}
      </main>

      <input ref={video.fileInputRef} type="file" accept="video/*" className="hidden" onChange={video.handleFileChange} />

      <div style={{ height: sectionHeights.controlSection }} className="border shrink-0">
        <ControlPanel
          currentFrame={video.currentFrame}
          totalFrames={totalFrames}
          fps={fps}
          isPlaying={video.isPlaying}
          setIsPlaying={video.setPlaying}
          videoEnded={video.videoEnded}
          playbackRate={video.playbackRate}
          setPlaybackRate={video.setPlaybackRate}
          onSeekToFrame={handleSeekToFrame}
          startFrame={startFrame}
          onSetStartFrame={() => { setStartFrame(video.currentFrame); ctxSetConfirmedSprintStart(video.currentFrame); }}
          onClearStartFrame={() => { setStartFrame(null); ctxSetConfirmedSprintStart(null); }}
          proposedStartFrame={proposedSprintStartFrame}
          calibration={cal.calibration}
          onStartCalibration={() => { video.setPlaying(false); cal.startCalibration(); }}
          measuringDistance={meas.measuringDistance}
          measuringAngle={meas.measuringAngle}
          onToggleMeasuringDistance={() => { video.setPlaying(false); meas.toggleMeasuringDistance(); }}
          onToggleMeasuringAngle={() => { video.setPlaying(false); meas.toggleMeasuringAngle(); }}
          measurementCount={meas.measurements.length}
          showMeasurementPanel={meas.showMeasurementPanel}
          onToggleMeasurementPanel={meas.toggleMeasurementPanel}
          poseEnabled={poseEnabled}
          onTogglePose={() => setPoseEnabled((v) => !v)}
          poseStatus={poseStatus}
          backendReachable={backendReachable}
          showPosePanel={showPosePanel}
          onTogglePosePanel={() => setShowPosePanel((v) => !v)}
          showTrimCropPanel={trimCrop.showTrimCropPanel}
          onToggleTrimCropPanel={() => { trimCrop.togglePanel(); zoom.resetTransform(); }}
          poseReady={poseEnabled && poseStatus === 'ready'}
          showCoM={com.showCoM}
          onToggleCoM={com.toggleCoM}
          comEventCount={com.comEvents.length}
          showCoMEvents={com.showCoMEvents}
          onToggleCoMEvents={com.toggleCoMEvents}
          onRecordCoMEvent={com.recordEvent}
          onClearCoMEvents={com.clearEvents}
          disabled={!video.videoMeta}
        />
      </div>

      {/* Sprint direction confirmation dialog */}
      <AlertDialog open={pendingDirection !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDirection === 'rtl' ? 'Right-to-left sprint detected' : 'Left-to-right sprint detected'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Based on your marker positions, the athlete appears to be sprinting{' '}
              {pendingDirection === 'rtl' ? 'right → left' : 'left → right'}.
              Confirm to switch direction and reset sprint markers, or keep the current setting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDirection(null)}>
              Keep {sprintDirection.toUpperCase()}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingDirection) ctxSetSprintDirection(pendingDirection); resetSprintAnalysis(); setPendingDirection(null); }}>
              Switch to {pendingDirection?.toUpperCase()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
