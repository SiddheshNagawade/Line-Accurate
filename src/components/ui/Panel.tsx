import { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  glass?: boolean;
}

export function Panel({ children, className = '', glass = true }: PanelProps) {
  const baseStyles = 'rounded-2xl shadow-lg border border-white/20';
  const glassStyles = glass ? 'glass-panel' : 'bg-[#1e1e1e]';

  return (
    <div className={`${baseStyles} ${glassStyles} ${className}`}>
      {children}
    </div>
  );
}

interface PanelHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PanelHeader({ title, subtitle, actions, className = '' }: PanelHeaderProps) {
  return (
    <div className={`px-4 py-3 border-b border-white/10 flex items-center justify-between ${className}`}>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

interface PanelContentProps {
  children: ReactNode;
  className?: string;
  scrollable?: boolean;
}

export function PanelContent({ children, className = '', scrollable = true }: PanelContentProps) {
  const scrollStyles = scrollable ? 'overflow-y-auto' : '';
  return (
    <div className={`flex-1 ${scrollStyles} ${className}`}>
      {children}
    </div>
  );
}
