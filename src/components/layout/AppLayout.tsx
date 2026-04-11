import { ReactNode } from 'react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div 
      className="h-screen w-screen flex flex-col bg-[#f0f0f0] overflow-hidden" 
      style={{
        paddingTop: 'max(0px, env(safe-area-inset-top))',
        paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0px, env(safe-area-inset-left))',
        paddingRight: 'max(0px, env(safe-area-inset-right))',
      }}
    >
      {children}
    </div>
  );
}

interface AppHeaderProps {
  children: ReactNode;
}

export function AppHeader({ children }: AppHeaderProps) {
  return (
    <header className="shrink-0 z-30">
      <div className="glass-panel rounded-b-2xl px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between shadow-lg border-b border-x border-white/20">
        {children}
      </div>
    </header>
  );
}

interface AppMainProps {
  children: ReactNode;
}

export function AppMain({ children }: AppMainProps) {
  return (
    <div className="flex-1 flex min-h-0 px-1 sm:px-2 py-1 sm:py-2 gap-1.5 sm:gap-2 relative overflow-hidden">
      {children}
    </div>
  );
}

interface LogoProps {
  title?: string;
  subtitle?: string;
}

export function Logo({ title = 'LineAccurate', subtitle }: LogoProps) {
  return (
    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
      <div className="w-6 h-6 sm:w-7 sm:h-7 bg-[#cc8bed] rounded-md flex items-center justify-center shadow-lg shadow-[#cc8bed]/30 shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
      </div>
      <div className="min-w-0">
        <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">{title}</h1>
        {subtitle && (
          <div className="hidden sm:flex items-center space-x-2 text-[9px] text-white/50 font-medium uppercase tracking-wider">
            <span>{subtitle}</span>
          </div>
        )}
      </div>
    </div>
  );
}
