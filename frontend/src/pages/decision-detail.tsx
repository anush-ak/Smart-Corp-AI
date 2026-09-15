import {
  ArrowLeft,
  Bot,
  Check,
  CircleHelp,
  Gavel,
  History,
  ScrollText,
  ShieldAlert,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AgentMark } from '@/components/brand'
import { EvidenceItemCard } from '@/components/ai/evidence-card'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, DefinitionList, PageBody, PageHeader } from '@/components/ui/primitives'
import { ConfidenceBadge } from '@/components/ui/metrics'
import { DecisionStatusBadge, RiskBadge, StatusBadge } from '@/components/ui/status-badge'
import { ConfirmationDialog } from '@/components/ui/overlays'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { Tooltip } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'
import { useAgents, useDecision, useDecisionTasks } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import { decisionService } from '@/services'
import { useAuth } from '@/contexts/auth-context'
import { cn, formatDateTime, formatRelativeTime } from '@/utils/format'

type Outcome = 'approved' | 'rejected' | 'needs_evidence'

/**
 * DecisionDetail — the signature screen.
 *
 * Structured as the product's decision doctrine: issue → evidence → analysis →
 * recommendation → risk → human decision → resulting action → audit. The visual
 * language keeps "what the AI recommends" and "what the human decided" clearly
 * separated, because that distinction is the core promise of the platform.
 */
