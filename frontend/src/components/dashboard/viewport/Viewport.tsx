import { useState, useRef, useCallback, useEffect } from 'react';
import { FilePlayIcon, Clock, Upload } from 'lucide-react';
import { IconDimensions } from '@tabler/icons-react';
import { VideoLayer } from './VideoLayer';
import { ControlPanel } from './ControlPanel';
import { CalibrationOverlay } from './CalibrationAndMeasurements/CalibrationOverlay';
import type { CalibrationData } from './CalibrationAndMeasurements/CalibrationOverlay';
import { MeasurementOverlay } from './CalibrationAndMeasurements/MeasurementOverlay';
import { MeasurementPanel } from './CalibrationAndMeasurements/MeasurementPanel';
import type { Measurement } from './CalibrationAndMeasurements/MeasurementOverlay';

import { PoseOverlay } from './PoseEngine/PoseOverlay';
import { PosePanel } from './PoseEngine/PosePanel';
import { usePoseLandmarker } from './PoseEngine/usePoseLandmarker';
import { LANDMARKS, buildDefaultVisibility } from './PoseEngine/poseConfig';
import type { LandmarkDef } from './PoseEngine/poseConfig';
import { TrimCropPanel } from './TrimAndCrop/TrimCropPanel';
import { CropOverlay } from './TrimAndCrop/CropOverlay';
import { useExport } from './videoUtilities/useExport';
import { probeVideoFps } from './videoUtilities/probeVideoFps';
import { useStatus } from './StatusBar/StatusContext';
import type { CropRect, TrimPoints } from './TrimAndCrop/TrimCropPanel';

