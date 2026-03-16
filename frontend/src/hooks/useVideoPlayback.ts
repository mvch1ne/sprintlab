import { useState, useRef, useCallback } from 'react';
import { probeVideoFps } from '../components/dashboard/viewport/videoUtilities/probeVideoFps';

export interface VideoMeta {
  src: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  duration: number;
}

/**
 * Manages video file loading, playback state, and frame tracking.
 * Accepts a `resetAll` callback that fires after a new file loads so
 * the parent can reset all other hooks.
 */
export function useVideoPlayback(resetAll: (meta: VideoMeta) => void) {
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoProbing, setVideoProbing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const currentFrameRef = useRef(0);
  currentFrameRef.current = currentFrame;

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
        setVideoProbing(true);
        const fps = await probeVideoFps(src);
        setVideoProbing(false);

        const meta: VideoMeta = {
          src,
          fps,
          title: file.name.replace(/\.[^/.]+$/, ''),
          width: tmp.videoWidth,
          height: tmp.videoHeight,
          totalFrames: Math.floor(tmp.duration * fps),
          duration: tmp.duration,
        };

        setVideoMeta(meta);
        setCurrentFrame(0);
        setIsPlaying(false);
        setPlaybackRate(1);
        setVideoEnded(false);

        resetAll(meta);
      };
    },
    [videoMeta, resetAll],
  );

  const seekToFrame = useCallback(
    (frame: number, total: number) => {
      setCurrentFrame(Math.max(0, Math.min(frame, total - 1)));
      setVideoEnded(false);
    },
    [],
  );

  /** Wrapper that also clears videoEnded — matches original behaviour. */
  const setPlaying = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    setIsPlaying(v);
    setVideoEnded(false);
  }, []);

  const onEnded = useCallback(() => {
    setIsPlaying(false);
    setVideoEnded(true);
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Replace the current video meta (e.g. after export/trim produces new blob).
   * Does NOT trigger resetAll — caller manages specific resets.
   */
  const replaceVideoMeta = useCallback((meta: VideoMeta) => {
    setVideoMeta(meta);
    setCurrentFrame(0);
    setIsPlaying(false);
    setPlaybackRate(1);
    setVideoEnded(false);
  }, []);

  return {
    videoMeta,
    setVideoMeta,
    currentFrame,
    setCurrentFrame,
    isPlaying,
    setIsPlaying,
    playbackRate,
    setPlaybackRate,
    videoEnded,
    videoProbing,
    fileInputRef,
    videoElRef,
    currentFrameRef,
    handleFileChange,
    seekToFrame,
    onEnded,
    setPlaying,
    handleUploadClick,
    replaceVideoMeta,
  };
}
