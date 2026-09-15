import { ArrowLeft, Check, Clock, Gavel, MessageSquarePlus, ShieldAlert, Sparkles, UserCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { EvidenceItemCard } from '@/components/ai/evidence-card'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, DefinitionList, PageBody, PageHeader } from '@/components/ui/primitives'
import { RiskBadge, StatusBadge } from '@/components/ui/status-badge'
import { ConfirmationDialog } from '@/components/ui/overlays'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { useApproval, useDecision } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import { approvalService, decisionService } from '@/services'
import { useAuth } from '@/contexts/auth-context'
import { cn, formatDateTime, formatRelativeTime } from '@/utils/format'

type Outcome = 'approved' | 'rejected' | 'needs_evidence'

/**
 * ApprovalDetail — deliberate by design.
 *
 * The screen states what is requested, why, what evidence supports it, what the
 * risk is and exactly what happens if you approve. Destructive and consequential
 * actions are never visually ambiguous.
 */
export function ApprovalDetailPage() {
  const { approvalId } = useParams<{ approvalId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { can } = usePermissions()
  const { toast } = useToast()

  const approvalQuery = useApproval(approvalId)
  const approval = approvalQuery.data
  const decisionQuery = useDecision(approval?.decisionId)

  const [dialog, setDialog] = useState<Outcome | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState(approval?.comments ?? [])

  useEffect(() => {
    if (approval?.comments) setComments(approval.comments)
  }, [approval?.comments])

  if (approvalQuery.initialLoading) {
    return (
      <PageBody>
        <Card>
          <LoadingState label="Loading approval request" rows={5} />
        </Card>
      </PageBody>
    )
  }

  if (approvalQuery.error || !approval) {
    return (
      <PageBody>
        <ErrorState
          title="This approval could not be loaded"
          cause={approvalQuery.error?.message ?? 'The approval id did not resolve.'}
          onRetry={approvalQuery.reload}
        />
      </PageBody>
    )
  }

  const pending = approval.status === 'awaiting_approval' || approval.status === 'needs_evidence'
  const overdue = pending && new Date(approval.dueAt).getTime() < Date.now()
  const canAct = can('approvals:act') && pending
  const decision = decisionQuery.data

  const submit = async (outcome: Outcome) => {
    setBusy(true)
    if (decision) {
      await decisionService.resolve({ id: decision.id, outcome, note, by: user?.name ?? 'Unknown user' })
    }
    const updated = await approvalService.comment({
      id: approval.id,
      author: user?.name ?? 'Unknown user',
      role: user?.role ?? 'employee',
      body: note || `${outcome === 'approved' ? 'Approved' : outcome === 'rejected' ? 'Rejected' : 'Requested more evidence'}.`,
    })
    setBusy(false)
    setDialog(null)
    if (updated) {
      approvalQuery.setData(updated)
      setComments(updated.comments)
    }
    toast({
      title:
        outcome === 'approved'
          ? 'Approved — action released'
          : outcome === 'rejected'
            ? 'Rejected — reason recorded'
            : 'More evidence requested',
      description:
        outcome === 'approved'
          ? approval.ifApproved
          : outcome === 'rejected'
            ? approval.ifRejected
            : 'The requesting agent has been asked to gather additional sources.',
      tone: outcome === 'approved' ? 'success' : outcome === 'rejected' ? 'warning' : 'info',
    })
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Approvals', to: '/approvals' }, { label: approval.title }]}
        title={approval.title}
        description={approval.summary}
        meta={
          <>
            <StatusBadge tone={pending ? 'warning' : approval.status === 'approved' ? 'success' : 'danger'} size="md">
              {pending ? 'Awaiting your decision' : approval.status === 'approved' ? 'Approved' : 'Rejected'}
            </StatusBadge>
            <RiskBadge risk={approval.risk} />
            {overdue && (
              <span className="flex items-center gap-1.5 font-medium text-danger-700">
                <Clock className="size-3.5" aria-hidden />
                Past SLA — due {formatDateTime(approval.dueAt)}
              </span>
            )}
            <span>Requested {formatRelativeTime(approval.createdAt)}</span>
          </>
        }
        actions={
          <Button variant="secondary" iconLeft={<ArrowLeft aria-hidden />} onClick={() => navigate('/approvals')}>
            Back to queue
          </Button>
        }
      />

      <PageBody className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {/* What & why ------------------------------------------------ */}
            <Card>
              <CardHeader
                title="What is being requested"
                description={`Raised by ${approval.requestedBy} (${approval.requestedByKind === 'ai' ? 'AI agent' : 'human'})`}
                icon={<Sparkles aria-hidden />}
              />
              <CardBody className="space-y-4">
                <p className="text-body leading-relaxed text-ink-700">{approval.summary}</p>

                <div className="rounded-md border border-line-subtle bg-surface-muted/60 px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Why this was raised</p>
                  <p className="mt-1.5 text-body-sm leading-relaxed text-ink-600">{approval.rationale}</p>
                </div>

                {decision && (
                  <>
                    <div className="rounded-md border border-line-subtle bg-surface px-3.5 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">AI analysis</p>
                      <p className="mt-1.5 text-body-sm leading-relaxed text-ink-600">{decision.analysis}</p>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                        Supporting evidence · {decision.evidence.length} sources
                      </p>
                      <ul className="space-y-2.5">
                        {decision.evidence.map((item, index) => (
                          <EvidenceItemCard key={item.id} item={item} index={index} />
                        ))}
                      </ul>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-line-subtle pt-3.5">
                      <Button variant="secondary" size="sm" onClick={() => navigate(`/decisions/${decision.id}`)}>
                        Open full decision record
                      </Button>
                      {can('audit:view') && (
                        <Button variant="ghost" size="sm" onClick={() => navigate('/audit-logs')}>
                          View audit trail
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardBody>
            </Card>

            {/* Discussion ----------------------------------------------- */}
            <Card>
              <CardHeader
                title="Discussion"
                description="Comments are attached to the approval record and visible to everyone involved."
                icon={<MessageSquarePlus aria-hidden />}
              />
              <CardBody padded={false}>
                <ul className="divide-y divide-line-subtle">
                  {comments.length === 0 && (
                    <li className="px-4 py-6">
                      <EmptyState variant="inline" icon={MessageSquarePlus} title="No comments yet" description="Add context for the approver or the requesting agent." />
                    </li>
                  )}
                  {comments.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3 px-4 py-3.5">
                      <Avatar name={entry.author} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-body-sm">
                          <span className="font-medium text-ink-900">{entry.author}</span>
                          <StatusBadge tone="neutral" size="sm">
                            {entry.role}
                          </StatusBadge>
                          <span className="text-caption text-ink-400">{formatRelativeTime(entry.at)}</span>
                        </p>
                        <p className="mt-1 text-body-sm leading-relaxed text-ink-600">{entry.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                {pending && (
                  <div className="border-t border-line bg-surface-muted/60 p-3">
                    <label htmlFor="approval-comment" className="sr-only">
                      Add a comment
                    </label>
                    <textarea
                      id="approval-comment"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      rows={2}
                      placeholder="Add a comment for the record…"
                      className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-body-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!comment.trim()}
                        onClick={async () => {
                          const updated = await approvalService.comment({
                            id: approval.id,
                            author: user?.name ?? 'Unknown user',
                            role: user?.role ?? 'employee',
                            body: comment,
                          })
                          if (updated) {
                            approvalQuery.setData(updated)
                            setComments(updated.comments)
                          }
                          setComment('')
                          toast({ title: 'Comment added', tone: 'success' })
                        }}
                      >
                        Add comment
                      </Button>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Decision panel -------------------------------------------- */}
          <div className="space-y-6">
            <Card className={cn('border-2', pending ? 'border-warning-200' : approval.status === 'approved' ? 'border-success-200' : 'border-danger-200')}>
              <CardHeader
                title="Your decision"
                description={pending ? 'This is the only way the requested action can proceed.' : 'This request has been resolved.'}
                icon={<UserCheck aria-hidden />}
              />
              <CardBody className="space-y-4">
                <DefinitionList
                  columns={1}
                  items={[
                    { label: 'Risk level', value: <RiskBadge risk={approval.risk} /> },
                    { label: 'Evidence attached', value: `${approval.evidenceCount} sources` },
                    { label: 'Requested by', value: `${approval.requestedBy} (${approval.requestedByKind === 'ai' ? 'AI' : 'human'})` },
                    { label: 'Assigned approver', value: approval.approverName },
                    { label: 'Due', value: formatDateTime(approval.dueAt) },
                  ]}
                />

                {pending ? (
                  <div className="space-y-3 border-t border-line-subtle pt-4">
                    <div className="rounded-md border border-success-200 bg-success-50/60 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-success-800">If you approve</p>
                      <p className="mt-1 text-body-sm leading-relaxed text-ink-700">{approval.ifApproved}</p>
                    </div>
                    <div className="rounded-md border border-line bg-surface-muted/60 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">If you reject</p>
                      <p className="mt-1 text-body-sm leading-relaxed text-ink-600">{approval.ifRejected}</p>
                    </div>

                    {!canAct && (
                      <p className="rounded-md border border-line bg-surface-muted px-3 py-2.5 text-caption leading-relaxed text-ink-500">
                        Your role can view this request but not act on it. Approval rights are held by{' '}
                        {approval.approverName} ({approval.approverRole}). The API enforces this independently of the
                        interface.
                      </p>
                    )}

                    <div className="space-y-2 pt-1">
                      <Button
                        variant="success"
                        size="lg"
                        className="w-full justify-center"
                        disabled={!canAct}
                        iconLeft={<Check aria-hidden />}
                        onClick={() => {
                          setNote('')
                          setDialog('approved')
                        }}
                      >
                        Approve and release action
                      </Button>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          variant="danger"
                          size="md"
                          className="justify-center"
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
                          className="justify-center"
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
                ) : (
                  <div className="border-t border-line-subtle pt-4">
                    <StatusBadge tone={approval.status === 'approved' ? 'success' : 'danger'} size="md">
                      {approval.status === 'approved' ? 'Approved' : 'Rejected'}
                    </StatusBadge>
                    {approval.resolution && (
                      <div className="mt-3 space-y-2">
                        <p className="text-body-sm text-ink-600">
                          <span className="font-medium text-ink-800">{approval.resolution.by}</span> ·{' '}
                          {formatDateTime(approval.resolution.at)}
                        </p>
                        <p className="rounded-md border border-line-subtle bg-surface-muted/60 px-3 py-2 text-body-sm text-ink-600">
                          “{approval.resolution.note}”
                        </p>
                        {approval.resolution.resultingTaskId && (
                          <p className="text-caption text-success-800">
                            Resulting task:{' '}
                            <Link to="/meetings" className="font-mono text-brand-700 hover:text-brand-800">
                              {approval.resolution.resultingTaskId}
                            </Link>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Audit record" description="The fields written when this approval is decided." icon={<Gavel aria-hidden />} />
              <CardBody>
                <ul className="space-y-2 text-body-sm">
                  {[
                    ['Requester', approval.requestedBy],
                    ['AI recommendation', approval.title],
                    ['Evidence', `${approval.evidenceCount} sources`],
                    ['Risk', approval.risk],
                    ['Approver', approval.resolution?.by ?? approval.approverName],
                    ['Status', approval.status.replace(/_/g, ' ')],
                    ['Timestamps', `${formatDateTime(approval.createdAt)}${approval.resolution ? ` → ${formatDateTime(approval.resolution.at)}` : ''}`],
                    ['Resulting action', approval.resolution?.resultingTaskId ?? (pending ? 'Pending decision' : 'None')],
                  ].map(([label, value]) => (
                    <li key={label} className="flex items-baseline justify-between gap-3">
                      <span className="text-caption text-ink-400">{label}</span>
                      <span className="truncate text-right text-body-sm text-ink-700">{value}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-line-subtle pt-3 text-caption leading-relaxed text-ink-400">
                  Records are append-only. Corrections are made by adding a new entry, never by editing history.
                </p>
              </CardBody>
            </Card>

            {approval.risk === 'high' && (
              <Card className="border-danger-200 bg-danger-50/40">
                <div className="flex items-start gap-2.5 p-4">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger-600" aria-hidden />
                  <div>
                    <p className="text-body-sm font-semibold text-danger-800">High-risk action</p>
                    <p className="mt-1 text-caption leading-relaxed text-danger-800/85">
                      This action affects customers or financial outcomes directly. Review the evidence before approving,
                      and record a review date if the change is temporary.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </PageBody>

      <ConfirmationDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog === 'approved'
            ? 'Approve and release this action?'
            : dialog === 'rejected'
              ? 'Reject this request?'
              : 'Request more evidence?'
        }
        body={
          dialog === 'approved'
            ? approval.ifApproved
            : dialog === 'rejected'
              ? approval.ifRejected
              : 'The request stays open and the requesting agent is asked for additional supporting sources.'
        }
        confirmLabel={dialog === 'approved' ? 'Approve and release' : dialog === 'rejected' ? 'Reject request' : 'Request evidence'}
        tone={dialog === 'approved' ? 'success' : dialog === 'rejected' ? 'danger' : 'primary'}
        requireNote
        noteLabel={
          dialog === 'approved'
            ? 'Approval note (recorded in the audit log)'
            : dialog === 'rejected'
              ? 'Reason for rejection (required)'
              : 'What additional evidence is needed? (required)'
        }
        note={note}
        onNoteChange={setNote}
        busy={busy}
        onConfirm={() => dialog && submit(dialog)}
      />
    </>
  )
}
