import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/format'
import { Button } from './button'

/* -------------------------------------------------------------------------- */
/* Focus management                                                           */
/* -------------------------------------------------------------------------- */

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Traps Tab focus inside the container and restores focus on unmount. */
function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    const previous = document.activeElement as HTMLElement | null
    const node = ref.current
    if (!node) return

    const focusFirst = () => {
      const target =
        node.querySelector<HTMLElement>('[data-autofocus]') ??
        node.querySelector<HTMLElement>(FOCUSABLE)
      target?.focus()
    }
    const raf = requestAnimationFrame(focusFirst)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (item) => item.offsetParent !== null || item === document.activeElement,
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus?.()
    }
  }, [active])

  return ref
}

function useLockScroll(active: boolean) {
  useEffect(() => {
    if (!active) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [active])
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Prevents accidental dismissal during destructive or in-flight actions. */
  dismissible?: boolean
  icon?: ReactNode
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  icon,
}: ModalProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open)
  useLockScroll(open)

  useEffect(() => {
    if (!open || !dismissible) return
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, dismissible, onClose])

  if (!open) return null

  const width = { sm: 'max-w-[420px]', md: 'max-w-[560px]', lg: 'max-w-[720px]', xl: 'max-w-[920px]' }[size]

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <div
        className="fixed inset-0 animate-fade-in bg-ink-900/35 backdrop-blur-[1px]"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sc-modal-title"
        className={cn(
          'relative z-10 my-auto w-full animate-scale-in rounded-xl border border-line bg-surface shadow-modal',
          width,
        )}
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          {icon && <span className="mt-0.5 text-ink-500 [&_svg]:size-[18px]">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 id="sc-modal-title" className="text-h2 text-ink-900">
              {title}
            </h2>
            {description && <p className="mt-1 text-body-sm text-ink-500">{description}</p>}
          </div>
          {dismissible && (
            <Button variant="ghost" size="icon-sm" label="Close dialog" onClick={onClose} className="-mr-1 -mt-0.5">
              <X aria-hidden />
            </Button>
          )}
        </header>

        {children && <div className="px-5 py-4">{children}</div>}

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-muted px-5 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}

/* -------------------------------------------------------------------------- */
/* ConfirmationDialog                                                         */
/* -------------------------------------------------------------------------- */

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  requireNote,
  noteLabel = 'Add a note (optional)',
  notePlaceholder,
  note,
  onNoteChange,
  busy,
  consequences,
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'primary' | 'danger' | 'success'
  requireNote?: boolean
  noteLabel?: string
  notePlaceholder?: string
  note?: string
  onNoteChange?: (value: string) => void
  busy?: boolean
  consequences?: ReactNode
  children?: ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : 'primary'}
            onClick={onConfirm}
            loading={busy}
            disabled={requireNote && !note?.trim()}
            data-autofocus
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="text-body text-ink-600">{body}</div>

        {consequences && (
          <div className="rounded-md border border-line-subtle bg-surface-muted px-3 py-2.5 text-body-sm text-ink-600">
            {consequences}
          </div>
        )}

        {onNoteChange && (
          <label className="block">
            <span className="mb-1.5 block text-body-sm font-medium text-ink-700">{noteLabel}</span>
            <textarea
              value={note ?? ''}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder={notePlaceholder}
              rows={3}
              autoFocus
              className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-body text-ink-800 placeholder:text-ink-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            />
          </label>
        )}

        {children}
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Drawer                                                                     */
/* -------------------------------------------------------------------------- */

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-[520px]',
  side = 'right',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
  side?: 'right' | 'bottom'
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(open)
  useLockScroll(open)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const isBottom = side === 'bottom'

  return createPortal(
    <div className="fixed inset-0 z-[65] flex" role="presentation">
      <div className="absolute inset-0 animate-fade-in bg-ink-900/30" onClick={onClose} aria-hidden />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sc-drawer-title"
        className={cn(
          'relative z-10 flex flex-col border-line bg-surface shadow-modal',
          isBottom
            ? cn('mt-auto max-h-[82vh] w-full animate-sheet-up rounded-t-xl border-t', width)
            : cn('ml-auto h-full w-full animate-slide-in-right border-l', width),
        )}
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="sc-drawer-title" className="text-h2 text-ink-900">
              {title}
            </h2>
            {description && <p className="mt-1 text-body-sm text-ink-500">{description}</p>}
          </div>
          <Button variant="ghost" size="icon-sm" label="Close panel" onClick={onClose} className="-mr-1">
            <X aria-hidden />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-muted px-5 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
