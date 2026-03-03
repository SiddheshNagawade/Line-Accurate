import { ReactNode } from 'react';

interface ListItemProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

export function ListItem({ active, onClick, children, className = '' }: ListItemProps) {
  const activeStyles = active 
    ? 'bg-[#cc8bed]/20 border-[#cc8bed]/30 shadow-[0_0_15px_-5px_rgba(204,139,237,0.3)]'
    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10';

  return (
    <div
      onClick={onClick}
      className={`group relative p-3 rounded-xl border transition-all duration-200 cursor-pointer ${activeStyles} ${className}`}
    >
      {children}
    </div>
  );
}

interface IconHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function IconHeader({ icon, title, subtitle, actions }: IconHeaderProps) {
  return (
    <div className="p-5 border-b border-white/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#cc8bed]/20 rounded-lg text-[#cc8bed]">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-lg tracking-wide">{title}</h3>
            {subtitle && <p className="text-xs text-white/40">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

interface InputGroupProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  buttonIcon: ReactNode;
  buttonDisabled?: boolean;
  buttonTitle?: string;
}

export function InputGroup({ placeholder, value, onChange, onSubmit, buttonIcon, buttonDisabled, buttonTitle }: InputGroupProps) {
  return (
    <div className="p-4 border-b border-white/10 bg-white/5">
      <div className="flex space-x-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-[#cc8bed]/50 focus:ring-1 focus:ring-[#cc8bed]/50 placeholder-white/30 transition-all"
          onKeyPress={(e) => e.key === 'Enter' && !buttonDisabled && onSubmit()}
        />
        <button
          onClick={onSubmit}
          disabled={buttonDisabled}
          className="px-4 py-2.5 bg-[#cc8bed] hover:bg-[#b070d0] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-200 text-white shadow-lg hover:shadow-[#cc8bed]/20 active:scale-95"
          title={buttonTitle}
        >
          {buttonIcon}
        </button>
      </div>
    </div>
  );
}
