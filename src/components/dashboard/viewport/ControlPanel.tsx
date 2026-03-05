import { useEffect, useRef, useCallback, useState } from 'react';
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
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 4];

interface ControlPanelProps {
  currentFrame: number;
  setCurrentFrame: (frame: number | ((f: number) => number)) => void;
  totalFrames: number;
  fps: number;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean | ((p: boolean) => boolean)) => void;
  disabled?: boolean;
}

function IconBtn({
  onClick,
  tooltip,
  children,
  active = false,
  disabled = false,
}: {
  onClick: () => void;
  tooltip: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={`
            flex items-center justify-center w-7 h-7 rounded-sm
            border transition-all duration-100 select-none
            ${
              disabled
                ? 'opacity-25 cursor-not-allowed border-transparent'
                : active
                  ? 'bg-sky-600/20 border-sky-500/60 text-sky-400 cursor-pointer'
                  : 'border-zinc-400 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-950 dark:hover:border-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer'
            }
          `}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <span className="text-xs text-sky-600 dark:text-sky-300 tabular-nums leading-none">
        {value}
      </span>
    </div>
  );
}

export function ControlPanel({
  currentFrame,
  setCurrentFrame,
  totalFrames,
  fps,
  isPlaying,
  setIsPlaying,
  disabled = false,
}: ControlPanelProps) {
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const frameToTimecode = (frame: number) => {
    const totalSecs = frame / (fps || 30);
    const mins = Math.floor(totalSecs / 60)
      .toString()
      .padStart(2, '0');
    const secs = Math.floor(totalSecs % 60)
      .toString()
      .padStart(2, '0');
    const frames = (frame % (fps || 30)).toString().padStart(2, '0');
    return `${mins}:${secs}:${frames}`;
  };

  const stepForward = useCallback(() => {
    setCurrentFrame((f) => Math.min(f + 1, totalFrames - 1));
  }, [setCurrentFrame, totalFrames]);

  const stepBack = useCallback(() => {
    setCurrentFrame((f) => Math.max(f - 1, 0));
  }, [setCurrentFrame]);

  const jumpToStart = () => {
    setCurrentFrame(0);
    setIsPlaying(false);
  };
  const jumpToEnd = () => {
    setCurrentFrame(totalFrames - 1);
    setIsPlaying(false);
  };

  // Keyboard controls
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowLeft', ' '].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowRight') {
        setIsPlaying(false);
        stepForward();
      }
      if (e.key === 'ArrowLeft') {
        setIsPlaying(false);
        stepBack();
      }
      if (e.key === ' ') {
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepForward, stepBack, setIsPlaying, disabled]);

  // Playback loop
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPlaying && !disabled) {
      const ms = 1000 / (fps || 30) / speed;
      intervalRef.current = setInterval(() => {
        setCurrentFrame((f) => {
          if (f >= totalFrames - 1) {
            setIsPlaying(false);
            return f;
          }
          return f + 1;
        });
      }, ms);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [
    isPlaying,
    fps,
    speed,
    totalFrames,
    setCurrentFrame,
    setIsPlaying,
    disabled,
  ]);

  const progress =
    totalFrames > 1 ? (currentFrame / (totalFrames - 1)) * 100 : 0;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    setCurrentFrame(Math.round(ratio * (totalFrames - 1)));
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className={`ControlPanelContainer h-full w-full flex flex-col bg-white dark:bg-zinc-950 dark:text-zinc-200 transition-opacity ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      >
        {/* Top label bar */}
        <div className="TopBar h-5 shrink-0 border border-b-0 border-zinc-400 dark:border-zinc-600 flex items-center px-3 gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
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

        {/* Main controls */}
        <div className="MainControls flex-1 border border-t-0 border-zinc-400 dark:border-zinc-600 flex flex-col overflow-hidden">
          {/* Scrubber */}
          <div className="ScrubberSection px-4 pt-3 pb-1">
            <div
              className="relative h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full cursor-pointer group"
              onClick={handleScrub}
            >
              <div
                className="absolute left-0 top-0 h-full bg-sky-500 dark:bg-sky-600 rounded-full transition-none"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-sky-500 border-2 border-white dark:bg-sky-400 dark:border-zinc-950 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
              {Array.from({ length: 25 }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-full mt-0.5 w-px h-1 bg-zinc-300 dark:bg-zinc-600"
                  style={{ left: `${(i / 24) * 100}%` }}
                />
              ))}
            </div>
          </div>

          {/* Timecode readouts */}
          <div className="ReadoutsRow flex justify-between items-center px-4 pt-2 pb-1">
            <Readout
              label="Frame"
              value={`${currentFrame} / ${totalFrames > 0 ? totalFrames - 1 : 0}`}
            />
            <Readout label="Timecode" value={frameToTimecode(currentFrame)} />
            <Readout
              label="Duration"
              value={
                totalFrames > 0 ? frameToTimecode(totalFrames - 1) : '00:00:00'
              }
            />
            <Readout label="FPS" value={`${(fps || 30) * speed}`} />
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-zinc-400 dark:border-zinc-600/60" />

          {/* Transport controls */}
          <div className="ControlInputSection flex flex-1 items-center px-4 gap-2 flex-wrap">
            <IconBtn onClick={jumpToStart} tooltip="Jump to start">
              <ChevronFirst size={14} />
            </IconBtn>
            <IconBtn
              onClick={() => {
                setIsPlaying(false);
                stepBack();
              }}
              tooltip="Step back (←)"
              disabled={currentFrame === 0}
            >
              <SkipBack size={14} />
            </IconBtn>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  className={`
                    flex items-center justify-center w-9 h-9 rounded-sm
                    border transition-all duration-150 cursor-pointer
                    ${
                      isPlaying
                        ? 'bg-sky-500 border-sky-400 text-white shadow-[0_0_12px_rgba(14,165,233,0.4)] dark:bg-sky-600 dark:border-sky-500'
                        : 'bg-zinc-100 border-zinc-400 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 hover:border-zinc-500 dark:bg-zinc-950 dark:border-zinc-600 dark:hover:bg-zinc-800'
                    }
                  `}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              </TooltipContent>
            </Tooltip>

            <IconBtn
              onClick={() => {
                setIsPlaying(false);
                stepForward();
              }}
              tooltip="Step forward (→)"
              disabled={currentFrame === totalFrames - 1}
            >
              <SkipForward size={14} />
            </IconBtn>
            <IconBtn onClick={jumpToEnd} tooltip="Jump to end">
              <ChevronLast size={14} />
            </IconBtn>

            <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600 mx-1" />

            <Select
              value={String(speed)}
              onValueChange={(v) => setSpeed(Number(v))}
            >
              <SelectTrigger className="h-7 w-20 text-xs px-2 bg-zinc-50 border-zinc-400 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500 dark:bg-zinc-950 dark:border-zinc-600 dark:hover:border-zinc-500 cursor-pointer">
                <Gauge size={12} className="shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEED_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)} className="text-xs">
                    {s}×
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center gap-2">
              {[
                ['←→', 'step'],
                ['Space', 'play'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className="text-[9px] px-1 py-0.5 bg-zinc-100 border border-zinc-400 dark:bg-zinc-950 dark:border-zinc-600 rounded-sm text-zinc-700 dark:text-zinc-300 leading-none">
                    {key}
                  </span>
                  <span className="text-[9px] text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
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
