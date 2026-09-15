import {
  Bot,
  Check,
  CircleDashed,
  Database,
  Gavel,
  Route,
  ScrollText,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Tooltip } from '@/components/ui/tooltip'
import type { AgentRun } from '@/types'
import { cn, formatDuration, formatRelativeTime } from '@/utils/format'

/**
 * AgentExecutionTimeline — the Agent Execution Inspector.
 *
 * Shows the request lifecycle as discrete, auditable stages: request → router →
 * agent → knowledge searched → evidence retrieved → result → action → audit.
 * It is an execution trace, not a dump of model internals: no chain-of-thought,
 * only the decisions the system actually made and can defend.
 */

export interface TimelineStage {
  id: string
  label: string
  icon: typeof Route
  summary: string
  detail?: string
  meta?: { label: string; value: string }[]
  state: 'complete' | 'attention' | 'failed' | 'pending'
  href?: string
  hrefLabel?: string
}

export function buildRunStages(run: AgentRun, agentName: string, agentHref: string): TimelineStage[] {
  const citedCount = run.retrieved.filter((source) => source.included).length
  const excluded = run.retrieved.filter((source) => !source.included)
  const excludedByPermission = excluded.filter((source) => source.exclusionReason?.toLowerCase().includes('permission'))

  const stages: TimelineStage[] = [
    {
      id: 'request',
      label: 'Request received',
      icon: Sparkles,
      summary: `“${run.question}”`,
      detail: `Asked by ${run.requestedBy} (${run.requestedByRole}) at ${formatRelativeTime(run.startedAt)}. The API authorised the request and scoped retrieval to the requester’s permitted knowledge bases.`,
      meta: [
        { label: 'Requester', value: `${run.requestedBy} · ${run.requestedByRole}` },
        { label: 'Started', value: formatRelativeTime(run.startedAt) },
      ],
      state: 'complete',
      href: '/audit-logs',
      hrefLabel: 'Audit entry',
    },
    {
      id: 'router',
      label: 'Intent detected and routed',
      icon: Route,
      summary: `${run.routing.detectedIntent} · ${run.routing.confidence}% confidence`,
      detail: run.routing.selectionReason,
      meta: run.routing.candidates.slice(0, 3).map((candidate) => ({
        label: candidate.category,
        value: `${candidate.score}%`,
      })),
      state: 'complete',
      href: `/agents/runs/${run.id}`,
      hrefLabel: 'Routing explanation',
    },
    {
      id: 'agent',
      label: `Agent selected — ${agentName}`,
      icon: Bot,
      summary: agentName,
      detail: `Selected because it owns the detected intent and holds the required knowledge scope. Model: ${run.model}.`,
      meta: [
        { label: 'Knowledge bases', value: run.routing.knowledgeBaseIds.map((id) => id.replace('kb_', '')).join(', ') },
      ],
      state: 'complete',
      href: agentHref,
      hrefLabel: 'Open agent',
    },
    {
      id: 'knowledge',
      label: 'Knowledge searched',
      icon: Database,
      summary: `${run.routing.knowledgeBaseIds.length} knowledge bases · top-k = ${run.retrieved.length}`,
      detail:
        'Permission filters were applied inside the vector query — department and access level are matched before similarity ranking, so restricted content is never scored.',
      meta: run.routing.toolsUsed.map((tool) => ({ label: tool.name, value: formatDuration(tool.durationMs) })),
      state: 'complete',
    },
    {
      id: 'evidence',
      label: 'Evidence retrieved',
      icon: Search,
      summary: `${citedCount} cited · ${excluded.length} excluded`,
      detail:
        excludedByPermission.length > 0
          ? `${excludedByPermission.length} candidate was excluded by the permission filter and is recorded in the audit log.`
          : 'All retrieved passages passed the relevance floor for this query.',
      meta: run.retrieved.slice(0, 4).map((source) => ({
        label: `#${source.rank} ${source.documentName.split('—').pop()?.trim() ?? source.documentName}`,
        value: source.score.toFixed(2),
      })),
      state: run.answerState === 'insufficient_evidence' ? 'attention' : 'complete',
    },
    {
      id: 'result',
      label: run.answerState === 'insufficient_evidence' ? 'Safe fallback returned' : 'Answer produced',
      icon: ScrollText,
      summary:
        run.answerState === 'insufficient_evidence'
          ? 'Insufficient evidence — no confident answer was given'
          : `${run.citations.length} citations attached to the answer`,
      detail:
        run.answerState === 'insufficient_evidence'
          ? 'The best candidate scored below the relevance threshold, so SmartCorp returned an insufficient-evidence response instead of guessing. The gap is recorded for knowledge owners.'
          : 'Every normative statement in the answer is bound to a page or section reference. Statements without support were withheld.',
      meta: [
        { label: 'Tokens', value: `${run.tokenUsage.prompt} in / ${run.tokenUsage.completion} out` },
        { label: 'Duration', value: formatDuration(run.durationMs) },
      ],
      state: run.answerState === 'insufficient_evidence' ? 'attention' : 'complete',
    },
  ]

  if (run.recommendedAction) {
    stages.push({
      id: 'action',
      label: 'Action recommended',
      icon: Gavel,
      summary: run.recommendedAction.title,
      detail: `${run.recommendedAction.detail} Effort ${run.recommendedAction.effort}; ${run.recommendedAction.reversible ? 'reversible' : 'not easily reversible'}. The action is not executed automatically — it waits for a human decision.`,
      meta: [{ label: 'Estimated impact', value: run.recommendedAction.impact }],
      state: 'attention',
      href: '/approvals',
      hrefLabel: 'Open approval queue',
    })
  }

  stages.push({
    id: 'audit',
    label: 'Recorded for audit',
    icon: Check,
    summary: `${run.auditEventIds.length} audit events written`,
    detail:
      'The question, routing decision, retrieved sources, exclusions, answer and any recommendation are written to the append-only audit log with the requester identity and request id.',
    meta: run.auditEventIds.map((id) => ({ label: 'Event', value: id })),
    state: 'complete',
    href: '/audit-logs',
    hrefLabel: 'Open audit log',
  })

  return stages
}

