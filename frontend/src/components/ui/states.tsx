import { CircleAlert, Loader2, RefreshCw, Search, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/format'
import { Button } from './button'

/* -------------------------------------------------------------------------- */
/* EmptyState — never leave a blank white panel                                */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  variant = 'default',
  className,
  children,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  primaryAction?: { label: string; onClick: () => void; icon?: ReactNode }
  secondaryAction?: { label: string; onClick: () => void }
  variant?: 'default' | 'bordered' | 'inline'
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 text-center',
        variant === 'inline' ? 'py-6' : 'py-12',
        variant === 'bordered' && 'rounded-lg border border-dashed border-line-strong bg-surface-muted/40',
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            'mb-3 grid place-items-center rounded-lg border border-line bg-surface text-ink-400 shadow-xs',
            variant === 'inline' ? 'size-8 [&_svg]:size-4' : 'size-10 [&_svg]:size-[18px]',
          )}
        >
          <Icon aria-hidden />
        </span>
      )}
      <p className={cn('font-semibold text-ink-800', variant === 'inline' ? 'text-body' : 'text-h3')}>{title}</p>
      {description && (
        <p className={cn('mt-1 text-ink-500', variant === 'inline' ? 'max-w-md text-caption' : 'max-w-sm text-body-sm')}>
          {description}
        </p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {primaryAction && (
            <Button variant="primary" size="sm" onClick={primaryAction.onClick} iconLeft={primaryAction.icon}>
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="secondary" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

export function NoResultsState({
  query,
  onClear,
  label = 'No results',
}: {
  query?: string
  onClear?: () => void
  label?: string
}) {
  return (
    <EmptyState
      variant="inline"
      icon={Search}
      title={query ? `${label} for “${query}”` : label}
      description="Try a different search term, or clear the filters to see everything in this view."
      secondaryAction={onClear ? { label: 'Clear filters', onClick: onClear } : undefined}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* LoadingState — contextual skeletons, not generic spinners                   */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-sm bg-surface-sunken', className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  )
}

export function LoadingState({
  label = 'Loading',
  rows = 4,
  className,
}: {
  label?: string
  rows?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-3 p-4', className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className={cn('h-3', index % 2 === 0 ? 'w-[46%]' : 'w-[62%]')} />
            <Skeleton className="h-3 w-[28%]" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-line-subtle" role="status" aria-label="Loading table data">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn('h-3.5', columnIndex === 0 ? 'w-[26%]' : columnIndex === columns - 1 ? 'w-[10%]' : 'w-[14%]')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Inline spinner for buttons, chips and table cells. */
export function InlineLoader({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-body-sm text-ink-500', className)} role="status">
      <Loader2 className="size-3.5 animate-spin text-ink-400" aria-hidden />
      {label}
    </span>
  )
}

/** Indeterminate progress bar for pipeline stages without a known percentage. */
export function ProgressBar({
  value,
  indeterminate,
  tone = 'brand',
  className,
  label,
}: {
  value?: number
  indeterminate?: boolean
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'ink'
  className?: string
  label?: string
}) {
  const bar = {
    brand: 'bg-brand-500',
    success: 'bg-success-600',
    warning: 'bg-warning-600',
    danger: 'bg-danger-600',
    ink: 'bg-ink-500',
  }[tone]

  return (
    <div
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-line-subtle', className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {indeterminate ? (
        <span className={cn('absolute inset-y-0 w-1/3 animate-indeterminate rounded-full', bar)} />
      ) : (
        <span
          className={cn('block h-full rounded-full transition-[width] duration-500 ease-out', bar)}
          style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* ErrorState — always actionable: cause, status, retry                        */
/* -------------------------------------------------------------------------- */

export function ErrorState({
  title,
  cause,
  status,
  onRetry,
  onDetails,
  className,
  compact,
}: {
  title: string
  cause?: string
  status?: string
  onRetry?: () => void
  onDetails?: () => void
  className?: string
  compact?: boolean
}) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border border-danger-200 bg-danger-50/60',
        compact ? 'p-3.5' : 'p-4',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-danger-800">{title}</p>
          {cause && <p className="mt-1 text-body-sm text-danger-800/85">{cause}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onRetry && (
              <Button variant="secondary" size="sm" iconLeft={<RefreshCw aria-hidden />} onClick={onRetry}>
                Retry processing
              </Button>
            )}
            {onDetails && (
              <Button variant="ghost" size="sm" onClick={onDetails}>
                View details
              </Button>
            )}
            {status && <span className="font-mono text-[11px] text-danger-700/70">{status}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Guard used when a role lacks permission for an entire route. */
export function AccessDeniedState({ area, role }: { area: string; role: string }) {
  return (
    <EmptyState
      icon={CircleAlert}
      title={`${area} is outside your current access scope`}
      description={`You are signed in as ${role}. Access is enforced by the Django API and retrieval layer — the interface only reflects what your role may retrieve and act on. Contact your administrator to request access.`}
    />
  )
}
