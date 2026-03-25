import { ReactNode } from 'react';
import { AppNavbar } from './AppNavbar';
import { AnimatedBackground } from './AnimatedBackground';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative">
      <AnimatedBackground />
      <AppNavbar />
      <main className="flex-1 relative z-10">
        {children}
      </main>
    </div>
  );
}
