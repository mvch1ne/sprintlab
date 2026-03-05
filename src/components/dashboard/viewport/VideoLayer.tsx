import { useEffect, useRef } from 'react';

interface VideoLayerProps {
  src: string;
  currentFrame: number;
  fps: number;
  isPlaying: boolean;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
}

export const VideoLayer = ({
  src,
  currentFrame,
  fps,
  isPlaying,
  onVideoRef,
}: VideoLayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Expose ref to parent via callback
  useEffect(() => {
    onVideoRef?.(videoRef.current);
  }, [onVideoRef]);

  // Sync play/pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying]);

  // Sync frame position when paused
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isPlaying) return;
    const targetTime = currentFrame / fps;
    if (Math.abs(video.currentTime - targetTime) > 0.001) {
      video.currentTime = targetTime;
    }
  }, [currentFrame, fps, isPlaying]);

  return (
    <video
      ref={videoRef}
      src={src}
      className="absolute inset-0 w-full h-full object-contain"
      playsInline
    />
  );
};
