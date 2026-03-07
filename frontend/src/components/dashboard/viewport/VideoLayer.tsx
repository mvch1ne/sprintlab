import { useEffect, useRef, useCallback } from 'react';
import type { Keypoint } from './PoseEngine/usePoseLandmarker';

interface VideoLayerProps {
  src: string;
  fps: number;
  totalFrames: number;
  currentFrame: number;
  playbackRate: number;
  isPlaying: boolean;
  skeletonOnly: boolean;
  onFrameChange: (frame: number) => void;
  onEnded: () => void;
  onReady: (videoEl: HTMLVideoElement) => void;
  // Optional: if provided, called each rAF tick with the current frame's
  // keypoints so PoseOverlay can redraw without going through React state.
  getKeypoints?: (frame: number) => Keypoint[];
  onKeypoints?: (kp: Keypoint[]) => void;
}

export const VideoLayer = ({
  src,
  fps,
  totalFrames,
  currentFrame,
  playbackRate,
  isPlaying,
  skeletonOnly,
  onFrameChange,
  onEnded,
  onReady,
  getKeypoints,
  onKeypoints,
}: VideoLayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef = useRef<number | null>(null);

  const fpsRef = useRef(fps);
  const totalFramesRef = useRef(totalFrames);
  const isPlayingRef = useRef(isPlaying);
  const playbackRateRef = useRef(playbackRate);
  const currentFrameRef = useRef(currentFrame);
  const skeletonOnlyRef = useRef(skeletonOnly);
  const getKeypointsRef = useRef(getKeypoints);
  const onKeypointsRef = useRef(onKeypoints);

  useEffect(() => {
    fpsRef.current = fps;
  }, [fps]);
  useEffect(() => {
    totalFramesRef.current = totalFrames;
  }, [totalFrames]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);
  useEffect(() => {
    skeletonOnlyRef.current = skeletonOnly;
  }, [skeletonOnly]);
  useEffect(() => {
    getKeypointsRef.current = getKeypoints;
  }, [getKeypoints]);
  useEffect(() => {
    onKeypointsRef.current = onKeypoints;
  }, [onKeypoints]);

  // ── Draw video frame to canvas (skipped in skeleton-only mode) ───────────
  const draw = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!video || !canvas || !ctx) return;
    if (skeletonOnlyRef.current) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
  }, []);

  // ── Emit keypoints for current frame ─────────────────────────────────────
  const emitKeypoints = useCallback((frame: number) => {
    const gk = getKeypointsRef.current;
    const ok = onKeypointsRef.current;
    if (gk && ok) ok(gk(frame));
  }, []);

  // ── Load new src ──────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    video.pause();
    video.src = src;
    video.muted = true;
    video.preload = 'auto';
    video.load();

    const onMeta = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctxRef.current = canvas.getContext('2d');
      }
      onReady(video);
      video.currentTime = 0;
    };

    const onSeeked = () => {
      draw();
      emitKeypoints(currentFrameRef.current);
    };

    video.addEventListener('loadedmetadata', onMeta, { once: true });
    video.addEventListener('seeked', onSeeked);
    return () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('seeked', onSeeked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // ── Redraw when skeletonOnly toggles (no seek needed) ────────────────────
  useEffect(() => {
    draw();
  }, [skeletonOnly, draw]);

  // ── Sync playbackRate ─────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);

  // ── Always keep currentFrameRef in sync ──────────────────────────────────
  useEffect(() => {
    currentFrameRef.current = currentFrame;
  }, [currentFrame]);

  // ── Seek on scrub/step (paused only) ─────────────────────────────────────
  useEffect(() => {
    if (isPlaying) return;
    const video = videoRef.current;
    if (!video || !fps) return;
    const target = (currentFrame + 0.5) / fps;
    if (Math.abs(video.currentTime - target) > 0.5 / fps) {
      video.currentTime = target;
    }
  }, [currentFrame, isPlaying, fps]);

  // ── Playback loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!isPlaying) {
      video.pause();
      return;
    }

    const tick = () => {
      if (!isPlayingRef.current) return;

      const raw = Math.round(video.currentTime * fpsRef.current);
      const frame = Math.min(raw, totalFramesRef.current - 1);

      if (frame !== currentFrameRef.current) {
        currentFrameRef.current = frame;
        draw();
        // Emit keypoints in the same tick — no React state round-trip
        emitKeypoints(frame);
        onFrameChange(frame);
      }

      if (video.ended || frame >= totalFramesRef.current - 1) {
        currentFrameRef.current = totalFramesRef.current - 1;
        draw();
        emitKeypoints(totalFramesRef.current - 1);
        onFrameChange(totalFramesRef.current - 1);
        onEnded();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const targetTime = currentFrameRef.current / fpsRef.current;
    video.currentTime = targetTime;
    video.addEventListener(
      'seeked',
      () => {
        if (!isPlayingRef.current) return;
        video.playbackRate = playbackRateRef.current;
        video.play().catch(() => {});
        rafRef.current = requestAnimationFrame(tick);
      },
      { once: true },
    );

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      video.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  return (
    <>
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        preload="auto"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-contain"
      />
    </>
  );
};
