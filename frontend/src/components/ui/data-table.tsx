import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { cn, formatNumber } from '@/utils/format'
import { Button } from './button'
import { EmptyState, TableSkeleton } from './states'
import { type LucideIcon } from 'lucide-react'

export interface Column<T> {
  id: string
  header: ReactNode
  /** Cell renderer. Receives the row, so cells stay declarative. */
  cell: (row: T) => ReactNode
  /** Value used for sorting + CSV export when it is not the rendered node. */
  sortValue?: (row: T) => string | number
  align?: 'left' | 'right' | 'center'
  width?: string
  className?: string
  headerClassName?: string
  /** Hidden below the given breakpoint (dense tables on small screens). */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
  /** Primary column: shown as the title in the mobile card layout. */
  primary?: boolean
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  getRowId: (row: T) => string
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyState?: { icon?: LucideIcon; title: string; description?: string; action?: { label: string; onClick: () => void } }
  /** Rows per page. Pass 0 to disable pagination. */
  pageSize?: number
  /** Enables click-to-sort headers where a sortValue is provided. */
  defaultSort?: { columnId: string; direction: 'asc' | 'desc' }
  dense?: boolean
  className?: string
  /** Rendered under the table: selection summary, export, etc. */
  footer?: ReactNode
  caption?: string
}

/**
 * DataTable — the dense data surface used across Knowledge, Audit, Analytics and
 * Evaluation. On small screens it reflows into a definition list rather than
 * horizontally scrolling, so the content stays readable on tablets and phones.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  loading,
  emptyState,
  pageSize = 0,
  defaultSort,
  dense,
  className,
  footer,
  caption,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>(defaultSort ?? null)
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((item) => item.id === sort.columnId)
    if (!column?.sortValue) return rows
    const getValue = column.sortValue
    return [...rows].sort((a, b) => {
      const left = getValue(a)
      const right = getValue(b)
      if (typeof left === 'number' && typeof right === 'number') {
        return sort.direction === 'asc' ? left - right : right - left
      }
      return sort.direction === 'asc'
        ? String(left).localeCompare(String(right))
        : String(right).localeCompare(String(left))
    })
  }, [rows, sort, columns])

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  const currentPage = Math.min(page, totalPages)
  const paged = pageSize > 0 ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize) : sorted

  const hiddenClass = {
    sm: 'hidden sm:table-cell',
    md: 'hidden md:table-cell',
    lg: 'hidden lg:table-cell',
    xl: 'hidden xl:table-cell',
  }

  if (loading) {
    return (
      <div className={cn('sc-card overflow-hidden', className)}>
        <TableSkeleton rows={6} columns={Math.min(columns.length, 5)} />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={cn('sc-card overflow-hidden', className)}>
        <EmptyState
          icon={emptyState?.icon}
          title={emptyState?.title ?? 'Nothing here yet'}
          description={emptyState?.description}
          primaryAction={emptyState?.action}
        />
      </div>
    )
  }

  const primaryColumn = columns.find((column) => column.primary)
  const detailColumns = columns.filter((column) => !column.primary)

  return (
    <div className={cn('sc-card overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left max-sm:min-w-0">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-line bg-surface-muted/70">
              {columns.map((column) => {
                const sortable = Boolean(column.sortValue)
                const active = sort?.columnId === column.id
                return (
                  <th
                    key={column.id}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    className={cn(
                      'px-4 py-2.5 text-caption font-semibold uppercase tracking-wide text-ink-500 max-sm:hidden',
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center',
                      column.hideBelow && hiddenClass[column.hideBelow],
                      column.headerClassName,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSort((current) =>
                            current?.columnId === column.id
                              ? { columnId: column.id, direction: current.direction === 'asc' ? 'desc' : 'asc' }
                              : { columnId: column.id, direction: 'asc' },
                          )
                        }
                        className={cn(
                          'inline-flex items-center gap-1 rounded-xs transition-colors hover:text-ink-800',
                          column.align === 'right' && 'flex-row-reverse',
                        )}
                        aria-label={`Sort by ${typeof column.header === 'string' ? column.header : column.id}`}
                      >
                        {column.header}
                        {active ? (
                          sort?.direction === 'asc' ? (
                            <ArrowUp className="size-3 text-ink-500" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3 text-ink-500" aria-hidden />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3 text-ink-300" aria-hidden />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr
                key={getRowId(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onRowClick(row)
                        }
                      }
                    : undefined
                }
                className={cn(
                  'border-b border-line-subtle transition-colors last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-surface-muted/70 focus-visible:bg-surface-muted/70 focus-visible:outline-none',
                )}
              >
                {columns.map((column, index) => (
                  <td
                    key={column.id}
                    className={cn(
                      'px-4 align-middle text-body-sm text-ink-700',
                      dense ? 'py-2' : 'py-3',
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center',
                      column.hideBelow && hiddenClass[column.hideBelow],
                      // Mobile: only the primary column renders as a wide cell.
                      index === 0 && 'max-sm:block max-sm:px-4',
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile reflow: each row becomes a labelled definition list. */}
      <ul className="divide-y divide-line-subtle sm:hidden">
        {paged.map((row) => (
          <li key={`m-${getRowId(row)}`} className="px-4 py-3.5">
            {onRowClick ? (
              <button
                type="button"
                onClick={() => onRowClick(row)}
                className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <div className="text-body font-medium text-ink-900">{primaryColumn?.cell(row)}</div>
              </button>
            ) : (
              <div className="text-body font-medium text-ink-900">{primaryColumn?.cell(row)}</div>
            )}
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
              {detailColumns.map((column) => (
                <div key={column.id} className="min-w-0">
                  <dt className="text-caption text-ink-400">{column.header}</dt>
                  <dd className="mt-0.5 text-body-sm text-ink-700">{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      {pageSize > 0 && sorted.length > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-muted/60 px-4 py-2.5">
          <p className="tnum text-caption text-ink-500">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)} of{' '}
            {formatNumber(sorted.length)}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="icon-sm"
              label="Previous page"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <span className="tnum px-2 text-caption text-ink-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="icon-sm"
              label="Next page"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      )}

      {footer && <div className="border-t border-line bg-surface-muted/60 px-4 py-2.5">{footer}</div>}
    </div>
  )
}
