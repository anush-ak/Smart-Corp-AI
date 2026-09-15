import { ArrowLeft, CheckSquare, CircleHelp, FileText, MessagesSquare, Send, TriangleAlert, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, AvatarGroup } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, DefinitionList, PageBody, PageHeader, Tabs } from '@/components/ui/primitives'
import { DataTable } from '@/components/ui/data-table'
import { RiskBadge, StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { useMeeting, useTasks } from '@/hooks/use-api'
import { cn, formatBytes, formatDateTime, formatRelativeTime } from '@/utils/format'
import type { Task } from '@/types'

/**
 * Meeting intelligence detail.
 *
 * Everything extracted is actionable: decisions show who made them, action items
 * link to their owners and deadlines, risks carry severity, and follow-ups can be
 * sent to the owner directly from this screen.
 */
export function MeetingDetailPage() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const meetingQuery = useMeeting(meetingId)
  const tasksQuery = useTasks()
  const [tab, setTab] = useState<'summary' | 'actions' | 'risks'>('summary')

  const meeting = meetingQuery.data

  if (meetingQuery.initialLoading) {
    return (
      <PageBody>
        <Card>
          <LoadingState label="Loading meeting intelligence" rows={5} />
        </Card>
      </PageBody>
    )
  }

  if (meetingQuery.error || !meeting) {
    return (
      <PageBody>
        <ErrorState
          title="This meeting could not be loaded"
          cause={meetingQuery.error?.message ?? 'The meeting id did not resolve.'}
          onRetry={meetingQuery.reload}
        />
      </PageBody>
    )
  }

  const trackedTasks = (tasksQuery.data ?? []).filter((task) => task.originRef === meeting.id)
  const allActions: Task[] = trackedTasks.length > 0 ? trackedTasks : meeting.actionItems

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Meetings', to: '/meetings' }, { label: meeting.title }]}
        title={meeting.title}
        description={meeting.summary ? meeting.summary.split('.')[0] + '.' : 'Processing in progress.'}
        meta={
          <>
            <StatusBadge tone={meeting.transcriptStatus === 'ready' ? 'success' : 'info'} size="md">
              {meeting.transcriptStatus === 'ready' ? 'Analysed' : 'Processing'}
            </StatusBadge>
            <span>{formatDateTime(meeting.date)}</span>
            <span>{meeting.durationMinutes} minutes</span>
            <span>{meeting.department}</span>
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5 text-ink-400" aria-hidden />
              {meeting.attendees.length} attendees
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" iconLeft={<ArrowLeft aria-hidden />} onClick={() => navigate('/meetings')}>
              Back
            </Button>
            <Button
              variant="primary"
              iconLeft={<CheckSquare aria-hidden />}
              onClick={() => toast({ title: 'Action items exported', description: `${allActions.length} tasks sent to the task tracker with owners and deadlines.`, tone: 'success' })}
            >
              Create tasks from actions
            </Button>
          </>
        }
        tabs={
          <Tabs
            ariaLabel="Meeting views"
            value={tab}
            onChange={(value) => setTab(value as typeof tab)}
            items={[
              { id: 'summary', label: 'Summary & decisions', count: meeting.keyDecisions.length },
              { id: 'actions', label: 'Action items', count: allActions.length },
              { id: 'risks', label: 'Risks & follow-ups', count: meeting.risks.length + meeting.followUps.length },
            ]}
          />
        }
      />

      <PageBody className="space-y-6">
        {meeting.transcriptStatus !== 'ready' && (
          <Card className="border-info-200 bg-info-50/50">
            <div className="flex items-start gap-3 p-4">
              <MessagesSquare className="mt-0.5 size-4 shrink-0 text-info-600" aria-hidden />
              <div>
                <p className="text-body-sm font-semibold text-info-800">Processing — partial results</p>
                <p className="mt-1 text-caption leading-relaxed text-info-800/85">
                  The transcript is being analysed. Summary, decisions and action items appear progressively; nothing
                  extracted so far is treated as a task until processing completes.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {tab === 'summary' && (
              <>
                <Card>
                  <CardHeader title="Meeting summary" description="Produced from the transcript, not from prior knowledge." icon={<FileText aria-hidden />} />
                  <CardBody>
                    {meeting.summary ? (
                      <p className="text-body leading-relaxed text-ink-700">{meeting.summary}</p>
                    ) : (
                      <EmptyState variant="inline" icon={MessagesSquare} title="Summary pending" description="The summary is written once processing completes." />
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-subtle pt-3.5 text-caption text-ink-400">
                      <span className="font-mono">{meeting.sourceFile.name}</span>
                      <span>{formatBytes(meeting.sourceFile.sizeBytes)}</span>
                      <span>Recorded {formatRelativeTime(meeting.date)}</span>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title="Key decisions"
                    description="Decisions taken in the meeting, with who made them."
                    icon={<CheckSquare aria-hidden />}
                  />
                  <CardBody padded={false}>
                    {meeting.keyDecisions.length === 0 ? (
                      <EmptyState variant="inline" icon={CheckSquare} title="No decisions detected" description="No decision statements were identified in this transcript." />
                    ) : (
                      <ul className="divide-y divide-line-subtle">
                        {meeting.keyDecisions.map((decision) => (
                          <li key={decision.id} className="flex items-start gap-3 px-4 py-3.5">
                            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border border-success-200 bg-success-50 text-success-700" aria-hidden>
                              <CheckSquare className="size-3" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-body-sm font-medium text-ink-900">{decision.decision}</p>
                              <p className="mt-0.5 text-caption leading-relaxed text-ink-500">{decision.rationale}</p>
                              <p className="mt-1.5 flex items-center gap-2 text-caption text-ink-400">
                                <Avatar name={decision.madeBy} size="xs" />
                                {decision.madeBy}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardBody>
                </Card>
              </>
            )}

            {tab === 'actions' && (
              <Card>
                <CardHeader
                  title="Action items"
                  description="Extracted with owners and deadlines. Each becomes a tracked task."
                  icon={<CheckSquare aria-hidden />}
                />
                <DataTable
                  rows={allActions}
                  getRowId={(task) => task.id}
                  dense
                  caption="Action items from this meeting"
                  emptyState={{ icon: CheckSquare, title: 'No action items detected', description: 'No commitments or follow-ups were identified in this transcript.' }}
                  columns={[
                    { id: 'task', header: 'Task', primary: true, cell: (task) => <span className="text-body-sm text-ink-800">{task.title}</span> },
                    {
                      id: 'owner',
                      header: 'Owner',
                      cell: (task) => (
                        <span className="flex items-center gap-2 text-body-sm text-ink-700">
                          <Avatar name={task.owner} size="xs" />
                          {task.owner}
                        </span>
                      ),
                    },
                    {
                      id: 'deadline',
                      header: 'Deadline',
                      sortValue: (task) => task.dueDate,
                      cell: (task) => <span className="text-caption text-ink-600">{formatDateTime(task.dueDate)}</span>,
                    },
                    {
                      id: 'status',
                      header: 'Status',
                      cell: (task) => (
                        <StatusBadge
                          tone={task.status === 'done' ? 'success' : task.status === 'blocked' ? 'danger' : task.status === 'in_progress' ? 'info' : 'neutral'}
                          size="sm"
                        >
                          {task.status.replace('_', ' ')}
                        </StatusBadge>
                      ),
                    },
                    {
                      id: 'priority',
                      header: 'Priority',
                      hideBelow: 'md',
                      cell: (task) => (
                        <StatusBadge tone={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'neutral'} size="sm">
                          {task.priority}
                        </StatusBadge>
                      ),
                    },
                  ]}
                />
              </Card>
            )}

            {tab === 'risks' && (
              <>
                <Card>
                  <CardHeader title="Risks" description="Risks raised during the meeting, with severity and owner." icon={<TriangleAlert aria-hidden />} />
                  <CardBody padded={false}>
                    {meeting.risks.length === 0 ? (
                      <EmptyState variant="inline" icon={TriangleAlert} title="No risks flagged" description="No risk statements were identified in this transcript." />
                    ) : (
                      <ul className="divide-y divide-line-subtle">
                        {meeting.risks.map((risk) => (
                          <li key={risk.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-body-sm text-ink-800">{risk.risk}</p>
                              <p className="mt-1 flex items-center gap-2 text-caption text-ink-400">
                                <Avatar name={risk.owner} size="xs" />
                                Owner {risk.owner}
                              </p>
                            </div>
                            <RiskBadge risk={risk.severity} size="sm" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title="Follow-ups"
                    description="Open questions raised from the meeting or suggested by the assistant."
                    icon={<CircleHelp aria-hidden />}
                  />
                  <CardBody padded={false}>
                    {meeting.followUps.length === 0 ? (
                      <EmptyState variant="inline" icon={CircleHelp} title="No follow-ups" description="No open questions were identified." />
                    ) : (
                      <ul className="divide-y divide-line-subtle">
                        {meeting.followUps.map((followUp) => (
                          <li key={followUp.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-body-sm text-ink-800">{followUp.question}</p>
                              <p className="mt-1 text-caption text-ink-400">
                                Owner {followUp.owner} · suggested by {followUp.suggestedBy}
                              </p>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              iconLeft={<Send aria-hidden />}
                              onClick={() =>
                                toast({
                                  title: 'Follow-up assigned',
                                  description: `${followUp.owner} has been asked to answer this and the response will attach to the meeting record.`,
                                  tone: 'success',
                                })
                              }
                            >
                              Assign
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardBody>
                </Card>
              </>
            )}
          </div>

          {/* Meta panel ------------------------------------------------- */}
          <div className="space-y-6">
            <Card>
              <CardHeader title="Meeting record" description="Source, participants and processing state." />
              <CardBody className="space-y-4">
                <DefinitionList
                  columns={1}
                  items={[
                    { label: 'Owner', value: meeting.owner },
                    { label: 'Department', value: meeting.department },
                    { label: 'Date', value: formatDateTime(meeting.date) },
                    { label: 'Duration', value: `${meeting.durationMinutes} minutes` },
                    { label: 'Processed', value: formatRelativeTime(meeting.date) },
                    {
                      label: 'Transcript',
                      value: (
                        <span className="font-mono text-body-sm">
                          {meeting.sourceFile.name} ({formatBytes(meeting.sourceFile.sizeBytes)})
                        </span>
                      ),
                    },
                  ]}
                />

                <div className="border-t border-line-subtle pt-3.5">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-400">Attendees</p>
                  <AvatarGroup people={meeting.attendees.map((name) => ({ name }))} max={5} />
                  <ul className="mt-2 space-y-1">
                    {meeting.attendees.map((name) => (
                      <li key={name} className="text-caption text-ink-500">
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Downstream effects" description="What this meeting produced across the platform." />
              <CardBody>
                <ul className="space-y-3">
                  {[
                    {
                      label: 'Tasks created',
                      value: `${allActions.length} tasks`,
                      detail: 'Each with an owner, a deadline and a link back to this meeting record.',
                      tone: 'success' as const,
                    },
                    {
                      label: 'Decisions raised',
                      value: `${meeting.keyDecisions.length} decisions`,
                      detail: 'Decisions that change business state route to the approval queue before execution.',
                      tone: 'brand' as const,
                    },
                    {
                      label: 'Follow-ups assigned',
                      value: `${meeting.followUps.length} open`,
                      detail: 'Owners are notified and their answers attach to the meeting record.',
                      tone: 'info' as const,
                    },
                  ].map((effect) => (
                    <li key={effect.label} className="flex items-start gap-3">
                      <StatusBadge tone={effect.tone} size="sm">
                        {effect.value}
                      </StatusBadge>
                      <div className="min-w-0">
                        <p className="text-body-sm font-medium text-ink-800">{effect.label}</p>
                        <p className="mt-0.5 text-caption leading-relaxed text-ink-500">{effect.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <p className={cn('mt-4 rounded-md border border-line-subtle bg-surface-muted px-3 py-2.5 text-caption leading-relaxed text-ink-500')}>
                  Meeting intelligence proposes work; it never authorises it. Anything that changes business state passes
                  through the approval queue and is recorded against the person who approved it.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  )
}
