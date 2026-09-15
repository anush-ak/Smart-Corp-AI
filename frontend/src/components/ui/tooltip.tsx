import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/utils/format'

interface TooltipProps {
  label: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
  className?: string
}

/**
 * Tooltip — hover/focus disclosure for definitions and metric provenance.
 * Kept dependency-free so it stays accessible by default (role="tooltip",
 * aria-describedby, Escape to dismiss).
 */
export function Tooltip({ label, side = 'top', children, className }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()

  const position = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  }[side]

  return (
    <span
      className={cn('relative inline-flex', className)}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
    >
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
            'aria-describedby': open ? id : undefined,
          })
        : children}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-none absolute z-50 w-max max-w-[260px] animate-fade-in-down rounded-md border border-ink-800 bg-ink-900 px-2.5 py-1.5 text-caption font-normal leading-snug text-white shadow-pop',
            position,
          )}
        >
          {label}
        </span>
      )}
    </span>
  )
}

/** InfoTooltip — the question-mark affordance used beside metric labels. */
export function InfoTooltip({
  children,
  label,
  side = 'top',
}: {
  children: ReactNode
  label?: string
  side?: TooltipProps['side']
}) {
  return (
    <Tooltip label={children} side={side}>
      <button
        type="button"
        aria-label={label ?? 'More information'}
        className="grid size-4 place-items-center rounded-full text-ink-300 transition-colors hover:text-ink-500 focus-visible:text-ink-600"
      >
        <HelpCircle className="size-3.5" aria-hidden />
      </button>
    </Tooltip>
  )
}
