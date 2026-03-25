import { useState, useRef, useEffect } from 'react';
import { Calculator, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/lib/auth';

const navItems = [
  { title: 'New Estimate', url: '/' },
  { title: 'History', url: '/history' },
  { title: 'Settings', url: '/settings' },
];

export function AppNavbar() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0].toUpperCase() ?? '?';

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 no-print">
      <div className="backdrop-blur-md bg-background/80 border-b border-border/60">
        <div className="relative flex h-16 items-center px-4 md:px-6">

          {/* Logo — left */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-sm shrink-0">
              <Calculator className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="hidden md:block text-base font-bold text-foreground tracking-tight whitespace-nowrap">
              Pressure Vessel Costing Calculator
            </span>
            <span className="block md:hidden text-sm font-bold text-foreground tracking-tight">
              PVCC
            </span>
          </div>

          {/* Nav links — absolutely centered */}
          <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                end={item.url === '/'}
                className="px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent/40 transition-colors whitespace-nowrap"
                activeClassName="text-primary hover:text-primary bg-primary/10 hover:bg-primary/15"
              >
                {item.title}
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* User avatar + dropdown */}
            {user && (
              <div className="relative ml-1" ref={menuRef}>
                <button
                  onClick={() => setOpen(o => !o)}
                  className="h-8 w-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary select-none hover:bg-primary/25 transition-colors"
                >
                  {initials}
                </button>

                {open && (
                  <div className="absolute right-0 mt-2 w-52 rounded-lg border border-border bg-card shadow-lg py-1 z-50">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { setOpen(false); signOut(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent/40 transition-colors"
                    >
                      <LogOut className="h-4 w-4 text-muted-foreground" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
