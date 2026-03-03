interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Divider({ orientation = 'horizontal', className = '' }: DividerProps) {
  const styles = orientation === 'horizontal' 
    ? 'h-px w-full bg-white/10' 
    : 'w-px h-5 bg-white/10';
  
  return <div className={`${styles} ${className}`} />;
}
