import {
  Activity,
  BadgeCheck,
  CircleAlert,
  Gauge,
  ListChecks,
  PlayCircle,
  Quote,
  Target,
  TriangleAlert,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, PageBody, PageHeader, SectionHeading, Tabs } from '@/components/ui/primitives'
import { DataTable } from '@/components/ui/data-table'
import { DeltaPill, MetricCard, ScoreRing } from '@/components/ui/metrics'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Modal } from '@/components/ui/overlays'
import { Tooltip } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'
import { DataProvenanceBanner, MetricProvenance } from '@/components/ai/attribution'
import { MetricTrendChart } from '@/components/analytics/charts'
import { useEvaluationRuns } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import { evaluationService } from '@/services'
import type { EvaluationCase, EvaluationMetric } from '@/types'
import { cn, formatDuration, formatRelativeTime, titleCase } from '@/utils/format'

const FAILURE_LABELS: Record<string, string> = {
  hallucination: 'Unsupported claim',
  missing_retrieval: 'Missing retrieval',
  citation_mismatch: 'Citation mismatch',
  low_relevance: 'Low relevance',
  latency: 'Latency',
}

/* -------------------------------------------------------------------------- */
/* Metric card with trend                                                      */
/* -------------------------------------------------------------------------- */

function EvaluationMetricCard({ metric }: { metric: EvaluationMetric }) {
  const measured = metric.availability === 'measured' && metric.value !== null
  const percent = metric.unit === 'percent'
  const display = measured ? (percent ? `${Math.round((metric.value as number) * 100)}%` : formatDuration(metric.value as number)) : '—'
  const targetDisplay = percent ? `${Math.round(metric.target * 100)}%` : formatDuration(metric.target)
  const meetsTarget = measured && (percent ? (metric.value as number) >= metric.target : (metric.value as number) <= metric.target)

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3 p-4 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-h3 text-ink-900">{metric.label}</h3>
            <MetricProvenance measured={Boolean(measured)} window="Last 14 days" method="Evaluation harness, golden set" />
          </div>
          <p className="mt-1 text-caption leading-relaxed text-ink-500">{metric.description}</p>
        </div>
        {metric.delta !== null && measured && <DeltaPill value={metric.delta} invert={metric.key === 'latency'} />}
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-baseline gap-2">
          <span className={cn('tnum text-[26px] font-semibold leading-none tracking-[-0.02em]', measured ? 'text-ink-900' : 'text-ink-300')}>
            {display}
          </span>
          {measured ? (
            <span className={cn('text-caption font-medium', meetsTarget ? 'text-success-700' : 'text-warning-700')}>
              {meetsTarget ? 'at or above' : 'below'} target {targetDisplay}
            </span>
          ) : (
            <span className="text-caption text-ink-400">pending next run</span>
          )}
        </div>
      </div>

      <div className="mt-auto px-2 pb-1">
        {metric.series.length > 0 ? (
          <MetricTrendChart
            data={metric.series}
            unit={metric.unit}
            target={metric.target}
            height={132}
            colour={meetsTarget ? '#059669' : '#D97706'}
          />
        ) : (
          <div className="grid h-[132px] place-items-center">
            <p className="text-caption text-ink-400">No measured series yet</p>
          </div>
        )}
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Failure analysis                                                            */
/* -------------------------------------------------------------------------- */

function FailureCaseRow({ item }: { item: EvaluationCase }) {
  const [open, setOpen] = useState(false)
  const tone = item.result === 'fail' ? 'danger' : 'warning'

  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={tone} size="sm">
              {FAILURE_LABELS[item.failureKind ?? ''] ?? 'Partial'}
            </StatusBadge>
            <span className="font-mono text-[11px] text-ink-400">{item.id}</span>
          </div>
          <p className="mt-1.5 text-body-sm font-medium text-ink-900">{item.question}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Tooltip label="Faithfulness — share of statements supported by the retrieved passages">
            <span className="tnum text-caption text-ink-500">faith {Math.round(item.faithfulnessScore * 100)}%</span>
          </Tooltip>
          <Tooltip label="Citation accuracy — citations resolving to a supporting passage">
            <span className="tnum text-caption text-ink-500">cite {Math.round(item.citationScore * 100)}%</span>
          </Tooltip>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-caption font-semibold text-brand-700 hover:text-brand-800"
            aria-expanded={open}
          >
            {open ? 'Hide' : 'Why it failed'}
          </button>
        </div>
      </div>

      {item.failureReason && !open && (
        <p className="mt-1.5 line-clamp-1 text-caption text-ink-500">{item.failureReason}</p>
      )}

      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-line-subtle bg-surface-muted/50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Expected</p>
            <p className="mt-1 text-body-sm text-ink-700">{item.expectedAnswer}</p>
            {item.expectedSources.length > 0 && (
              <p className="mt-1.5 font-mono text-[11px] text-ink-400">{item.expectedSources.join(' · ')}</p>
            )}
          </div>
          <div className="rounded-md border border-line-subtle bg-surface-muted/50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Actual</p>
            <p className="mt-1 text-body-sm text-ink-700">{item.actualAnswer}</p>
            {item.retrievedSources.length > 0 && (
              <p className="mt-1.5 font-mono text-[11px] text-ink-400">{item.retrievedSources.join(' · ')}</p>
            )}
          </div>
          {item.failureReason && (
            <div className="sm:col-span-2 rounded-md border border-warning-200 bg-warning-50/60 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-warning-800">
                <TriangleAlert className="size-3" aria-hidden />
                Diagnosis and fix
              </p>
              <p className="mt-1 text-body-sm leading-relaxed text-warning-800/90">{item.failureReason}</p>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function EvaluationPage() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const { toast } = useToast()
  const runsQuery = useEvaluationRuns()

  const [tab, setTab] = useState<'overview' | 'runs' | 'cases' | 'failures'>('overview')
  const [runDialogOpen, setRunDialogOpen] = useState(false)
  const [running, setRunning] = useState(false)

  const runs = runsQuery.data ?? []
  const latest = runs.find((run) => run.status === 'completed')
  const previous = runs.filter((run) => run.status === 'completed')[1]
  const running_run = runs.find((run) => run.status === 'running')

  const failures = useMemo(
    () => (latest?.cases ?? []).filter((item) => item.result !== 'pass'),
    [latest],
  )

  const overallDelta =
    latest?.overallScore !== null && latest?.overallScore !== undefined && previous?.overallScore
      ? ((latest.overallScore - previous.overallScore) / previous.overallScore) * 100
      : null

  return (
    <>
      <PageHeader
        title="Evaluation"
        description="AI reliability centre. Retrieval quality, faithfulness, citation accuracy and failure analysis — measured against your own approved knowledge, never estimated."
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <ListChecks className="size-3.5 text-ink-400" aria-hidden />
              {latest ? `${latest.caseCount} questions in ${latest.datasetName.split('(')[0].trim()}` : 'No dataset loaded'}
            </span>
            {latest && (
              <span className="flex items-center gap-1.5">
                <Activity className="size-3.5 text-ink-400" aria-hidden />
                Last run {formatRelativeTime(latest.startedAt)} · {formatDuration(latest.durationMs)}
              </span>
            )}
            {running_run && (
              <span className="flex items-center gap-1.5 text-info-700">
                <Gauge className="size-3.5" aria-hidden />
                A run is in progress
              </span>
            )}
          </>
        }
        actions={
          can('evaluation:run') ? (
            <Button variant="primary" iconLeft={<PlayCircle aria-hidden />} onClick={() => setRunDialogOpen(true)}>
              Run evaluation
            </Button>
          ) : undefined
        }
        tabs={
          <Tabs
            ariaLabel="Evaluation views"
            value={tab}
            onChange={(value) => setTab(value as typeof tab)}
            items={[
              { id: 'overview', label: 'Quality overview' },
              { id: 'runs', label: 'Evaluation runs', count: runs.length },
              { id: 'cases', label: 'Test dataset', count: latest?.cases.length ?? 0 },
              { id: 'failures', label: 'Failure analysis', count: failures.length },
            ]}
          />
        }
      />

      <PageBody className="space-y-6">
        <DataProvenanceBanner
          source={latest?.datasetName ?? 'SmartCorp golden set v3'}
          detail="Scores are produced by the evaluation harness. Until /api/evaluations/ is connected they reflect the bundled demonstration set, not your organisation’s traffic."
        />

        {runsQuery.error ? (
          <ErrorState title="Evaluation runs could not be loaded" cause={runsQuery.error.message} onRetry={runsQuery.reload} />
        ) : runsQuery.initialLoading ? (
          <Card>
            <LoadingState label="Loading evaluation results" rows={5} />
          </Card>
        ) : tab === 'overview' ? (
          <>
            {/* Overall score --------------------------------------------- */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
              <Card>
                <CardHeader title="Overall AI quality" description="Weighted across retrieval, faithfulness, citation accuracy and relevance." icon={<BadgeCheck aria-hidden />} />
                <CardBody className="flex flex-wrap items-center gap-5">
                  <ScoreRing value={latest?.overallScore ?? null} size={112} label="Overall AI quality" unavailable={!latest} />
                  <div className="min-w-0 flex-1">
                    {latest ? (
                      <>
                        <p className="text-h3 text-ink-900">{latest.name}</p>
                        <p className="mt-1 text-body-sm text-ink-500">
                          {latest.caseCount} cases · pass rate {Math.round((latest.passRate ?? 0) * 100)}% · {latest.failureCount} failures
                        </p>
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center justify-between text-caption">
                            <span className="text-ink-500">Release threshold</span>
                            <span className="tnum font-medium text-ink-800">75 / 100</span>
                          </div>
                          <div className="flex items-center justify-between text-caption">
                            <span className="text-ink-500">Change vs. previous run</span>
                            {overallDelta !== null ? <DeltaPill value={overallDelta} /> : <span className="text-ink-400">n/a</span>}
                          </div>
                          <div className="flex items-center justify-between text-caption">
                            <span className="text-ink-500">Unsupported claims</span>
                            <span className={cn('tnum font-medium', latest.hallucinationCount > 0 ? 'text-danger-700' : 'text-success-700')}>
                              {latest.hallucinationCount}
                            </span>
                          </div>
                        </div>
                        <Button variant="secondary" size="sm" className="mt-3" onClick={() => navigate(`/evaluation/runs/${latest.id}`)}>
                          Open run detail
                        </Button>
                      </>
                    ) : (
                      <p className="text-body-sm text-ink-500">
                        No completed run yet. Run the golden set to establish a baseline before making any quality claim.
                      </p>
                    )}
                  </div>
                </CardBody>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Pass rate', value: latest?.passRate !== null && latest?.passRate !== undefined ? `${Math.round(latest.passRate * 100)}%` : '—', hint: 'Cases scoring at or above the pass threshold across all metrics.', icon: Target },
                  { label: 'Failing cases', value: latest?.failureCount ?? '—', hint: 'Cases requiring investigation or a knowledge fix.', icon: TriangleAlert },
                  { label: 'Unsupported claims', value: latest?.hallucinationCount ?? '—', hint: 'Answers containing statements with no supporting passage.', icon: Quote },
                  { label: 'Median latency', value: latest ? formatDuration(latest.metrics.find((metric) => metric.key === 'latency')?.value ?? 0) : '—', hint: 'End-to-end answer latency for evaluation traffic.', icon: Gauge },
                ].map((metric) => (
                  <MetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    hint={metric.hint}
                    icon={<metric.icon aria-hidden />}
                    availability={latest ? 'measured' : 'not_measured'}
                  />
                ))}
              </div>
            </div>

            {/* Metric breakdown ----------------------------------------- */}
            <section aria-labelledby="metric-breakdown">
              <SectionHeading
                id="metric-breakdown"
                title="Metric breakdown"
                description="Each metric states its window, target and method. Values are measured by the harness, not sampled from traffic."
                icon={<Gauge aria-hidden />}
              />
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {(latest?.metrics ?? []).map((metric) => (
                  <EvaluationMetricCard key={metric.key} metric={metric} />
                ))}
                {!latest && (
                  <Card className="lg:col-span-2 2xl:col-span-3">
                    <EmptyState
                      icon={BadgeCheck}
                      title="No measured metrics yet"
                      description="Metrics appear after the first completed evaluation run. SmartCorp deliberately shows ‘not measured’ rather than an estimated score."
                    />
                  </Card>
                )}
              </div>
            </section>
          </>
        ) : tab === 'runs' ? (
          <DataTable
            rows={runs}
            getRowId={(run) => run.id}
            onRowClick={(run) => navigate(`/evaluation/runs/${run.id}`)}
            pageSize={8}
            caption="Evaluation runs with scores and outcomes"
            emptyState={{ icon: ListChecks, title: 'No evaluation runs yet', description: 'Run the golden set to measure retrieval, faithfulness, citations and latency.' }}
            columns={[
              {
                id: 'name',
                header: 'Run',
                primary: true,
                sortValue: (run) => run.name,
                cell: (run) => (
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-ink-900">{run.name}</p>
                    <p className="truncate text-caption text-ink-400">{run.datasetName}</p>
                  </div>
                ),
              },
              { id: 'cases', header: 'Cases', align: 'right', sortValue: (run) => run.caseCount, cell: (run) => <span className="tnum text-body-sm text-ink-700">{run.caseCount}</span> },
              {
                id: 'score',
                header: 'Overall score',
                align: 'right',
                sortValue: (run) => run.overallScore ?? 0,
                cell: (run) => (
                  <span className={cn('tnum text-body-sm font-medium', run.overallScore === null ? 'text-ink-300' : run.overallScore >= 75 ? 'text-success-700' : 'text-warning-700')}>
                    {run.overallScore ?? 'Pending'}
                  </span>
                ),
              },
              {
                id: 'pass',
                header: 'Pass rate',
                align: 'right',
                hideBelow: 'md',
                sortValue: (run) => run.passRate ?? 0,
                cell: (run) => <span className="tnum text-body-sm text-ink-700">{run.passRate === null ? '—' : `${Math.round(run.passRate * 100)}%`}</span>,
              },
              {
                id: 'failures',
                header: 'Failures',
                align: 'right',
                hideBelow: 'lg',
                sortValue: (run) => run.failureCount,
                cell: (run) => (
                  <span className={cn('tnum text-body-sm', run.failureCount > 0 ? 'text-warning-700' : 'text-ink-500')}>
                    {run.failureCount}
                  </span>
                ),
              },
              {
                id: 'status',
                header: 'Status',
                cell: (run) => (
                  <StatusBadge tone={run.status === 'completed' ? 'success' : run.status === 'running' ? 'info' : 'danger'} size="sm">
                    {titleCase(run.status)}
                  </StatusBadge>
                ),
              },
              {
                id: 'started',
                header: 'Started',
                align: 'right',
                hideBelow: 'md',
                sortValue: (run) => run.startedAt,
                cell: (run) => <span className="text-caption text-ink-400">{formatRelativeTime(run.startedAt)}</span>,
              },
            ]}
          />
        ) : tab === 'cases' ? (
          <DataTable
            rows={latest?.cases ?? []}
            getRowId={(item) => item.id}
            pageSize={8}
            caption="Golden set questions with expected and actual answers"
            emptyState={{ icon: ListChecks, title: 'No test dataset loaded', description: 'Upload a golden set to compare expected answers, expected sources and actual retrieval.' }}
            columns={[
              {
                id: 'question',
                header: 'Question',
                primary: true,
                cell: (item) => <p className="text-body-sm font-medium text-ink-900">{item.question}</p>,
              },
              {
                id: 'expected',
                header: 'Expected answer',
                hideBelow: 'lg',
                cell: (item) => <p className="line-clamp-2 text-caption text-ink-600">{item.expectedAnswer}</p>,
              },
              {
                id: 'sources',
                header: 'Expected source',
                hideBelow: 'xl',
                cell: (item) => (
                  <span className="font-mono text-[11px] text-ink-500">
                    {item.expectedSources.length === 0 ? 'refusal expected' : item.expectedSources.join(', ')}
                  </span>
                ),
              },
              {
                id: 'retrieved',
                header: 'Retrieved',
                hideBelow: 'xl',
                cell: (item) => (
                  <span className="font-mono text-[11px] text-ink-500">
                    {item.retrievedSources.length === 0 ? 'nothing above floor' : item.retrievedSources.join(', ')}
                  </span>
                ),
              },
              {
                id: 'scores',
                header: 'Scores',
                align: 'right',
                cell: (item) => (
                  <div className="flex items-center justify-end gap-2">
                    <Tooltip label={`Retrieval ${Math.round(item.retrievalScore * 100)}% · Faithfulness ${Math.round(item.faithfulnessScore * 100)}% · Citation ${Math.round(item.citationScore * 100)}% · Relevance ${Math.round(item.relevanceScore * 100)}%`}>
                      <span className="tnum text-caption text-ink-500">
                        {Math.round(item.retrievalScore * 100)}/{Math.round(item.faithfulnessScore * 100)}/
                        {Math.round(item.citationScore * 100)}/{Math.round(item.relevanceScore * 100)}
                      </span>
                    </Tooltip>
                  </div>
                ),
              },
              {
                id: 'result',
                header: 'Result',
                cell: (item) => (
                  <StatusBadge tone={item.result === 'pass' ? 'success' : item.result === 'partial' ? 'warning' : 'danger'} size="sm">
                    {titleCase(item.result)}
                  </StatusBadge>
                ),
              },
            ]}
          />
        ) : (
          /* Failure analysis ------------------------------------------- */
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader
                title="Failed and partial cases"
                description="Each case states what was expected, what happened, and the fix."
                icon={<TriangleAlert aria-hidden />}
                actions={
                  <span className="tnum text-caption text-ink-500">
                    {failures.filter((item) => item.result === 'fail').length} failed ·{' '}
                    {failures.filter((item) => item.result === 'partial').length} partial
                  </span>
                }
              />
              <CardBody padded={false}>
                {failures.length === 0 ? (
                  <EmptyState
                    variant="inline"
                    icon={BadgeCheck}
                    title="No failures in the latest run"
                    description="Every case passed its thresholds. Failures will be listed here with their diagnosis when they occur."
                  />
                ) : (
                  <ul className="divide-y divide-line-subtle">
                    {failures.map((item) => (
                      <FailureCaseRow key={item.id} item={item} />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Failure categories" description="Grouped by root cause, from the latest completed run." icon={<CircleAlert aria-hidden />} />
                <CardBody>
                  {failures.length === 0 ? (
                    <p className="text-body-sm text-ink-500">No failures to categorise.</p>
                  ) : (
                    <ul className="space-y-3">
                      {Object.entries(
                        failures.reduce<Record<string, number>>((accumulator, item) => {
                          const key = item.failureKind ?? 'other'
                          accumulator[key] = (accumulator[key] ?? 0) + 1
                          return accumulator
                        }, {}),
                      ).map(([kind, count]) => (
                        <li key={kind}>
                          <div className="flex items-center justify-between text-body-sm">
                            <span className="text-ink-700">{FAILURE_LABELS[kind] ?? titleCase(kind)}</span>
                            <span className="tnum text-ink-500">{count}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line-subtle">
                            <div
                              className={cn('h-full rounded-full', kind === 'hallucination' ? 'bg-danger-600' : 'bg-warning-500')}
                              style={{ width: `${(count / failures.length) * 100}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="How failures are scored" description="Definitions used by the harness, so results are reproducible." icon={<Quote aria-hidden />} />
                <CardBody>
                  <dl className="space-y-3">
                    {[
                      { term: 'Retrieval quality', detail: 'Recall@k and mean reciprocal rank of the expected source before reranking.' },
                      { term: 'Faithfulness', detail: 'Claim-level entailment: what share of answer statements are supported by the retrieved passages.' },
                      { term: 'Citation accuracy', detail: 'Share of citations that resolve to a passage actually supporting the attached claim.' },
                      { term: 'Answer relevance', detail: 'Judge-scored relevance of the answer to the exact question asked.' },
                      { term: 'Unsupported claim', detail: 'A statement with no supporting passage — counted separately because it is the failure that erodes trust fastest.' },
                    ].map((entry) => (
                      <div key={entry.term}>
                        <dt className="text-body-sm font-medium text-ink-800">{entry.term}</dt>
                        <dd className="mt-0.5 text-caption leading-relaxed text-ink-500">{entry.detail}</dd>
                      </div>
                    ))}
                  </dl>
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </PageBody>

      <Modal
        open={runDialogOpen}
        onClose={() => setRunDialogOpen(false)}
        title="Run evaluation"
        description="The harness replays the golden set against the current index and reports measured quality."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRunDialogOpen(false)} disabled={running}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={running}
              onClick={async () => {
                setRunning(true)
                await evaluationService.startRun()
                setRunning(false)
                setRunDialogOpen(false)
                runsQuery.reload()
                toast({
                  title: 'Evaluation started',
                  description: 'Running the golden set: replaying questions, evaluating retrieval, checking citations, calculating results. Results appear here when the run completes.',
                  tone: 'info',
                })
              }}
            >
              Start run
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-md border border-line bg-surface-muted/50 p-3.5">
            <p className="text-body-sm font-medium text-ink-800">{latest?.datasetName ?? 'SmartCorp golden set v3'}</p>
            <p className="mt-1 text-caption text-ink-500">
              {latest?.caseCount ?? 108} questions with expected answers and expected sources. Runs are read-only against the
              index and never modify knowledge.
            </p>
          </div>
          <ol className="space-y-2">
            {['Running test set', 'Evaluating retrieval', 'Checking citations', 'Calculating results'].map((stage, index) => (
              <li key={stage} className="flex items-center gap-2.5 text-body-sm text-ink-600">
                <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line bg-surface font-mono text-[10px] text-ink-500">
                  {index + 1}
                </span>
                {stage}
              </li>
            ))}
          </ol>
          <p className="text-caption leading-relaxed text-ink-400">
            A full run against 108 cases takes approximately 12 minutes in the reference environment. Running an
            evaluation does not affect live traffic.
          </p>
        </div>
      </Modal>
    </>
  )
}
