import { ArrowLeft, Bot, Gavel, Route, ScrollText, Sparkles } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AgentExecutionTimeline, buildRunStages, RouterExplanation, ToolUsageStrip } from '@/components/ai/agent-run-timeline'
import { EvidencePanel } from '@/components/ai/evidence-card'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, DefinitionList, PageBody, PageHeader } from '@/components/ui/primitives'
import { ConfidenceBadge } from '@/components/ui/metrics'
import { StatusBadge } from '@/components/ui/status-badge'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { useAgent, useAgentRun } from '@/hooks/use-api'
import { formatDateTime, formatDuration, formatNumber } from '@/utils/format'

/**
 * Agent Execution Inspector.
 *
 * The project specification requires run details with inputs, sources, actions
 * and status. This screen presents them as an execution trace — request, router,
 * agent, knowledge, evidence, result, action, audit — rather than raw logs.
 */
export function AgentRunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()

  const runQuery = useAgentRun(runId)
  const run = runQuery.data
  const agentQuery = useAgent(run?.agentId)
  const agent = agentQuery.data

  if (runQuery.initialLoading) {
    return (
      <PageBody>
        <Card>
          <LoadingState label="Loading execution trace" rows={6} />
        </Card>
      </PageBody>
    )
  }

  if (runQuery.error || !run) {
    return (
      <PageBody>
        <ErrorState
          title="This execution could not be loaded"
          cause={runQuery.error?.message ?? 'The run id did not resolve to a recorded execution.'}
          onRetry={runQuery.reload}
        />
      </PageBody>
    )
  }

  const stages = buildRunStages(run, agent?.name ?? 'Agent', `/agents/${run.agentId}`)

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Agents', to: '/agents' },
          { label: agent?.name ?? 'Agent', to: `/agents/${run.agentId}` },
          { label: run.id },
        ]}
        title="Execution inspector"
        description={run.question}
        meta={
          <>
            <StatusBadge tone={run.status === 'completed' ? 'success' : run.status === 'awaiting_approval' ? 'warning' : 'danger'} size="sm">
              {run.status === 'awaiting_approval' ? 'Awaiting approval' : run.status === 'completed' ? 'Completed' : 'Failed'}
            </StatusBadge>
            <ConfidenceBadge value={run.routing.confidence} label="Routing confidence" />
            <span className="font-mono text-caption">{run.id}</span>
            <span>{formatDateTime(run.startedAt)}</span>
            <span>{formatDuration(run.durationMs)}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" iconLeft={<ArrowLeft aria-hidden />} onClick={() => navigate('/agents')}>
              Back
            </Button>
            <Link to={`/assistant/${run.conversationId}`}>
              <Button variant="secondary" iconLeft={<Sparkles aria-hidden />}>
                Open conversation
              </Button>
            </Link>
            {run.recommendedAction && (
              <Link to="/approvals">
                <Button variant="primary" iconLeft={<Gavel aria-hidden />}>
                  Review recommendation
                </Button>
              </Link>
            )}
          </>
        }
      />

      <PageBody className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
          {/* Execution timeline ---------------------------------------- */}
          <section aria-labelledby="timeline-heading">
            <Card>
              <CardHeader
                id="timeline-heading"
                title="Execution timeline"
                description="The decisions this run actually made, in order — not internal reasoning."
                icon={<Route aria-hidden />}
              />
              <CardBody>
                <AgentExecutionTimeline stages={stages} />
              </CardBody>
            </Card>
          </section>

          {/* Request + routing + result --------------------------------- */}
          <div className="space-y-6">
            <Card>
              <CardHeader title="Request" description="The input that started this run." icon={<Bot aria-hidden />} />
              <CardBody>
                <blockquote className="rounded-md border-l-2 border-brand-300 bg-surface-muted/60 px-3.5 py-3 text-body text-ink-800">
                  {run.question}
                </blockquote>
                <div className="mt-4">
                  <DefinitionList
                    columns={2}
                    items={[
                      { label: 'Requested by', value: `${run.requestedBy} (${run.requestedByRole})` },
                      { label: 'Started', value: formatDateTime(run.startedAt) },
                      { label: 'Agent', value: <Link to={`/agents/${run.agentId}`} className="text-brand-700 hover:text-brand-800">{agent?.name ?? run.agentId}</Link> },
                      { label: 'Model', value: <span className="font-mono text-body-sm">{run.model}</span> },
                      { label: 'Conversation', value: <Link to={`/assistant/${run.conversationId}`} className="text-brand-700 hover:text-brand-800">{run.conversationId}</Link> },
                      { label: 'Audit events', value: <span className="font-mono text-body-sm">{run.auditEventIds.join(', ')}</span> },
                    ]}
                  />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="AI router" description="Intent detection and agent selection, with the reason recorded." icon={<Route aria-hidden />} />
              <CardBody>
                <RouterExplanation run={run} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Tools invoked"
                description="Each call made during retrieval, with its latency."
                icon={<ScrollText aria-hidden />}
              />
              <CardBody>
                <ToolUsageStrip tools={run.routing.toolsUsed} />
                <p className="mt-3 text-caption leading-relaxed text-ink-400">
                  Tool calls are recorded with their filters, so you can verify that permission constraints were applied
                  at the query stage rather than filtered afterwards.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Result -------------------------------------------------------- */}
        <Card>
          <CardHeader
            title="Result"
            description={
              run.answerState === 'insufficient_evidence'
                ? 'The safe fallback was returned instead of an unsupported answer.'
                : 'Every statement below is bound to a cited passage.'
            }
            icon={<ScrollText aria-hidden />}
            actions={
              <StatusBadge tone={run.answerState === 'answered' ? 'success' : 'warning'} size="sm">
                {run.answerState === 'answered' ? 'Answered from evidence' : 'Insufficient evidence'}
              </StatusBadge>
            }
          />
          <CardBody className="space-y-4">
            <div className="answer-body">{run.answer}</div>

            {run.citations.length > 0 && (
              <div className="rounded-md border border-line bg-surface-muted/50 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Citation map · every claim resolves to a passage
                </p>
                <ul className="mt-2 space-y-2">
                  {run.citations.map((citation) => (
                    <li key={citation.id} className="flex items-start gap-2.5">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success-600" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-body-sm text-ink-700">{citation.claim}</p>
                        <p className="text-caption text-ink-400">
                          <Link to={`/knowledge/${citation.documentId}`} className="hover:text-brand-700">
                            {citation.documentName}
                          </Link>
                          {citation.page !== null && ` · page ${citation.page}`}
                          {citation.section && ` · ${citation.section}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {run.recommendedAction && (
              <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-4">
                <div className="flex items-center gap-2">
                  <Gavel className="size-3.5 text-brand-700" aria-hidden />
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-800">Action proposed by the agent</p>
                  <StatusBadge tone="warning" size="sm" className="ml-auto">
                    Not executed — requires approval
                  </StatusBadge>
                </div>
                <p className="mt-2 text-body font-medium text-ink-900">{run.recommendedAction.title}</p>
                <p className="mt-1 text-body-sm leading-relaxed text-ink-600">{run.recommendedAction.detail}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-ink-500">
                  <span>Impact: {run.recommendedAction.impact}</span>
                  <span>Effort: {run.recommendedAction.effort}</span>
                  <span>{run.recommendedAction.reversible ? 'Reversible' : 'Not easily reversible'}</span>
                </div>
                <Button variant="primary" size="sm" className="mt-3" onClick={() => navigate('/approvals')}>
                  Open approval queue
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-subtle pt-3.5 text-caption text-ink-500">
              <span className="tnum">Prompt tokens {formatNumber(run.tokenUsage.prompt)}</span>
              <span className="tnum">Completion tokens {formatNumber(run.tokenUsage.completion)}</span>
              <span className="tnum">Duration {formatDuration(run.durationMs)}</span>
              <span className="tnum">Sources cited {run.retrieved.filter((source) => source.included).length}</span>
            </div>
          </CardBody>
        </Card>

        {/* Evidence ----------------------------------------------------- */}
        <Card>
          <CardHeader
            title="Evidence"
            description="Every retrieved passage, including the ones the system excluded and why."
            icon={<Sparkles aria-hidden />}
          />
          <CardBody>
            <EvidencePanel sources={run.retrieved} citations={run.citations} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Audit trail" description="How this run appears in the organisation’s records." icon={<ScrollText aria-hidden />} />
          <CardBody>
            <ul className="space-y-2">
              {run.auditEventIds.map((id) => (
                <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line-subtle bg-surface-muted/50 px-3 py-2">
                  <span className="font-mono text-caption text-ink-600">{id}</span>
                  <span className="text-caption text-ink-400">
                    Actor {run.requestedBy} · result success · resource agent_run/{run.id}
                  </span>
                  <Link to="/audit-logs" className="text-caption font-semibold text-brand-700 hover:text-brand-800">
                    Open in audit log →
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </PageBody>
    </>
  )
}
