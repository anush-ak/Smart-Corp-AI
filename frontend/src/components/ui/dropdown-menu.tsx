import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cn } from '@/utils/format'

interface MenuContextValue {
  open: boolean
  setOpen: (value: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  panelRef: React.RefObject<HTMLDivElement | null>
  align: 'start' | 'end'
}

const MenuContext = createContext<MenuContextValue | null>(null)

function useMenu() {
  const context = useContext(MenuContext)
  if (!context) throw new Error('Menu components must be used inside <DropdownMenu>')
  return context
}

/**
 * DropdownMenu — anchored popover used for row actions, filters and account
 * menus. Keyboard accessible by default: Escape closes and restores focus,
 * outside pointer events dismiss, and focus moves to the first menu item.
 */
export function DropdownMenu({
  children,
  align = 'end',
  className,
}: {
  children: ReactNode
  align?: 'start' | 'end'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const first = panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')
    first?.focus()
  }, [open])

  return (
    <MenuContext.Provider value={{ open, setOpen, triggerRef, panelRef, align }}>
      <div ref={rootRef} className={cn('relative', className)}>
        {children}
      </div>
    </MenuContext.Provider>
  )
}

/**
 * MenuTrigger — clones its child button and wires the open/close behaviour,
 * so callers keep full control of the button's own styling and semantics.
 */
export function MenuTrigger({
  children,
  asChild = true,
}: {
  children: ReactElement<{ onClick?: (event: React.MouseEvent) => void; 'aria-expanded'?: boolean; 'aria-haspopup'?: string; ref?: React.Ref<HTMLElement> }>
  asChild?: boolean
}) {
  const { open, setOpen, triggerRef } = useMenu()

  if (!asChild || !isValidElement(children)) {
    return (
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        {children}
      </button>
    )
  }

  return cloneElement(children, {
    ref: triggerRef,
    'aria-expanded': open,
    'aria-haspopup': 'menu',
    onClick: (event: React.MouseEvent) => {
      children.props.onClick?.(event)
      setOpen(!open)
    },
  })
}

export function MenuPanel({
  children,
  className,
  width = 220,
  placement = 'below',
}: {
  children: ReactNode
  className?: string
  width?: number
  /** `above` anchors the panel upwards — used by the sidebar account menu. */
  placement?: 'below' | 'above' | 'below-start' | 'above-start'
}) {
  const { open, setOpen, panelRef, align } = useMenu()
  if (!open) return null

  const side = align === 'end' ? 'right-0' : 'left-0'
  const position = {
    below: `top-[calc(100%+6px)] ${side}`,
    above: `bottom-[calc(100%+6px)] ${side}`,
    'below-start': 'top-[calc(100%+6px)] left-0',
    'above-start': 'bottom-[calc(100%+6px)] left-0',
  }[placement]

  return (
    <div
      ref={panelRef}
      role="menu"
      style={{ width }}
      onClick={() => setOpen(false)}
      className={cn(
        'absolute z-40 max-w-[calc(100vw-1.5rem)] animate-fade-in-down overflow-hidden rounded-md border border-line bg-surface p-1 shadow-pop',
        position,
        className,
      )}
    >
      <div className="max-h-[min(70vh,460px)] overflow-y-auto">{children}</div>
    </div>
  )
}

export function MenuItem({
  children,
  icon,
  onSelect,
  disabled,
  destructive,
  hint,
  className,
}: {
  children: ReactNode
  icon?: ReactNode
  onSelect?: () => void
  disabled?: boolean
  destructive?: boolean
  hint?: string
  className?: string
}) {
  const { setOpen } = useMenu()
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onSelect?.()
        setOpen(false)
      }}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body-sm transition-colors',
        'focus-visible:bg-surface-muted focus-visible:outline-none',
        disabled && 'pointer-events-none opacity-45',
        destructive ? 'text-danger-700 hover:bg-danger-50' : 'text-ink-700 hover:bg-surface-muted',
        className,
      )}
    >
      {icon && <span className="shrink-0 text-ink-400 [&_svg]:size-4">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="kbd shrink-0">{hint}</span>}
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-2 pb-1 pt-2 text-label uppercase text-ink-400">{children}</p>
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line-subtle" />
}
