import { ArrowLeft, BadgeCheck, ListChecks, Quote, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, DefinitionList, PageBody, PageHeader, Tabs } from '@/components/ui/primitives'
import { DataTable } from '@/components/ui/data-table'
import { DeltaPill, ScoreRing } from '@/components/ui/metrics'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { DataProvenanceBanner } from '@/components/ai/attribution'
import { MetricTrendChart } from '@/components/analytics/charts'
import { useEvaluationRun, useEvaluationRuns } from '@/hooks/use-api'
import { cn, formatDateTime, formatDuration, formatRelativeTime, titleCase } from '@/utils/format'

/**
 * Evaluation run detail — one measured run, with its cases, scoring and failures.
 * Kept separate from the overview so a reviewer can audit exactly which questions
 * produced which scores.
 */
export function EvaluationRunPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const runQuery = useEvaluationRun(runId)
  const runsQuery = useEvaluationRuns()
  const [tab, setTab] = useState<'cases' | 'failures'>('cases')

  const run = runQuery.data

  if (runQuery.initialLoading) {
    return (
      <PageBody>
        <Card>
          <LoadingState label="Loading evaluation run" rows={5} />
        </Card>
      </PageBody>
    )
  }

  if (runQuery.error || !run) {
    return (
      <PageBody>
        <ErrorState
          title="This evaluation run could not be loaded"
          cause={runQuery.error?.message ?? 'The run id did not resolve.'}
          onRetry={runQuery.reload}
        />
      </PageBody>
    )
  }

  const previous = (runsQuery.data ?? []).filter((candidate) => candidate.status === 'completed' && candidate.id !== run.id)[0]
  const failures = run.cases.filter((item) => item.result !== 'pass')

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Evaluation', to: '/evaluation' }, { label: run.name }]}
        title={run.name}
        description={`${run.datasetName} · triggered by ${run.triggeredBy}`}
        meta={
          <>
            <StatusBadge tone={run.status === 'completed' ? 'success' : run.status === 'running' ? 'info' : 'danger'}>
              {titleCase(run.status)}
            </StatusBadge>
            <span>{formatDateTime(run.startedAt)}</span>
            {run.durationMs > 0 && <span>{formatDuration(run.durationMs)}</span>}
            <span>{run.caseCount} cases</span>
          </>
        }
        actions={
          <Button variant="secondary" iconLeft={<ArrowLeft aria-hidden />} onClick={() => navigate('/evaluation')}>
            Back to reliability centre
          </Button>
        }
      />
      {/* Tabs rendered in the header area for consistency with other detail pages */}
      <div className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-content px-4 sm:px-6 lg:px-8">
          <Tabs
            ariaLabel="Run views"
            value={tab}
            onChange={(value) => setTab(value as typeof tab)}
            items={[
              { id: 'cases', label: 'All cases', count: run.cases.length },
              { id: 'failures', label: 'Failures', count: failures.length },
            ]}
          />
        </div>
      </div>

      <PageBody className="space-y-6">
        <DataProvenanceBanner source={run.datasetName} />

        {/* Scores ------------------------------------------------------- */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Run score" description="Weighted across the four quality metrics and latency." icon={<BadgeCheck aria-hidden />} />
            <CardBody className="flex flex-wrap items-center gap-5">
              <ScoreRing value={run.overallScore} size={104} label="Overall AI quality" unavailable={run.overallScore === null} />
              <div className="min-w-0 flex-1 space-y-2">
                {run.passRate !== null && (
                  <div className="flex items-center justify-between text-body-sm">
                    <span className="text-ink-500">Pass rate</span>
                    <span className="tnum font-medium text-ink-900">{Math.round(run.passRate * 100)}%</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-ink-500">Failures</span>
                  <span className={cn('tnum font-medium', run.failureCount > 0 ? 'text-warning-700' : 'text-success-700')}>
                    {run.failureCount}
                  </span>
                </div>
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-ink-500">Unsupported claims</span>
                  <span className={cn('tnum font-medium', run.hallucinationCount > 0 ? 'text-danger-700' : 'text-success-700')}>
                    {run.hallucinationCount}
                  </span>
                </div>
                {previous && previous.overallScore !== null && run.overallScore !== null && (
                  <div className="flex items-center justify-between text-body-sm">
                    <span className="text-ink-500">vs. previous run</span>
                    <DeltaPill value={((run.overallScore - previous.overallScore) / previous.overallScore) * 100} />
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Metrics" description="Measured values with their targets. ‘Pending’ means not measured in this run." icon={<ListChecks aria-hidden />} />
            <CardBody className="space-y-4">
              {run.metrics.map((metric) => {
                const measured = metric.availability === 'measured' && metric.value !== null
                const percent = metric.unit === 'percent'
                const meetsTarget = measured && (percent ? (metric.value as number) >= metric.target : (metric.value as number) <= metric.target)
                return (
                  <div key={metric.key} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body-sm font-medium text-ink-800">{metric.label}</p>
                      <p className="text-caption text-ink-400">{metric.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn('tnum text-body font-semibold', measured ? 'text-ink-900' : 'text-ink-300')}>
                        {measured
                          ? percent
                            ? `${Math.round((metric.value as number) * 100)}%`
                            : formatDuration(metric.value as number)
                          : 'Pending'}
                      </span>
                      {measured && (
                        <StatusBadge tone={meetsTarget ? 'success' : 'warning'} size="sm">
                          target {percent ? `${Math.round(metric.target * 100)}%` : formatDuration(metric.target)}
                        </StatusBadge>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardBody>
          </Card>
        </div>

        {/* Trend for this run ------------------------------------------ */}
        {run.metrics[1]?.series.length > 0 && (
          <Card>
            <CardHeader
              title="Faithfulness trend"
              description="Claim-level entailment over the evaluated period · 0–100% scale"
              icon={<Quote aria-hidden />}
            />
            <CardBody>
              <MetricTrendChart data={run.metrics[1].series} unit="percent" target={run.metrics[1].target} height={220} />
            </CardBody>
          </Card>
        )}

        {/* Run metadata + cases ---------------------------------------- */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Run details" description="Reproducibility information for this run." />
            <CardBody>
              <DefinitionList
                columns={1}
                items={[
                  { label: 'Run id', value: <span className="font-mono text-body-sm">{run.id}</span> },
                  { label: 'Dataset', value: run.datasetName },
                  { label: 'Cases', value: String(run.caseCount) },
                  { label: 'Triggered by', value: run.triggeredBy },
                  { label: 'Started', value: formatDateTime(run.startedAt) },
                  { label: 'Duration', value: run.durationMs > 0 ? formatDuration(run.durationMs) : 'in progress' },
                  { label: 'Status', value: titleCase(run.status) },
                ]}
              />
              <p className="mt-4 border-t border-line-subtle pt-3.5 text-caption leading-relaxed text-ink-400">
                Runs replay a fixed question set against the current index, so results between runs are comparable. A run
                never modifies knowledge or live traffic.
              </p>
            </CardBody>
          </Card>

          <div>
            {run.cases.length === 0 ? (
              <Card>
                <EmptyState
                  icon={TriangleAlert}
                  title={run.status === 'running' ? 'Run in progress' : 'No case results in this run'}
                  description={
                    run.status === 'running'
                      ? 'Cases appear as the harness completes them: replaying questions, evaluating retrieval, checking citations, calculating results.'
                      : 'This run recorded scores without per-case detail.'
                  }
                />
              </Card>
            ) : tab === 'cases' ? (
              <DataTable
                rows={run.cases}
                getRowId={(item) => item.id}
                pageSize={10}
                dense
                caption="Evaluation cases with expected and actual results"
                columns={[
                  { id: 'question', header: 'Question', primary: true, cell: (item) => <p className="text-body-sm text-ink-800">{item.question}</p> },
                  {
                    id: 'expected',
                    header: 'Expected answer',
                    hideBelow: 'lg',
                    cell: (item) => <p className="line-clamp-2 text-caption text-ink-500">{item.expectedAnswer}</p>,
                  },
                  {
                    id: 'actual',
                    header: 'Actual answer',
                    hideBelow: 'xl',
                    cell: (item) => <p className="line-clamp-2 text-caption text-ink-500">{item.actualAnswer}</p>,
                  },
                  {
                    id: 'scores',
                    header: 'Scores',
                    align: 'right',
                    cell: (item) => (
                      <span className="tnum font-mono text-[11px] text-ink-500">
                        {Math.round(item.retrievalScore * 100)}/{Math.round(item.faithfulnessScore * 100)}/
                        {Math.round(item.citationScore * 100)}/{Math.round(item.relevanceScore * 100)}
                      </span>
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
              <Card>
                {failures.length === 0 ? (
                  <EmptyState variant="inline" icon={BadgeCheck} title="No failures in this run" description="Every case met its thresholds." />
                ) : (
                  <CardBody padded={false}>
                    <ul className="divide-y divide-line-subtle">
                      {failures.map((item) => (
                        <li key={item.id} className="px-4 py-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-body-sm font-medium text-ink-900">{item.question}</p>
                            <StatusBadge tone={item.result === 'fail' ? 'danger' : 'warning'} size="sm">
                              {item.failureKind ? titleCase(item.failureKind) : titleCase(item.result)}
                            </StatusBadge>
                          </div>
                          <p className="mt-1.5 text-caption leading-relaxed text-ink-500">{item.failureReason}</p>
                          <p className="mt-1.5 font-mono text-[11px] text-ink-400">
                            retrieved: {item.retrievedSources.length === 0 ? 'nothing above floor' : item.retrievedSources.join(', ')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                )}
              </Card>
            )}
          </div>
        </div>

        <p className="px-1 text-caption text-ink-400">
          Run recorded {formatRelativeTime(run.startedAt)} · visible to roles with evaluation access.
        </p>
      </PageBody>
    </>
  )
}
