import { cn } from '@/utils/format'

/**
 * SmartCorp AI mark.
 *
 * An original identity: a solid charcoal tile holding a "stacked knowledge"
 * glyph, with a single accent dot representing the active intelligence layer.
 * Deliberately geometric and quiet — no gradients, no glow.
 */
export function BrandMark({ className, size = 26 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center rounded-md bg-ink-900 text-white', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.66} height={size * 0.66} fill="none">
        {/* three knowledge layers resolving into one answer */}
        <path d="M12 4.2 20 8l-8 3.8L4 8l8-3.8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M4 12.4 12 16.2l8-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" opacity="0.62" />
        <path d="M4 16.4 12 20.2l8-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" opacity="0.34" />
      </svg>
      <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-surface bg-brand-500" />
    </span>
  )
}

export function BrandWordmark({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn('flex min-w-0 items-baseline gap-1', className)}>
      <span className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink-900">SmartCorp</span>
      {!collapsed && <span className="text-[13px] font-medium tracking-[-0.01em] text-brand-600">AI</span>}
    </span>
  )
}

/** Agent identity mark — department-tinted initials, never decorative artwork. */
export function AgentMark({
  name,
  accent = 'indigo',
  size = 30,
  className,
}: {
  name: string
  accent?: string
  size?: number
  className?: string
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-success-50 text-success-800 border-success-200',
    sky: 'bg-info-50 text-info-800 border-info-200',
    amber: 'bg-warning-50 text-warning-800 border-warning-200',
    violet: 'bg-agent-50 text-agent-700 border-agent-200',
    indigo: 'bg-brand-50 text-brand-700 border-brand-200',
    rose: 'bg-danger-50 text-danger-800 border-danger-200',
  }
  const initials = name
    .replace(/agent/gi, '')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-md border text-[11px] font-semibold tracking-wide',
        tones[accent] ?? tones.indigo,
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials || 'AI'}
    </span>
  )
}
