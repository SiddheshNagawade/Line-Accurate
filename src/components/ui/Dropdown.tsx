import { ReactNode, useRef, useEffect } from 'react';
import { LucideIcon } from 'lucide-react';

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ isOpen, onClose, trigger, children, align = 'right', className = '' }: DropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const alignStyles = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div className="relative" ref={dropdownRef}>
      {trigger}
      {isOpen && (
        <div className={`absolute ${alignStyles} mt-2 w-48 glass-panel rounded-xl shadow-2xl border border-white/20 overflow-hidden z-50 ${className}`}>
          {children}
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  icon?: LucideIcon;
  iconSize?: number;
  onClick: () => void;
  children: ReactNode;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export function DropdownItem({ 
  icon: Icon, 
  iconSize = 16, 
  onClick, 
  children, 
  variant = 'default',
  disabled = false 
}: DropdownItemProps) {
  const variantStyles = variant === 'danger' 
    ? 'text-red-400 hover:text-red-300' 
    : 'text-white/80 hover:text-white';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${variantStyles} hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {Icon && <Icon size={iconSize} />}
      <span>{children}</span>
    </button>
  );
}

export function DropdownDivider() {
  return <div className="h-px bg-white/10" />;
}
