// ─── Command Palette (Ctrl+K) ───────────────────────────────────────────────
// Searchable action palette powered by cmdk. Reads actions from CommandContext
// plus UIContext/VideoContext for stage navigation and playback.
import { useState, useEffect, useMemo } from 'react';
import { Command } from 'cmdk';
import {
  Play, SkipForward, SkipBack, ChevronsRight, ChevronsLeft,
  Gauge, Crosshair, Ruler, Triangle, Activity, Scissors,
  Flag, RotateCcw, Upload, PanelLeftOpen,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useUI, STAGES, STAGE_ACCENT, type Stage } from './UIContext';
import { useVideoContext } from './VideoContext';
import { useCommands } from './CommandContext';

// ── Action definition ───────────────────────────────────────────────────────
interface Action {
  id: string;
  label: string;
  shortcut?: string;
  icon?: ReactNode;
  group: string;
  enabled: boolean;
  execute: () => void;
}

// ── Shortcut display helper ─────────────────────────────────────────────────
function Kbd({ children }: { children: string }) {
  return (
    <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-600">
      {children}
    </kbd>
  );
}

// ── Stage label map ─────────────────────────────────────────────────────────
const STAGE_LABELS: Record<Stage, string> = {
  import: 'Import', calibrate: 'Calibrate', analyse: 'Analyse',
  measure: 'Measure', report: 'Report',
};