export function DecisionDetailPage() {
  const { decisionId } = useParams<{ decisionId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { can } = usePermissions()
  const { toast } = useToast()

  const decisionQuery = useDecision(decisionId)
  const taskQuery = useDecisionTasks(decisionQuery.data?.resultingTaskId ? decisionId : undefined)
  const agentsQuery = useAgents()

  const [dialog, setDialog] = useState<Outcome | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const decision = decisionQuery.data

  if (decisionQuery.initialLoading) {
    return (
      <PageBody>
        <Card>
          <LoadingState label="Loading decision" rows={6} />
        </Card>
      </PageBody>
    )
  }

  if (decisionQuery.error || !decision) {
    return (
      <PageBody>
        <ErrorState
          title="This decision could not be loaded"
          cause={decisionQuery.error?.message ?? 'The decision id did not resolve.'}
          onRetry={decisionQuery.reload}
        />
      </PageBody>
    )
  }

  const agent = (agentsQuery.data ?? []).find((candidate) => candidate.id === decision.detectedBy.agentId)
  const open = decision.status === 'awaiting_approval' || decision.status === 'needs_evidence'
  const canAct = can('decisions:approve') && open

  const dialogCopy: Record<Outcome, { title: string; body: string; confirm: string; tone: 'primary' | 'danger' | 'success' }> = {
    approved: {
      title: 'Approve this recommendation?',
      body: `Approving executes the recommended action: ${decision.recommendation.title}.`,
      confirm: 'Approve recommendation',
      tone: 'success',
    },
    rejected: {
      title: 'Reject this recommendation?',
      body: 'The recommendation is closed and your reason is recorded. The agent may re-raise it if new evidence appears.',
      confirm: 'Reject recommendation',
      tone: 'danger',
    },
    needs_evidence: {
      title: 'Request more evidence?',
      body: 'The recommendation stays open and the requesting agent is asked to gather additional supporting sources.',
      confirm: 'Request more evidence',
      tone: 'primary',
    },
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Decisions', to: '/decisions' }, { label: decision.title }]}
        title={decision.title}
        description={decision.issue}
        meta={
          <>
            <DecisionStatusBadge status={decision.status} />
            <RiskBadge risk={decision.risk} />
            <ConfidenceBadge value={decision.confidence} label="Detection confidence" />
            <span>Detected {formatRelativeTime(decision.detectedAt)}</span>
            <span>Approver {decision.approverName ?? 'unassigned'}</span>
            {decision.slaDueAt && (
              <span className="flex items-center gap-1.5 text-warning-700">
                <ShieldAlert className="size-3.5" aria-hidden />
                SLA due {formatDateTime(decision.slaDueAt)}
              </span>
            )}
          </>
        }
        actions={
          <>
            <Button variant="secondary" iconLeft={<ArrowLeft aria-hidden />} onClick={() => navigate('/decisions')}>
              Back
            </Button>
            {can('audit:view') && (
              <Button variant="secondary" iconLeft={<ScrollText aria-hidden />} onClick={() => navigate('/audit-logs')}>
                Audit trail
              </Button>
            )}
          </>
        }
      />

      <PageBody className="space-y-6">
        {/* AI recommendation block -------------------------------------- */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {/* Detected issue ------------------------------------------- */}
            <Card>
              <CardHeader
                title="Detected issue"
                description={`Raised by ${decision.detectedBy.agentName} on ${formatDateTime(decision.detectedAt)}`}
                icon={<Sparkles aria-hidden />}
                actions={
                  agent && (
                    <Link to={`/agents/${agent.id}`} className="flex items-center gap-2 text-caption font-medium text-brand-700 hover:text-brand-800">
                      <AgentMark name={agent.name} accent={agent.accent} size={20} />
                      Open agent
                    </Link>
                  )
                }
              />
              <CardBody className="space-y-4">
                <p className="text-body leading-relaxed text-ink-700">{decision.issue}</p>

                <div className="rounded-md border border-line-subtle bg-surface-muted/50 px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                    <Bot className="size-3" aria-hidden />
                    AI analysis
                  </p>
                  <p className="mt-1.5 text-body-sm leading-relaxed text-ink-600">{decision.analysis}</p>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line-subtle pt-3.5 sm:grid-cols-3">
                  {decision.businessImpact.map((impact) => (
                    <div key={impact.label}>
                      <dt className="text-[11px] uppercase tracking-wide text-ink-400">{impact.label}</dt>
                      <dd className="tnum mt-0.5 text-body font-medium text-ink-900">{impact.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>

            {/* Evidence ------------------------------------------------- */}
            <Card>
              <CardHeader
                title="Evidence"
                description={`${decision.evidence.length} sources support this recommendation. Strength reflects how directly each one supports the analysis.`}
                icon={<CircleHelp aria-hidden />}
              />
              <CardBody padded={false}>
                <ul className="space-y-2.5 p-4">
                  {decision.evidence.map((item, index) => (
                    <EvidenceItemCard key={item.id} item={item} index={index} />
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>

          {/* Decision panel -------------------------------------------- */}
          <div className="space-y-6">
            {/* Recommendation ------------------------------------------- */}
            <Card className="border-brand-200">
              <CardHeader
                title="Recommended action"
                description="Produced by AI. It is never executed without an approval."
                icon={<Gavel aria-hidden />}
                className="bg-brand-50/50"
              />
              <CardBody className="space-y-4">
                <div>
                  <p className="text-body font-semibold text-ink-900">{decision.recommendation.title}</p>
                  <p className="mt-1.5 text-body-sm leading-relaxed text-ink-600">{decision.recommendation.detail}</p>
                </div>

                <DefinitionList
                  columns={2}
                  items={[
                    { label: 'Estimated impact', value: decision.recommendation.impact },
                    { label: 'Effort', value: decision.recommendation.effort },
                    { label: 'Reversibility', value: decision.recommendation.reversible ? 'Can be reverted' : 'Not easily reversible' },
                    { label: 'Risk level', value: <RiskBadge risk={decision.risk} size="sm" /> },
                  ]}
                />

                {/* Human decision ---------------------------------------- */}
                <div className="rounded-lg border border-line bg-surface p-3.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                    <UserCheck className="size-3" aria-hidden />
                    Human decision
                  </p>

                  {open ? (
                    <>
                      <p className="mt-1.5 text-body-sm leading-relaxed text-ink-500">
                        {canAct
                          ? 'Your approval, rejection or evidence request is recorded against this decision with your name and timestamp.'
                          : 'You do not hold approval rights for this department. The request remains with ' + (decision.approverName ?? 'the assigned approver') + '.'}
                      </p>

                      <div className="mt-3 space-y-2">
                        <p className="text-caption text-ink-500">
                          If approved: {decision.recommendation.impact}
                        </p>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="success"
                            size="md"
                            disabled={!canAct}
                            iconLeft={<Check aria-hidden />}
                            onClick={() => {
                              setNote('')
                              setDialog('approved')
                            }}
                          >
                            Approve recommendation
                          </Button>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="danger"
                              size="md"
                              disabled={!canAct}
                              iconLeft={<X aria-hidden />}
                              onClick={() => {
                                setNote('')
                                setDialog('rejected')
                              }}
                            >
                              Reject
                            </Button>
                            <Button
                              variant="secondary"
                              size="md"
                              disabled={!canAct}
                              onClick={() => {
                                setNote('')
                                setDialog('needs_evidence')
                              }}
                            >
                              Request more evidence
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2">
                      <DecisionStatusBadge status={decision.status} />
                      <p className="mt-2 text-body-sm text-ink-600">
                        {decision.status === 'approved'
                          ? `Approved by ${decision.approverName}. The recommended action was released and a task created.`
                          : decision.status === 'rejected'
                            ? `Rejected by ${decision.approverName}. The reason is recorded below and feeds the next evaluation cycle.`
                            : 'Waiting on additional evidence before a decision can be taken.'}
                      </p>
                      {decision.resultingTaskId && (
                        <div className="mt-3 rounded-md border border-success-200 bg-success-50/60 px-3 py-2.5">
                          <p className="text-caption font-medium text-success-800">Resulting action</p>
                          <p className="mt-0.5 text-body-sm text-ink-700">
                            Task{' '}
                            <Link to="/meetings" className="font-mono text-brand-700 hover:text-brand-800">
                              {decision.resultingTaskId}
                            </Link>{' '}
                            created and assigned.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-caption leading-relaxed text-ink-400">
                  Approval records capture the requester, the AI recommendation, the supporting evidence, the risk level,
                  the approver, the outcome, timestamps and the resulting action — the complete chain needed for audit.
                </p>
              </CardBody>
            </Card>

            {/* Resulting tasks ------------------------------------------ */}
            {taskQuery.data && taskQuery.data.length > 0 && (
              <Card>
                <CardHeader title="Resulting tasks" description="Work created by the approval." icon={<Check aria-hidden />} />
                <CardBody padded={false}>
                  <ul className="divide-y divide-line-subtle">
                    {taskQuery.data.map((task) => (
                      <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-body-sm font-medium text-ink-800">{task.title}</p>
                          <p className="text-caption text-ink-400">
                            Owner {task.owner} · due {formatDateTime(task.dueDate)}
                          </p>
                        </div>
                        <StatusBadge tone={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'neutral'} size="sm">
                          {task.priority} priority
                        </StatusBadge>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}

            {/* Timeline ------------------------------------------------- */}
            <Card>
              <CardHeader
                title="Decision record"
                description="Who did what, in order — AI and human actions distinguished."
                icon={<History aria-hidden />}
              />
              <CardBody>
                <ol className="space-y-3">
                  {decision.timeline.map((event, index) => (
                    <li key={event.id} className="relative pl-8">
                      {index < decision.timeline.length - 1 && (
                        <span aria-hidden className="absolute left-[11px] top-5 h-[calc(100%+0.25rem)] w-px bg-line" />
                      )}
                      <span
                        className={cn(
                          'absolute left-0 top-0.5 grid size-6 place-items-center rounded-full border',
                          event.actorKind === 'ai'
                            ? 'border-brand-200 bg-brand-50 text-brand-700'
                            : event.actorKind === 'human'
                              ? 'border-success-200 bg-success-50 text-success-700'
                              : 'border-line bg-surface-muted text-ink-500',
                        )}
                        aria-hidden
                      >
                        {event.actorKind === 'ai' ? (
                          <Bot className="size-3" />
                        ) : event.actorKind === 'human' ? (
                          <UserCheck className="size-3" />
                        ) : (
                          <Sparkles className="size-3" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-body-sm">
                          <span className="font-medium text-ink-900">{event.label}</span>
                          <span className="text-caption text-ink-400">
                            {event.actor} · {formatDateTime(event.at)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-caption leading-relaxed text-ink-500">{event.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-subtle pt-3.5">
                  <StatusBadge tone="neutral" size="sm">
                    AI actions: {decision.timeline.filter((event) => event.actorKind === 'ai').length}
                  </StatusBadge>
                  <StatusBadge tone="success" size="sm">
                    Human actions: {decision.timeline.filter((event) => event.actorKind === 'human').length}
                  </StatusBadge>
                  <StatusBadge tone="info" size="sm">
                    System events: {decision.timeline.filter((event) => event.actorKind === 'system').length}
                  </StatusBadge>
                  <Tooltip label="The full record is exportable from the audit log.">
                    <span className="ml-auto text-caption text-ink-400">Audit-ready</span>
                  </Tooltip>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </PageBody>

      <ConfirmationDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog ? dialogCopy[dialog].title : ''}
        body={dialog ? dialogCopy[dialog].body : ''}
        confirmLabel={dialog ? dialogCopy[dialog].confirm : 'Confirm'}
        tone={dialog ? dialogCopy[dialog].tone : 'primary'}
        requireNote
        noteLabel={dialog === 'rejected' ? 'Reason for rejection (required)' : dialog === 'needs_evidence' ? 'What evidence is missing? (required)' : 'Approval note (required for the audit record)'}
        notePlaceholder={
          dialog === 'rejected'
            ? 'Explain why this recommendation should not proceed.'
            : dialog === 'needs_evidence'
              ? 'Describe the additional sources needed.'
              : 'Add context for the audit record.'
        }
        note={note}
        onNoteChange={setNote}
        busy={busy}
        consequences={
          <div className="space-y-2">
            <p className="font-medium text-ink-700">What is recorded</p>
            <p>
              Approver {user?.name} · decision {decision.id} · risk {decision.risk} · {decision.evidence.length} evidence
              sources · timestamp and resulting action.
            </p>
          </div>
        }
        onConfirm={async () => {
          if (!dialog) return
          setBusy(true)
          const result = await decisionService.resolve({
            id: decision.id,
            outcome: dialog,
            note,
            by: user?.name ?? 'Unknown user',
          })
          setBusy(false)
          setDialog(null)
          if (result) {
            decisionQuery.setData(result)
            toast({
              title:
                dialog === 'approved'
                  ? 'Recommendation approved'
                  : dialog === 'rejected'
                    ? 'Recommendation rejected'
                    : 'Additional evidence requested',
              description:
                dialog === 'approved'
                  ? `A task was created and ${decision.requesterName} was notified. The action is recorded in the audit log.`
                  : dialog === 'rejected'
                    ? 'Your reason was recorded and the agent was notified. The recommendation is closed.'
                    : 'The agent will gather further sources and re-raise the recommendation.',
              tone: dialog === 'approved' ? 'success' : dialog === 'rejected' ? 'warning' : 'info',
            })
          }
        }}
      />
    </>
  )
}
