import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div
      className={cn(
        'flex w-16 h-8 p-1 rounded-full cursor-pointer transition-all duration-300',
        isDark
          ? 'bg-background/80 border border-zinc-700'
          : 'bg-background/80 border border-zinc-300',
        className
      )}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      role="button"
      tabIndex={0}
      aria-label="Toggle theme"
      onKeyDown={(e) => e.key === 'Enter' && setTheme(isDark ? 'light' : 'dark')}
    >
      <div className="flex justify-between items-center w-full">
        <div
          className={cn(
            'flex justify-center items-center w-6 h-6 rounded-full transition-transform duration-300',
            isDark
              ? 'transform translate-x-0 bg-zinc-700'
              : 'transform translate-x-8 bg-zinc-200'
          )}
        >
          {isDark ? (
            <Moon className="w-4 h-4 text-white" strokeWidth={1.5} />
          ) : (
            <Sun className="w-4 h-4 text-gray-700" strokeWidth={1.5} />
          )}
        </div>
        <div
          className={cn(
            'flex justify-center items-center w-6 h-6 rounded-full transition-transform duration-300',
            isDark ? 'bg-transparent' : 'transform -translate-x-8'
          )}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
          ) : (
            <Moon className="w-4 h-4 text-black" strokeWidth={1.5} />
          )}
        </div>
      </div>
    </div>
  );
}
