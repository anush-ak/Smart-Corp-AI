import { cn, initialsOf } from '@/utils/format'

const PALETTE: Record<string, string> = {
  indigo: 'bg-brand-50 text-brand-700 border-brand-200',
  slate: 'bg-surface-muted text-ink-600 border-line',
  emerald: 'bg-success-50 text-success-800 border-success-200',
  amber: 'bg-warning-50 text-warning-800 border-warning-200',
  rose: 'bg-danger-50 text-danger-800 border-danger-200',
  sky: 'bg-info-50 text-info-800 border-info-200',
  violet: 'bg-agent-50 text-agent-700 border-agent-200',
}

export type AvatarColor = keyof typeof PALETTE

const SIZES = {
  xs: 'size-5 text-[10px]',
  sm: 'size-6 text-[11px]',
  md: 'size-8 text-[12px]',
  lg: 'size-10 text-body-sm',
  xl: 'size-12 text-body',
}

/**
 * Avatar — initials-first identity mark. Deterministic colour from the name so
 * the same person keeps the same tint across the product.
 */
export function Avatar({
  name,
  color = 'slate',
  size = 'md',
  className,
  ring,
  title,
}: {
  name: string
  color?: AvatarColor | string
  size?: keyof typeof SIZES
  className?: string
  ring?: boolean
  title?: string
}) {
  const tone = PALETTE[color] ?? PALETTE.slate
  return (
    <span
      title={title ?? name}
      aria-hidden={title ? undefined : true}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full border font-semibold uppercase tracking-tight',
        tone,
        SIZES[size],
        ring && 'ring-2 ring-surface',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}

/** Overlapping avatar row used for reviewers, attendees and approvers. */
export function AvatarGroup({
  people,
  max = 4,
  size = 'sm',
}: {
  people: { name: string; color?: string }[]
  max?: number
  size?: keyof typeof SIZES
}) {
  const visible = people.slice(0, max)
  const overflow = people.length - visible.length
  return (
    <div className="flex items-center">
      {visible.map((person, index) => (
        <Avatar
          key={`${person.name}-${index}`}
          name={person.name}
          color={person.color}
          size={size}
          ring
          className={index > 0 ? '-ml-1.5' : undefined}
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            '-ml-1.5 inline-grid place-items-center rounded-full border border-line bg-surface-sunken font-medium text-ink-500 ring-2 ring-surface',
            SIZES[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
