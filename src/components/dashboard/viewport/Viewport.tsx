import { useState, useRef, useCallback, useEffect } from 'react';
import { FilePlayIcon, Clock, Upload } from 'lucide-react';
import { IconDimensions } from '@tabler/icons-react';
import { VideoLayer } from './VideoLayer';
import { ControlPanel } from './ControlPanel';
import { CalibrationOverlay } from './CalibrationOverlay';
import type { CalibrationData } from './CalibrationOverlay';

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
  const sectionHeights = { header: '1.25rem', controlSection: '10rem' };

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
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    x: 0,
    y: 0,
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

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (calibrating || transform.scale <= 1) return;
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { x: transform.x, y: transform.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [calibrating, transform.scale, transform.x, transform.y],
  );

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
      tmp.onloadedmetadata = () => {
        const fps = 30;
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
    },
    [fps],
  );

  const handleVideoReady = useCallback(
    (seek: (time: number) => void, getTime: () => number) => {
      seekVideo.current = seek;
      getVideoTime.current = getTime;
    },
    [],
  );

  const handleUploadClick = () => fileInputRef.current?.click();
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
          <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 font-sans">
            Viewport
          </span>
        </div>
        <div className="h-4 w-px bg-zinc-400 dark:bg-zinc-600" />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <FilePlayIcon className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span className="text-[9px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300 font-sans">
              {videoMeta ? videoMeta.title : 'No Video'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <IconDimensions className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span className="text-[9px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300 font-sans">
              {videoMeta ? `${videoMeta.width}×${videoMeta.height}` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span className="text-[9px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300 font-sans">
              {videoMeta ? `${videoMeta.fps} fps` : '—'}
            </span>
          </div>
          {zoomLabel && (
            <button
              onClick={resetTransform}
              className="text-[9px] uppercase tracking-widest text-sky-500 hover:text-sky-400 border border-sky-600/40 px-1.5 py-0.5 rounded-sm transition-colors cursor-pointer"
            >
              {zoomLabel} ✕
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {videoMeta && (
            <button
              onClick={handleUploadClick}
              className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
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
          cursor: calibrating
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
              />
            </div>

            <CalibrationOverlay
              key={calibrationKey}
              active={calibrating}
              transform={transform}
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
                existingCalibration={calibration}
                onCalibrationComplete={() => {}}
                onCancel={() => {}}
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-sm border border-zinc-700 flex items-center justify-center">
                <Upload className="h-5 w-5 text-zinc-500" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-sans">
                  No video loaded
                </span>
                <span className="text-[9px] text-zinc-600 font-sans">
                  Upload a video to begin analysis
                </span>
              </div>
              <button
                onClick={handleUploadClick}
                className="mt-1 px-3 py-1.5 rounded-sm border border-zinc-700 text-[9px] uppercase tracking-widest text-zinc-400 hover:border-sky-500 hover:text-sky-400 transition-all duration-150 cursor-pointer font-sans"
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
          setIsPlaying={setIsPlaying}
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
          disabled={!videoMeta}
        />
      </div>
    </div>
  );
};
