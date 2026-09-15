import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/format'

const buttonStyles = cva(
  [
    'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded',
    'font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-1',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:translate-y-[0.5px]',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600',
        secondary:
          'border border-line bg-surface text-ink-800 shadow-xs hover:border-line-strong hover:bg-surface-muted active:bg-surface-sunken',
        ghost: 'text-ink-600 hover:bg-surface-muted hover:text-ink-900 active:bg-surface-sunken',
        subtle: 'bg-surface-muted text-ink-800 hover:bg-surface-sunken active:bg-line-subtle',
        danger: 'bg-danger-600 text-white shadow-xs hover:bg-danger-700 active:bg-danger-800',
        'danger-ghost': 'text-danger-700 hover:bg-danger-50 active:bg-danger-100',
        success: 'bg-success-600 text-white shadow-xs hover:bg-success-700 active:bg-success-800',
        outline:
          'border border-line-strong bg-surface text-ink-800 hover:bg-surface-muted active:bg-surface-sunken',
        link: 'text-brand-700 underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-6 px-2 text-[12px] [&_svg]:size-3.5',
        sm: 'h-7.5 px-2.5 text-body-sm [&_svg]:size-4',
        md: 'h-9 px-3 text-body [&_svg]:size-4',
        lg: 'h-10 px-4 text-body [&_svg]:size-[18px]',
        'icon-xs': 'size-6 [&_svg]:size-3.5',
        'icon-sm': 'size-7.5 [&_svg]:size-4',
        'icon': 'size-9 [&_svg]:size-4',
        'icon-lg': 'size-10 [&_svg]:size-[18px]',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
  /** Accessible label is required when the button has no visible text. */
  label?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, iconLeft, iconRight, label, children, disabled, ...props },
  ref,
) {
  const iconOnly = typeof size === 'string' && size.startsWith('icon')
  return (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        iconLeft
      )}
      {!iconOnly && children}
      {!loading && iconRight}
    </button>
  )
})

/** Split control used for filter bars: a segmented group of mutually exclusive views. */
export function ButtonGroup({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="group"
      className={cn(
        'inline-flex items-center rounded-md border border-line bg-surface p-0.5 shadow-xs',
        '[&>button]:rounded-sm [&>button]:border-0 [&>button]:shadow-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { buttonStyles }
