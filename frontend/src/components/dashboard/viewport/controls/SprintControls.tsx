import { Flag, MapPin, Activity, Eye, EyeOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IconBtn, Separator } from './shared';

interface SprintControlsProps {
  startFrame: number | null;
  proposedStartFrame?: number | null;
  currentFrame: number;
  onSetStartFrame: () => void;
  onClearStartFrame: () => void;
  poseReady?: boolean;
  showCoM?: boolean;
  onToggleCoM?: () => void;
  comEventCount?: number;
  showCoMEvents?: boolean;
  onToggleCoMEvents?: () => void;
  onRecordCoMEvent?: () => void;
  onClearCoMEvents?: () => void;
  disabled?: boolean;
}

export function SprintStartRow({
  startFrame,
  proposedStartFrame = null,
  onSetStartFrame,
  onClearStartFrame,
}: Pick<
  SprintControlsProps,
  'startFrame' | 'proposedStartFrame' | 'onSetStartFrame' | 'onClearStartFrame'
>) {
  return (
    <div className="px-4 pb-0.5 flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={startFrame !== null ? onClearStartFrame : onSetStartFrame}
            className={`flex items-center justify-center w-6 h-6 rounded-sm border transition-all duration-100 shrink-0 cursor-pointer
              ${startFrame !== null
                ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-400'
                : 'border-zinc-400 text-zinc-500 dark:border-zinc-600 hover:border-zinc-500 hover:text-zinc-300'}`}
          >
            <Flag size={12} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {startFrame !== null
            ? `Sprint start: frame ${startFrame} \u2014 click to clear`
            : proposedStartFrame != null
              ? `Override sprint start (proposed: ${proposedStartFrame})`
              : 'Set sprint start (current frame)'}
        </TooltipContent>
      </Tooltip>
      {startFrame !== null ? (
        <>
          <span className="text-[9px] font-mono text-emerald-400 tabular-nums">Frame {startFrame} confirmed</span>
          <button onClick={onClearStartFrame} className="text-[9px] uppercase tracking-widest text-red-500/60 hover:text-red-400 cursor-pointer ml-1">Clear</button>
        </>
      ) : proposedStartFrame != null ? (
        <>
          <span className="text-[9px] font-mono text-amber-400 tabular-nums">Frame {proposedStartFrame} proposed</span>
          <button
            onClick={onSetStartFrame}
            className="text-[9px] uppercase tracking-widest text-emerald-400 hover:text-emerald-300 cursor-pointer border border-emerald-500/40 px-1 rounded-sm"
          >
            Confirm
          </button>
        </>
      ) : (
        <span className="text-[9px] font-mono text-zinc-600 italic">Set sprint start frame</span>
      )}
    </div>
  );
}

export function CoMControls({
  poseReady = false,
  showCoM = true,
  onToggleCoM,
  comEventCount = 0,
  showCoMEvents = true,
  onToggleCoMEvents,
  onRecordCoMEvent,
  onClearCoMEvents,
}: Pick<
  SprintControlsProps,
  | 'poseReady'
  | 'showCoM'
  | 'onToggleCoM'
  | 'comEventCount'
  | 'showCoMEvents'
  | 'onToggleCoMEvents'
  | 'onRecordCoMEvent'
  | 'onClearCoMEvents'
>) {
  if (!poseReady) return null;

  return (
    <>
      <Separator />
      <IconBtn
        onClick={() => onToggleCoM?.()}
        tooltip={showCoM ? 'Hide CoM marker' : 'Show CoM marker'}
        active={showCoM}
      >
        <MapPin size={14} />
      </IconBtn>
      <IconBtn
        onClick={() => onRecordCoMEvent?.()}
        tooltip="Record CoM event at current frame"
      >
        <Activity size={14} />
      </IconBtn>
      {comEventCount > 0 && (
        <>
          <IconBtn
            onClick={() => onToggleCoMEvents?.()}
            tooltip={showCoMEvents ? 'Hide CoM events' : 'Show CoM events'}
            active={showCoMEvents}
          >
            {showCoMEvents ? <Eye size={14} /> : <EyeOff size={14} />}
          </IconBtn>
          <button
            onClick={() => onClearCoMEvents?.()}
            className="text-[9px] uppercase tracking-widest text-red-500/70 hover:text-red-400 transition-colors cursor-pointer px-1"
            title="Clear all CoM events"
          >
            {comEventCount} evt
          </button>
        </>
      )}
    </>
  );
}
