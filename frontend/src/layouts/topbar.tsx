import {
  Bell,
  Check,
  CircleHelp,
  Menu as MenuIcon,
  Search,
  Sparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, MenuItem, MenuLabel, MenuPanel, MenuSeparator, MenuTrigger } from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tooltip } from '@/components/ui/tooltip'
import { useAuth } from '@/contexts/auth-context'
import { useNotifications } from '@/hooks/use-api'
import { notificationService } from '@/services'
import { cn, formatRelativeTime } from '@/utils/format'
import type { Notification } from '@/types'
import { useEffect, useState } from 'react'

const KIND_TONE: Record<Notification['kind'], 'warning' | 'info' | 'brand' | 'danger' | 'success'> = {
  approval: 'warning',
  agent: 'info',
  evaluation: 'brand',
  security: 'danger',
  knowledge: 'success',
}

/**
 * Topbar — page context, global command access, AI status and notifications.
 * Kept visually quiet and 56px tall so the content area keeps the attention.
 */
export function Topbar({
  pageTitle,
  pagePurpose,
  onOpenMobileNav,
  onOpenCommandPalette,
}: {
  pageTitle: string
  pagePurpose?: string
  onOpenMobileNav: () => void
  onOpenCommandPalette: () => void
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data } = useNotifications()
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (data) setNotifications(data)
  }, [data])

  const unread = notifications.filter((item) => !item.read).length

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon-sm" label="Open navigation" className="lg:hidden" onClick={onOpenMobileNav}>
        <MenuIcon aria-hidden />
      </Button>

      {/* Page context ------------------------------------------------------ */}
      <div className="hidden min-w-0 items-baseline gap-2.5 sm:flex">
        <h1 className="truncate text-h3 text-ink-900">{pageTitle}</h1>
        {pagePurpose && (
          <>
            <span aria-hidden className="text-ink-200">
              /
            </span>
            <p className="truncate text-body-sm text-ink-400">{pagePurpose}</p>
          </>
        )}
      </div>

      {/* Command palette trigger ------------------------------------------ */}
      <button
        type="button"
        onClick={onOpenCommandPalette}
        className="group ml-auto flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-ink-400 shadow-xs transition-colors hover:border-line-strong hover:text-ink-600 sm:w-[240px] sm:justify-start sm:gap-2 sm:px-2.5"
        aria-label="Open command palette"
      >
        <Search className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden flex-1 text-left text-body-sm text-ink-400 sm:block">Search or jump to…</span>
        <span className="kbd hidden sm:inline-flex">⌘K</span>
      </button>

      {/* AI platform status ------------------------------------------------ */}
      <Tooltip
        side="bottom"
        label={
          <span className="block space-y-1">
            <span className="block font-semibold">Platform status: Operational</span>
            <span className="block text-white/70">
              Vector store reachable · 3 agents registered · last evaluation completed 14 Sept 2026
            </span>
          </span>
        }
      >
        <button
          type="button"
          onClick={() => navigate('/evaluation')}
          className="hidden items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1.5 text-caption font-medium text-ink-600 shadow-xs transition-colors hover:border-line-strong hover:text-ink-800 md:inline-flex"
        >
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-pulse-soft rounded-full bg-success-600" />
          </span>
          AI operational
        </button>
      </Tooltip>

      <div className="flex items-center gap-0.5">
        {/* Help ----------------------------------------------------------- */}
        <DropdownMenu>
          <MenuTrigger>
            <Button variant="ghost" size="icon-sm" label="Help and keyboard shortcuts">
              <CircleHelp aria-hidden />
            </Button>
          </MenuTrigger>
          <MenuPanel width={268}>
            <MenuLabel>Quick reference</MenuLabel>
            <MenuItem hint="⌘K" onSelect={onOpenCommandPalette}>
              Open command palette
            </MenuItem>
            <MenuItem hint="[" onSelect={() => window.dispatchEvent(new CustomEvent('smartcorp:toggle-sidebar'))}>
              Collapse or expand sidebar
            </MenuItem>
            <MenuItem hint="Esc" onSelect={() => undefined}>
              Close panels and dialogs
            </MenuItem>
            <MenuSeparator />
            <MenuLabel>How SmartCorp works</MenuLabel>
            <MenuItem icon={<Sparkles aria-hidden />} onSelect={() => navigate('/assistant')}>
              AI answers with citations
            </MenuItem>
            <MenuItem onSelect={() => navigate('/decisions')}>
              AI recommends. Humans decide.
            </MenuItem>
            <MenuItem onSelect={() => navigate('/security')}>
              Access is enforced, not hidden
            </MenuItem>
          </MenuPanel>
        </DropdownMenu>

        {/* Notifications --------------------------------------------------- */}
        <DropdownMenu>
          <MenuTrigger>
            <Button variant="ghost" size="icon-sm" label={`Notifications, ${unread} unread`} className="relative">
              <Bell aria-hidden />
              {unread > 0 && (
                <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-brand-600 text-[9px] font-semibold text-white">
                  {unread}
                </span>
              )}
            </Button>
          </MenuTrigger>
          <MenuPanel width={340}>
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-body-sm font-semibold text-ink-900">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-caption font-medium text-brand-700 hover:text-brand-800"
                  onClick={async () => setNotifications(await notificationService.markRead({ all: true }))}
                >
                  <Check className="size-3" aria-hidden />
                  Mark all read
                </button>
              )}
            </div>
            <MenuSeparator />
            <div className="max-h-[320px] overflow-y-auto">
              {notifications.length === 0 && (
                <p className="px-2 py-6 text-center text-body-sm text-ink-400">You’re all caught up.</p>
              )}
              {notifications.slice(0, 6).map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    setNotifications((current) =>
                      current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
                    )
                    void notificationService.markRead({ id: notification.id })
                    navigate(notification.href)
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-sm px-2 py-2 text-left transition-colors hover:bg-surface-muted',
                    !notification.read && 'bg-brand-50/40',
                  )}
                >
                  <span className={cn('mt-1 size-1.5 shrink-0 rounded-full', !notification.read ? 'bg-brand-600' : 'bg-transparent')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-body-sm font-medium text-ink-900">{notification.title}</span>
                      <span className="shrink-0 text-[11px] text-ink-400">{formatRelativeTime(notification.at)}</span>
                    </span>
                    <span className="mt-0.5 block text-caption leading-snug text-ink-500">{notification.body}</span>
                    <StatusBadge tone={KIND_TONE[notification.kind]} size="sm" className="mt-1.5">
                      {notification.kind}
                    </StatusBadge>
                  </span>
                </button>
              ))}
            </div>
          </MenuPanel>
        </DropdownMenu>

        {/* Account --------------------------------------------------------- */}
        <DropdownMenu className="ml-1">
          <MenuTrigger>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md py-0.5 pl-0.5 pr-1 transition-colors hover:bg-surface-muted"
              aria-label="Account menu"
            >
              <Avatar name={user?.name ?? 'User'} color={user?.avatarColor} size="sm" />
            </button>
          </MenuTrigger>
          <MenuPanel width={252}>
            <div className="px-2 py-2">
              <p className="text-body-sm font-medium text-ink-900">{user?.name}</p>
              <p className="mt-0.5 truncate text-caption text-ink-400">{user?.email}</p>
            </div>
            <MenuSeparator />
            <MenuItem onSelect={() => navigate('/settings')}>Profile & preferences</MenuItem>
            <MenuItem onSelect={() => navigate('/users')}>Access & permissions</MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={() => navigate('/login')}>Sign out</MenuItem>
          </MenuPanel>
        </DropdownMenu>
      </div>
    </header>
  )
}
