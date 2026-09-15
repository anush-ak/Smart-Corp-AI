import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  UserCog,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { BrandMark, BrandWordmark } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { DropdownMenu, MenuItem, MenuLabel, MenuPanel, MenuSeparator, MenuTrigger } from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tooltip } from '@/components/ui/tooltip'
import { ROLE_LABELS, useAuth } from '@/contexts/auth-context'
import { useDemoAccounts } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import { NAV_GROUPS } from '@/routes/navigation'
import { cn } from '@/utils/format'
import { Avatar } from '@/components/ui/avatar'

/**
 * Sidebar — one unified navigation surface for the whole platform.
 *
 * Group headers (Workspace / Intelligence / Governance / System) make the
 * single-system story legible: knowledge, agents, decisions and governance are
 * layers of one product, not separate tools. Items the current role cannot use
 * are hidden, with the reason stated in Users & Roles and the Security centre.
 */
export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const { can } = usePermissions()
  const { user, organization, switchUser } = useAuth()
  const demoAccounts = useDemoAccounts()
  const switchable = (demoAccounts.data?.users ?? []).filter((candidate) => candidate.id !== user?.id)
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(item.permission)),
  })).filter((group) => group.items.length > 0)

  return (
    <>
      {/* Mobile scrim */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 animate-fade-in bg-ink-900/30 lg:hidden" onClick={onCloseMobile} aria-hidden />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface transition-[width,transform] duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          collapsed ? 'lg:w-[60px]' : 'lg:w-[244px]',
          'w-[268px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand ------------------------------------------------------------ */}
        <div className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-3', collapsed && 'lg:justify-center lg:px-0')}>
          <BrandMark size={26} />
          <BrandWordmark className={cn('flex-1', collapsed && 'lg:hidden')} />
          <Button
            variant="ghost"
            size="icon-sm"
            label="Close navigation"
            className="lg:hidden"
            onClick={onCloseMobile}
          >
            <X aria-hidden />
          </Button>
        </div>

        {/* Workspace selector ------------------------------------------------ */}
        <div className={cn('shrink-0 border-b border-line px-2.5 py-2.5', collapsed && 'lg:px-2')}>
          <DropdownMenu className={cn(collapsed && 'lg:hidden')}>
            <MenuTrigger>
            <button
              type="button"
              className="group flex w-full items-center gap-2.5 rounded-md border border-line bg-surface px-2 py-1.5 text-left shadow-xs transition-colors hover:border-line-strong hover:bg-surface-muted"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-sm bg-ink-800 text-[10px] font-semibold text-white">
                {organization?.name.slice(0, 1) ?? 'N'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-medium text-ink-900">
                  {organization?.name ?? 'Northwind Industries'}
                </span>
                <span className="block truncate text-[11px] text-ink-400">{organization?.plan ?? 'Enterprise'} workspace</span>
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-ink-400 transition-transform group-hover:text-ink-600" aria-hidden />
            </button>
            </MenuTrigger>
            <MenuPanel width={252} placement="below-start">
              <MenuLabel>Organisation</MenuLabel>
              <MenuItem icon={<ShieldCheck aria-hidden />} onSelect={() => navigate('/security')}>
                {organization?.name ?? 'Northwind Industries'}
              </MenuItem>
              <MenuItem icon={<Settings aria-hidden />} onSelect={() => navigate('/settings')}>
                Workspace settings
              </MenuItem>
              <MenuSeparator />
              <MenuLabel>Region</MenuLabel>
              <MenuItem disabled>{organization?.dataRegion ?? 'ap-south-1 (Mumbai)'}</MenuItem>
            </MenuPanel>
          </DropdownMenu>

          {collapsed && (
            <Tooltip label={organization?.name ?? 'Northwind Industries'} side="right">
              <button
                type="button"
                className="hidden size-9 place-items-center rounded-md border border-line bg-surface text-[11px] font-semibold text-ink-800 lg:grid"
                onClick={() => navigate('/settings')}
                aria-label="Workspace"
              >
                {organization?.name.slice(0, 1) ?? 'N'}
              </button>
            </Tooltip>
          )}
        </div>

        {/* New conversation shortcut --------------------------------------- */}
        {can('assistant:use') && (
          <div className={cn('px-2.5 pt-2.5', collapsed && 'lg:px-2')}>
            <NavLink
              to="/assistant"
              className={cn(
                'flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-1.5 text-body-sm font-medium text-ink-700 shadow-xs transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800',
                collapsed && 'lg:justify-center lg:px-0',
              )}
            >
              <Plus className="size-4 shrink-0 text-ink-400" aria-hidden />
              <span className={cn('truncate', collapsed && 'lg:hidden')}>Ask SmartCorp</span>
            </NavLink>
          </div>
        )}

        {/* Navigation groups ------------------------------------------------ */}
        <nav aria-label="Primary navigation" className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4 pt-3.5">
          {visibleGroups.map((group) => (
            <div key={group.id} className="mb-4 last:mb-0">
              <p
                className={cn(
                  'mb-1.5 px-2 text-label uppercase text-ink-400',
                  collapsed && 'lg:sr-only',
                )}
              >
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      onClick={onCloseMobile}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-2.5 rounded-md px-2 py-[7px] text-body-sm font-medium transition-colors',
                          collapsed && 'lg:justify-center lg:px-0',
                          isActive
                            ? 'bg-brand-50 text-brand-800'
                            : 'text-ink-600 hover:bg-surface-muted hover:text-ink-900',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            aria-hidden
                            className={cn(
                              'absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full transition-opacity',
                              isActive ? 'bg-brand-600 opacity-100' : 'opacity-0',
                            )}
                          />
                          <item.icon
                            className={cn('size-4 shrink-0', isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600')}
                            aria-hidden
                          />
                          <span className={cn('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* User footer & collapse control ----------------------------------- */}
        <div className="shrink-0 border-t border-line p-2.5">
          <DropdownMenu className={cn(collapsed && 'lg:hidden')}>
            <MenuTrigger>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-surface-muted"
            >
              <Avatar name={user?.name ?? 'User'} color={user?.avatarColor} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-medium text-ink-900">{user?.name}</span>
                <span className="block truncate text-[11px] text-ink-400">
                  {user ? ROLE_LABELS[user.role] : 'Not signed in'} · {user?.department}
                </span>
              </span>
              <ChevronsLeft className="size-3.5 shrink-0 rotate-90 text-ink-400" aria-hidden />
            </button>
            </MenuTrigger>
            <MenuPanel width={264} placement="above-start">
              <div className="px-2 py-2">
                <p className="text-body-sm font-medium text-ink-900">{user?.name}</p>
                <p className="mt-0.5 truncate text-caption text-ink-400">{user?.email}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <StatusBadge tone="brand" size="sm">
                    {user ? ROLE_LABELS[user.role] : 'Guest'}
                  </StatusBadge>
                  <StatusBadge tone="neutral" size="sm">
                    {user?.department}
                  </StatusBadge>
                </div>
              </div>
              <MenuSeparator />
              <MenuItem icon={<UserCog aria-hidden />} onSelect={() => navigate('/settings')}>
                Profile & preferences
              </MenuItem>
              <MenuItem icon={<LogOut aria-hidden />} onSelect={() => navigate('/login')}>
                Sign out
              </MenuItem>
              <MenuSeparator />
              <MenuLabel>Demo · switch role</MenuLabel>
              {switchable.map((candidate) => (
                <MenuItem
                  key={candidate.id}
                  icon={<Avatar name={candidate.name} color={candidate.avatarColor} size="xs" />}
                  disabled={switching}
                  onSelect={async () => {
                    setSwitching(true)
                    await switchUser(candidate.id)
                    setSwitching(false)
                    navigate('/overview')
                  }}
                >
                  {candidate.name} · {ROLE_LABELS[candidate.role]}
                </MenuItem>
              ))}
            </MenuPanel>
          </DropdownMenu>

          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              'mt-1.5 hidden w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-body-sm text-ink-500 transition-colors hover:bg-surface-muted hover:text-ink-800 lg:flex',
              collapsed && 'lg:justify-center lg:px-0',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronsRight className="size-4 shrink-0" aria-hidden />
            ) : (
              <>
                <ChevronsLeft className="size-4 shrink-0" aria-hidden />
                <span>Collapse</span>
                <span className="kbd ml-auto">[</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