const STATE_STYLES = {
  complete: { dot: 'border-success-200 bg-success-50 text-success-700', card: '' },
  attention: { dot: 'border-warning-200 bg-warning-50 text-warning-700', card: 'border-warning-200 bg-warning-50/30' },
  failed: { dot: 'border-danger-200 bg-danger-50 text-danger-700', card: 'border-danger-200 bg-danger-50/30' },
  pending: { dot: 'border-line bg-surface-muted text-ink-400', card: 'opacity-70' },
}

export function AgentExecutionTimeline({
  stages,
  className,
}: {
  stages: TimelineStage[]
  className?: string
}) {
  return (
    <ol className={cn('relative space-y-2.5', className)}>
      {stages.map((stage, index) => {
        const styles = STATE_STYLES[stage.state]
        return (
          <li key={stage.id} className="relative pl-10">
            {/* connector */}
            {index < stages.length - 1 && (
              <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-line" />
            )}
            <span
              className={cn(
                'absolute left-0 top-0.5 grid size-8 place-items-center rounded-md border',
                styles.dot,
              )}
              aria-hidden
            >
              <stage.icon className="size-3.5" />
            </span>

            <div className={cn('rounded-md border border-line bg-surface p-3.5', styles.card)}>
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <p className="text-body font-medium text-ink-900">{stage.label}</p>
                <span className="font-mono text-[11px] text-ink-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>

              <p className="mt-1 text-body-sm leading-relaxed text-ink-600">{stage.summary}</p>
              {stage.detail && <p className="mt-1.5 text-caption leading-relaxed text-ink-500">{stage.detail}</p>}

              {stage.meta && stage.meta.length > 0 && (
                <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line-subtle pt-2.5">
                  {stage.meta.map((entry, metaIndex) => (
                    <div key={`${entry.label}-${metaIndex}`} className="min-w-0">
                      <dt className="truncate text-[10px] uppercase tracking-wide text-ink-400">{entry.label}</dt>
                      <dd className="tnum truncate font-mono text-[11px] text-ink-600">{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {stage.href && (
                <Link to={stage.href} className="mt-2 inline-block text-caption font-semibold text-brand-700 hover:text-brand-800">
                  {stage.hrefLabel ?? 'Open'} →
                </Link>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Compact horizontal pipeline used in lists and cards. */
export function RunPipeline({ run }: { run: AgentRun }) {
  const steps = [
    { label: 'Intent', value: run.routing.intentCategory, ok: true },
    { label: 'Agent', value: run.agentId.replace('agent_', ''), ok: true },
    { label: 'Retrieval', value: `${run.retrieved.filter((s) => s.included).length} cited`, ok: run.retrieved.some((s) => s.included) },
    { label: 'Answer', value: run.answerState === 'answered' ? 'answered' : 'fallback', ok: run.answerState === 'answered' },
    { label: 'Action', value: run.recommendedAction ? 'recommended' : 'none', ok: !run.recommendedAction },
  ]

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, index) => (
        <span key={step.label} className="flex items-center gap-1.5">
          <Tooltip label={`${step.label}: ${step.value}`}>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium',
                step.ok ? 'border-line bg-surface-muted text-ink-600' : 'border-warning-200 bg-warning-50 text-warning-800',
              )}
            >
              {step.ok ? <Check className="size-2.5" aria-hidden /> : <CircleDashed className="size-2.5" aria-hidden />}
              {step.label}
            </span>
          </Tooltip>
          {index < steps.length - 1 && <span aria-hidden className="text-ink-200">›</span>}
        </span>
      ))}
    </div>
  )
}

/** Tool usage strip — what the agent actually called. */
export function ToolUsageStrip({ tools }: { tools: AgentRun['routing']['toolsUsed'] }) {
  if (tools.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2">
      {tools.map((tool) => (
        <li
          key={tool.name}
          className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5"
        >
          <Wrench className="size-3 text-ink-400" aria-hidden />
          <span className="font-mono text-[11px] text-ink-700">{tool.name}</span>
          <span className="tnum text-[11px] text-ink-400">{formatDuration(tool.durationMs)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Router explanation block — why this agent was chosen. */
export function RouterExplanation({ run }: { run: AgentRun }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Detected intent', value: run.routing.detectedIntent, hint: 'Classification produced by the intent router.' },
          { label: 'Confidence', value: `${run.routing.confidence}%`, hint: 'Below 70% the query falls back to the General agent with a clarification prompt.' },
          { label: 'Selected agent', value: run.routing.selectedAgentId.replace('agent_', '').replace(/^./, (c) => c.toUpperCase()) + ' Agent', hint: run.routing.selectionReason },
        ].map((item) => (
          <div key={item.label} className="rounded-md border border-line bg-surface p-3">
            <Tooltip label={item.hint}>
              <p className="text-[11px] uppercase tracking-wide text-ink-400">{item.label}</p>
            </Tooltip>
            <p className="mt-1 text-body font-medium text-ink-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-line bg-surface">
        <p className="border-b border-line px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          Candidate scores
        </p>
        <ul className="divide-y divide-line-subtle">
          {run.routing.candidates.map((candidate) => (
            <li key={candidate.category} className="flex items-start gap-3 px-3.5 py-2.5">
              <span
                className={cn(
                  'mt-0.5 inline-flex h-5 w-14 shrink-0 items-center justify-center rounded-sm text-[11px] font-semibold tnum',
                  candidate.score >= 60 ? 'bg-brand-50 text-brand-700' : 'bg-surface-muted text-ink-500',
                )}
              >
                {candidate.score}%
              </span>
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-ink-800">{candidate.category}</p>
                <p className="mt-0.5 text-caption leading-relaxed text-ink-500">{candidate.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-caption leading-relaxed text-ink-400">
        Routing is deterministic and inspectable: the classification, the score for each candidate and the reason for the
        selection are all stored with the run. SmartCorp does not expose internal chain-of-thought — only the decisions it
        made, the evidence it used and the reason it chose an agent.
      </p>
    </div>
  )
}
