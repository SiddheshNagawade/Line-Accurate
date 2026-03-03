import { ReactNode } from 'react';

interface ToggleGroupProps {
  children: ReactNode;
  className?: string;
}

export function ToggleGroup({ children, className = '' }: ToggleGroupProps) {
  return (
    <div className={`flex bg-white/5 p-0.5 rounded-lg border border-white/5 ${className}`}>
      {children}
    </div>
  );
}

interface ToggleItemProps {
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
  title?: string;
}

export function ToggleItem({ icon, active, onClick, title }: ToggleItemProps) {
  const activeStyles = active 
    ? 'bg-[#cc8bed] text-white shadow-md' 
    : 'text-white/60 hover:text-white hover:bg-white/5';

  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-md transition-all duration-200 ${activeStyles}`}
      title={title}
    >
      {icon}
    </button>
  );
}
