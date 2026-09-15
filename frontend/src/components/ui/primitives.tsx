import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/format'

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'li'
}) {
  return <Tag className={cn('sc-card', className)}>{children}</Tag>
}

/**
 * CardHeader — standard section header used across the product.
 * Title, optional description, optional meta line and right-aligned actions.
 */
export function CardHeader({
  title,
  description,
  meta,
  actions,
  icon,
  size = 'md',
  className,
  id,
}: {
  title: ReactNode
  description?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  size?: 'sm' | 'md'
  className?: string
  id?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-line',
        size === 'sm' ? 'px-4 py-3' : 'px-4 py-3.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 shrink-0 text-ink-400 [&_svg]:size-4">{icon}</span>}
        <div className="min-w-0">
          <h2 id={id} className={cn('truncate text-ink-900', size === 'sm' ? 'text-h3' : 'text-h2')}>
            {title}
          </h2>
          {description && <p className="mt-0.5 text-body-sm text-ink-500">{description}</p>}
          {meta && <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-400">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cn(padded && 'p-4', className)}>{children}</div>
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-muted/60 px-4 py-3', className)}>
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Page header                                                                */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  tabs,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  breadcrumbs?: { label: string; to?: string }[]
  actions?: ReactNode
  meta?: ReactNode
  tabs?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('border-b border-line bg-surface', className)}>
      <div className="mx-auto w-full max-w-content px-4 pt-5 sm:px-6 lg:px-8">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2.5">
            <ol className="flex flex-wrap items-center gap-1 text-caption text-ink-400">
              {breadcrumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {crumb.to ? (
                    <Link to={crumb.to} className="rounded-xs transition-colors hover:text-ink-700">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-ink-600">
                      {crumb.label}
                    </span>
                  )}
                  {index < breadcrumbs.length - 1 && <ChevronRight className="size-3 text-ink-300" aria-hidden />}
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4 pb-4">
          <div className="min-w-0">
            <h1 className="text-h1 text-ink-900">{title}</h1>
            {description && <p className="mt-1 max-w-prose text-body text-ink-500">{description}</p>}
            {meta && <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-ink-500">{meta}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {tabs && <div className="-mb-px">{tabs}</div>}
      </div>
    </div>
  )
}

/** PageBody — enforces the max-width content system and consistent gutters. */
export function PageBody({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className={cn('mx-auto w-full px-4 py-5 sm:px-6 lg:px-8', wide ? 'max-w-[1680px]' : 'max-w-content', className)}>
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

export interface TabItem {
  id: string
  label: string
  count?: number
  icon?: ReactNode
  disabled?: boolean
}

export function Tabs({
  items,
  value,
  onChange,
  variant = 'underline',
  className,
  ariaLabel = 'Sections',
}: {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  variant?: 'underline' | 'segmented' | 'pill'
  className?: string
  ariaLabel?: string
}) {
  if (variant === 'segmented') {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn('inline-flex items-center gap-0.5 rounded-md border border-line bg-surface-muted p-0.5', className)}
      >
        {items.map((item) => {
          const active = item.id === value
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={active}
              disabled={item.disabled}
              onClick={() => onChange(item.id)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-body-sm font-medium transition-colors',
                active ? 'bg-surface text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-800',
                item.disabled && 'pointer-events-none opacity-40',
              )}
            >
              {item.icon && <span className="[&_svg]:size-3.5">{item.icon}</span>}
              {item.label}
              {item.count !== undefined && (
                <span className={cn('tnum text-[11px]', active ? 'text-ink-500' : 'text-ink-400')}>{item.count}</span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex items-center gap-1 overflow-x-auto no-scrollbar', className)}>
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={cn(
              'group relative inline-flex items-center gap-1.5 whitespace-nowrap px-1 pb-2.5 pt-1 text-body-sm font-medium transition-colors',
              active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800',
              item.disabled && 'pointer-events-none opacity-40',
              variant === 'pill' && 'rounded-md px-2.5 py-1.5',
            )}
          >
            {item.icon && <span className="text-ink-400 [&_svg]:size-3.5">{item.icon}</span>}
            {item.label}
            {item.count !== undefined && (
              <span className="tnum rounded-sm bg-surface-sunken px-1 text-[11px] font-semibold text-ink-500">{item.count}</span>
            )}
            {variant === 'underline' && (
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-0 -bottom-px h-[2px] rounded-full transition-colors',
                  active ? 'bg-brand-600' : 'bg-transparent group-hover:bg-line-strong',
                )}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Definition list — used for metadata panels                                 */
/* -------------------------------------------------------------------------- */

export function DefinitionList({
  items,
  columns = 2,
  className,
}: {
  items: { label: string; value: ReactNode; hint?: string }[]
  columns?: 1 | 2 | 3
  className?: string
}) {
  const cols = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }[columns]
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3.5', cols, className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-caption font-medium uppercase tracking-wide text-ink-400">{item.label}</dt>
          <dd className="mt-1 break-words text-body text-ink-800">{item.value}</dd>
          {item.hint && <p className="mt-0.5 text-caption text-ink-400">{item.hint}</p>}
        </div>
      ))}
    </dl>
  )
}

/* -------------------------------------------------------------------------- */
/* Section divider                                                            */
/* -------------------------------------------------------------------------- */

export function SectionHeading({
  title,
  description,
  actions,
  icon,
  className,
  id,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  className?: string
  id?: string
}) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-ink-400 [&_svg]:size-4">{icon}</span>}
        <div>
          <h2 id={id} className="text-h2 text-ink-900">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-body-sm text-ink-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
