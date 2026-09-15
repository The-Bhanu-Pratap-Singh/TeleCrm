import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.tsx';

interface ThemeToggleProps {
  variant?: 'sidebar' | 'compact' | 'icon';
  className?: string;
}

export default function ThemeToggle({ variant = 'sidebar', className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme, setTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        onClick={toggleTheme}
        className={`p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-zinc-300" />
        )}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={toggleTheme}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
          theme === 'dark'
            ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
            : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
        } ${className}`}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          <>
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Light mode</span>
          </>
        ) : (
          <>
            <Moon className="w-3.5 h-3.5 text-indigo-500" />
            <span>Dark mode</span>
          </>
        )}
      </button>
    );
  }

  // Default 'sidebar' variant: Segregated switch pill with intuitive icons & active states
  return (
    <div
      className={`px-3 py-2 bg-zinc-800/80 dark:bg-zinc-900/90 rounded-xl border border-zinc-700/60 dark:border-zinc-800 flex items-center justify-between shadow-2xs ${className}`}
    >
      <div className="flex items-center gap-2">
        {theme === 'dark' ? (
          <Moon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        ) : (
          <Sun className="w-4 h-4 text-amber-400 flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-zinc-200">Theme</span>
      </div>

      <div className="flex items-center bg-zinc-900/90 dark:bg-zinc-950 p-0.5 rounded-lg border border-zinc-700/40 dark:border-zinc-800/80">
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
            theme === 'light'
              ? 'bg-zinc-700 text-amber-300 shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Light Theme"
          aria-label="Light Theme"
        >
          <Sun className="w-3 h-3 text-amber-400" />
          <span>Light</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
            theme === 'dark'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Dark Theme"
          aria-label="Dark Theme"
        >
          <Moon className="w-3 h-3 text-indigo-200" />
          <span>Dark</span>
        </button>
      </div>
    </div>
  );
}
