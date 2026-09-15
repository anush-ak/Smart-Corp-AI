import { ArrowRight, CalendarClock, CheckSquare, Loader2, MessagesSquare, RefreshCw, Upload, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, PageBody, PageHeader, Tabs } from '@/components/ui/primitives'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState, ProgressBar } from '@/components/ui/states'
import { Modal } from '@/components/ui/overlays'
import { useToast } from '@/components/ui/toast'
import { useMeetings } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import type { Meeting } from '@/types'
import { cn, formatDateTime } from '@/utils/format'

/**
 * Meeting intelligence — a pipeline, not a transcript viewer.
 *
 * The workflow is stated explicitly on the page: upload → processing → summary →
 * decisions → action items → owners → deadlines → tasks → notifications. Action
 * items link through to the approval/settings surfaces so output is usable
 * immediately.
 */

const PIPELINE_STAGES = [
  { key: 'uploaded', label: 'Transcript uploaded', detail: 'File validated and stored' },
  { key: 'processing', label: 'Processing', detail: 'Speaker separation, summarisation, decision and action extraction' },
  { key: 'ready', label: 'Ready', detail: 'Summary, decisions, actions, risks and follow-ups extracted' },
] as const

function MeetingPipeline({ status }: { status: Meeting['transcriptStatus'] }) {
  const index = status === 'uploaded' ? 0 : status === 'processing' ? 1 : 2
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {PIPELINE_STAGES.map((stage, stageIndex) => {
        const done = status === 'ready' ? true : stageIndex < index
        const active = status !== 'ready' && stageIndex === index
        const failed = status === 'failed' && stageIndex === index
        return (
          <li key={stage.key} className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] font-medium',
                failed
                  ? 'border-danger-200 bg-danger-50 text-danger-800'
                  : done
                    ? 'border-success-200 bg-success-50 text-success-800'
                    : active
                      ? 'border-brand-200 bg-brand-50 text-brand-800'
                      : 'border-line bg-surface-muted text-ink-400',
              )}
            >
              {failed ? <RefreshCw className="size-3" aria-hidden /> : active ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <CheckSquare className="size-3" aria-hidden />}
              {stage.label}
            </span>
            {stageIndex < PIPELINE_STAGES.length - 1 && <span aria-hidden className="text-ink-200">→</span>}
          </li>
        )
      })}
    </ol>
  )
}

