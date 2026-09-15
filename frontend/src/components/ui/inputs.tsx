import { Search, SlidersHorizontal, X } from 'lucide-react'
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/utils/format'
import { Button } from './button'

/* -------------------------------------------------------------------------- */
/* Text input                                                                 */
/* -------------------------------------------------------------------------- */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  iconLeft?: ReactNode
  trailing?: ReactNode
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, iconLeft, trailing, className, containerClassName, id, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-body-sm font-medium text-ink-700">
          {label}
          {props.required && <span className="ml-0.5 text-danger-600" aria-hidden>*</span>}
        </label>
      )}
      <div className="relative">
        {iconLeft && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 [&_svg]:size-4">
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-9 w-full rounded-md border bg-surface px-3 text-body text-ink-900 shadow-xs transition-colors',
            'placeholder:text-ink-300',
            'focus:outline-none focus:ring-2 focus:ring-brand-500/25',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-400',
            error ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-500/20' : 'border-line focus:border-brand-500',
            iconLeft && 'pl-8.5',
            trailing && 'pr-9',
            className,
          )}
          {...props}
        />
        {trailing && <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-caption text-danger-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-caption text-ink-400">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

/* -------------------------------------------------------------------------- */
/* Search input                                                               */
/* -------------------------------------------------------------------------- */

export const SearchInput = forwardRef<HTMLInputElement, InputProps & { onClear?: () => void }>(
  function SearchInput({ value, onClear, className, placeholder = 'Search…', ...props }, ref) {
    return (
      <Input
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        iconLeft={<Search aria-hidden />}
        className={cn('pl-8.5', className)}
        trailing={
          value ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onClear?.()}
              className="grid size-6 place-items-center rounded-sm text-ink-300 transition-colors hover:bg-surface-muted hover:text-ink-600"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : undefined
        }
        {...props}
      />
    )
  },
)

/* -------------------------------------------------------------------------- */
/* Select                                                                     */
/* -------------------------------------------------------------------------- */

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  options: { value: string; label: string; disabled?: boolean }[]
  placeholder?: string
  containerClassName?: string
  hint?: string
  size?: 'sm' | 'md'
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, placeholder, className, containerClassName, id, hint, size = 'md', ...props },
  ref,
) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-body-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full appearance-none rounded-md border border-line bg-surface pr-8 text-ink-800 shadow-xs transition-colors',
            'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-400',
            size === 'sm' ? 'h-8 pl-2.5 text-body-sm' : 'h-9 pl-3 text-body',
            className,
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="m4 6.5 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {hint && <p className="mt-1.5 text-caption text-ink-400">{hint}</p>}
    </div>
  )
})

/* -------------------------------------------------------------------------- */
/* Textarea                                                                   */
/* -------------------------------------------------------------------------- */

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string }>(
  function Textarea({ label, hint, className, id, ...props }, ref) {
    const generatedId = useId()
    const textareaId = id ?? generatedId
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="mb-1.5 block text-body-sm font-medium text-ink-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-body text-ink-900 shadow-xs transition-colors',
            'placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
            className,
          )}
          {...props}
        />
        {hint && <p className="mt-1.5 text-caption text-ink-400">{hint}</p>}
      </div>
    )
  },
)

/* -------------------------------------------------------------------------- */
/* Checkbox / switch                                                          */
/* -------------------------------------------------------------------------- */

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  indeterminate,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: string
  indeterminate?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5', disabled && 'cursor-not-allowed opacity-55', className)}>
      <span className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer size-4 appearance-none rounded-xs border border-line-strong bg-surface transition-colors checked:border-brand-600 checked:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed"
        />
        {indeterminate && !checked ? (
          <span aria-hidden className="pointer-events-none absolute h-0.5 w-2 rounded-full bg-brand-600" />
        ) : (
          <svg
            viewBox="0 0 12 12"
            className="pointer-events-none absolute size-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m2.5 6.2 2.3 2.3 4.7-5" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-body-sm text-ink-800">{label}</span>
        {description && <span className="mt-0.5 block text-caption text-ink-400">{description}</span>}
      </span>
    </label>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: string
  disabled?: boolean
  id?: string
}) {
  const generatedId = useId()
  const switchId = id ?? generatedId
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={switchId} className="block text-body-sm font-medium text-ink-800">
          {label}
        </label>
        {description && <p className="mt-0.5 text-caption text-ink-500">{description}</p>}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-1',
          checked ? 'border-brand-600 bg-brand-600' : 'border-line-strong bg-surface-sunken',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 size-3.5 rounded-full bg-white shadow-xs transition-transform duration-200 ease-out',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* FilterBar / FilterChip                                                     */
/* -------------------------------------------------------------------------- */

export function FilterBar({
  children,
  onReset,
  showReset,
  className,
  trailing,
}: {
  children: ReactNode
  onReset?: () => void
  showReset?: boolean
  className?: string
  trailing?: ReactNode
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="sr-only">
        <SlidersHorizontal aria-hidden />
        Filters
      </span>
      {children}
      {showReset && onReset && (
        <Button variant="ghost" size="sm" onClick={onReset} iconLeft={<X aria-hidden />}>
          Clear
        </Button>
      )}
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  )
}

/** Removable filter token — shows the active filter value explicitly. */
export function FilterChip({
  label,
  value,
  onRemove,
  tone = 'neutral',
}: {
  label: string
  value: string
  onRemove?: () => void
  tone?: 'neutral' | 'brand'
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-body-sm',
        tone === 'brand' ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-line bg-surface text-ink-700 shadow-xs',
      )}
    >
      <span className="text-ink-400">{label}:</span>
      <span className="font-medium">{value}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${label} filter`}
          onClick={onRemove}
          className="-mr-0.5 grid size-4 place-items-center rounded-xs text-ink-400 transition-colors hover:bg-black/5 hover:text-ink-700"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  )
}

/** Native-feeling segmented filter used in list headers. */
export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex items-center gap-0.5 rounded-md bg-surface-sunken p-0.5">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-6.5 items-center gap-1.5 rounded-sm px-2 text-body-sm font-medium transition-colors',
              active ? 'bg-surface text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cn('tnum text-[11px]', active ? 'text-ink-500' : 'text-ink-400')}>{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
