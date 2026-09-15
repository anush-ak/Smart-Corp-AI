import { ChevronDown, Download, ScrollText, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, PageBody, PageHeader } from '@/components/ui/primitives'
import { AuditResultBadge, StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState, NoResultsState } from '@/components/ui/states'
import { TableToolbar } from '@/components/ui/table-toolbar'
import { Tooltip } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'
import { useAuditEvents } from '@/hooks/use-api'
import { useDebouncedValue } from '@/hooks/use-async'
import { ROLE_LABELS } from '@/contexts/auth-context'
import type { AuditEvent } from '@/types'
import { cn, formatDateTime, formatRelativeTime } from '@/utils/format'

/**
 * Audit explorer.
 *
 * Readable human language first — the summary line states what happened in plain
 * words — with the technical payload available on expand for engineers and
 * auditors. Every entry carries actor, action, resource, result and request id.
 */

const ACTION_LABELS: Record<AuditEvent['action'], string> = {
  login: 'Login',
  logout: 'Logout',
  document_uploaded: 'Document uploaded',
  document_accessed: 'Document accessed',
  document_published: 'Document published',
  ai_query: 'AI query',
  agent_executed: 'Agent executed',
  decision_generated: 'Decision generated',
  approval_granted: 'Approval granted',
  approval_rejected: 'Approval rejected',
  permission_changed: 'Permission changed',
  permission_denied: 'Permission denied',
  evaluation_run: 'Evaluation run',
  meeting_processed: 'Meeting processed',
}

function AuditRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <li className="px-4 py-3.5 transition-colors hover:bg-surface-muted/40">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        {/* Actor --------------------------------------------------------- */}
        <div className="flex min-w-[190px] items-center gap-2.5">
          {event.actorRole === 'system' ? (
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface-muted text-ink-500" aria-hidden>
              <ShieldCheck className="size-3" />
            </span>
          ) : (
            <Avatar name={event.actorName} size="sm" />
          )}
          <div className="min-w-0">
            <p className="truncate text-body-sm font-medium text-ink-800">{event.actorName}</p>
            <p className="text-[11px] text-ink-400">
              {event.actorRole === 'system' ? 'Automated system action' : ROLE_LABELS[event.actorRole] ?? event.actorRole}
            </p>
          </div>
        </div>

        {/* What happened ------------------------------------------------- */}
        <div className="min-w-0 flex-1">
          <p className="text-body-sm text-ink-800">{event.summary}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusBadge tone="neutral" size="sm">
              {ACTION_LABELS[event.action]}
            </StatusBadge>
            <span className="text-caption text-ink-400">
              Resource: <span className="font-mono text-ink-500">{event.resource.type}/{event.resource.id}</span>
            </span>
            <AuditResultBadge result={event.result} size="sm" />
            <Tooltip label={formatDateTime(event.at)}>
              <span className="text-caption text-ink-400">{formatRelativeTime(event.at)}</span>
            </Tooltip>
          </div>
        </div>

        <Button
          variant="ghost"
          size="xs"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="shrink-0"
          iconRight={<ChevronDown className={cn('transition-transform', expanded && 'rotate-180')} aria-hidden />}
        >
          {expanded ? 'Hide details' : 'Technical details'}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 grid gap-3 border-t border-line-subtle pt-3 sm:grid-cols-2">
          <dl className="space-y-1.5">
            {[
              ['Request id', event.requestId],
              ['IP address', event.ipAddress],
              ['Client', event.userAgent],
              ['Resource', `${event.resource.type} · ${event.resource.label}`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="text-caption text-ink-400">{label}</dt>
                <dd className="truncate font-mono text-[11px] text-ink-600">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-md border border-line-subtle bg-surface-muted/60 p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Payload</p>
            <pre className="mt-1.5 overflow-x-auto font-mono text-[11px] leading-relaxed text-ink-600">
              {JSON.stringify(event.technical, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </li>
  )
}

export function AuditLogsPage() {
  const { toast } = useToast()
  const audit = useAuditEvents()

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 180)
  const [actionFilter, setActionFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [rangeFilter, setRangeFilter] = useState('30d')

  const rows = audit.data ?? []
  const actors = useMemo(() => [...new Set(rows.map((event) => event.actorName))].sort(), [rows])

  const filtered = useMemo(() => {
    const now = Date.now()
    const rangeMs = rangeFilter === '24h' ? 86400000 : rangeFilter === '7d' ? 604800000 : rangeFilter === '30d' ? 2592000000 : null

    return rows.filter((event) => {
      if (rangeMs && now - new Date(event.at).getTime() > rangeMs) return false
      if (actionFilter && event.action !== actionFilter) return false
      if (actorFilter && event.actorName !== actorFilter) return false
      if (resultFilter && event.result !== resultFilter) return false
      if (debouncedQuery) {
        const haystack = `${event.summary} ${event.actorName} ${event.resource.label} ${event.resource.id} ${event.requestId}`.toLowerCase()
        if (!haystack.includes(debouncedQuery.toLowerCase())) return false
      }
      return true
    })
  }, [rows, actionFilter, actorFilter, resultFilter, rangeFilter, debouncedQuery])

  const exportCsv = () => {
    const header = ['Timestamp', 'Actor', 'Role', 'Action', 'Summary', 'Resource', 'Result', 'IP', 'Request ID']
    const lines = filtered.map((event) =>
      [
        event.at,
        event.actorName,
        event.actorRole,
        event.action,
        `"${event.summary.replace(/"/g, '""')}"`,
        `${event.resource.type}/${event.resource.id}`,
        event.result,
        event.ipAddress,
        event.requestId,
      ].join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `smartcorp-audit-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Audit export started', description: `${filtered.length} events written to CSV with request ids for correlation.`, tone: 'success' })
  }

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="Every AI and human action, in order and in plain language. Technical detail is available on expand for auditors and engineers."
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <ScrollText className="size-3.5 text-ink-400" aria-hidden />
              {rows.length} events in the retained window
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-ink-400" aria-hidden />
              Append-only · 730-day retention
            </span>
          </>
        }
        actions={
          <Button variant="secondary" iconLeft={<Download aria-hidden />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <PageBody className="space-y-4">
        <TableToolbar
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search by summary, actor, resource or request id…"
          filters={[
            {
              id: 'action',
              label: 'Event type',
              value: actionFilter,
              onChange: setActionFilter,
              options: [{ value: '', label: 'All event types' }, ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))],
            },
            {
              id: 'actor',
              label: 'User',
              value: actorFilter,
              onChange: setActorFilter,
              hideBelow: 'md',
              options: [{ value: '', label: 'All actors' }, ...actors.map((name) => ({ value: name, label: name }))],
            },
            {
              id: 'result',
              label: 'Result',
              value: resultFilter,
              onChange: setResultFilter,
              hideBelow: 'lg',
              options: [
                { value: '', label: 'Any result' },
                { value: 'success', label: 'Success' },
                { value: 'failure', label: 'Failure' },
                { value: 'denied', label: 'Denied' },
              ],
            },
            {
              id: 'range',
              label: 'Period',
              value: rangeFilter,
              onChange: setRangeFilter,
              hideBelow: 'lg',
              options: [
                { value: '24h', label: 'Last 24 hours' },
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
                { value: 'all', label: 'All retained' },
              ],
            },
          ]}
          showReset={Boolean(query || actionFilter || actorFilter || resultFilter || rangeFilter !== '30d')}
          onReset={() => {
            setQuery('')
            setActionFilter('')
            setActorFilter('')
            setResultFilter('')
            setRangeFilter('30d')
          }}
        />

        {audit.error ? (
          <ErrorState title="Audit log could not be loaded" cause={audit.error.message} onRetry={audit.reload} />
        ) : audit.initialLoading ? (
          <Card>
            <LoadingState rows={6} />
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            {rows.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="No audit events in this window"
                description="Logins, document access, AI queries, agent executions, decisions, approvals and permission changes are all recorded here."
              />
            ) : (
              <NoResultsState
                query={debouncedQuery}
                onClear={() => {
                  setQuery('')
                  setActionFilter('')
                  setActorFilter('')
                  setResultFilter('')
                  setRangeFilter('all')
                }}
              />
            )}
          </Card>
        ) : (
          <Card>
            <CardHeader
              title={`${filtered.length} events`}
              description="Newest first. Result is colour-coded and labelled — denial is never signalled by colour alone."
              actions={
                <StatusBadge tone="neutral" size="sm">
                  {filtered.filter((event) => event.result === 'denied').length} denied
                </StatusBadge>
              }
            />
            <CardBody padded={false}>
              <ul className="divide-y divide-line-subtle">
                {filtered.map((event) => (
                  <AuditRow key={event.id} event={event} />
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        <Card className="p-4">
          <p className="text-body-sm font-semibold text-ink-800">What is recorded, and why</p>
          <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-body-sm text-ink-500 sm:grid-cols-2">
            <li>· Authentication: sign-in, MFA outcome and policy denials</li>
            <li>· Knowledge: uploads, publishing, access changes and retrievals</li>
            <li>· AI: questions, routing decisions, retrieved sources and exclusions</li>
            <li>· Decisions: generation, evidence, approval, rejection and resulting action</li>
            <li>· Governance: role, scope and permission changes</li>
            <li>· Evaluation: run start, scores and failure counts</li>
          </ul>
          <p className="mt-3 text-caption leading-relaxed text-ink-400">
            Entries are append-only; corrections are new entries rather than edits, so the trail remains trustworthy.
            Technical payloads are shown on demand to keep the readable view clean.
          </p>
        </Card>
      </PageBody>
    </>
  )
}
