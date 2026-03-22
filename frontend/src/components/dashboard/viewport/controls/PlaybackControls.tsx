import { useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronFirst,
  ChevronLast,
  Gauge,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconBtn } from './shared';

const SPEED_OPTIONS = [0.0625, 0.125, 0.25, 0.5, 1, 1.5, 2, 4];
const SPEED_LABELS: Record<number, string> = {
  0.0625: '1/16\u00d7',
  0.125: '1/8\u00d7',
  0.25: '1/4\u00d7',
  0.5: '1/2\u00d7',
};
const speedLabel = (s: number) => SPEED_LABELS[s] ?? `${s}\u00d7`;

interface PlaybackControlsProps {
  currentFrame: number;
  totalFrames: number;
  fps: number;
  isPlaying: boolean;
  setIsPlaying: (v: boolean | ((p: boolean) => boolean)) => void;
  videoEnded: boolean;
  playbackRate: number;
  setPlaybackRate: (v: number) => void;
  onSeekToFrame: (frame: number) => void;
  disabled?: boolean;
}

export function PlaybackControls({
  currentFrame,
  totalFrames,
  fps,
  isPlaying,
  setIsPlaying,
  videoEnded,
  playbackRate,
  setPlaybackRate,
  onSeekToFrame,
  disabled = false,
}: PlaybackControlsProps) {
  const stepForward = useCallback(() => {
    setIsPlaying(false);
    onSeekToFrame(Math.min(currentFrame + 1, totalFrames - 1));
  }, [currentFrame, totalFrames, onSeekToFrame, setIsPlaying]);

  const stepBack = useCallback(() => {
    setIsPlaying(false);
    onSeekToFrame(Math.max(currentFrame - 1, 0));
  }, [currentFrame, onSeekToFrame, setIsPlaying]);

  const jumpToStart = () => {
    setIsPlaying(false);
    onSeekToFrame(0);
  };
  const jumpToEnd = () => {
    setIsPlaying(false);
    onSeekToFrame(totalFrames - 1);
  };

  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowLeft', ' '].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowRight') stepForward();
      if (e.key === 'ArrowLeft') stepBack();
      if (e.key === ' ') {
        if (videoEnded) {
          onSeekToFrame(0);
          setIsPlaying(true);
        } else setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    stepForward,
    stepBack,
    setIsPlaying,
    disabled,
    videoEnded,
    onSeekToFrame,
  ]);

  return (
    <>
      <IconBtn onClick={jumpToStart} tooltip="Jump to start">
        <ChevronFirst size={14} />
      </IconBtn>
      <IconBtn
        onClick={stepBack}
        tooltip="Step back (\u2190)"
        disabled={currentFrame === 0}
      >
        <SkipBack size={14} />
      </IconBtn>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              if (videoEnded) {
                onSeekToFrame(0);
                setIsPlaying(true);
              } else setIsPlaying((p) => !p);
            }}
            className={`flex items-center justify-center w-9 h-9 rounded-sm border transition-all duration-150 cursor-pointer active:scale-90
              ${
                isPlaying
                  ? 'bg-sky-500 border-sky-400 text-white shadow-[0_0_12px_rgba(14,165,233,0.4)] dark:bg-sky-600 dark:border-sky-500'
                  : 'bg-zinc-100 border-zinc-400 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 hover:border-zinc-500 dark:bg-zinc-950 dark:border-zinc-600 dark:hover:bg-zinc-800'
              }`}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        </TooltipContent>
      </Tooltip>

      <IconBtn
        onClick={stepForward}
        tooltip="Step forward (\u2192)"
        disabled={currentFrame === totalFrames - 1}
      >
        <SkipForward size={14} />
      </IconBtn>
      <IconBtn onClick={jumpToEnd} tooltip="Jump to end">
        <ChevronLast size={14} />
      </IconBtn>

      <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600 mx-1" />

      <Select
        value={String(playbackRate)}
        onValueChange={(v) => setPlaybackRate(Number(v))}
      >
        <SelectTrigger className="h-7 text-xs px-2 bg-zinc-50 border-zinc-400 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500 dark:bg-zinc-950 dark:border-zinc-600 dark:hover:border-zinc-500 cursor-pointer">
          <Gauge size={12} className="shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SPEED_OPTIONS.map((s) => (
            <SelectItem key={s} value={String(s)} className="text-xs">
              {speedLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
