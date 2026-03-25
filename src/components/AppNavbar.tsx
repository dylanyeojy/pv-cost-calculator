import { Calculator, Settings } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { ThemeToggle } from './ThemeToggle';

const navItems = [
  { title: 'New Estimate', url: '/' },
  { title: 'History', url: '/history' },
  { title: 'Settings', url: '/settings' },
];

export function AppNavbar() {
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Theme toggle — right */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
