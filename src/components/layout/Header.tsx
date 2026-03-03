import { ThemeToggle } from '../misc/themeToggle';

const Header = () => {
  return (
    <header className="min-h-12 mb-2 w-full flex justify-items-start items-center p-3 border-2">
      <div className="mr-auto">PROJECT ZERO</div>
      <ThemeToggle />
    </header>
  );
};

export { Header };
