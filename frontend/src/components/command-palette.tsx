import {
  ArrowRight,
  Bot,
  BookOpen,
  ClipboardCheck,
  CornerDownLeft,
  FileText,
  Gavel,
  MessageSquare,
  Search,
  Sparkles,
  User,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  useAgents,
  useConversations,
  useDecisions,
  useDocuments,
  useKnowledgeBases,
  useUsers,
} from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import { NAV_GROUPS } from '@/routes/navigation'
import { cn, formatRelativeTime } from '@/utils/format'

/**
 * CommandPalette — ⌘K / Ctrl+K across the whole platform.
 *
 * Results are grouped by the object a user actually thinks in: knowledge,
 * conversations, agents, decisions, people and navigation. Keyboard-first:
 * ↑ ↓ to move, ↵ to open, Esc to dismiss.
 */

interface Result {
  id: string
  group: string
  title: string
  subtitle: string
  href: string
  icon: ReactNode
  badge?: { label: string; tone: 'neutral' | 'brand' | 'info' | 'warning' | 'success' | 'danger' | 'agent' }
  action?: { label: string; run: () => void }
  /** Higher scores rank first; computed from a simple fuzzy match. */
  score: number
}

function scoreMatch(haystack: string, needle: string) {
  const text = haystack.toLowerCase()
  const query = needle.toLowerCase().trim()
  if (!query) return 0
  if (text === query) return 100
  if (text.startsWith(query)) return 80
  if (text.includes(query)) return 55
  // Token-wise match: every query token must appear somewhere.
  const tokens = query.split(/\s+/).filter(Boolean)
  if (tokens.every((token) => text.includes(token))) return 35
  return 0
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { can } = usePermissions()

  // Entity results come from the same services the pages use, so the palette
  // searches exactly what the API would return for this user — and only loads
  // once it is opened.
  const knowledgeBases = useKnowledgeBases()
  const documents = useDocuments()
  const conversations = useConversations()
  const agents = useAgents()
  const decisions = useDecisions()
  const users = useUsers()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [open])

  const results = useMemo<Result[]>(() => {
    const trimmed = query.trim()
    const collected: Result[] = []

    /* Navigation -------------------------------------------------------- */
    NAV_GROUPS.flatMap((group) => group.items)
      .filter((item) => can(item.permission))
      .forEach((item) => {
        const score = trimmed
          ? Math.max(scoreMatch(item.label, trimmed), scoreMatch(item.aliases?.join(' ') ?? '', trimmed), scoreMatch(item.summary, trimmed) * 0.6)
          : 12
        if (score > 0) {
          collected.push({
            id: `nav-${item.id}`,
            group: 'Go to',
            title: item.label,
            subtitle: item.summary,
            href: item.path,
            icon: <item.icon className="size-4" aria-hidden />,
            score,
          })
        }
      })

    /* Knowledge --------------------------------------------------------- */
    if (can('knowledge:view')) {
      const bases = knowledgeBases.data ?? []
      const documentsInScope = documents.data ?? []

      bases.forEach((base) => {
        const score = trimmed ? Math.max(scoreMatch(base.name, trimmed), scoreMatch(base.description, trimmed) * 0.6) : 0
        if (score > 0) {
          collected.push({
            id: `kb-${base.id}`,
            group: 'Knowledge',
            title: base.name,
            subtitle: `${base.department} · ${base.documentCount} documents`,
            href: `/knowledge?base=${base.id}`,
            icon: <BookOpen className="size-4" aria-hidden />,
            badge: { label: 'Knowledge base', tone: 'neutral' },
            score: score + 4,
          })
        }
      })
      documentsInScope.forEach((document) => {
        const score = Math.max(scoreMatch(document.name, trimmed), scoreMatch(document.tags.join(' '), trimmed) * 0.8)
        if (score > 0) {
          collected.push({
            id: `doc-${document.id}`,
            group: 'Knowledge',
            title: document.name,
            subtitle: `${document.department} · ${document.version} · updated ${formatRelativeTime(document.updatedAt)}`,
            href: `/knowledge/${document.id}`,
            icon: <FileText className="size-4" aria-hidden />,
            badge:
              document.status === 'ready'
                ? { label: 'Ready for AI', tone: 'success' }
                : document.status === 'failed'
                  ? { label: 'Failed', tone: 'danger' }
                  : { label: 'Processing', tone: 'info' },
            score,
          })
        }
      })
    }

    /* Conversations ------------------------------------------------------ */
    if (can('assistant:use')) {
      const threads = conversations.data ?? []
      threads.forEach((conversation) => {
        const score = scoreMatch(conversation.title, trimmed)
        if (score > 0) {
          collected.push({
            id: `conv-${conversation.id}`,
            group: 'AI conversations',
            title: conversation.title,
            subtitle: `${conversation.department} · ${conversation.messageCount} messages · ${formatRelativeTime(conversation.updatedAt)}`,
            href: `/assistant/${conversation.id}`,
            icon: <MessageSquare className="size-4" aria-hidden />,
            score: score + 2,
          })
        }
      })
    }

    /* Agents ------------------------------------------------------------- */
    if (can('agents:view')) {
      const registeredAgents = agents.data ?? []
      registeredAgents.forEach((agent) => {
        const score = Math.max(scoreMatch(agent.name, trimmed), scoreMatch(agent.purpose, trimmed) * 0.7)
        if (score > 0) {
          collected.push({
            id: `agent-${agent.id}`,
            group: 'Agents',
            title: agent.name,
            subtitle: agent.purpose,
            href: `/agents/${agent.id}`,
            icon: <Bot className="size-4" aria-hidden />,
            badge: { label: agent.department, tone: 'agent' },
            score: score + 3,
          })
        }
      })
    }

    /* Decisions & approvals ---------------------------------------------- */
    if (can('decisions:view')) {
      const decisionQueue = decisions.data ?? []
      decisionQueue.forEach((decision) => {
        const score = Math.max(scoreMatch(decision.title, trimmed), scoreMatch(decision.issue, trimmed) * 0.5)
        if (score > 0) {
          collected.push({
            id: `dec-${decision.id}`,
            group: 'Decisions & approvals',
            title: decision.title,
            subtitle: `${decision.detectedBy.agentName} · ${decision.risk} risk · ${decision.status.replace(/_/g, ' ')}`,
            href: `/decisions/${decision.id}`,
            icon: <Gavel className="size-4" aria-hidden />,
            badge: { label: decision.risk === 'high' ? 'High risk' : decision.risk === 'medium' ? 'Medium risk' : 'Low risk', tone: decision.risk === 'high' ? 'danger' : decision.risk === 'medium' ? 'warning' : 'success' },
            score,
          })
        }
      })
    }

    if (can('approvals:view') && !trimmed) {
      collected.push({
        id: 'nav-approvals',
        group: 'Actions',
        title: 'Review approval queue',
        subtitle: 'Requests waiting on a human decision',
        href: '/approvals',
        icon: <ClipboardCheck className="size-4" aria-hidden />,
        score: 6,
      })
    }

    if (can('assistant:use') && !trimmed) {
      collected.push({
        id: 'action-new-ask',
        group: 'Actions',
        title: 'Ask SmartCorp a question',
        subtitle: 'Permission-aware answer with citations',
        href: '/assistant',
        icon: <Sparkles className="size-4" aria-hidden />,
        score: 6,
      })
    }

    /* People -------------------------------------------------------------- */
    if (can('users:view')) {
      const directory = users.data ?? []
      directory.forEach((user) => {
        const score = Math.max(scoreMatch(user.name, trimmed), scoreMatch(user.email, trimmed) * 0.8)
        if (score > 0) {
          collected.push({
            id: `user-${user.id}`,
            group: 'People',
            title: user.name,
            subtitle: `${user.jobTitle} · ${user.department}`,
            href: '/users',
            icon: <User className="size-4" aria-hidden />,
            badge: { label: user.role, tone: 'neutral' },
            score,
          })
        }
      })
    }

    return collected.sort((a, b) => b.score - a.score).slice(0, 18)
  }, [
    query,
    can,
    knowledgeBases.data,
    documents.data,
    conversations.data,
    agents.data,
    decisions.data,
    users.data,
  ])

  const grouped = useMemo(() => {
    const map = new Map<string, Result[]>()
    results.forEach((result) => {
      const list = map.get(result.group) ?? []
      list.push(result)
      map.set(result.group, list)
    })
    return [...map.entries()]
  }, [results])

  // Keep keyboard selection in range when the result set changes.
  useEffect(() => setActiveIndex(0), [query])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, results.length - 1))
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const active = results[activeIndex]
        if (active) {
          if (active.action) active.action.run()
          else navigate(active.href)
          onClose()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, results, activeIndex, navigate, onClose])

  // Scroll the active row into view during keyboard navigation.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  let flatIndex = -1

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[12vh] sm:pt-[14vh]">
      <div className="fixed inset-0 animate-fade-in bg-ink-900/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-[640px] animate-fade-in-up overflow-hidden rounded-xl border border-line bg-surface shadow-modal"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-ink-400" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search knowledge, conversations, agents, decisions, people…"
            aria-label="Search SmartCorp"
            aria-controls="command-results"
            aria-activedescendant={results[activeIndex] ? `cmd-${results[activeIndex].id}` : undefined}
            className="h-12 w-full bg-transparent text-body text-ink-900 placeholder:text-ink-300 focus:outline-none"
          />
          <span className="kbd shrink-0">Esc</span>
        </div>

        <div ref={listRef} id="command-results" role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <div className="px-3 py-10 text-center">
              <p className="text-body font-medium text-ink-700">No matches for “{query}”</p>
              <p className="mt-1 text-body-sm text-ink-400">
                Try a document name, an agent, a decision, or a section such as “audit”.
              </p>
            </div>
          )}

          {grouped.map(([group, items]) => (
            <div key={group} className="mb-1 last:mb-0">
              <p className="px-2.5 pb-1 pt-2 text-label uppercase text-ink-400">{group}</p>
              {items.map((result) => {
                flatIndex += 1
                const index = flatIndex
                const active = index === activeIndex
                return (
                  <button
                    key={result.id}
                    id={`cmd-${result.id}`}
                    data-index={index}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      if (result.action) result.action.run()
                      else navigate(result.href)
                      onClose()
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                      active ? 'bg-surface-muted' : 'hover:bg-surface-muted/60',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-surface text-ink-500',
                        active && 'border-brand-200 bg-brand-50 text-brand-700',
                      )}
                    >
                      {result.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-medium text-ink-900">{result.title}</span>
                      <span className="block truncate text-caption text-ink-400">{result.subtitle}</span>
                    </span>
                    {result.badge && (
                      <StatusBadge tone={result.badge.tone} size="sm" className="shrink-0">
                        {result.badge.label}
                      </StatusBadge>
                    )}
                    {active && <CornerDownLeft className="size-3.5 shrink-0 text-ink-400" aria-hidden />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-muted px-4 py-2 text-caption text-ink-400">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="kbd">↑</span>
              <span className="kbd">↓</span>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <span className="kbd">↵</span>
              open
            </span>
            <span className="flex items-center gap-1">
              <span className="kbd">Esc</span>
              close
            </span>
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            Scoped to your role
            <ArrowRight className="size-3" aria-hidden />
            API enforces access
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
