import { Activity, BadgeCheck, Bot, Clock, Database, HelpCircle, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardBody, CardHeader, PageBody, PageHeader, Tabs } from '@/components/ui/primitives'
import { DataTable } from '@/components/ui/data-table'
import { MetricCard } from '@/components/ui/metrics'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Tooltip } from '@/components/ui/tooltip'
import { DataProvenanceBanner } from '@/components/ai/attribution'
import {
  AgentUsageChart,
  ApprovalVolumeChart,
  ChartFrame,
  LatencyDistributionChart,
  QueryVolumeChart,
} from '@/components/analytics/charts'
import { useAnalytics } from '@/hooks/use-api'
import { formatDuration, formatNumber } from '@/utils/format'

/**
 * Analytics — restrained, question-led charts only.
 *
 * Each chart states its title, time period and units; each KPI carries a tooltip
 * explaining exactly what it counts. Where a metric is not yet available (AI cost,
 * for example), the UI says so instead of inventing a number.
 */
export function AnalyticsPage() {
  const [window, setWindow] = useState<'7d' | '30d' | '90d'>('30d')
  const analytics = useAnalytics(window === '30d' ? undefined : window)
  const data = analytics.data

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Adoption, agent usage and response performance across the organisation. Charts answer a specific question — nothing is here to look advanced."
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <Activity className="size-3.5 text-ink-400" aria-hidden />
              {data?.windowLabel ?? 'Last 30 days'}
            </span>
            <span className="flex items-center gap-1.5">
              <Database className="size-3.5 text-ink-400" aria-hidden />
              Source: /api/analytics/
            </span>
          </>
        }
        tabs={
          <Tabs
            ariaLabel="Analytics period"
            value={window}
            onChange={(value) => setWindow(value as typeof window)}
            items={[
              { id: '7d', label: 'Last 7 days' },
              { id: '30d', label: 'Last 30 days' },
              { id: '90d', label: 'Last 90 days' },
            ]}
          />
        }
      />

      <PageBody className="space-y-6">
        <DataProvenanceBanner source="organisational telemetry sample" detail="Live figures arrive from the Django analytics endpoint once connected." />

        {analytics.error ? (
          <ErrorState title="Analytics could not be loaded" cause={analytics.error.message} onRetry={analytics.reload} />
        ) : analytics.initialLoading || !data ? (
          <Card>
            <LoadingState label="Loading analytics" rows={6} />
          </Card>
        ) : (
          <>
            {/* KPIs ---------------------------------------------------- */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {data.kpis.map((kpi) => (
                <MetricCard
                  key={kpi.key}
                  label={kpi.label}
                  value={
                    kpi.unit === 'percent'
                      ? `${kpi.value.toFixed(1)}%`
                      : kpi.unit === 'ms'
                        ? formatDuration(kpi.value)
                        : kpi.unit === 'currency'
                          ? `$${kpi.value.toFixed(0)}`
                          : formatNumber(kpi.value)
                  }
                  delta={kpi.deltaPct}
                  hint={kpi.hint}
                  icon={
                    kpi.key === 'queries' ? <Activity aria-hidden /> :
                    kpi.key === 'active_users' ? <Users aria-hidden /> :
                    kpi.key === 'agent_executions' ? <Bot aria-hidden /> :
                    kpi.key === 'avg_latency' ? <Clock aria-hidden /> :
                    kpi.key === 'unanswered' ? <HelpCircle aria-hidden /> : <BadgeCheck aria-hidden />
                  }
                />
              ))}
            </div>

            {/* Charts ------------------------------------------------- */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <ChartFrame
                id="query-volume"
                title="AI query volume"
                context="Questions asked per day · last 30 days · count"
                height={260}
              >
                <QueryVolumeChart data={data.queryVolume} />
              </ChartFrame>

              <ChartFrame
                id="agent-usage"
                title="Agent usage"
                context="Executions per agent · last 30 days · count"
                height={260}
              >
                <AgentUsageChart data={data.agentUsage} />
              </ChartFrame>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <ChartFrame
                id="latency"
                title="Response latency distribution"
                context="Answers per latency bucket · milliseconds · last 30 days"
                height={240}
                footer="Latency is measured end-to-end, from question submission to first complete answer."
              >
                <LatencyDistributionChart data={data.latency} />
              </ChartFrame>

              <ChartFrame
                id="approvals"
                title="Approval volume"
                context="Requests raised, approved and rejected per day · last 14 days · count"
                height={240}
                footer="A steady ratio of raised to resolved requests indicates the human review loop is keeping pace."
              >
                <ApprovalVolumeChart data={data.approvalVolume} />
              </ChartFrame>
            </div>

            {/* Tables ------------------------------------------------- */}
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title="Unanswered questions"
                  description="Fallbacks to insufficient evidence — a knowledge gap signal, not a model failure."
                  icon={<HelpCircle aria-hidden />}
                />
                <CardBody padded={false}>
                  {data.unanswered.length === 0 ? (
                    <EmptyState variant="inline" icon={BadgeCheck} title="No unanswered questions in this period" description="Every question was answerable from approved knowledge." />
                  ) : (
                    <ul className="divide-y divide-line-subtle">
                      {data.unanswered.map((item) => (
                        <li key={item.question} className="px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="min-w-0 flex-1 text-body-sm font-medium text-ink-800">{item.question}</p>
                            <span className="tnum shrink-0 text-caption text-ink-500">{item.count}×</span>
                          </div>
                          <p className="mt-1 text-caption leading-relaxed text-ink-500">{item.suggestedFix}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <StatusBadge tone="neutral" size="sm">
                              {item.department}
                            </StatusBadge>
                            <Link to="/knowledge" className="text-caption font-semibold text-brand-700 hover:text-brand-800">
                              Add knowledge →
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader title="Agent success rate" description="Share of executions resolved without escalation." icon={<Bot aria-hidden />} />
                  <CardBody padded={false}>
                    <ul className="divide-y divide-line-subtle">
                      {data.agentUsage.map((agent) => (
                        <li key={agent.name} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-body-sm font-medium text-ink-800">{agent.name}</p>
                            <p className="text-caption text-ink-400">
                              {agent.department} · {formatNumber(agent.executions)} executions
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line-subtle">
                              <div
                                className={agent.successRate >= 0.9 ? 'h-full rounded-full bg-success-600' : 'h-full rounded-full bg-warning-600'}
                                style={{ width: `${agent.successRate * 100}%` }}
                              />
                            </div>
                            <span className="tnum w-10 text-right text-body-sm font-medium text-ink-800">
                              {Math.round(agent.successRate * 100)}%
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title="AI usage cost"
                    description="Consumption recorded by the model gateway, if configured."
                    icon={<Activity aria-hidden />}
                    actions={<StatusBadge tone="neutral" size="sm">Not measured</StatusBadge>}
                  />
                  <CardBody>
                    <div className="rounded-md border border-dashed border-line-strong bg-surface-muted/50 px-3.5 py-4">
                      <p className="text-body-sm font-medium text-ink-700">Cost tracking is not enabled for this workspace</p>
                      <p className="mt-1 text-caption leading-relaxed text-ink-500">
                        SmartCorp reports cost only when the gateway exposes usage per request. No estimate is shown, because
                        an invented number is worse than a missing one.
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>

            {/* Most retrieved documents -------------------------------- */}
            <Card>
              <CardHeader
                title="Most retrieved documents"
                description="Which sources actually answer questions, and how often."
                icon={<Database aria-hidden />}
              />
              <DataTable
                rows={data.topDocuments}
                getRowId={(row) => row.documentName}
                dense
                caption="Most frequently retrieved knowledge documents"
                columns={[
                  { id: 'name', header: 'Document', primary: true, cell: (row) => <span className="text-body-sm text-ink-800">{row.documentName}</span> },
                  { id: 'department', header: 'Department', cell: (row) => <span className="text-body-sm text-ink-600">{row.department}</span> },
                  {
                    id: 'count',
                    header: 'Retrievals',
                    align: 'right',
                    cell: (row) => <span className="tnum text-body-sm text-ink-800">{formatNumber(row.retrievalCount)}</span>,
                  },
                  {
                    id: 'share',
                    header: 'Share of retrievals',
                    align: 'right',
                    hideBelow: 'md',
                    cell: (row) => {
                      const total = data.topDocuments.reduce((sum, item) => sum + item.retrievalCount, 0)
                      return (
                        <Tooltip label="Share of all retrievals across the documents listed here.">
                          <span className="tnum text-caption text-ink-500">{Math.round((row.retrievalCount / total) * 100)}%</span>
                        </Tooltip>
                      )
                    },
                  },
                ]}
              />
            </Card>
          </>
        )}
      </PageBody>
    </>
  )
}
