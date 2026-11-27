import React, { useEffect } from 'react';
import { LucideIcon, Menu, X, AlertCircle, Loader2, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from './LayoutContext';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  showTenant?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  badge,
  actions,
  showTenant = true,
}) => {
  const { user } = useAuth();
  const { toggleMobileSidebar } = useLayout();

  return (
    <header className="h-14 border-b border-border px-4 sm:px-6 flex items-center justify-between shrink-0 bg-surface/90 backdrop-blur-sm z-20 transition-colors">
      <div className="flex items-center space-x-3 min-w-0">
        <button
          type="button"
          onClick={toggleMobileSidebar}
          className="lg:hidden p-1.5 rounded-md border border-border bg-subtle text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu size={16} strokeWidth={1.75} />
        </button>

        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Icon size={16} strokeWidth={1.75} />
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-semibold text-text-primary tracking-tight truncate">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-[11px] text-text-muted truncate hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2.5 shrink-0">
        {actions}
        {showTenant && user && (
          <div className="hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-subtle border border-border text-[11px] font-mono text-text-muted">
            <Building2 size={12} strokeWidth={1.75} className="text-indigo-500" />
            <span className="text-text-primary font-medium">{user.org_name}</span>
          </div>
        )}
      </div>
    </header>
  );
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) => {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes = {
    sm: 'text-xs px-2.5 py-1.5',
    md: 'text-xs px-3.5 py-2',
  };
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs',
    secondary: 'bg-subtle hover:bg-elevated text-text-primary border border-border',
    ghost: 'text-text-muted hover:text-text-primary hover:bg-subtle',
    danger: 'bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-500/30',
    success: 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {isLoading && <Loader2 size={13} className="animate-spin" strokeWidth={1.75} />}
      {children}
    </button>
  );
};

interface BadgeProps {
  tone?: 'neutral' | 'indigo' | 'sky' | 'emerald' | 'amber' | 'rose';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', children, className = '' }) => {
  const tones = {
    neutral: 'bg-subtle text-text-muted border-border',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  maxWidth?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  maxWidth = 'max-w-lg',
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${maxWidth} rounded-xl bg-surface border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center space-x-2.5 min-w-0">
            {Icon && (
              <div className="w-7 h-7 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Icon size={14} strokeWidth={1.75} />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-primary truncate">{title}</h3>
              {subtitle && <p className="text-[11px] text-text-muted truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-subtle transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, description, action }) => (
  <div className="py-12 px-6 text-center rounded-xl border border-dashed border-border bg-surface/60 flex flex-col items-center justify-center space-y-2.5">
    <div className="w-10 h-10 rounded-lg bg-subtle border border-border flex items-center justify-center text-text-muted">
      <Icon size={18} strokeWidth={1.75} />
    </div>
    <div className="space-y-1 max-w-sm">
      <p className="text-xs font-semibold text-text-primary">{title}</p>
      <p className="text-[11px] text-text-muted leading-relaxed">{description}</p>
    </div>
    {action && <div className="pt-1">{action}</div>}
  </div>
);

export const ErrorBanner: React.FC<{
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}> = ({ message, onRetry, onDismiss }) => (
  <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-3">
    <div className="flex items-center space-x-2 min-w-0">
      <AlertCircle size={15} className="shrink-0" strokeWidth={1.75} />
      <span className="break-words">{message}</span>
    </div>
    <div className="flex items-center space-x-2 shrink-0">
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-mono text-[11px] underline hover:opacity-80 cursor-pointer"
        >
          Retry
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-0.5 rounded hover:bg-rose-500/15 cursor-pointer"
          aria-label="Dismiss error"
        >
          <X size={13} />
        </button>
      )}
    </div>
  </div>
);

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading workspace data...' }) => (
  <div className="py-16 flex flex-col items-center justify-center space-y-2.5 text-text-muted">
    <Loader2 size={20} className="animate-spin text-indigo-500" strokeWidth={1.75} />
    <span className="text-xs font-mono">{label}</span>
  </div>
);
