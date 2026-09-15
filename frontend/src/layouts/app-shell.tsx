import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { CommandPalette } from '@/components/command-palette'
import { findNavItem } from '@/routes/navigation'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

/**
 * AppShell — the persistent frame for the whole platform.
 *
 * Left sidebar (navigation), top bar (context, ⌘K, AI status, notifications) and
 * a max-width content region. The shell stays quiet; the content area carries
 * the emphasis. Sidebar and command palette state live here so every page
 * inherits identical behaviour.
 */
export function AppShell() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('smartcorp.sidebar') === 'collapsed'
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const navItem = findNavItem(location.pathname)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem('smartcorp.sidebar', next ? 'collapsed' : 'expanded')
      return next
    })
  }, [])

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Global shortcuts: ⌘K / Ctrl+K for the palette, "[" to collapse the sidebar.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      if (event.key === '[' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        toggleCollapsed()
      }
    }
    const onToggleRequest = () => toggleCollapsed()

    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('smartcorp:toggle-sidebar', onToggleRequest)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('smartcorp:toggle-sidebar', onToggleRequest)
    }
  }, [toggleCollapsed])

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          pageTitle={navItem?.label ?? 'SmartCorp AI'}
          pagePurpose={navItem?.purpose}
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenCommandPalette={() => setPaletteOpen(true)}
        />

        <main id="main-content" className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

/** Skip link — first focusable element on every page. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-line focus:bg-surface focus:px-3 focus:py-2 focus:text-body-sm focus:font-medium focus:text-ink-900 focus:shadow-pop"
    >
      Skip to main content
    </a>
  )
}
