import { useState, useRef, useCallback, useEffect } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Viewport } from '../dashboard/viewport/Viewport';
import { Telemetry } from '../dashboard/telemetry/Telemetry';
import { StatusProvider } from '../dashboard/viewport/StatusBar/StatusContext';
import { VideoProvider } from '../dashboard/VideoContext';
import { PoseProvider } from '../dashboard/PoseContext';
import { UIProvider } from '../dashboard/UIContext';
import { StatusBar } from '../dashboard/viewport/StatusBar/StatusBar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const TELEMETRY_MIN = 260; // px
const TELEMETRY_MAX = 480; // px
const TELEMETRY_DEFAULT = 260; // px
const COLLAPSED_WIDTH = 20; // px — slim strip

export const Dashboard = () => {
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const [telemetryWidth, setTelemetryWidth] = useState(TELEMETRY_DEFAULT);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragStartWidth.current = telemetryWidth;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [telemetryWidth],
  );

  const onDragMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current) return;
    const delta = e.clientX - dragStartX.current;
    const next = Math.max(
      TELEMETRY_MIN,
      Math.min(TELEMETRY_MAX, dragStartWidth.current + delta),
    );
    setTelemetryWidth(next);
  }, []);

  const onDragEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    return () => {
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup', onDragEnd);
    };
  }, [onDragMove, onDragEnd]);

  const currentWidth = telemetryOpen ? telemetryWidth : COLLAPSED_WIDTH;

  return (
    <UIProvider>
    <VideoProvider>
      <PoseProvider>
        <StatusProvider>
          <TooltipProvider delayDuration={400}>
            <div
              ref={containerRef}
              className="flex flex-col h-full w-full overflow-hidden"
            >
              {/* Main content row */}
              <div className="flex flex-1 min-h-0 w-full overflow-hidden">
                {/* Telemetry panel */}
                <div
                  className="flex flex-col shrink-0 h-full overflow-hidden"
                  style={{ width: currentWidth }}
                >
                  {telemetryOpen ? (
                    <>
                      {/* Header */}
                      <div className="h-5 shrink-0 border border-t-0 border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950 flex items-center px-3 gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                        <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 font-sans whitespace-nowrap">
                          Telemetry
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                          <div className="flex gap-1">
                            {[...Array(3)].map((_, i) => (
                              <div
                                key={i}
                                className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600"
                              />
                            ))}
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setTelemetryOpen(false)}
                                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                              >
                                <PanelLeftClose size={11} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Close telemetry</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <Telemetry />
                      </div>
                    </>
                  ) : (
                    /* Collapsed strip */
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setTelemetryOpen(true)}
                          className="h-full w-full flex items-center justify-center border-r border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950 text-zinc-500 hover:text-sky-500 dark:hover:text-sky-400 transition-colors cursor-pointer"
                        >
                          <PanelLeftOpen size={11} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        Open telemetry
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Drag handle — only when open */}
                {telemetryOpen && (
                  <div
                    onPointerDown={onDragStart}
                    className="w-1 shrink-0 h-full relative cursor-col-resize group bg-zinc-400 dark:bg-zinc-600 hover:bg-sky-500 dark:hover:bg-sky-500 transition-colors"
                  >
                    {/* Grab pill */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-zinc-500 dark:bg-zinc-400 group-hover:bg-sky-400 transition-colors" />
                  </div>
                )}

                {/* Viewport — always mounted, takes remaining space */}
                <div className="flex-1 min-w-0 h-full">
                  <Viewport />
                </div>
              </div>
              {/* end main row */}

              {/* Status bar */}
              <StatusBar />
            </div>
          </TooltipProvider>
        </StatusProvider>
      </PoseProvider>
    </VideoProvider>
    </UIProvider>
  );
};
