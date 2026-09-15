import { cva, type VariantProps } from 'class-variance-authority'
import { Check, CircleAlert, CircleCheck, CircleSlash, Clock, MinusCircle, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/format'

/**
 * StatusBadge — the single source of truth for state in SmartCorp.
 * Colour is never the only signal: every tone pairs a tint with a shape/icon.
 */
const badgeStyles = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface-muted text-ink-600',
        brand: 'border-brand-200 bg-brand-50 text-brand-700',
        success: 'border-success-200 bg-success-50 text-success-800',
        warning: 'border-warning-200 bg-warning-50 text-warning-800',
        danger: 'border-danger-200 bg-danger-50 text-danger-800',
        info: 'border-info-200 bg-info-50 text-info-800',
        agent: 'border-agent-200 bg-agent-50 text-agent-700',
        outline: 'border-line-strong bg-surface text-ink-600',
      },
      size: {
        sm: 'h-[18px] px-1.5 text-[11px] [&_svg]:size-3',
        md: 'h-[22px] px-2 text-caption [&_svg]:size-3.5',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
)

export interface StatusBadgeProps
  extends VariantProps<typeof badgeStyles> {
  children: ReactNode
  icon?: ReactNode | null
  className?: string
  /** Optional dot variant for dense tables. */
  dot?: boolean
}

export function StatusBadge({ children, icon, tone, size, className, dot }: StatusBadgeProps) {
  return (
    <span className={cn(badgeStyles({ tone, size }), className)}>
      {dot ? (
        <span
          aria-hidden
          className={cn('size-1.5 shrink-0 rounded-full', {
            'bg-ink-400': tone === 'neutral' || tone === 'outline' || !tone,
            'bg-brand-500': tone === 'brand',
            'bg-success-600': tone === 'success',
            'bg-warning-600': tone === 'warning',
            'bg-danger-600': tone === 'danger',
            'bg-info-600': tone === 'info',
            'bg-agent-600': tone === 'agent',
          })}
        />
      ) : (
        icon
      )}
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Domain status vocabulary — one place defines what a state looks like.       */
/* -------------------------------------------------------------------------- */

export type Tone = NonNullable<VariantProps<typeof badgeStyles>['tone']>

export function DocumentStatusBadge({
  status,
  progress,
  size = 'md',
}: {
  status: 'uploading' | 'processing' | 'indexing' | 'ready' | 'failed'
  progress?: number
  size?: 'sm' | 'md'
}) {
  const map: Record<string, { tone: Tone; icon: ReactNode; label: string }> = {
    uploading: { tone: 'info', icon: <Clock aria-hidden />, label: 'Uploading' },
    processing: { tone: 'info', icon: <Clock aria-hidden />, label: `Extracting${progress ? ` ${progress}%` : ''}` },
    indexing: { tone: 'brand', icon: <Clock aria-hidden />, label: `Embedding${progress ? ` ${progress}%` : ''}` },
    ready: { tone: 'success', icon: <CircleCheck aria-hidden />, label: 'Ready for AI' },
    failed: { tone: 'danger', icon: <CircleAlert aria-hidden />, label: 'Failed' },
  }
  const entry = map[status]
  return (
    <StatusBadge tone={entry.tone} size={size} icon={entry.icon}>
      {entry.label}
    </StatusBadge>
  )
}

export function RiskBadge({ risk, size = 'md' }: { risk: 'low' | 'medium' | 'high'; size?: 'sm' | 'md' }) {
  const map = {
    low: { tone: 'success' as Tone, icon: <CircleCheck aria-hidden />, label: 'Low risk' },
    medium: { tone: 'warning' as Tone, icon: <TriangleAlert aria-hidden />, label: 'Medium risk' },
    high: { tone: 'danger' as Tone, icon: <TriangleAlert aria-hidden />, label: 'High risk' },
  }
  const entry = map[risk]
  return (
    <StatusBadge tone={entry.tone} size={size} icon={entry.icon}>
      {entry.label}
    </StatusBadge>
  )
}

export function DecisionStatusBadge({
  status,
  size = 'md',
}: {
  status: 'awaiting_approval' | 'approved' | 'rejected' | 'needs_evidence' | 'in_progress'
  size?: 'sm' | 'md'
}) {
  const map = {
    awaiting_approval: { tone: 'warning' as Tone, icon: <Clock aria-hidden />, label: 'Awaiting approval' },
    approved: { tone: 'success' as Tone, icon: <Check aria-hidden />, label: 'Approved' },
    rejected: { tone: 'danger' as Tone, icon: <X aria-hidden />, label: 'Rejected' },
    needs_evidence: { tone: 'info' as Tone, icon: <CircleAlert aria-hidden />, label: 'More evidence requested' },
    in_progress: { tone: 'brand' as Tone, icon: <Clock aria-hidden />, label: 'Action in progress' },
  }
  const entry = map[status]
  return (
    <StatusBadge tone={entry.tone} size={size} icon={entry.icon}>
      {entry.label}
    </StatusBadge>
  )
}

export function AgentStatusBadge({
  status,
  size = 'md',
}: {
  status: 'active' | 'degraded' | 'paused'
  size?: 'sm' | 'md'
}) {
  const map = {
    active: { tone: 'success' as Tone, icon: <CircleCheck aria-hidden />, label: 'Active' },
    degraded: { tone: 'warning' as Tone, icon: <TriangleAlert aria-hidden />, label: 'Degraded' },
    paused: { tone: 'neutral' as Tone, icon: <CircleSlash aria-hidden />, label: 'Paused' },
  }
  const entry = map[status]
  return (
    <StatusBadge tone={entry.tone} size={size} icon={entry.icon}>
      {entry.label}
    </StatusBadge>
  )
}

export function AccessBadge({
  level,
  size = 'md',
}: {
  level: 'organization' | 'department' | 'restricted'
  size?: 'sm' | 'md'
}) {
  const map = {
    organization: { tone: 'neutral' as Tone, label: 'Org-wide' },
    department: { tone: 'info' as Tone, label: 'Department' },
    restricted: { tone: 'warning' as Tone, label: 'Restricted' },
  }
  const entry = map[level]
  return (
    <StatusBadge tone={entry.tone} size={size}>
      {entry.label}
    </StatusBadge>
  )
}

export function AuditResultBadge({
  result,
  size = 'md',
}: {
  result: 'success' | 'failure' | 'denied'
  size?: 'sm' | 'md'
}) {
  const map = {
    success: { tone: 'success' as Tone, icon: <Check aria-hidden />, label: 'Success' },
    failure: { tone: 'danger' as Tone, icon: <CircleAlert aria-hidden />, label: 'Failure' },
    denied: { tone: 'warning' as Tone, icon: <MinusCircle aria-hidden />, label: 'Denied' },
  }
  const entry = map[result]
  return (
    <StatusBadge tone={entry.tone} size={size} icon={entry.icon}>
      {entry.label}
    </StatusBadge>
  )
}

export function EvidenceStrengthBadge({
  strength,
  size = 'sm',
}: {
  strength: 'strong' | 'moderate' | 'weak'
  size?: 'sm' | 'md'
}) {
  const map = {
    strong: { tone: 'success' as Tone, label: 'Strong evidence' },
    moderate: { tone: 'info' as Tone, label: 'Moderate evidence' },
    weak: { tone: 'warning' as Tone, label: 'Weak evidence' },
  }
  const entry = map[strength]
  return (
    <StatusBadge tone={entry.tone} size={size}>
      {entry.label}
    </StatusBadge>
  )
}

export { badgeStyles }
