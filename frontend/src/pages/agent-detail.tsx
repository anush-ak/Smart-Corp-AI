import { ArrowLeft, Bot, Clock, Database, Gauge, ShieldCheck, Sparkles, Workflow } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AgentMark } from '@/components/brand'
import { RunPipeline } from '@/components/ai/agent-run-timeline'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, DefinitionList, PageBody, PageHeader, SectionHeading } from '@/components/ui/primitives'
import { DataTable } from '@/components/ui/data-table'
import { AgentStatusBadge, StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { MetricTrendChart } from '@/components/analytics/charts'
import { useAgent, useAgentRuns, useEvaluationRuns, useKnowledgeBases } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDuration, formatNumber, formatRelativeTime } from '@/utils/format'

/**
 * Agent detail — identity, scope, permissions, performance and execution history.
 *
 * The "performance" panel deliberately separates measured evaluation figures
 * from operational counters, and flags when a value is not yet measured.
 */
export function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const { can } = usePermissions()

  const agentQuery = useAgent(agentId)
  const runsQuery = useAgentRuns(agentId)
  const knowledgeBases = useKnowledgeBases()
  const evaluations = useEvaluationRuns()

  const agent = agentQuery.data

  if (agentQuery.initialLoading) {
    return (
      <PageBody>
        <Card>
          <LoadingState label="Loading agent" rows={5} />
        </Card>
      </PageBody>
    )
  }

  if (agentQuery.error) {
    return (
      <PageBody>
        <ErrorState title="This agent could not be loaded" cause={agentQuery.error.message} onRetry={agentQuery.reload} />
      </PageBody>
    )
  }

  if (!agent) {
    return (
      <PageBody>
        <EmptyState
          icon={Bot}
          title="Agent not found"
          description="It may have been deregistered, or it sits outside your permitted scope."
          primaryAction={{ label: 'Back to Agents', onClick: () => navigate('/agents') }}
        />
      </PageBody>
    )
  }

  const scope = (knowledgeBases.data ?? []).filter((base) => agent.knowledgeBaseIds.includes(base.id))
  // The most recent published evaluation run provides the reliability series.
  const latestEvaluation = (evaluations.data ?? []).find((run) => run.status === 'completed')
  const runs = runsQuery.data ?? []

  const successRateSeries = latestEvaluation?.metrics
    .find((metric) => metric.key === 'answer_relevance')
    ?.series.map((point) => ({ date: point.date, value: point.value }))

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Agents', to: '/agents' }, { label: agent.name }]}
        title={
          <span className="flex items-center gap-3">
            <AgentMark name={agent.name} accent={agent.accent} size={32} />
            {agent.name}
          </span>
        }
        description={agent.purpose}
        meta={
          <>
            <AgentStatusBadge status={agent.status} />
            <span>{agent.department} department</span>
            <span className="font-mono text-caption">{agent.model}</span>
            <span>Last execution {formatRelativeTime(agent.lastExecutionAt)}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" iconLeft={<ArrowLeft aria-hidden />} onClick={() => navigate('/agents')}>
              Back
            </Button>
            <Button variant="primary" iconLeft={<Sparkles aria-hidden />} onClick={() => navigate('/assistant')}>
              Ask this agent
            </Button>
          </>
        }
      />

      <PageBody className="space-y-6">
        {/* Operational counters ----------------------------------------- */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Queries processed', value: formatNumber(agent.queriesProcessed), hint: 'Total executions recorded against this agent.' },
            {
              label: 'Successful resolutions',
              value: agent.successRate === null ? 'Not measured' : `${Math.round(agent.successRate * 100)}%`,
              hint: 'Answers rated helpful, or not re-asked within 24 hours.',
            },
            { label: 'Median latency', value: formatDuration(agent.avgLatencyMs), hint: 'p50 from question to complete answer.' },
            {
              label: 'Open recommendations',
              value: String(runs.filter((run) => run.recommendedAction).length),
              hint: 'Recommendations this agent raised that required human approval.',
            },
          ].map((metric) => (
            <Card key={metric.label} className="p-4">
              <p className="text-caption font-medium uppercase tracking-wide text-ink-500">{metric.label}</p>
              <p className="tnum mt-2 text-[24px] font-semibold leading-none tracking-[-0.02em] text-ink-900">{metric.value}</p>
              <p className="mt-2 text-caption leading-relaxed text-ink-400">{metric.hint}</p>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* Configuration --------------------------------------------- */}
          <div className="space-y-6">
            <Card>
              <CardHeader title="Configuration" description="What this agent is, and what it may do." icon={<Bot aria-hidden />} />
              <CardBody>
                <DefinitionList
                  columns={2}
                  items={[
                    { label: 'Model', value: <span className="font-mono text-body-sm">{agent.model}</span> },
                    { label: 'Department', value: agent.department },
                    { label: 'Escalation owner', value: agent.escalationOwner },
                    { label: 'Status', value: <AgentStatusBadge status={agent.status} size="sm" /> },
                  ]}
                />

                <div className="mt-4 border-t border-line-subtle pt-4">
                  <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-400">
                    <ShieldCheck className="size-3" aria-hidden />
                    Permissions
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {agent.permissions.map((permission) => (
                      <li key={permission} className="flex items-start gap-2 text-body-sm text-ink-700">
                        <StatusBadge
                          tone={permission.startsWith('knowledge') ? 'neutral' : permission.includes('request') || permission.includes('create') ? 'warning' : 'info'}
                          size="sm"
                        >
                          {permission}
                        </StatusBadge>
                        <span className="text-caption text-ink-400">
                          {permission === 'knowledge:read' && 'May retrieve passages from knowledge bases in scope.'}
                          {permission === 'answers:draft' && 'May compose answers, always bound to citations.'}
                          {permission === 'decisions:create' && 'May raise a decision for human review — never execute it.'}
                          {permission === 'approvals:request' && 'May request approval; may not grant it.'}
                          {permission === 'tickets:annotate' && 'May attach context to an existing ticket.'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 border-t border-line-subtle pt-4">
                  <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-400">
                    <Database className="size-3" aria-hidden />
                    Knowledge scope
                  </p>
                  <ul className="mt-2 space-y-2">
                    {scope.map((base) => (
                      <li key={base.id} className="rounded-md border border-line bg-surface px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link to={`/knowledge?base=${base.id}`} className="text-body-sm font-medium text-ink-800 hover:text-brand-700">
                            {base.name}
                          </Link>
                          <StatusBadge tone={base.status === 'ready' ? 'success' : 'warning'} size="sm">
                            {base.status === 'ready' ? 'ready' : base.status === 'attention' ? 'quality drift' : 'indexing'}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-caption text-ink-400">
                          {base.documentCount} documents · {formatNumber(base.chunkCount)} passages ·{' '}
                          {base.accessLevel === 'organization' ? 'org-wide' : base.accessLevel}
                        </p>
                        {base.retrievalQuality !== null && (
                          <p className="tnum mt-1 text-caption text-ink-500">
                            Retrieval quality {base.retrievalQuality.toFixed(2)}
                            {base.retrievalQuality < 0.85 && <span className="ml-1.5 text-warning-700">below the 0.85 review threshold</span>}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Answer relevance trend"
                description="Judge-scored relevance from the evaluation harness · last 14 days"
                icon={<Gauge aria-hidden />}
                actions={
                  <StatusBadge tone="neutral" size="sm">
                    0–100 scale
                  </StatusBadge>
                }
              />
              <CardBody>
                {successRateSeries && successRateSeries.length > 0 ? (
                  <MetricTrendChart data={successRateSeries} unit="percent" target={0.88} height={190} />
                ) : (
                  <EmptyState variant="inline" icon={Gauge} title="No measured trend yet" description="Quality figures appear once an evaluation run completes." />
                )}
                <p className="mt-2 text-caption leading-relaxed text-ink-400">
                  Operational counters above come from live traffic. The trend here is measured by the evaluation harness —
                  the two are shown separately so a busy agent is never mistaken for a reliable one.
                </p>
              </CardBody>
            </Card>
          </div>

          {/* Execution history ----------------------------------------- */}
          <div className="space-y-6">
            <section aria-labelledby="agent-runs-heading">
              <SectionHeading
                id="agent-runs-heading"
                title="Execution history"
                description="Every run with its routing decision, evidence and outcome."
                icon={<Workflow aria-hidden />}
                actions={
                  <Button variant="ghost" size="sm" onClick={() => navigate('/agents')}>
                    All agents
                  </Button>
                }
              />
              <DataTable
                loading={runsQuery.initialLoading}
                rows={runs}
                getRowId={(run) => run.id}
                onRowClick={(run) => navigate(`/agents/runs/${run.id}`)}
                dense
                caption="Agent execution history"
                emptyState={{ icon: Workflow, title: 'No runs recorded for this agent', description: 'Executions appear here with their full evidence trail.' }}
                columns={[
                  {
                    id: 'question',
                    header: 'Request',
                    primary: true,
                    cell: (run) => (
                      <div className="min-w-0">
                        <p className="truncate text-body-sm font-medium text-ink-900">{run.question}</p>
                        <p className="truncate text-caption text-ink-400">{run.requestedBy} · {formatRelativeTime(run.startedAt)}</p>
                      </div>
                    ),
                  },
                  {
                    id: 'outcome',
                    header: 'Outcome',
                    cell: (run) => (
                      <StatusBadge tone={run.answerState === 'answered' ? 'success' : 'warning'} size="sm">
                        {run.answerState === 'answered' ? 'Answered' : 'Fallback'}
                      </StatusBadge>
                    ),
                  },
                  {
                    id: 'duration',
                    header: 'Duration',
                    align: 'right',
                    hideBelow: 'lg',
                    cell: (run) => <span className="tnum text-caption text-ink-500">{formatDuration(run.durationMs)}</span>,
                  },
                  {
                    id: 'trace',
                    header: 'Trace',
                    hideBelow: 'xl',
                    cell: (run) => <RunPipeline run={run} />,
                  },
                ]}
              />
            </section>

            <Card>
              <CardHeader title="Guardrails" description="Constraints applied to this agent on every execution." icon={<ShieldCheck aria-hidden />} />
              <CardBody>
                <ul className="space-y-3">
                  {[
                    { title: 'No autonomous business actions', detail: 'The agent may recommend, but any change to business state requires a recorded human approval.' },
                    { title: 'Permission-filtered retrieval', detail: 'Knowledge outside the requester’s scope is filtered inside the vector query before ranking.' },
                    { title: 'Citation-bound answers', detail: 'Statements without a supporting passage are withheld rather than softened.' },
                    { title: 'Safe fallback', detail: 'Below the relevance floor the agent returns insufficient evidence and logs the knowledge gap.' },
                    { title: 'Full traceability', detail: 'Routing, retrieval, exclusions, answer and recommendation are written to the audit log.' },
                  ].map((guardrail) => (
                    <li key={guardrail.title} className="flex items-start gap-2.5">
                      <Clock className="mt-0.5 size-3.5 shrink-0 text-ink-300" aria-hidden />
                      <div>
                        <p className="text-body-sm font-medium text-ink-800">{guardrail.title}</p>
                        <p className="mt-0.5 text-caption leading-relaxed text-ink-500">{guardrail.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {can('agents:manage') && (
                  <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate('/settings')}>
                    Adjust guardrails in settings
                  </Button>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  )
}
