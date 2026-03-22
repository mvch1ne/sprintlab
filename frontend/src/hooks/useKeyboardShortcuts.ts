// ─── Global Keyboard Shortcuts ──────────────────────────────────────────────
// Listens for key events and dispatches to CommandContext / UIContext.
// Ignores events when an input/textarea/select is focused.
import { useEffect } from 'react';
import { useCommands } from '../components/dashboard/CommandContext';
import { useUI, STAGES } from '../components/dashboard/UIContext';

export function useKeyboardShortcuts(onTogglePalette: () => void) {
  const cmds = useCommands();
  const { setStage, hasVideo } = useUI();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      // Ctrl+K / Cmd+K → command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onTogglePalette();
        return;
      }

      // Don't intercept modified keys (except shift for some)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          cmds.execute('toggle-play');
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            // Jump 10 frames
            cmds.execute('jump-forward-10');
          } else {
            cmds.execute('step-forward');
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            cmds.execute('jump-back-10');
          } else {
            cmds.execute('step-back');
          }
          break;
        case 'Home':
          e.preventDefault();
          cmds.execute('jump-start');
          break;
        case 'End':
          e.preventDefault();
          cmds.execute('jump-end');
          break;
        case '[':
          cmds.execute('speed-down');
          break;
        case ']':
          cmds.execute('speed-up');
          break;
        case 'c':
        case 'C':
          cmds.execute('start-calibration');
          break;
        case 'p':
        case 'P':
          cmds.execute('toggle-pose');
          break;
        case 't':
        case 'T':
          cmds.execute('toggle-telemetry');
          break;
        case '1': case '2': case '3': case '4': case '5': {
          const idx = parseInt(e.key) - 1;
          const s = STAGES[idx];
          if (s && (s === 'import' || hasVideo)) setStage(s);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cmds, setStage, hasVideo, onTogglePalette]);
}
