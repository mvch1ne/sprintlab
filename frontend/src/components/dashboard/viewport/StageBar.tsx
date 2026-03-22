// Horizontal workflow stage tabs with completion indicators.
// Sits at the top of the ControlPanel area.
import { Upload, Ruler, ScanLine, Crosshair, FileBarChart, Check } from 'lucide-react';
import { STAGES, useUI } from '../UIContext';
import type { Stage } from '../UIContext';

const STAGE_META: Record<Stage, { label: string; icon: React.ReactNode }> = {
  import:    { label: 'Import',    icon: <Upload size={12} /> },
  calibrate: { label: 'Calibrate', icon: <Ruler size={12} /> },
  analyse:   { label: 'Analyse',   icon: <ScanLine size={12} /> },
  measure:   { label: 'Measure',   icon: <Crosshair size={12} /> },
  report:    { label: 'Report',    icon: <FileBarChart size={12} /> },
};

export function StageBar() {
  const { stage, setStage, completion, hasVideo } = useUI();

  return (
    <div className="StageBar h-7 shrink-0 border border-b-0 border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950 flex items-stretch">
      {STAGES.map((s, i) => {
        const meta = STAGE_META[s];
        const active = s === stage;
        const done = completion[s];
        // Import tab is always reachable. Others require a loaded video.
        const reachable = s === 'import' || hasVideo;

        return (
          <button
            key={s}
            onClick={() => reachable && setStage(s)}
            disabled={!reachable}
            className={`
              group relative flex items-center gap-1.5 px-3 text-[10px] uppercase tracking-[0.15em] font-sans transition-colors cursor-pointer
              border-r border-zinc-300 dark:border-zinc-700 last:border-r-0
              ${active
                ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                : reachable
                  ? 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                  : 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
              }
            `}
          >
            {/* Step number / completion indicator */}
            <span
              className={`
                flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-mono leading-none shrink-0 transition-colors
                ${done
                  ? 'bg-emerald-500/20 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : active
                    ? 'bg-sky-500/20 text-sky-500'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                }
              `}
            >
              {done ? <Check size={9} strokeWidth={3} /> : i + 1}
            </span>

            {/* Icon + label */}
            <span className="flex items-center gap-1">
              {meta.icon}
              {meta.label}
            </span>

            {/* Active indicator bar */}
            {active && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-sky-500 rounded-t-full" />
            )}
          </button>
        );
      })}

      {/* Right-aligned hints */}
      <div className="ml-auto flex items-center gap-2 px-3">
        {[
          ['\u2190\u2192', 'step'],
          ['Space', 'play'],
        ].map(([key, label]) => (
          <div key={key} className="flex items-center gap-1">
            <span className="text-[10px] px-1 py-0.5 bg-zinc-100 border border-zinc-400 dark:bg-zinc-950 dark:border-zinc-600 rounded-sm text-zinc-700 dark:text-zinc-300 leading-none">
              {key}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
