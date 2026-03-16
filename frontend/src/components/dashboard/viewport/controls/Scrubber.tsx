interface ScrubberProps {
  currentFrame: number;
  totalFrames: number;
  startFrame: number | null;
  proposedStartFrame?: number | null;
  onSeekToFrame: (frame: number) => void;
  disabled?: boolean;
}

export function Scrubber({
  currentFrame,
  totalFrames,
  startFrame,
  proposedStartFrame = null,
  onSeekToFrame,
  disabled = false,
}: ScrubberProps) {
  const progress =
    totalFrames > 1 ? (currentFrame / (totalFrames - 1)) * 100 : 0;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    onSeekToFrame(Math.round(ratio * (totalFrames - 1)));
  };

  return (
    <div className="ScrubberSection px-4 pt-2 pb-1">
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
        {startFrame !== null && totalFrames > 1 && (
          <div
            className="-top-1 -bottom-1 absolute w-px bg-orange-400"
            style={{ left: `${(startFrame / (totalFrames - 1)) * 100}%` }}
          />
        )}
        {proposedStartFrame !== null && proposedStartFrame !== startFrame && totalFrames > 1 && (
          <div
            className="-top-1 -bottom-1 absolute w-px border-l border-dashed border-emerald-500/60"
            style={{ left: `${(proposedStartFrame / (totalFrames - 1)) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}
