import { Gavel, ListFilter, ShieldAlert, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgentMark } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Card, PageBody, PageHeader, Tabs } from '@/components/ui/primitives'
import { MetricCard } from '@/components/ui/metrics'
import { DecisionStatusBadge, RiskBadge, StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState, NoResultsState } from '@/components/ui/states'
import { SegmentedFilter } from '@/components/ui/input-field'
import { TableToolbar } from '@/components/ui/table-toolbar'
import { Tooltip } from '@/components/ui/tooltip'
import { useAgents, useDecisions } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import { useDebouncedValue } from '@/hooks/use-async'
import type { AgentSummary, Decision } from '@/types'
import { cn, formatRelativeTime } from '@/utils/format'

/* -------------------------------------------------------------------------- */
/* Decision card                                                              */
/* -------------------------------------------------------------------------- */

export function DecisionCard({
  decision,
  agent,
  onOpen,
}: {
  decision: Decision
  /** The agent that raised the recommendation, resolved by the API. */
  agent?: AgentSummary
  onOpen: () => void
}) {
  const strongEvidence = decision.evidence.filter((item) => item.strength === 'strong').length

  return (
    <article className="sc-card flex flex-col transition-colors hover:border-line-strong">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {agent && <AgentMark name={agent.name} accent={agent.accent} size={24} />}
          <span className="min-w-0">
            <span className="block truncate text-caption font-medium text-ink-700">{decision.detectedBy.agentName}</span>
            <span className="block text-[11px] text-ink-400">Detected {formatRelativeTime(decision.detectedAt)}</span>
          </span>
        </div>
        <RiskBadge risk={decision.risk} size="sm" />
      </div>

      <div className="flex-1 px-4 py-3.5">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <h3 className="text-h3 text-ink-900 hover:text-brand-700">{decision.title}</h3>
        </button>
        <p className="mt-1.5 line-clamp-2 text-body-sm leading-relaxed text-ink-500">{decision.issue}</p>

        <div className="mt-3 rounded-md border border-line-subtle bg-surface-muted/60 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Recommendation</p>
          <p className="mt-1 text-body-sm font-medium text-ink-800">{decision.recommendation.title}</p>
          <p className="mt-1 text-caption leading-relaxed text-ink-500">{decision.recommendation.impact}</p>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-x-3">
          {decision.businessImpact.slice(0, 3).map((impact) => (
            <div key={impact.label} className="min-w-0">
              <dt className="truncate text-[10px] uppercase tracking-wide text-ink-400">{impact.label}</dt>
              <dd className="tnum mt-0.5 truncate text-body-sm font-medium text-ink-800">{impact.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-subtle px-4 py-3">
        <DecisionStatusBadge status={decision.status} size="sm" />
        <span className="text-caption text-ink-400">
          {decision.evidence.length} sources · {strongEvidence} strong
        </span>
        <span className="text-caption text-ink-400">Approver {decision.approverName ?? 'unassigned'}</span>
        <button type="button" onClick={onOpen} className="ml-auto text-caption font-semibold text-brand-700 hover:text-brand-800">
          Review →
        </button>
      </div>
    </article>
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function DecisionsPage() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const decisions = useDecisions()
  const agents = useAgents()
  const agentsById = useMemo(
    () => new Map((agents.data ?? []).map((agent) => [agent.id, agent])),
    [agents.data],
  )

  const [tab, setTab] = useState<'attention' | 'all'>('attention')
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 180)

  const rows = decisions.data ?? []

  const filtered = useMemo(
    () =>
      rows.filter((decision) => {
        if (tab === 'attention' && !['awaiting_approval', 'needs_evidence'].includes(decision.status)) return false
        if (riskFilter !== 'all' && decision.risk !== riskFilter) return false
        if (debouncedQuery) {
          const haystack = `${decision.title} ${decision.issue} ${decision.recommendation.title}`.toLowerCase()
          if (!haystack.includes(debouncedQuery.toLowerCase())) return false
        }
        return true
      }),
    [rows, tab, riskFilter, debouncedQuery],
  )

  const awaiting = rows.filter((decision) => decision.status === 'awaiting_approval').length
  const highRisk = rows.filter((decision) => decision.risk === 'high' && decision.status === 'awaiting_approval').length
  const approved = rows.filter((decision) => decision.status === 'approved').length
  const rejected = rows.filter((decision) => decision.status === 'rejected').length
  const resolved = approved + rejected
  // Derived from the records on this page — never an invented period-over-period delta.
  const approvalRate = resolved > 0 ? `${Math.round((approved / resolved) * 100)}% of resolved` : 'No decisions resolved yet'

  return (
    <>
      <PageHeader
        title="Decisions"
        description="AI-generated recommendations that require review. SmartCorp analyses and recommends; a person decides."
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <Gavel className="size-3.5 text-ink-400" aria-hidden />
              {awaiting} awaiting approval
            </span>
            <span className={cn('flex items-center gap-1.5', highRisk > 0 && 'text-danger-700')}>
              <ShieldAlert className="size-3.5" aria-hidden />
              {highRisk} high risk
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-ink-400" aria-hidden />
              {approved} approved · {rejected} rejected
            </span>
          </>
        }
        actions={
          can('approvals:view') ? (
            <Button variant="primary" onClick={() => navigate('/approvals')}>
              Open approval queue
            </Button>
          ) : undefined
        }
        tabs={
          <Tabs
            ariaLabel="Decision views"
            value={tab}
            onChange={(value) => setTab(value as typeof tab)}
            items={[
              { id: 'attention', label: 'Requires attention', count: awaiting + rows.filter((decision) => decision.status === 'needs_evidence').length },
              { id: 'all', label: 'All decisions', count: rows.length },
            ]}
          />
        }
      />

      <PageBody className="space-y-5">
        {/* Summary ------------------------------------------------------ */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Awaiting approval" value={awaiting} hint="Recommendations raised by agents that need a human decision." icon={<Gavel aria-hidden />} />
          <MetricCard
            label="High risk open"
            value={highRisk}
            hint="High-risk items carry an approval SLA and cannot be auto-executed under any configuration."
            icon={<ShieldAlert aria-hidden />}
          />
          <MetricCard
            label="Approved this period"
            value={approved}
            hint="Approvals that produced a task, with the approver recorded against the decision."
            footer={<span className="text-caption text-ink-500">{approvalRate}</span>}
          />
          <MetricCard
            label="Rejected this period"
            value={rejected}
            hint="Rejections always carry a reason, which feeds the next evaluation cycle."
            footer={<span className="text-caption text-ink-500">{rejected} with a recorded reason</span>}
          />
        </div>

        {/* Filters ------------------------------------------------------ */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TableToolbar
            query={query}
            onQueryChange={setQuery}
            searchPlaceholder="Search decisions, issues or recommendations…"
            showReset={riskFilter !== 'all' || query.length > 0}
            onReset={() => {
              setRiskFilter('all')
              setQuery('')
            }}
            className="flex-1"
          />
          <SegmentedFilter
            ariaLabel="Filter by risk"
            value={riskFilter}
            onChange={setRiskFilter}
            options={[
              { value: 'all', label: 'All risk' },
              { value: 'high', label: 'High', count: rows.filter((decision) => decision.risk === 'high').length },
              { value: 'medium', label: 'Medium', count: rows.filter((decision) => decision.risk === 'medium').length },
              { value: 'low', label: 'Low', count: rows.filter((decision) => decision.risk === 'low').length },
            ]}
          />
        </div>

        {/* Content ------------------------------------------------------ */}
        {decisions.error ? (
          <ErrorState
            title="Decisions could not be loaded"
            cause={decisions.error.message}
            status={`http_${decisions.error.status ?? 'network'}`}
            onRetry={decisions.reload}
          />
        ) : decisions.initialLoading ? (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <LoadingState rows={4} />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            {rows.length === 0 ? (
              <EmptyState
                icon={Gavel}
                title="No decisions raised yet"
                description="Agents raise a decision when an answer implies a business action, a policy conflict or a risk. Nothing is executed automatically."
              />
            ) : (
              <NoResultsState
                query={debouncedQuery}
                onClear={() => {
                  setQuery('')
                  setRiskFilter('all')
                  setTab('all')
                }}
              />
            )}
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                agent={agentsById.get(decision.detectedBy.agentId)}
                onOpen={() => navigate(`/decisions/${decision.id}`)}
              />
            ))}
          </div>
        )}

        {/* Explainer ---------------------------------------------------- */}
        <Card className="p-4">
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-surface-muted text-ink-500">
              <ListFilter className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-ink-800">How a decision reaches this queue</p>
              <ol className="mt-2 grid gap-x-6 gap-y-1.5 text-body-sm text-ink-500 sm:grid-cols-2 lg:grid-cols-4">
                <li>1 · An agent detects an issue in evidence or telemetry.</li>
                <li>2 · Sources are gathered, scored and attached.</li>
                <li>3 · Analysis and a recommendation are produced with a risk level.</li>
                <li>4 · A human approves, rejects or asks for more evidence — always recorded.</li>
              </ol>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge tone="brand" size="sm">
                  AI recommends
                </StatusBadge>
                <span aria-hidden className="text-ink-200">→</span>
                <StatusBadge tone="neutral" size="sm">
                  Evidence explains
                </StatusBadge>
                <span aria-hidden className="text-ink-200">→</span>
                <StatusBadge tone="success" size="sm">
                  Humans control
                </StatusBadge>
                <Tooltip label="Actions that change business state are never executed by an agent, regardless of confidence.">
                  <span className="ml-1 text-caption text-ink-400">Why this matters</span>
                </Tooltip>
              </div>
            </div>
          </div>
        </Card>
      </PageBody>
    </>
  )
}
