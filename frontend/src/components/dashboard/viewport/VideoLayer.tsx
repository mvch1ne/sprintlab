import { useEffect, useRef } from 'react';

interface VideoLayerProps {
  src: string;
  playbackRate: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  onTimeUpdate: (currentTime: number) => void;
  onVideoReady: (
    seek: (time: number) => void,
    getCurrentTime: () => number,
    videoEl: HTMLVideoElement,
  ) => void;
  onLoadingChange: (loading: boolean) => void;
  onEnded: () => void;
}

export const VideoLayer = ({
  src,
  playbackRate,
  isPlaying,
  volume,
  isMuted,
  onTimeUpdate,
  onVideoReady,
  onLoadingChange,
  onEnded,
}: VideoLayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    onVideoReady(
      (time: number) => {
        video.currentTime = time;
      },
      () => video.currentTime,
      video,
    );
  }, [onVideoReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tick = () => {
      onTimeUpdate(video.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    if (isPlaying) {
      video.play().catch(() => {});
      rafRef.current = requestAnimationFrame(tick);
    } else {
      video.pause();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      onTimeUpdate(video.currentTime);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, onTimeUpdate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  // Ended — fires when video reaches its natural end
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener('ended', onEnded);
    return () => video.removeEventListener('ended', onEnded);
  }, [onEnded]);

  // Loading state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const setLoading = () => onLoadingChange(true);
    const setNotLoading = () => onLoadingChange(false);
    video.addEventListener('waiting', setLoading);
    video.addEventListener('seeking', setLoading);
    video.addEventListener('loadstart', setLoading);
    video.addEventListener('canplay', setNotLoading);
    video.addEventListener('canplaythrough', setNotLoading);
    video.addEventListener('seeked', setNotLoading);
    video.addEventListener('playing', setNotLoading);
    return () => {
      video.removeEventListener('waiting', setLoading);
      video.removeEventListener('seeking', setLoading);
      video.removeEventListener('loadstart', setLoading);
      video.removeEventListener('canplay', setNotLoading);
      video.removeEventListener('canplaythrough', setNotLoading);
      video.removeEventListener('seeked', setNotLoading);
      video.removeEventListener('playing', setNotLoading);
    };
  }, [onLoadingChange]);

  return (
    <video
      ref={videoRef}
      src={src}
      className="absolute inset-0 w-full h-full object-contain"
      playsInline
      preload="auto"
    />
  );
};