// ── Component ───────────────────────────────────────────────────────────────
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const { stage, setStage, hasVideo } = useUI();
  const { seekToFrame, totalFrames, currentFrame } = useVideoContext();
  const cmds = useCommands();

  // Reset search when opened
  useEffect(() => { if (open) setSearch(''); }, [open]);

  // ── Build action list ───────────────────────────────────────────────────
  const actions: Action[] = useMemo(() => {
    const a: Action[] = [];

    // Stage navigation
    STAGES.forEach((s, i) => {
      a.push({
        id: `stage-${s}`,
        label: `Go to ${STAGE_LABELS[s]}`,
        shortcut: `${i + 1}`,
        group: 'Navigation',
        enabled: s === 'import' || hasVideo,
        execute: () => { setStage(s); onOpenChange(false); },
      });
    });

    // Playback
    const hasFrames = totalFrames > 0;
    a.push({
      id: 'play-pause',
      label: 'Play / Pause',
      shortcut: 'Space',
      icon: <Play size={14} />,
      group: 'Playback',
      enabled: hasFrames,
      execute: () => { cmds.execute('toggle-play'); onOpenChange(false); },
    });
    a.push({
      id: 'step-forward',
      label: 'Step forward',
      shortcut: '→',
      icon: <SkipForward size={14} />,
      group: 'Playback',
      enabled: hasFrames,
      execute: () => { cmds.execute('step-forward'); onOpenChange(false); },
    });
    a.push({
      id: 'step-back',
      label: 'Step backward',
      shortcut: '←',
      icon: <SkipBack size={14} />,
      group: 'Playback',
      enabled: hasFrames,
      execute: () => { cmds.execute('step-back'); onOpenChange(false); },
    });
    a.push({
      id: 'jump-start',
      label: 'Jump to start',
      shortcut: 'Home',
      icon: <ChevronsLeft size={14} />,
      group: 'Playback',
      enabled: hasFrames && !!seekToFrame,
      execute: () => { seekToFrame?.(0); onOpenChange(false); },
    });
    a.push({
      id: 'jump-end',
      label: 'Jump to end',
      shortcut: 'End',
      icon: <ChevronsRight size={14} />,
      group: 'Playback',
      enabled: hasFrames && !!seekToFrame,
      execute: () => { seekToFrame?.(totalFrames - 1); onOpenChange(false); },
    });
    ([
      ['speed-0.25', '0.25×', '1/4 speed'],
      ['speed-0.5', '0.5×', '1/2 speed'],
      ['speed-1', '1×', 'Normal speed'],
      ['speed-2', '2×', '2× speed'],
    ] as const).forEach(([id, label, desc]) => {
      a.push({
        id,
        label: `Set speed: ${desc}`,
        icon: <Gauge size={14} />,
        group: 'Playback',
        enabled: hasFrames,
        execute: () => { cmds.execute(id); onOpenChange(false); },
      });
    });

    // Tools
    a.push({
      id: 'start-calibration',
      label: 'Start calibration',
      shortcut: 'C',
      icon: <Crosshair size={14} />,
      group: 'Tools',
      enabled: hasVideo,
      execute: () => { cmds.execute('start-calibration'); onOpenChange(false); },
    });
    a.push({
      id: 'toggle-distance',
      label: 'Measure distance',
      icon: <Ruler size={14} />,
      group: 'Tools',
      enabled: hasVideo,
      execute: () => { cmds.execute('toggle-distance'); onOpenChange(false); },
    });
    a.push({
      id: 'toggle-angle',
      label: 'Measure angle',
      icon: <Triangle size={14} />,
      group: 'Tools',
      enabled: hasVideo,
      execute: () => { cmds.execute('toggle-angle'); onOpenChange(false); },
    });
    a.push({
      id: 'toggle-pose',
      label: 'Toggle pose analysis',
      shortcut: 'P',
      icon: <Activity size={14} />,
      group: 'Tools',
      enabled: hasVideo,
      execute: () => { cmds.execute('toggle-pose'); onOpenChange(false); },
    });
    a.push({
      id: 'toggle-trim-crop',
      label: 'Toggle trim & crop',
      icon: <Scissors size={14} />,
      group: 'Tools',
      enabled: hasVideo,
      execute: () => { cmds.execute('toggle-trim-crop'); onOpenChange(false); },
    });

    // Sprint
    a.push({
      id: 'set-start-frame',
      label: 'Set start frame (current)',
      icon: <Flag size={14} />,
      group: 'Sprint',
      enabled: hasFrames,
      execute: () => { cmds.execute('set-start-frame'); onOpenChange(false); },
    });
    a.push({
      id: 'clear-start-frame',
      label: 'Clear start frame',
      group: 'Sprint',
      enabled: hasFrames,
      execute: () => { cmds.execute('clear-start-frame'); onOpenChange(false); },
    });
    a.push({
      id: 'reset-sprint',
      label: 'Reset sprint analysis',
      icon: <RotateCcw size={14} />,
      group: 'Sprint',
      enabled: hasVideo,
      execute: () => { cmds.execute('reset-sprint'); onOpenChange(false); },
    });

    // UI
    a.push({
      id: 'toggle-telemetry',
      label: 'Toggle telemetry panel',
      shortcut: 'T',
      icon: <PanelLeftOpen size={14} />,
      group: 'View',
      enabled: true,
      execute: () => { cmds.execute('toggle-telemetry'); onOpenChange(false); },
    });
    a.push({
      id: 'toggle-pose-panel',
      label: 'Toggle pose settings panel',
      group: 'View',
      enabled: hasVideo,
      execute: () => { cmds.execute('toggle-pose-panel'); onOpenChange(false); },
    });
    a.push({
      id: 'toggle-measurement-panel',
      label: 'Toggle measurement panel',
      group: 'View',
      enabled: hasVideo,
      execute: () => { cmds.execute('toggle-measurement-panel'); onOpenChange(false); },
    });
    a.push({
      id: 'upload-video',
      label: 'Upload video',
      icon: <Upload size={14} />,
      group: 'File',
      enabled: true,
      execute: () => { cmds.execute('upload-video'); onOpenChange(false); },
    });

    return a;
  }, [stage, hasVideo, totalFrames, currentFrame, seekToFrame, cmds, setStage, onOpenChange]);

  // ── Group actions ─────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const map = new Map<string, Action[]>();
    for (const a of actions) {
      if (!a.enabled) continue;
      const arr = map.get(a.group) ?? [];
      arr.push(a);
      map.set(a.group, arr);
    }
    return map;
  }, [actions]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-9999">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />

      {/* Palette */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <Command
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
          loop
        >
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command…"
            className="w-full px-4 py-3 text-sm bg-transparent border-b border-zinc-200 dark:border-zinc-700 outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            autoFocus
          />
          <Command.List className="max-h-72 overflow-y-auto p-1.5 scrollbar-thin">
            <Command.Empty className="py-6 text-center text-sm text-zinc-500">
              No results found.
            </Command.Empty>

            {[...groups.entries()].map(([group, items]) => (
              <Command.Group
                key={group}
                heading={group}
                className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-[10px] **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-widest **:[[cmdk-group-heading]]:text-zinc-400 **:[[cmdk-group-heading]]:font-sans"
              >
                {items.map((action) => (
                  <Command.Item
                    key={action.id}
                    value={`${action.group} ${action.label}`}
                    onSelect={action.execute}
                    className="flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-md cursor-pointer text-zinc-700 dark:text-zinc-300 data-[selected=true]:bg-sky-50 dark:data-[selected=true]:bg-sky-950/40 data-[selected=true]:text-sky-600 dark:data-[selected=true]:text-sky-400 transition-colors"
                  >
                    {action.icon && (
                      <span className="shrink-0 w-4 text-zinc-400 dark:text-zinc-500">
                        {action.icon}
                      </span>
                    )}
                    <span className="flex-1 truncate">{action.label}</span>
                    {action.shortcut && <Kbd>{action.shortcut}</Kbd>}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
