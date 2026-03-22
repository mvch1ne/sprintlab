import { useState, useEffect, useCallback } from 'react';
import { HelpCircle, Search } from 'lucide-react';
import { ThemeToggle } from './primitives/themeToggle';
import { AppLogo } from './primitives/appLogo';
import { HelpModal } from './HelpModal';
import { isHelpDismissed, dismissHelp, undismissHelp } from './helpModalStore';

const Header = () => {
  const [helpOpen, setHelpOpen] = useState(false);
  // showOnStartup = true means the modal WILL appear next time (i.e. not dismissed)
  const [showOnStartup, setShowOnStartup] = useState(!isHelpDismissed());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onFullscreenChange(setIsFullscreen);
  }, []);

  // Auto-open on first visit (when not previously dismissed)
  useEffect(() => {
    if (!isHelpDismissed()) setHelpOpen(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleShowOnStartup = (checked: boolean) => {
    setShowOnStartup(checked);
    if (checked) undismissHelp();
    else dismissHelp();
  };

  const handleClose = () => {
    setHelpOpen(false);
  };

  return (
    <header className="h-10 w-full flex justify-items-start items-center px-3 border border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950">
      <AppLogo />
      <div className="ml-auto flex items-center gap-3">
        {/* Command palette trigger */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          title="Command palette"
        >
          <Search size={13} />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 leading-none">
            Ctrl+K
          </kbd>
        </button>

        {isFullscreen && window.electronAPI && (
          <button
            onClick={() => window.electronAPI!.exitFullscreen()}
            className="text-xs font-mono px-2 py-0.5 rounded border border-zinc-600 text-zinc-400 hover:text-zinc-200 hover:border-zinc-400 transition-colors cursor-pointer"
          >
            Exit Fullscreen · F11
          </button>
        )}
        <button
          onClick={() => setHelpOpen(true)}
          title="Help & getting started"
          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <HelpCircle size={15} />
        </button>
        <ThemeToggle />
      </div>

      <HelpModal
        isOpen={helpOpen}
        onClose={handleClose}
        showOnStartup={showOnStartup}
        onToggleShowOnStartup={handleToggleShowOnStartup}
      />
    </header>
  );
};

export { Header };
