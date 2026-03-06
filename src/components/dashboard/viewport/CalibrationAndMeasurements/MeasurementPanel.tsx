import { Trash2, Ruler, X, Eye, EyeOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { Measurement } from './MeasurementOverlay';

interface Props {
  measurements: Measurement[];
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onToggleVisible: (id: string) => void;
  onToggleAllVisible: () => void;
  onToggleSectionVisible: (type: 'distance' | 'angle') => void;
  onDeleteSection: (type: 'distance' | 'angle') => void;
  onClose: () => void;
}

function SectionHeader({
  label,
  icon,
  count,
  allVisible,
  onToggleAll,
  onDeleteAll,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  allVisible: boolean;
  onToggleAll: () => void;
  onDeleteAll: () => void;
}) {
  return (
    <div className="flex items-center px-3 py-1 gap-2 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-300 dark:border-zinc-700">
      <span className="text-[10px] shrink-0">{icon}</span>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 flex-1">
        {label}
      </span>
      {count > 0 && (
        <span className="text-[9px] tabular-nums text-zinc-500">({count})</span>
      )}
      {count > 0 && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleAll}
                className="text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                {allVisible ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {allVisible ? 'Hide all' : 'Show all'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onDeleteAll}
                className="text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 size={10} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Clear section</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}

function MeasurementRow({
  m,
  index,
  onToggleVisible,
  onDelete,
}: {
  m: Measurement;
  index: number;
  onToggleVisible: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-center px-3 py-1.5 gap-2 group hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors ${!m.visible ? 'opacity-40' : ''}`}
    >
      <span className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-600 w-4 shrink-0">
        {String(index + 1).padStart(2, '0')}
      </span>

      {m.type === 'distance' && m.meters !== undefined ? (
        <span className="text-xs text-sky-600 dark:text-sky-300 tabular-nums font-mono flex-1">
          {m.meters.toFixed(3)}
          <span className="text-[9px] text-zinc-500 ml-1">m</span>
          <span className="text-[9px] text-zinc-500 ml-2">
            {(m.meters * 100).toFixed(1)}cm
          </span>
        </span>
      ) : (
        <span className="text-xs text-violet-400 tabular-nums font-mono flex-1">
          {m.degrees?.toFixed(1)}
          <span className="text-[9px] text-zinc-500 ml-1">°</span>
        </span>
      )}

      <button
        onClick={onToggleVisible}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-200 cursor-pointer shrink-0"
      >
        {m.visible ? <Eye size={11} /> : <EyeOff size={11} />}
      </button>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-red-400 cursor-pointer shrink-0"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

export const MeasurementPanel = ({
  measurements,
  onDelete,
  onDeleteAll,
  onToggleVisible,
  onToggleAllVisible,
  onToggleSectionVisible,
  onDeleteSection,
  onClose,
}: Props) => {
  const distances = measurements.filter((m) => m.type === 'distance');
  const angles = measurements.filter((m) => m.type === 'angle');

  const allDistVisible =
    distances.length > 0 && distances.every((m) => m.visible);
  const allAngVisible = angles.length > 0 && angles.every((m) => m.visible);

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className="flex flex-col h-full bg-white dark:bg-zinc-950"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-5 shrink-0 border-b border-zinc-400 dark:border-zinc-600 flex items-center px-3 gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
            Measurements
          </span>
          {measurements.length > 0 && (
            <span className="text-[9px] tabular-nums text-zinc-500">
              ({measurements.length})
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {measurements.length > 0 && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onToggleAllVisible}
                      className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      {measurements.every((m) => m.visible) ? (
                        <Eye size={10} />
                      ) : (
                        <EyeOff size={10} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle all visibility</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onDeleteAll}
                      className="text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 size={10} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Clear all</TooltipContent>
                </Tooltip>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onClose}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  <X size={10} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Close panel</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Lists */}
        <div className="flex-1 overflow-y-auto">
          {measurements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
              <Ruler size={14} className="text-zinc-500" />
              <span className="text-[9px] uppercase tracking-widest text-zinc-500">
                No measurements
              </span>
            </div>
          ) : (
            <>
              {/* Distances section */}
              <SectionHeader
                label="Distances"
                icon={<span className="text-sky-500">⟷</span>}
                count={distances.length}
                allVisible={allDistVisible}
                onToggleAll={() => onToggleSectionVisible('distance')}
                onDeleteAll={() => onDeleteSection('distance')}
              />
              {distances.length === 0 ? (
                <div className="px-3 py-2 text-[9px] text-zinc-600 italic">
                  None yet
                </div>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {distances.map((m, i) => (
                    <MeasurementRow
                      key={m.id}
                      m={m}
                      index={i}
                      onToggleVisible={() => onToggleVisible(m.id)}
                      onDelete={() => onDelete(m.id)}
                    />
                  ))}
                </div>
              )}

              {/* Angles section */}
              <SectionHeader
                label="Angles"
                icon={<span className="text-violet-400">∠</span>}
                count={angles.length}
                allVisible={allAngVisible}
                onToggleAll={() => onToggleSectionVisible('angle')}
                onDeleteAll={() => onDeleteSection('angle')}
              />
              {angles.length === 0 ? (
                <div className="px-3 py-2 text-[9px] text-zinc-600 italic">
                  None yet
                </div>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {angles.map((m, i) => (
                    <MeasurementRow
                      key={m.id}
                      m={m}
                      index={i}
                      onToggleVisible={() => onToggleVisible(m.id)}
                      onDelete={() => onDelete(m.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};