export function MeetingsPage() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const { toast } = useToast()
  const meetings = useMeetings()
  const [tab, setTab] = useState<'all' | 'processing' | 'actions'>('all')
  const [uploadOpen, setUploadOpen] = useState(false)

  const rows = meetings.data ?? []
  const filtered = rows.filter((meeting) => {
    if (tab === 'processing') return meeting.transcriptStatus !== 'ready'
    if (tab === 'actions') return meeting.actionItems.length > 0
    return true
  })

  const openActions = rows.flatMap((meeting) => meeting.actionItems).filter((task) => task.status !== 'done')

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Transcripts turned into summaries, decisions, action items, owners and deadlines — then into tracked tasks."
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <MessagesSquare className="size-3.5 text-ink-400" aria-hidden />
              {rows.length} meetings in this period
            </span>
            <span className="flex items-center gap-1.5">
              <CheckSquare className="size-3.5 text-ink-400" aria-hidden />
              {openActions.length} open action items
            </span>
          </>
        }
        actions={
          can('meetings:view') ? (
            <Button variant="primary" iconLeft={<Upload aria-hidden />} onClick={() => setUploadOpen(true)}>
              Add transcript
            </Button>
          ) : undefined
        }
        tabs={
          <Tabs
            ariaLabel="Meeting views"
            value={tab}
            onChange={(value) => setTab(value as typeof tab)}
            items={[
              { id: 'all', label: 'All meetings', count: rows.length },
              { id: 'processing', label: 'In processing', count: rows.filter((meeting) => meeting.transcriptStatus !== 'ready').length },
              { id: 'actions', label: 'With action items', count: rows.filter((meeting) => meeting.actionItems.length > 0).length },
            ]}
          />
        }
      />

      <PageBody className="space-y-6">
        {/* Pipeline explainer ------------------------------------------ */}
        <Card>
          <CardHeader
            title="From transcript to tracked work"
            description="Every meeting follows the same pipeline so output is consistent and reviewable."
            icon={<CalendarClock aria-hidden />}
          />
          <CardBody>
            <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body-sm">
              {['Upload transcript', 'Processing', 'Summary', 'Key decisions', 'Action items', 'Owners', 'Deadlines', 'Tasks', 'Notifications'].map((step, index, list) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="text-ink-600">{step}</span>
                  {index < list.length - 1 && <span aria-hidden className="text-ink-200">→</span>}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-caption leading-relaxed text-ink-400">
              Extracted action items become tasks with an owner and a deadline. Anything that changes business state still
              passes through the approval queue — meeting intelligence proposes work, it does not authorise it.
            </p>
          </CardBody>
        </Card>

        {meetings.error ? (
          <ErrorState title="Meetings could not be loaded" cause={meetings.error.message} onRetry={meetings.reload} />
        ) : meetings.initialLoading ? (
          <Card>
            <LoadingState rows={4} />
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            {rows.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title="No meetings analysed yet"
                description="Upload a transcript to get a summary, the decisions taken, action items with owners and deadlines, risks and follow-ups."
                primaryAction={{ label: 'Add transcript', onClick: () => setUploadOpen(true), icon: <Upload aria-hidden /> }}
              />
            ) : (
              <EmptyState icon={CheckSquare} title="Nothing in this view" description="Switch tabs to see all meetings or those with action items." />
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map((meeting) => (
              <Card key={meeting.id} className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle px-4 py-3">
                  <div className="min-w-0">
                    <button type="button" onClick={() => navigate(`/meetings/${meeting.id}`)} className="text-left">
                      <h3 className="text-h3 text-ink-900 hover:text-brand-700">{meeting.title}</h3>
                    </button>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-ink-400">
                      <span>{formatDateTime(meeting.date)}</span>
                      <span>·</span>
                      <span>{meeting.durationMinutes} min</span>
                      <span>·</span>
                      <span>{meeting.department}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3" aria-hidden />
                        {meeting.attendees.length} attendees
                      </span>
                    </p>
                  </div>
                  <StatusBadge
                    tone={meeting.transcriptStatus === 'ready' ? 'success' : meeting.transcriptStatus === 'failed' ? 'danger' : 'info'}
                    size="sm"
                  >
                    {meeting.transcriptStatus === 'ready' ? 'Analysed' : meeting.transcriptStatus === 'processing' ? 'Processing' : meeting.transcriptStatus}
                  </StatusBadge>
                </div>

                <div className="px-4 py-3.5">
                  <MeetingPipeline status={meeting.transcriptStatus} />

                  {meeting.transcriptStatus === 'processing' && (
                    <div className="mt-3">
                      <ProgressBar indeterminate label="Meeting processing in progress" />
                      <p className="mt-1.5 text-caption text-ink-400">
                        Speaker separation → summarisation → decision extraction → action item detection.
                      </p>
                    </div>
                  )}

                  {meeting.summary && <p className="mt-3 text-body-sm leading-relaxed text-ink-600">{meeting.summary}</p>}

                  {meeting.keyDecisions.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {meeting.keyDecisions.slice(0, 2).map((decision) => (
                        <li key={decision.id} className="flex items-start gap-2.5 rounded-md border border-line-subtle bg-surface-muted/50 px-3 py-2">
                          <CheckSquare className="mt-0.5 size-3.5 shrink-0 text-success-600" aria-hidden />
                          <div className="min-w-0">
                            <p className="text-body-sm text-ink-700">{decision.decision}</p>
                            <p className="text-caption text-ink-400">
                              {decision.madeBy} · {decision.rationale}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-subtle px-4 py-3">
                  {meeting.actionItems.length > 0 && (
                    <span className="flex items-center gap-1.5 text-caption text-ink-600">
                      <CheckSquare className="size-3.5 text-ink-400" aria-hidden />
                      {meeting.actionItems.length} action items ·{' '}
                      {meeting.actionItems.filter((task) => task.status !== 'done').length} open
                    </span>
                  )}
                  {meeting.risks.length > 0 && (
                    <span className="text-caption text-ink-600">{meeting.risks.length} risks flagged</span>
                  )}
                  <span className="text-caption text-ink-400">Owner {meeting.owner}</span>
                  <button
                    type="button"
                    onClick={() => navigate(`/meetings/${meeting.id}`)}
                    className="ml-auto inline-flex items-center gap-1 text-caption font-semibold text-brand-700 hover:text-brand-800"
                  >
                    Open meeting intelligence
                    <ArrowRight className="size-3" aria-hidden />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageBody>

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Add a meeting transcript"
        description="SmartCorp will summarise the meeting, extract decisions, action items, risks and follow-ups."
        footer={
          <>
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setUploadOpen(false)
                toast({
                  title: 'Transcript queued',
                  description: 'Processing stages run in order: speaker separation, summarisation, decision extraction, action detection. Results appear here when complete.',
                  tone: 'info',
                })
              }}
            >
              Start processing
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="sc-dotted rounded-lg border-2 border-dashed border-line-strong bg-surface-muted/40 px-4 py-7 text-center">
            <span className="mx-auto grid size-9 place-items-center rounded-md border border-line bg-surface text-ink-400 shadow-xs">
              <Upload className="size-4" aria-hidden />
            </span>
            <p className="mt-2.5 text-body font-medium text-ink-800">Drop an .vtt, .txt or .docx transcript</p>
            <p className="mt-1 text-caption text-ink-400">Up to 10 MB · speaker labels improve action-item ownership accuracy</p>
          </div>
          <div className="rounded-md border border-line-subtle bg-surface-muted px-3 py-2.5">
            <p className="text-caption font-medium text-ink-600">What is extracted</p>
            <ul className="mt-1.5 grid gap-1 text-caption text-ink-500 sm:grid-cols-2">
              <li>· Summary and context</li>
              <li>· Key decisions and who made them</li>
              <li>· Action items with owners and deadlines</li>
              <li>· Risks and open questions</li>
            </ul>
          </div>
        </div>
      </Modal>
    </>
  )
}