interface VideoMeta {
  src: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  duration: number;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_SPEED = 0.005;

export const Viewport = () => {
  const sectionHeights = { header: '1.25rem', controlSection: '12rem' };

  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [startFrame, setStartFrame] = useState<number | null>(null);
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationKey, setCalibrationKey] = useState(0);
  const [measuringDistance, setMeasuringDistance] = useState(false);
  const [measuringAngle, setMeasuringAngle] = useState(false);
  const [measuringKey, setMeasuringKey] = useState(0);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [showMeasurementPanel, setShowMeasurementPanel] = useState(false);
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    x: 0,
    y: 0,
  });
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoProbing, setVideoProbing] = useState(false); // true while ffprobe reads fps
  const exportingRef = useRef(false);

  // ── Pose ──────────────────────────────────────────────────────────────────
  const [poseEnabled, setPoseEnabled] = useState(false);
  const [showPosePanel, setShowPosePanel] = useState(false);
  const [showPoseLabels, setShowPoseLabels] = useState(true);
  const [landmarkVisibility, setLandmarkVisibility] = useState<
    Record<number, boolean>
  >(buildDefaultVisibility);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const {
    status: poseStatus,
    result: poseResult,
    detect,
  } = usePoseLandmarker(poseEnabled);

  // ── Trim & Crop ───────────────────────────────────────────────────────────
  const [showTrimCropPanel, setShowTrimCropPanel] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [drawingCrop, setDrawingCrop] = useState(false);
  const [showCropOverlay, setShowCropOverlay] = useState(false);
  const [trimPoints, setTrimPoints] = useState<TrimPoints>({
    inPoint: 0,
    outPoint: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const seekVideo = useRef<(time: number) => void>(() => {});
  const getVideoTime = useRef<() => number>(() => 0);
  const mainRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  const fps = videoMeta?.fps ?? 30;
  const totalFrames = videoMeta?.totalFrames ?? 0;
  const currentFrame = Math.floor(currentTime * fps);

  const {
    exportStatus,
    exportProgress,
    lastExportUrl,
    lastExportTitle,
    startExport,
  } = useExport({
    videoElRef,
    exportingRef,
    videoWidth: videoMeta?.width ?? 0,
    videoHeight: videoMeta?.height ?? 0,
    fps,
    trimPoints,
    cropRect,
    title: videoMeta?.title ?? 'clip',
  });

  // ── Run pose detection on every frame change ──────────────────────────────
  useEffect(() => {
    if (!poseEnabled || poseStatus !== 'ready' || !videoElRef.current) return;
    detect(videoElRef.current, currentTime * 1000);
  }, [currentTime, poseEnabled, poseStatus, detect]);

  // ── Status bar reporting ──────────────────────────────────────────────────
  const { set: setStatus, clear: clearStatus } = useStatus();

  // Video file info
  useEffect(() => {
    if (!videoMeta) {
      clearStatus('video');
      clearStatus('fps');
      clearStatus('frame');
      return;
    }
    setStatus('video', 'file', videoMeta.title, { accent: 'sky' });
    setStatus(
      'fps',
      'fps',
      `${videoMeta.fps % 1 === 0 ? videoMeta.fps : videoMeta.fps.toFixed(3)}`,
    );
  }, [videoMeta, setStatus, clearStatus]);

  // Playback position
  useEffect(() => {
    if (!videoMeta) return;
    const tc = `${String(Math.floor(currentTime / 60)).padStart(2, '0')}:${(currentTime % 60).toFixed(2).padStart(5, '0')}`;
    setStatus('frame', 'frame', `${currentFrame} / ${totalFrames}  ${tc}`);
  }, [currentFrame, currentTime, totalFrames, videoMeta, setStatus]);

  // Playback state
  useEffect(() => {
    if (!videoMeta) {
      clearStatus('playback');
      return;
    }
    if (videoEnded)
      setStatus('playback', 'state', 'ended', { accent: 'amber' });
    else if (isPlaying)
      setStatus('playback', 'state', 'playing', {
        accent: 'emerald',
        pulse: true,
      });
    else setStatus('playback', 'state', 'paused', { accent: 'default' });
  }, [isPlaying, videoEnded, videoMeta, setStatus, clearStatus]);

  // Probing
  useEffect(() => {
    if (videoProbing)
      setStatus('probe', 'analysing', 'fps…', { accent: 'amber', pulse: true });
    else clearStatus('probe');
  }, [videoProbing, setStatus, clearStatus]);

  // Export
  useEffect(() => {
    if (exportStatus === 'idle') clearStatus('export');
    else if (exportStatus === 'loading')
      setStatus('export', 'export', 'loading ffmpeg…', {
        accent: 'amber',
        pulse: true,
      });
    else if (exportStatus === 'running')
      setStatus(
        'export',
        'export',
        `encoding ${Math.round(exportProgress * 100)}%`,
        { accent: 'sky', pulse: true },
      );
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

  // Pose
  useEffect(() => {
    if (poseEnabled)
      setStatus(
        'pose',
        'pose',
        poseStatus === 'ready' ? 'active' : 'loading…',
        {
          accent: poseStatus === 'ready' ? 'emerald' : 'amber',
          pulse: poseStatus !== 'ready',
        },
      );
    else clearStatus('pose');
  }, [poseEnabled, poseStatus, setStatus, clearStatus]);

  // Zoom
  useEffect(() => {
    if (transform.scale > 1)
      setStatus('zoom', 'zoom', `${transform.scale.toFixed(1)}×`, {
        accent: 'sky',
      });
    else clearStatus('zoom');
  }, [transform.scale, setStatus, clearStatus]);

  const clampPan = useCallback(
    (x: number, y: number, scale: number, el: HTMLElement) => {
      const maxX = (el.clientWidth * (scale - 1)) / 2;
      const maxY = (el.clientHeight * (scale - 1)) / 2;
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    [],
  );

  // Wheel zoom — no dep array so listener is always re-attached fresh
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setTransform((prev) => {
        const newScale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, prev.scale * (1 + -e.deltaY * ZOOM_SPEED)),
        );
        const rect = el.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const mx = e.clientX - rect.left - cx;
        const my = e.clientY - rect.top - cy;
        const sf = newScale / prev.scale;
        const { x, y } = clampPan(
          mx + (prev.x - mx) * sf,
          my + (prev.y - my) * sf,
          newScale,
          el,
        );
        return { scale: newScale, x, y };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const calibratingRef = useRef(calibrating);
  const measuringRef = useRef(false);
  useEffect(() => {
    measuringRef.current = measuringDistance || measuringAngle;
  }, [measuringDistance, measuringAngle]);
  useEffect(() => {
    calibratingRef.current = calibrating;
  }, [calibrating]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (
      calibratingRef.current ||
      measuringRef.current ||
      drawingCrop ||
      transform.scale <= 1
    )
      return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { x: transform.x, y: transform.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning.current || !mainRef.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      const { x, y } = clampPan(
        panOrigin.current.x + dx,
        panOrigin.current.y + dy,
        transform.scale,
        mainRef.current,
      );
      setTransform((prev) => ({ ...prev, x, y }));
    },
    [clampPan, transform.scale],
  );

  const onPointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const resetTransform = useCallback(
    () => setTransform({ scale: 1, x: 0, y: 0 }),
    [],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (videoMeta?.src) URL.revokeObjectURL(videoMeta.src);
      const src = URL.createObjectURL(file);
      const tmp = document.createElement('video');
      tmp.src = src;
      tmp.muted = true;
      tmp.preload = 'auto';

      tmp.onloadedmetadata = async () => {
        // Read fps from the file via ffprobe (avg_frame_rate fraction).
        // This is the only reliable source — rVFC-based counting is inaccurate.
        setVideoProbing(true);
        const fps = await probeVideoFps(src);
        setVideoProbing(false);

        setVideoMeta({
          src,
          fps,
          title: file.name.replace(/\.[^/.]+$/, ''),
          width: tmp.videoWidth,
          height: tmp.videoHeight,
          totalFrames: Math.floor(tmp.duration * fps),
          duration: tmp.duration,
        });
        setCurrentTime(0);
        setIsPlaying(false);
        setPlaybackRate(1);
        setVolume(1);
        setIsMuted(false);
        setStartFrame(null);
        setCalibration(null);
        setCalibrating(false);
        setMeasuringDistance(false);
        setMeasuringAngle(false);
        setMeasurements([]);
        setShowMeasurementPanel(false);
        setPoseEnabled(false);
        setShowPosePanel(false);
        setLandmarkVisibility(buildDefaultVisibility());
        setShowTrimCropPanel(false);
        setCropRect(null);
        setDrawingCrop(false);
        setShowCropOverlay(false);
        setTrimPoints({ inPoint: 0, outPoint: tmp.duration });
        resetTransform();
      };
    },
    [videoMeta, resetTransform],
  );

  const handleSeekToFrame = useCallback(
    (frame: number) => {
      const time = frame / fps;
      seekVideo.current(time);
      setCurrentTime(time);
      setVideoEnded(false);
    },
    [fps],
  );

  const handleVideoReady = useCallback(
    (
      seek: (time: number) => void,
      getTime: () => number,
      videoEl: HTMLVideoElement,
    ) => {
      seekVideo.current = seek;
      getVideoTime.current = getTime;
      videoElRef.current = videoEl;
    },
    [],
  );

  // Stable ref callback that adds the wheel-stop listener exactly once per element
  const stopWheel = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    el.addEventListener('wheel', (e) => e.stopPropagation(), {
      passive: false,
    });
  }, []);

  const handleUploadClick = () => fileInputRef.current?.click();

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
  const zoomLabel =
    transform.scale > 1 ? `${transform.scale.toFixed(1)}×` : null;

  return (
    <div className="viewport-container flex flex-col h-full">
      <header
        style={{ height: sectionHeights.header }}
        className="flex items-center shrink-0 border border-t-0 border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 gap-3"
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 font-sans">
            Viewport
          </span>
        </div>
        <div className="h-4 w-px bg-zinc-400 dark:bg-zinc-600" />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <FilePlayIcon className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span className="text-[11px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300 font-sans">
              {videoMeta ? videoMeta.title : 'No Video'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <IconDimensions className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span className="text-[11px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300 font-sans">
              {videoMeta ? `${videoMeta.width}×${videoMeta.height}` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span className="text-[11px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300 font-sans">
              {videoMeta ? `${videoMeta.fps} fps` : '—'}
            </span>
          </div>
          {zoomLabel && (
            <button
              onClick={resetTransform}
              className="text-[11px] uppercase tracking-widest text-sky-500 hover:text-sky-400 border border-sky-600/40 px-1.5 py-0.5 rounded-sm transition-colors cursor-pointer"
            >
              {zoomLabel} ✕
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {videoMeta && (
            <button
              onClick={handleUploadClick}
              className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <Upload className="h-3 w-3" />
              <span className="font-sans">Replace</span>
            </button>
          )}
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600"
              />
            ))}
          </div>
        </div>
      </header>

      <main
        ref={mainRef}
        className="flex-1 border border-zinc-400 dark:border-zinc-600 overflow-hidden relative bg-black select-none"
        style={{
          cursor:
            calibrating || measuringDistance || measuringAngle || drawingCrop
              ? 'crosshair'
              : transform.scale > 1
                ? 'grab'
                : 'default',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {videoMeta ? (
          <>
            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: 'center center',
                willChange: 'transform',
              }}
            >
              <VideoLayer
                src={videoMeta.src}
                playbackRate={playbackRate}
                isPlaying={isPlaying}
                volume={volume}
                isMuted={isMuted}
                onTimeUpdate={setCurrentTime}
                onVideoReady={handleVideoReady}
                onLoadingChange={(loading) => {
                  if (!exportingRef.current) setVideoLoading(loading);
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  setVideoEnded(true);
                }}
              />
              {/* Pose overlay lives inside transform wrapper — stays registered to video */}
              {poseEnabled && (
                <PoseOverlay
                  result={poseResult}
                  visibilityMap={landmarkVisibility}
                  showLabels={showPoseLabels}
                  transform={{ scale: 1, x: 0, y: 0 }}
                />
              )}
            </div>

            {/* Loading spinner — probing fps or buffering, hidden during export */}
            {(videoProbing || videoLoading) && exportStatus === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-zinc-600 border-t-sky-400 rounded-full animate-spin" />
                  <span className="text-[8px] uppercase tracking-widest text-zinc-500">
                    {videoProbing ? 'Analysing…' : 'Loading'}
                  </span>
                </div>
              </div>
            )}

            {/* Crop overlay */}
            <CropOverlay
              active={drawingCrop || showCropOverlay}
              cropRect={cropRect}
              videoWidth={videoMeta.width}
              videoHeight={videoMeta.height}
              transform={transform}
              onCropChange={(rect) => setCropRect(rect)}
              onCropComplete={(rect) => {
                setCropRect(rect);
                setDrawingCrop(false);
                setShowCropOverlay(true);
              }}
            />

            <CalibrationOverlay
              key={calibrationKey}
              active={calibrating}
              transform={transform}
              videoWidth={videoMeta.width}
              videoHeight={videoMeta.height}
              existingCalibration={calibration}
              onCalibrationComplete={(data: CalibrationData) => {
                setCalibration(data);
                setCalibrating(false);
              }}
              onCancel={() => setCalibrating(false)}
            />

            {calibration && !calibrating && (
              <CalibrationOverlay
                active={false}
                transform={transform}
                videoWidth={videoMeta.width}
                videoHeight={videoMeta.height}
                existingCalibration={calibration}
                onCalibrationComplete={() => {}}
                onCancel={() => {}}
              />
            )}

            {/* Measurement overlay — always mounted when calibrated so saved lines persist */}
            {calibration && (
              <MeasurementOverlay
                key={measuringKey}
                active={measuringDistance || measuringAngle}
                mode={measuringAngle ? 'angle' : 'distance'}
                transform={transform}
                calibration={calibration}
                measurements={measurements}
                onMeasurementAdded={(m) => {
                  setMeasurements((prev) => [...prev, m]);
                  setShowMeasurementPanel(true);
                }}
              />
            )}

            {/* Measurement HUD */}
            {(measuringDistance || measuringAngle) && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 border border-zinc-600 rounded-sm backdrop-blur-sm pointer-events-auto">
                  <div
                    className={`w-1.5 h-1.5 rounded-full animate-pulse ${measuringAngle ? 'bg-violet-400' : 'bg-sky-400'}`}
                  />
                  <span
                    className={`text-[11px] uppercase tracking-widest ${measuringAngle ? 'text-violet-300' : 'text-zinc-300'}`}
                  >
                    {measuringAngle
                      ? 'Click: ray A → vertex → ray B'
                      : 'Click two points to measure'}
                  </span>
                  <button
                    onClick={() => {
                      setMeasuringDistance(false);
                      setMeasuringAngle(false);
                    }}
                    className="ml-2 text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Trim & Crop panel */}
            {showTrimCropPanel && videoMeta && (
              <div
                className="absolute top-0 bottom-0 w-56 border-l border-zinc-400 dark:border-zinc-600 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm"
                style={{
                  right:
                    (showPosePanel ? 224 : 0) +
                    (showMeasurementPanel ? 224 : 0),
                }}
                ref={stopWheel}
              >
                <TrimCropPanel
                  duration={videoMeta.duration}
                  fps={fps}
                  currentTime={currentTime}
                  cropRect={cropRect}
                  trimPoints={trimPoints}
                  videoMeta={{
                    width: videoMeta.width,
                    height: videoMeta.height,
                    title: videoMeta.title,
                  }}
                  onSetTrimIn={() =>
                    setTrimPoints((p) => ({
                      inPoint: currentTime,
                      outPoint: Math.max(p.outPoint, currentTime),
                    }))
                  }
                  onSetTrimOut={() =>
                    setTrimPoints((p) => ({
                      inPoint: Math.min(p.inPoint, currentTime),
                      outPoint: currentTime,
                    }))
                  }
                  onClearTrim={() =>
                    setTrimPoints({ inPoint: 0, outPoint: videoMeta.duration })
                  }
                  onSeekTo={(t) => handleSeekToFrame(Math.round(t * fps))}
                  onSetTrimInTo={(t) =>
                    setTrimPoints((p) => ({
                      inPoint: Math.max(0, Math.min(t, p.outPoint - 1 / fps)),
                      outPoint: p.outPoint,
                    }))
                  }
                  onSetTrimOutTo={(t) =>
                    setTrimPoints((p) => ({
                      inPoint: p.inPoint,
                      outPoint: Math.min(
                        videoMeta.duration,
                        Math.max(t, p.inPoint + 1 / fps),
                      ),
                    }))
                  }
                  onStartCropDraw={() => {
                    setIsPlaying(false);
                    setDrawingCrop(true);
                    setShowCropOverlay(true);
                  }}
                  onClearCrop={() => {
                    setCropRect(null);
                    setShowCropOverlay(false);
                    setDrawingCrop(false);
                  }}
                  onExport={(mode) =>
                    startExport(mode, (url, w, h) => {
                      // Clear crop immediately — don't wait for metadata
                      setCropRect(null);
                      setShowCropOverlay(false);
                      setDrawingCrop(false);

                      if (videoMeta?.src) URL.revokeObjectURL(videoMeta.src);

                      const tmp = document.createElement('video');
                      tmp.src = url;
                      tmp.muted = true;
                      tmp.preload = 'auto';

                      tmp.onloadedmetadata = () => {
                        if (isFinite(tmp.duration) && tmp.duration > 0) {
                          applyReplace(url, w, h, tmp.duration);
                        } else {
                          // WebM from captureStream often has Infinity duration.
                          // Seek to a large number forces the browser to scan and resolve it.
                          tmp.currentTime = 1e10;
                          tmp.onseeked = () => {
                            tmp.onseeked = null;
                            applyReplace(url, w, h, tmp.duration);
                          };
                        }
                      };

                      const applyReplace = (
                        src: string,
                        w: number,
                        h: number,
                        dur: number,
                      ) => {
                        const safeDur = isFinite(dur)
                          ? dur
                          : trimPoints.outPoint - trimPoints.inPoint;
                        setVideoMeta({
                          src,
                          fps,
                          title: videoMeta.title + '_clip',
                          width: w,
                          height: h,
                          totalFrames: Math.floor(safeDur * fps),
                          duration: safeDur,
                        });
                        setCurrentTime(0);
                        setIsPlaying(false);
                        setPlaybackRate(1);
                        setStartFrame(null);
                        setCalibration(null);
                        setCalibrating(false);
                        setMeasuringDistance(false);
                        setMeasuringAngle(false);
                        setMeasurements([]);
                        setShowMeasurementPanel(false);
                        setTrimPoints({ inPoint: 0, outPoint: safeDur });
                        resetTransform();
                      };
                    })
                  }
                  exportStatus={exportStatus}
                  exportProgress={exportProgress}
                  lastExportUrl={lastExportUrl}
                  lastExportTitle={lastExportTitle}
                  onClose={() => setShowTrimCropPanel(false)}
                />
              </div>
            )}

            {/* Pose panel */}
            {showPosePanel && (
              <div
                className="absolute top-0 right-0 bottom-0 w-56 border-l border-zinc-400 dark:border-zinc-600 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm"
                style={{ right: showMeasurementPanel ? '224px' : '0' }}
                ref={stopWheel}
              >
                <PosePanel
                  visibilityMap={landmarkVisibility}
                  showLabels={showPoseLabels}
                  onToggleLandmark={handleToggleLandmark}
                  onToggleRegion={handleToggleRegion}
                  onToggleLabels={() => setShowPoseLabels((v) => !v)}
                  onClose={() => setShowPosePanel(false)}
                />
              </div>
            )}

            {/* Measurement panel */}
            {showMeasurementPanel && (
              <div
                className="absolute top-0 right-0 bottom-0 w-56 border-l border-zinc-400 dark:border-zinc-600 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm"
                ref={stopWheel}
              >
                <MeasurementPanel
                  measurements={measurements}
                  onDelete={(id) =>
                    setMeasurements((prev) => prev.filter((m) => m.id !== id))
                  }
                  onDeleteAll={() => setMeasurements([])}
                  onToggleVisible={(id) =>
                    setMeasurements((prev) =>
                      prev.map((m) =>
                        m.id === id ? { ...m, visible: !m.visible } : m,
                      ),
                    )
                  }
                  onToggleAllVisible={() => {
                    const allVisible = measurements.every((m) => m.visible);
                    setMeasurements((prev) =>
                      prev.map((m) => ({ ...m, visible: !allVisible })),
                    );
                  }}
                  onToggleSectionVisible={(type) =>
                    setMeasurements((prev) => {
                      const section = prev.filter((m) => m.type === type);
                      const allVisible = section.every((m) => m.visible);
                      return prev.map((m) =>
                        m.type === type ? { ...m, visible: !allVisible } : m,
                      );
                    })
                  }
                  onDeleteSection={(type) =>
                    setMeasurements((prev) =>
                      prev.filter((m) => m.type !== type),
                    )
                  }
                  onClose={() => setShowMeasurementPanel(false)}
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
                <span className="text-base uppercase tracking-[0.2em] text-white font-sans">
                  No video loaded
                </span>
                <span className="text-sm text-zinc-300 font-sans">
                  Upload a video to begin analysis
                </span>
              </div>
              <button
                onClick={handleUploadClick}
                className="mt-1 px-5 py-2.5 rounded-sm border border-zinc-500 text-sm uppercase tracking-widest text-white hover:border-sky-400 hover:text-sky-400 transition-all duration-150 cursor-pointer font-sans"
              >
                Upload Video
              </button>
            </div>
          </div>
        )}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        style={{ height: sectionHeights.controlSection }}
        className="border shrink-0"
      >
        <ControlPanel
          currentFrame={currentFrame}
          totalFrames={totalFrames}
          fps={fps}
          isPlaying={isPlaying}
          setIsPlaying={(v) => {
            setIsPlaying(v);
            setVideoEnded(false);
          }}
          videoEnded={videoEnded}
          playbackRate={playbackRate}
          setPlaybackRate={setPlaybackRate}
          volume={volume}
          setVolume={setVolume}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          onSeekToFrame={handleSeekToFrame}
          startFrame={startFrame}
          onSetStartFrame={() => setStartFrame(currentFrame)}
          onClearStartFrame={() => setStartFrame(null)}
          calibration={calibration}
          onStartCalibration={() => {
            setIsPlaying(false);
            setCalibrationKey((k) => k + 1);
            setCalibrating(true);
          }}
          measuringDistance={measuringDistance}
          measuringAngle={measuringAngle}
          onToggleMeasuringDistance={() => {
            setIsPlaying(false);
            setMeasuringKey((k) => k + 1);
            setMeasuringDistance((m) => !m);
            setMeasuringAngle(false);
          }}
          onToggleMeasuringAngle={() => {
            setIsPlaying(false);
            setMeasuringKey((k) => k + 1);
            setMeasuringAngle((m) => !m);
            setMeasuringDistance(false);
          }}
          measurementCount={measurements.length}
          showMeasurementPanel={showMeasurementPanel}
          onToggleMeasurementPanel={() => setShowMeasurementPanel((v) => !v)}
          poseEnabled={poseEnabled}
          onTogglePose={() => setPoseEnabled((v) => !v)}
          poseStatus={poseStatus}
          showPosePanel={showPosePanel}
          onTogglePosePanel={() => setShowPosePanel((v) => !v)}
          showTrimCropPanel={showTrimCropPanel}
          onToggleTrimCropPanel={() => {
            setShowTrimCropPanel((v) => !v);
            resetTransform();
          }}
          disabled={!videoMeta}
        />
      </div>
    </div>
  );
};
