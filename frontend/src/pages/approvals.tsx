import { ArrowRight, Clock, Inbox, ShieldAlert, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, PageBody, PageHeader, Tabs } from '@/components/ui/primitives'
import { RiskBadge, StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState, NoResultsState } from '@/components/ui/states'
import { SearchInput, SegmentedFilter } from '@/components/ui/input-field'
import { useApprovals } from '@/hooks/use-api'
import { useDebouncedValue } from '@/hooks/use-async'
import type { ApprovalRequest } from '@/types'
import { cn, formatDateTime } from '@/utils/format'

/* -------------------------------------------------------------------------- */
/* Approval row — an operations inbox, so the row must answer the five questions */
/* -------------------------------------------------------------------------- */

function ApprovalRow({ approval, onOpen }: { approval: ApprovalRequest; onOpen: () => void }) {
  const pending = approval.status === 'awaiting_approval' || approval.status === 'needs_evidence'
  const overdue = pending && new Date(approval.dueAt).getTime() < Date.now()

  const kindLabel = {
    decision: 'Recommendation',
    document_publish: 'Knowledge change',
    agent_permission: 'Agent permission',
    access_request: 'Access request',
  }[approval.kind]

  return (
    <li className={cn('transition-colors hover:bg-surface-muted/50', overdue && 'bg-danger-50/30')}>
      <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start">
        {/* What & why ---------------------------------------------------- */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="neutral" size="sm">
              {kindLabel}
            </StatusBadge>
            <RiskBadge risk={approval.risk} size="sm" />
            {overdue && (
              <StatusBadge tone="danger" size="sm" icon={<Clock aria-hidden />}>
                Past SLA
              </StatusBadge>
            )}
          </div>

          <button type="button" onClick={onOpen} className="mt-2 block w-full text-left">
            <h3 className="text-body font-semibold text-ink-900 hover:text-brand-700">{approval.title}</h3>
          </button>
          <p className="mt-1 text-body-sm leading-relaxed text-ink-500">{approval.summary}</p>

          <div className="mt-2.5 rounded-md border border-line-subtle bg-surface-muted/60 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Why</p>
            <p className="mt-0.5 text-caption leading-relaxed text-ink-600">{approval.rationale}</p>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-ink-400">
            <span className="flex items-center gap-1.5">
              {approval.requestedByKind === 'ai' ? <ShieldAlert className="size-3.5" aria-hidden /> : <UserCheck className="size-3.5" aria-hidden />}
              Raised by {approval.requestedBy} ({approval.requestedByKind === 'ai' ? 'AI' : 'human'})
            </span>
            <span>{approval.evidenceCount} evidence sources</span>
            <span>Approver {approval.approverName}</span>
            <span className={cn(pending && overdue && 'font-medium text-danger-700')}>
              Due {formatDateTime(approval.dueAt)}
            </span>
          </div>
        </div>

        {/* What happens next ------------------------------------------- */}
        <div className="shrink-0 space-y-2 lg:w-[300px]">
          <div className="rounded-md border border-line bg-surface p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-success-800">If approved</p>
            <p className="mt-1 text-caption leading-relaxed text-ink-600">{approval.ifApproved}</p>
          </div>
          <Button
            variant={pending ? 'primary' : 'secondary'}
            size="sm"
            className="w-full justify-center"
            onClick={onOpen}
            iconRight={<ArrowRight aria-hidden />}
          >
            {pending ? 'Review and decide' : 'View record'}
          </Button>
        </div>
      </div>
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function ApprovalsPage() {
  const navigate = useNavigate()
  const approvals = useApprovals()

  const [tab, setTab] = useState<'review' | 'approved' | 'rejected' | 'completed'>('review')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 180)
  const [risk, setRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  const rows = approvals.data ?? []

  const byTab = useMemo(
    () =>
      rows.filter((approval) => {
        if (tab === 'review') return approval.status === 'awaiting_approval' || approval.status === 'needs_evidence'
        if (tab === 'approved') return approval.status === 'approved'
        if (tab === 'rejected') return approval.status === 'rejected'
        return approval.resolution && approval.resolution.resultingTaskId !== null
      }),
    [rows, tab],
  )

  const filtered = useMemo(
    () =>
      byTab.filter((approval) => {
        if (risk !== 'all' && approval.risk !== risk) return false
        if (debouncedQuery) {
          const haystack = `${approval.title} ${approval.summary} ${approval.rationale}`.toLowerCase()
          if (!haystack.includes(debouncedQuery.toLowerCase())) return false
        }
        return true
      }),
    [byTab, risk, debouncedQuery],
  )

  const needsReview = rows.filter((approval) => approval.status === 'awaiting_approval' || approval.status === 'needs_evidence').length
  const overdueCount = rows.filter(
    (approval) =>
      (approval.status === 'awaiting_approval' || approval.status === 'needs_evidence') &&
      new Date(approval.dueAt).getTime() < Date.now(),
  ).length

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Requests waiting on a human. Approving releases the action; rejecting records your reason. Neither happens without you."
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <Inbox className="size-3.5 text-ink-400" aria-hidden />
              {needsReview} in needs review
            </span>
            {overdueCount > 0 && (
              <span className="flex items-center gap-1.5 text-danger-700">
                <Clock className="size-3.5" aria-hidden />
                {overdueCount} past SLA
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <UserCheck className="size-3.5 text-ink-400" aria-hidden />
              Approval rights follow your role and department
            </span>
          </>
        }
        tabs={
          <Tabs
            ariaLabel="Approval views"
            value={tab}
            onChange={(value) => setTab(value as typeof tab)}
            items={[
              { id: 'review', label: 'Needs review', count: needsReview },
              { id: 'approved', label: 'Approved', count: rows.filter((approval) => approval.status === 'approved').length },
              { id: 'rejected', label: 'Rejected', count: rows.filter((approval) => approval.status === 'rejected').length },
              { id: 'completed', label: 'Completed', count: rows.filter((approval) => approval.resolution?.resultingTaskId).length },
            ]}
          />
        }
      />

      <PageBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery('')}
            placeholder="Search approvals, rationale or requester…"
            containerClassName="w-full sm:w-[300px]"
          />
          <SegmentedFilter
            ariaLabel="Filter by risk"
            value={risk}
            onChange={setRisk}
            options={[
              { value: 'all', label: 'All risk' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
          />
        </div>

        {approvals.error ? (
          <ErrorState
            title="Approvals could not be loaded"
            cause={approvals.error.message}
            status={`http_${approvals.error.status ?? 'network'}`}
            onRetry={approvals.reload}
          />
        ) : approvals.initialLoading ? (
          <Card>
            <LoadingState rows={4} />
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            {rows.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No approval requests"
                description="When an agent recommends an action that changes business state, the request appears here for a human decision."
              />
            ) : (
              <NoResultsState
                query={debouncedQuery}
                onClear={() => {
                  setQuery('')
                  setRisk('all')
                }}
              />
            )}
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {filtered.map((approval) => (
                <ApprovalRow key={approval.id} approval={approval} onOpen={() => navigate(`/approvals/${approval.id}`)} />
              ))}
            </ul>
          </Card>
        )}

        <p className="px-1 text-caption leading-relaxed text-ink-400">
          Every decision here produces an immutable record: who requested it, what the AI recommended, the evidence
          attached, the risk level, who approved or rejected it, when, and what action followed. Rejections require a
          reason, which is fed back into the evaluation cycle so the same recommendation is not blindly repeated.
        </p>
      </PageBody>
    </>
  )
}
