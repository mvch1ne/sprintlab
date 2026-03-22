import { useEffect, useState } from 'react';
import { useStatus } from './StatusContext';

let blinkInjected = false;
function injectBlink() {
  if (blinkInjected || typeof document === 'undefined') return;
  blinkInjected = true;
  const s = document.createElement('style');
  s.textContent = `@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`;
  document.head.appendChild(s);
}

const Cursor = () => (
  <span className="inline-block w-1.25 h-2.25 bg-sky-400 ml-0.5 align-middle animate-[blink_1s_step-end_infinite]" />
);

const accentClass: Record<string, string> = {
  default: 'text-zinc-500 dark:text-zinc-300',
  sky: 'text-sky-500 dark:text-sky-400',
  emerald: 'text-emerald-400 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
};

export const StatusBar = () => {
  injectBlink();
  const { segments } = useStatus();
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <footer
      className="
      h-5 shrink-0 w-full
      border-t border-zinc-300 dark:border-zinc-700
      bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm
      flex items-center
      px-3 gap-0
      font-mono text-[11px] tracking-wider
      select-none overflow-hidden
    "
    >
      <span className="text-zinc-400 dark:text-zinc-600 uppercase mr-3 shrink-0">
        SprintLab
      </span>
      <span className="text-zinc-300 dark:text-zinc-700 mr-3 shrink-0">·</span>

      <div className="flex items-center gap-0 flex-1 min-w-0 overflow-hidden">
        {segments.length === 0 ? (
          <span className="text-zinc-400 dark:text-zinc-600 uppercase">
            Ready
            <Cursor />
          </span>
        ) : (
          segments.map((seg, i) => (
            <div key={seg.id} className="flex items-center shrink-0">
              {i > 0 && (
                <span className="text-zinc-300 dark:text-zinc-700 mx-2">·</span>
              )}
              <span className="text-zinc-400 dark:text-zinc-500 uppercase mr-1.5">
                {seg.label}
              </span>
              <span
                className={`uppercase ${accentClass[seg.accent ?? 'default']}`}
              >
                {seg.value}
              </span>
              {seg.pulse && (
                <span className="ml-1.5 w-1 h-1 rounded-full bg-sky-400 inline-block animate-pulse" />
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <span className="text-zinc-400 dark:text-zinc-500 tabular-nums">
          {timeStr}
        </span>
      </div>
    </footer>
  );
};
