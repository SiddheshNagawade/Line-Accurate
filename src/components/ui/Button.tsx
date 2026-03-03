import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconSize?: number;
  active?: boolean;
  children?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#cc8bed] hover:bg-[#b070d0] text-white shadow-lg hover:shadow-[#cc8bed]/20',
  secondary: 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/5',
  ghost: 'text-white/60 hover:text-white hover:bg-white/10',
  danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300',
  icon: 'text-white/60 hover:text-white hover:bg-white/10',
};

const activeStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#cc8bed] text-white shadow-md',
  secondary: 'bg-white/10 text-white border-white/10',
  ghost: 'bg-white/10 text-white',
  danger: 'bg-red-500/30 text-red-300',
  icon: 'bg-[#cc8bed] text-white shadow-md',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs rounded-md',
  md: 'px-3 py-2 text-sm rounded-lg',
  lg: 'px-4 py-2.5 text-base rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon: Icon, iconSize = 16, active, className = '', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95';
    const variantClass = active ? activeStyles[variant] : variantStyles[variant];
    const sizeClass = variant === 'icon' ? 'p-1.5 rounded-md' : sizeStyles[size];

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantClass} ${sizeClass} ${className}`}
        {...props}
      >
        {Icon && <Icon size={iconSize} />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
