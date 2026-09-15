import { Bot, CircleHelp, Database, Pause, Play, Route, ShieldCheck, Workflow } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AgentMark } from '@/components/brand'
import { RunPipeline } from '@/components/ai/agent-run-timeline'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, PageBody, PageHeader, Tabs } from '@/components/ui/primitives'
import { DataTable } from '@/components/ui/data-table'
import { ConfidenceMeter } from '@/components/ui/metrics'
import { AgentStatusBadge, StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Tooltip } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'
import { useAgents, useAgentRuns, useKnowledgeBases } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import { agentService } from '@/services'
import type { AgentSummary, KnowledgeBase } from '@/types'
import { cn, formatDuration, formatNumber, formatRelativeTime } from '@/utils/format'

/* -------------------------------------------------------------------------- */
/* Agent card                                                                 */
/* -------------------------------------------------------------------------- */

function AgentCard({
  agent,
  knowledgeBases,
  onOpen,
}: {
  agent: AgentSummary
  /** Knowledge bases the agent may retrieve from, resolved by the API. */
  knowledgeBases: KnowledgeBase[]
  onOpen: () => void
}) {
  const scope = knowledgeBases.filter((base) => agent.knowledgeBaseIds.includes(base.id))

  return (
    <article className="sc-card flex flex-col transition-colors hover:border-line-strong">
      <div className="flex items-start gap-3 p-4 pb-3">
        <AgentMark name={agent.name} accent={agent.accent} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-h3 text-ink-900">{agent.name}</h3>
            <AgentStatusBadge status={agent.status} size="sm" />
          </div>
          <p className="mt-1 text-body-sm leading-relaxed text-ink-500">{agent.purpose}</p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-x-3 border-y border-line-subtle px-4 py-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-400">Queries</dt>
          <dd className="tnum mt-0.5 text-body-sm font-medium text-ink-800">{formatNumber(agent.queriesProcessed)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-400">Resolved</dt>
          <dd className="tnum mt-0.5 text-body-sm font-medium text-ink-800">
            {agent.successRate === null ? '—' : `${Math.round(agent.successRate * 100)}%`}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-400">Median latency</dt>
          <dd className="tnum mt-0.5 text-body-sm font-medium text-ink-800">{formatDuration(agent.avgLatencyMs)}</dd>
        </div>
      </dl>

      <div className="px-4 py-3">
        <p className="text-[11px] uppercase tracking-wide text-ink-400">Knowledge scope</p>
        <ul className="mt-1.5 space-y-1">
          {scope.map((base) => (
            <li key={base.id} className="flex items-center gap-2 text-body-sm text-ink-700">
              <Database className="size-3.5 shrink-0 text-ink-400" aria-hidden />
              <Link to={`/knowledge?base=${base.id}`} className="truncate hover:text-brand-700">
                {base.name}
              </Link>
              <StatusBadge tone={base.status === 'ready' ? 'success' : 'warning'} size="sm" className="ml-auto shrink-0">
                {base.status === 'ready' ? 'ready' : base.status === 'attention' ? 'drift' : 'indexing'}
              </StatusBadge>
            </li>
          ))}
          {scope.length === 0 && <li className="text-body-sm text-ink-400">No knowledge bases assigned.</li>}
        </ul>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-subtle px-4 py-3">
        <span className="flex items-center gap-1.5 text-caption text-ink-400">
          <ShieldCheck className="size-3" aria-hidden />
          Escalates to {agent.escalationOwner}
        </span>
        <span className="text-caption text-ink-400">Last run {formatRelativeTime(agent.lastExecutionAt)}</span>
        <button type="button" onClick={onOpen} className="ml-auto text-caption font-semibold text-brand-700 hover:text-brand-800">
          Open agent →
        </button>
      </div>
    </article>
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function AgentsPage() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const { toast } = useToast()
  const agents = useAgents()
  const runs = useAgentRuns()
  const knowledgeBases = useKnowledgeBases()
  const [tab, setTab] = useState<'agents' | 'runs' | 'router'>('agents')

  const routerRuns = useMemo(() => runs.data ?? [], [runs.data])

  return (
    <>
      <PageHeader
        title="Agents"
        description="Specialised agents with defined purpose, knowledge scope and permissions. Each run is inspectable end to end."
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <Bot className="size-3.5 text-ink-400" aria-hidden />
              {(agents.data ?? []).length} agents registered
            </span>
            <span className="flex items-center gap-1.5">
              <Workflow className="size-3.5 text-ink-400" aria-hidden />
              {formatNumber((agents.data ?? []).reduce((total, agent) => total + agent.queriesProcessed, 0))} queries processed
            </span>
            <span className="flex items-center gap-1.5">
              <Route className="size-3.5 text-ink-400" aria-hidden />
              Deterministic intent routing with recorded confidence
            </span>
          </>
        }
        tabs={
          <Tabs
            ariaLabel="Agent views"
            value={tab}
            onChange={(value) => setTab(value as typeof tab)}
            items={[
              { id: 'agents', label: 'Registered agents', count: agents.data?.length ?? 0 },
              { id: 'runs', label: 'Execution history', count: runs.data?.length ?? 0 },
              { id: 'router', label: 'AI routing', icon: <Route aria-hidden /> },
            ]}
          />
        }
      />

      <PageBody className="space-y-5">
        {agents.error || runs.error ? (
          <ErrorState
            title="Agents could not be loaded"
            cause={(agents.error ?? runs.error)?.message}
            status={`http_${(agents.error ?? runs.error)?.status ?? 'network'}`}
            onRetry={() => {
              agents.reload()
              runs.reload()
            }}
          />
        ) : tab === 'agents' ? (
          agents.initialLoading ? (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index}>
                  <LoadingState rows={4} />
                </Card>
              ))}
            </div>
          ) : (agents.data ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon={Bot}
                title="No agents registered"
                description="Agents are registered by an administrator with a purpose, knowledge scope and explicit permissions."
                primaryAction={can('agents:manage') ? { label: 'Register an agent', onClick: () => toast({ title: 'Agent registration', description: 'Available from the Django admin or /api/agents/ once connected.', tone: 'info' }) } : undefined}
              />
            </Card>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {(agents.data ?? []).map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    knowledgeBases={knowledgeBases.data ?? []}
                    onOpen={() => navigate(`/agents/${agent.id}`)}
                  />
                ))}
              </div>

              {can('agents:manage') && (
                <Card>
                  <CardHeader
                    title="Agent permissions"
                    description="What each agent is allowed to do. Actions that change business state always require a human approval."
                    icon={<ShieldCheck aria-hidden />}
                  />
                  <CardBody padded={false}>
                    <ul className="divide-y divide-line-subtle">
                      {(agents.data ?? []).map((agent) => (
                        <li key={agent.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                          <span className="flex min-w-[150px] items-center gap-2.5">
                            <AgentMark name={agent.name} accent={agent.accent} size={24} />
                            <span className="text-body-sm font-medium text-ink-800">{agent.name}</span>
                          </span>
                          <span className="flex flex-wrap gap-1.5">
                            {agent.permissions.map((permission) => (
                              <StatusBadge key={permission} tone={permission.includes('request') || permission.includes('create') ? 'warning' : 'neutral'} size="sm">
                                {permission}
                              </StatusBadge>
                            ))}
                          </span>
                          <span className="ml-auto flex items-center gap-2">
                            {can('agents:manage') && (
                              <Button
                                variant="ghost"
                                size="xs"
                                iconLeft={agent.status === 'paused' ? <Play aria-hidden /> : <Pause aria-hidden />}
                                onClick={async () => {
                                  const next = agent.status === 'paused' ? 'active' : 'paused'
                                  await agentService.setStatus(agent.id, next)
                                  agents.reload()
                                  toast({
                                    title: `${agent.name} ${next === 'paused' ? 'paused' : 'resumed'}`,
                                    description: next === 'paused' ? 'New executions are blocked until resumed. Existing runs complete normally.' : 'The router will include this agent again.',
                                    tone: next === 'paused' ? 'warning' : 'success',
                                  })
                                }}
                              >
                                {agent.status === 'paused' ? 'Resume' : 'Pause'}
                              </Button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              )}
            </>
          )
        ) : tab === 'runs' ? (
          <DataTable
            loading={runs.initialLoading}
            rows={runs.data ?? []}
            getRowId={(run) => run.id}
            onRowClick={(run) => navigate(`/agents/runs/${run.id}`)}
            pageSize={10}
            caption="Agent executions with routing, retrieval and outcome"
            defaultSort={{ columnId: 'started', direction: 'desc' }}
            emptyState={{ icon: Workflow, title: 'No executions recorded yet', description: 'Runs appear here as soon as an agent answers a question.' }}
            columns={[
              {
                id: 'question',
                header: 'Request',
                primary: true,
                sortValue: (run) => run.question,
                cell: (run) => (
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-ink-900">{run.question}</p>
                    <p className="truncate text-caption text-ink-400">
                      {run.requestedBy} · {run.requestedByRole} · {formatRelativeTime(run.startedAt)}
                    </p>
                  </div>
                ),
              },
              {
                id: 'intent',
                header: 'Intent',
                sortValue: (run) => run.routing.detectedIntent,
                cell: (run) => (
                  <div className="min-w-0">
                    <p className="truncate text-body-sm text-ink-700">{run.routing.detectedIntent}</p>
                    <p className="tnum text-caption text-ink-400">{run.routing.confidence}% confidence</p>
                  </div>
                ),
              },
              {
                id: 'agent',
                header: 'Agent',
                hideBelow: 'md',
                sortValue: (run) => run.agentId,
                cell: (run) => <span className="text-body-sm text-ink-700">{run.agentId.replace('agent_', '').replace(/^./, (c) => c.toUpperCase())} Agent</span>,
              },
              {
                id: 'sources',
                header: 'Sources',
                hideBelow: 'lg',
                align: 'center',
                sortValue: (run) => run.retrieved.filter((source) => source.included).length,
                cell: (run) => (
                  <span className="tnum text-body-sm text-ink-700">
                    {run.retrieved.filter((source) => source.included).length} cited
                  </span>
                ),
              },
              {
                id: 'outcome',
                header: 'Outcome',
                cell: (run) => (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone={run.answerState === 'answered' ? 'success' : 'warning'} size="sm">
                      {run.answerState === 'answered' ? 'Answered' : 'Safe fallback'}
                    </StatusBadge>
                    {run.recommendedAction && (
                      <StatusBadge tone="brand" size="sm">
                        Action proposed
                      </StatusBadge>
                    )}
                  </div>
                ),
              },
              {
                id: 'duration',
                header: 'Duration',
                align: 'right',
                hideBelow: 'lg',
                sortValue: (run) => run.durationMs,
                cell: (run) => <span className="tnum text-caption text-ink-500">{formatDuration(run.durationMs)}</span>,
              },
              {
                id: 'pipeline',
                header: 'Trace',
                hideBelow: 'xl',
                cell: (run) => <RunPipeline run={run} />,
              },
            ]}
          />
        ) : (
          /* AI routing explanation ---------------------------------------- */
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Card>
              <CardHeader
                title="How routing works"
                description="Every question passes through the same five stages, and every stage is recorded."
                icon={<Route aria-hidden />}
              />
              <CardBody>
                <ol className="space-y-4">
                  {[
                    { step: 'Question received', detail: 'The API authenticates the requester and resolves their knowledge and agent scope.' },
                    { step: 'Intent detection', detail: 'The classifier scores HR, Finance, Support and General against the question, producing a confidence value per domain.' },
                    { step: 'Agent selection', detail: 'The highest-scoring in-scope agent is chosen. Below 70% confidence the question falls back to the General policy with a clarification prompt, never a guess.' },
                    { step: 'Retrieval and tools', detail: 'Permission filters are applied inside the vector query, passages are reranked, and only candidates above the relevance floor reach the model.' },
                    { step: 'Response or recommendation', detail: 'The answer is bound to citations. If the result implies a business action, it is raised as a recommendation and waits for human approval.' },
                  ].map((item, index) => (
                    <li key={item.step} className="flex gap-3.5">
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border border-line bg-surface-muted font-mono text-[11px] text-ink-500" aria-hidden>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="text-body-sm font-medium text-ink-800">{item.step}</p>
                        <p className="mt-0.5 text-caption leading-relaxed text-ink-500">{item.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                <p className="mt-4 flex items-start gap-2 rounded-md border border-line-subtle bg-surface-muted px-3 py-2.5 text-caption leading-relaxed text-ink-500">
                  <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-ink-400" aria-hidden />
                  SmartCorp explains its routing decisions and the evidence it used. It does not expose internal
                  chain-of-thought — the interface shows what the system decided and why, which is what an auditor or
                  reviewer needs.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Recent routing decisions"
                description="Detected intent, confidence and the agent selected."
                icon={<Workflow aria-hidden />}
              />
              <CardBody padded={false}>
                {runs.initialLoading ? (
                  <LoadingState rows={4} />
                ) : routerRuns.length === 0 ? (
                  <EmptyState variant="inline" icon={Route} title="No routing decisions recorded yet" />
                ) : (
                  <ul className="divide-y divide-line-subtle">
                    {routerRuns.map((run) => {
                      const agent = (agents.data ?? []).find((candidate) => candidate.id === run.agentId)
                      return (
                        <li key={run.id} className="px-4 py-3.5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="min-w-0 flex-1 truncate text-body-sm font-medium text-ink-900">{run.question}</p>
                            <Tooltip label={`Confidence ${run.routing.confidence}% — below 70% the question is clarified rather than answered`}>
                              <span className="shrink-0">
                                <ConfidenceMeter value={run.routing.confidence} tone={run.routing.confidence >= 80 ? 'success' : 'brand'} className="w-12" />
                              </span>
                            </Tooltip>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            <span className="text-caption text-ink-500">{run.routing.detectedIntent}</span>
                            <span aria-hidden className="text-ink-200">→</span>
                            <span className="flex items-center gap-1.5 text-caption">
                              {agent && <AgentMark name={agent.name} accent={agent.accent} size={18} />}
                              <span className="font-medium text-ink-700">{agent?.name}</span>
                            </span>
                            <span className="tnum text-caption text-ink-400">{run.routing.confidence}%</span>
                            <Link to={`/agents/runs/${run.id}`} className="ml-auto text-caption font-semibold text-brand-700 hover:text-brand-800">
                              Inspect →
                            </Link>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {run.routing.candidates.slice(0, 3).map((candidate) => (
                              <span
                                key={candidate.category}
                                className={cn(
                                  'rounded-sm border px-1.5 py-0.5 text-[11px] tnum',
                                  candidate.score >= 60 ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-line bg-surface-muted text-ink-500',
                                )}
                              >
                                {candidate.category} {candidate.score}%
                              </span>
                            ))}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </PageBody>
    </>
  )
}
