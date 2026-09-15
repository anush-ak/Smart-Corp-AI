import { Check, CircleAlert, Info, TriangleAlert, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/format'

/* -------------------------------------------------------------------------- */
/* Toasts — lightweight, non-blocking confirmation of user actions.            */
/* -------------------------------------------------------------------------- */

export interface Toast {
  id: string
  title: string
  description?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  action?: { label: string; onClick: () => void }
  durationMs?: number
}

interface ToastContextValue {
  toast: (input: Omit<Toast, 'id'> & { id?: string }) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback<ToastContextValue['toast']>(
    (input) => {
      const id = input.id ?? `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
      setToasts((current) => [...current.slice(-3), { ...input, id }])
      const duration = input.durationMs ?? 5200
      if (duration > 0) window.setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} toast={item} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  )
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntering(false))
    return () => cancelAnimationFrame(raf)
  }, [])

  const tone = toast.tone ?? 'neutral'
  const icon = {
    neutral: <Info aria-hidden />,
    info: <Info aria-hidden />,
    success: <Check aria-hidden />,
    warning: <TriangleAlert aria-hidden />,
    danger: <CircleAlert aria-hidden />,
  }[tone]

  const iconTone = {
    neutral: 'text-ink-400',
    info: 'text-info-600',
    success: 'text-success-600',
    warning: 'text-warning-600',
    danger: 'text-danger-600',
  }[tone]

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-pop transition-all duration-200 ease-out',
        entering ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100',
      )}
    >
      <span className={cn('mt-0.5 shrink-0 [&_svg]:size-4', iconTone)}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-medium text-ink-900">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-caption text-ink-500">{toast.description}</p>}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick()
              onDismiss(toast.id)
            }}
            className="mt-2 text-caption font-semibold text-brand-700 hover:text-brand-800 hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="-mr-1 -mt-1 grid size-6 shrink-0 place-items-center rounded-sm text-ink-300 transition-colors hover:bg-surface-muted hover:text-ink-600"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}
