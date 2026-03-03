interface AvatarProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

export function Avatar({ name = 'User', size = 'sm', className = '' }: AvatarProps) {
  const initial = name.slice(0, 1).toUpperCase();
  
  return (
    <span className={`${sizeStyles[size]} rounded-full bg-white/10 flex items-center justify-center font-semibold ${className}`}>
      {initial}
    </span>
  );
}
