import { ThemeToggle } from './primitives/themeToggle';
import { AppLogo } from './primitives/appLogo';

const Header = () => {
  return (
    <header className="h-10 w-full flex justify-items-start items-center px-3 border border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950">
      <AppLogo />
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
};

export { Header };
