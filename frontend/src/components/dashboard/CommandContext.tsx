// ─── Command Registry ───────────────────────────────────────────────────────
// Lightweight registry where any component can publish named callbacks.
// The CommandPalette and keyboard shortcut hook read from this registry.
import { createContext, useContext, useRef, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

type CommandFn = () => void;

interface CommandContextValue {
  /** Register a named action. Returns an unregister function. */
  register: (id: string, fn: CommandFn) => () => void;
  /** Execute a registered action by id. Returns false if not found. */
  execute: (id: string) => boolean;
  /** Get the current callback for an id (or undefined). */
  get: (id: string) => CommandFn | undefined;
}

const CommandContext = createContext<CommandContextValue | null>(null);

export const CommandProvider = ({ children }: { children: ReactNode }) => {
  const registry = useRef(new Map<string, CommandFn>());

  const register = useCallback((id: string, fn: CommandFn) => {
    registry.current.set(id, fn);
    return () => { registry.current.delete(id); };
  }, []);

  const execute = useCallback((id: string) => {
    const fn = registry.current.get(id);
    if (fn) { fn(); return true; }
    return false;
  }, []);

  const get = useCallback((id: string) => registry.current.get(id), []);

  const value = useMemo(() => ({ register, execute, get }), [register, execute, get]);

  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
};

export const useCommands = (): CommandContextValue => {
  const ctx = useContext(CommandContext);
  if (!ctx) throw new Error('useCommands must be used inside CommandProvider');
  return ctx;
};
