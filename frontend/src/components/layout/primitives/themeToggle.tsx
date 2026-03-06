import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const ThemeToggle = () => {
  function handleThemeToggle() {
    const bodyTagClasses = document.body.classList;
    if (bodyTagClasses.contains('dark')) {
      bodyTagClasses.remove('dark');
    } else {
      bodyTagClasses.add('dark');
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleThemeToggle}
          className="flex items-center justify-center w-7 h-7 rounded-sm border border-zinc-400 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 dark:bg-zinc-950 hover:border-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:border-zinc-1000 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-all duration-100 cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
            <path d="M12 3l0 18" />
            <path d="M12 9l4.65 -4.65" />
            <path d="M12 14.3l7.37 -7.37" />
            <path d="M12 19.6l8.85 -8.85" />
          </svg>
        </button>
      </TooltipTrigger>
      <TooltipContent>Change Theme</TooltipContent>
    </Tooltip>
  );
};
