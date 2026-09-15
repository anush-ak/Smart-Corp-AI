import { Check, Minus, X } from 'lucide-react'
import { cn, clampPercent } from '@/utils/format'
import type { ReactNode } from 'react'
import { InfoTooltip } from './tooltip'

/* -------------------------------------------------------------------------- */
/* Confidence / evidence strength                                             */
/* -------------------------------------------------------------------------- */

const confidenceTone = (value: number) => {
  if (value >= 80) return { bar: 'bg-success-600', text: 'text-success-800', ring: 'border-success-200 bg-success-50', label: 'High confidence' }
  if (value >= 60) return { bar: 'bg-info-600', text: 'text-info-800', ring: 'border-info-200 bg-info-50', label: 'Moderate confidence' }
  if (value >= 40) return { bar: 'bg-warning-600', text: 'text-warning-800', ring: 'border-warning-200 bg-warning-50', label: 'Low confidence' }
  return { bar: 'bg-danger-600', text: 'text-danger-800', ring: 'border-danger-200 bg-danger-50', label: 'Weak confidence' }
}

/**
 * ConfidenceBadge — always shows the numeric value plus a word label so the
 * strength is legible without relying on colour (WCAG).
 */
export function ConfidenceBadge({
  value,
  label = 'Confidence',
  className,
  size = 'md',
}: {
  value: number
  label?: string
  className?: string
  size?: 'sm' | 'md'
}) {
  const clamped = clampPercent(value)
  const tone = confidenceTone(clamped)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border font-medium',
        tone.ring,
        tone.text,
        size === 'sm' ? 'h-[18px] px-1.5 text-[11px]' : 'h-[22px] px-2 text-caption',
        className,
      )}
    >
      <span aria-hidden className="relative h-1 w-6 overflow-hidden rounded-full bg-black/10">
        <span className={cn('absolute inset-y-0 left-0 rounded-full', tone.bar)} style={{ width: `${clamped}%` }} />
      </span>
      <span className="tnum">{clamped}%</span>
      <span className="sr-only">
        {label}: {tone.label}
      </span>
    </span>
  )
}

/** Compact inline confidence meter used in retrieval lists. */
export function ConfidenceMeter({
  value,
  className,
  max = 100,
  tone = 'brand',
}: {
  value: number
  className?: string
  max?: number
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'ink'
}) {
  const pct = clampPercent((value / max) * 100)
  const bar = {
    brand: 'bg-brand-500',
    success: 'bg-success-600',
    warning: 'bg-warning-600',
    danger: 'bg-danger-600',
    ink: 'bg-ink-400',
  }[tone]
  return (
    <span
      className={cn('inline-block h-1 w-full overflow-hidden rounded-full bg-line', className)}
      role="meter"
      aria-valuenow={clampPercent(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className={cn('block h-full rounded-full transition-[width] duration-300 ease-out', bar)} style={{ width: `${pct}%` }} />
    </span>
  )
}

/** Circular score used for AI quality headline numbers. */
export function ScoreRing({
  value,
  size = 92,
  label,
  sublabel,
  unavailable,
}: {
  value: number | null
  size?: number
  label?: string
  sublabel?: string
  unavailable?: boolean
}) {
  const stroke = 7
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  if (unavailable || value === null) {
    return (
      <div
        className="relative grid shrink-0 place-items-center rounded-full border border-dashed border-line-strong bg-surface-muted text-center"
        style={{ width: size, height: size }}
      >
        <div className="px-2">
          <p className="text-caption font-semibold text-ink-500">Not measured</p>
          {label && <p className="mt-0.5 text-[10px] leading-tight text-ink-400">{label}</p>}
        </div>
      </div>
    )
  }

  const clamped = clampPercent(value)
  const tone = clamped >= 85 ? '#059669' : clamped >= 70 ? '#2563EB' : clamped >= 55 ? '#D97706' : '#DC2626'

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEF0F3" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (clamped / 100) * circumference}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="tnum text-[22px] font-semibold leading-none tracking-tight text-ink-900">{clamped}</p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-400">/ 100</p>
        </div>
      </div>
      <span className="sr-only">
        {label ?? 'Score'}: {clamped} out of 100
        {sublabel ? `. ${sublabel}` : ''}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Metric primitives                                                          */
/* -------------------------------------------------------------------------- */

export function MetricCard({
  label,
  value,
  unit,
  delta,
  hint,
  footer,
  icon,
  availability = 'measured',
  className,
  valueSuffix,
}: {
  label: string
  value: ReactNode
  unit?: string
  delta?: number | null
  hint?: string
  footer?: ReactNode
  icon?: ReactNode
  availability?: 'measured' | 'not_measured'
  className?: string
  valueSuffix?: string
}) {
  const measured = availability === 'measured'
  return (
    <div className={cn('sc-card p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-ink-400 [&_svg]:size-3.5">{icon}</span>}
          <p className="text-caption font-medium uppercase tracking-wide text-ink-500">{label}</p>
        </div>
        {hint && <InfoTooltip label={hint}>{hint}</InfoTooltip>}
      </div>

      {measured ? (
        <div className="mt-2.5 flex items-baseline gap-1.5">
          <span className="tnum text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink-900">{value}</span>
          {unit && <span className="text-body-sm text-ink-500">{unit}</span>}
          {valueSuffix && <span className="text-body-sm text-ink-500">{valueSuffix}</span>}
        </div>
      ) : (
        <div className="mt-2.5">
          <p className="text-[15px] font-medium text-ink-400">Not measured yet</p>
        </div>
      )}

      {delta !== undefined && delta !== null && measured && (
        <div className="mt-2 flex items-center gap-1.5">
          <DeltaPill value={delta} />
          <span className="text-caption text-ink-400">vs. previous period</span>
        </div>
      )}

      {footer && <div className="mt-3 border-t border-line-subtle pt-2.5 text-caption text-ink-500">{footer}</div>}
    </div>
  )
}

export function DeltaPill({ value, invert = false, className }: { value: number; invert?: boolean; className?: string }) {
  const positive = value > 0
  const neutral = value === 0
  const good = invert ? !positive : positive
  const Icon = neutral ? Minus : positive ? ArrowUpRightMini : ArrowDownRightMini
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[11px] font-semibold tnum',
        neutral && 'bg-surface-muted text-ink-500',
        !neutral && good && 'bg-success-50 text-success-800',
        !neutral && !good && 'bg-danger-50 text-danger-800',
        className,
      )}
    >
      <Icon />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

function ArrowUpRightMini() {
  return (
    <svg viewBox="0 0 12 12" className="size-3" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5 8.5 3.5M4.6 3.5h3.9v3.9" />
    </svg>
  )
}

function ArrowDownRightMini() {
  return (
    <svg viewBox="0 0 12 12" className="size-3" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 3.5 8.5 8.5M8.4 4.6v3.9H4.5" />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* Boolean / presence cells                                                   */
/* -------------------------------------------------------------------------- */

export function BooleanCell({ value, labels = ['Yes', 'No'] }: { value: boolean; labels?: [string, string] }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-body-sm">
      {value ? (
        <Check className="size-3.5 text-success-600" aria-hidden />
      ) : (
        <X className="size-3.5 text-ink-300" aria-hidden />
      )}
      <span className={value ? 'text-ink-700' : 'text-ink-400'}>{value ? labels[0] : labels[1]}</span>
    </span>
  )
}
