import { Download, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './button'
import { SearchInput, Select } from './inputs'
import { cn } from '@/utils/format'

export interface ToolbarFilter {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  /** Filters hidden on narrow screens keep the toolbar usable on tablets. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

/**
 * TableToolbar — one consistent filter/search/export row above every data table.
 * Search is always first, filters follow, bulk actions sit at the far right.
 */
export function TableToolbar({
  query,
  onQueryChange,
  searchPlaceholder = 'Search…',
  filters = [],
  onReset,
  showReset,
  onExport,
  exportLabel = 'Export CSV',
  actions,
  className,
  children,
}: {
  query?: string
  onQueryChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: ToolbarFilter[]
  onReset?: () => void
  showReset?: boolean
  onExport?: () => void
  exportLabel?: string
  actions?: ReactNode
  className?: string
  children?: ReactNode
}) {
  const hidden = {
    sm: 'hidden sm:block',
    md: 'hidden md:block',
    lg: 'hidden lg:block',
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {onQueryChange && (
        <SearchInput
          value={query ?? ''}
          onChange={(event) => onQueryChange(event.target.value)}
          onClear={() => onQueryChange('')}
          placeholder={searchPlaceholder}
          containerClassName="w-full sm:w-[248px]"
        />
      )}

      {filters.map((filter) => (
        <Select
          key={filter.id}
          size="sm"
          aria-label={filter.label}
          value={filter.value}
          onChange={(event) => filter.onChange(event.target.value)}
          options={filter.options}
          containerClassName={cn('w-auto', filter.hideBelow && hidden[filter.hideBelow])}
          className="h-9 min-w-[132px]"
        />
      ))}

      {children}

      {(showReset || onExport || actions) && (
        <div className="ml-auto flex items-center gap-2">
          {showReset && onReset && (
            <Button variant="ghost" size="md" onClick={onReset}>
              Clear filters
            </Button>
          )}
          {onExport && (
            <Button variant="secondary" size="md" iconLeft={<Download aria-hidden />} onClick={onExport}>
              {exportLabel}
            </Button>
          )}
          {actions}
        </div>
      )}
    </div>
  )
}

/** Compact count + view hint line shown above dense tables. */
export function TableSummary({
  children,
  actions,
  className,
}: {
  children: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2 px-1', className)}>
      <p className="flex items-center gap-1.5 text-caption text-ink-500">
        <SlidersHorizontal className="size-3.5 text-ink-300" aria-hidden />
        {children}
      </p>
      {actions}
    </div>
  )
}
