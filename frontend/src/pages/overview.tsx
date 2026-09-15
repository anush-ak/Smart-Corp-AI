import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Bot,
  CircleAlert,
  ClipboardCheck,
  Clock,
  Gavel,
  MessageSquarePlus,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, PageBody, SectionHeading } from '@/components/ui/primitives'
import { MetricCard, ScoreRing, DeltaPill } from '@/components/ui/metrics'
import { RiskBadge, StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { DataProvenanceBanner } from '@/components/ai/attribution'
import { Sparkline } from '@/components/analytics/charts'
import { useAuth } from '@/contexts/auth-context'
import { usePermissions } from '@/hooks/use-permissions'
import {
  useAgents,
  useAnalytics,
  useApprovals,
  useDecisions,
  useEvaluationRuns,
  useKnowledgeBases,
  useNotifications,
  useSecurityOverview,
} from '@/hooks/use-api'
import { cn, formatDuration, formatNumber, formatRelativeTime } from '@/utils/format'

/* -------------------------------------------------------------------------- */
/* Priority item — the "what needs my attention" primitive                      */
/* -------------------------------------------------------------------------- */

type PriorityKind = 'approval' | 'recommendation' | 'knowledge' | 'evaluation' | 'security'

interface PriorityItem {
  id: string
  kind: PriorityKind
  title: string
  reason: string
  href: string
  actionLabel: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  meta: ReactNode
}

const SEVERITY_TONE = {
  critical: { box: 'border-l-danger-600', chip: 'danger' as const, label: 'Critical' },
  high: { box: 'border-l-danger-600', chip: 'danger' as const, label: 'High' },
  medium: { box: 'border-l-warning-600', chip: 'warning' as const, label: 'Medium' },
  low: { box: 'border-l-info-600', chip: 'info' as const, label: 'Low' },
}

const KIND_ICON = {
  approval: ClipboardCheck,
  recommendation: Gavel,
  knowledge: BookOpen,
  evaluation: BadgeCheck,
  security: ShieldAlert,
}

function PriorityRow({ item }: { item: PriorityItem }) {
  const tone = SEVERITY_TONE[item.severity]
  const Icon = KIND_ICON[item.kind]

  return (
    <li className={cn('border-l-2 px-4 py-3.5 transition-colors hover:bg-surface-muted/60', tone.box)}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-surface text-ink-500" aria-hidden>
          <Icon className="size-3.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <div className="min-w-0">
              <Link to={item.href} className="text-body font-medium text-ink-900 hover:text-brand-700">
                {item.title}
              </Link>
              <p className="mt-1 text-body-sm leading-relaxed text-ink-500">{item.reason}</p>
            </div>
            <StatusBadge tone={tone.chip} size="sm">
              {tone.label}
            </StatusBadge>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {item.meta}
            <Link
              to={item.href}
              className="ml-auto inline-flex items-center gap-1 text-caption font-semibold text-brand-700 hover:text-brand-800"
            >
              {item.actionLabel}
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/* Recent intelligence feed                                                     */
/* -------------------------------------------------------------------------- */

interface IntelligenceEvent {
  id: string
  title: string
  detail: string
  at: string
  href: string
  action: string
  kind: string
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export function OverviewPage() {
  const { user, organization } = useAuth()
  const { can } = usePermissions()
  const navigate = useNavigate()

  const approvals = useApprovals()
  const decisions = useDecisions()
  const analytics = useAnalytics()
  const knowledgeBases = useKnowledgeBases()
  const evaluations = useEvaluationRuns()
  const security = useSecurityOverview()
  const agents = useAgents()
  const notifications = useNotifications()

  const pendingApprovals = useMemo(
    () => (approvals.data ?? []).filter((approval) => approval.status === 'awaiting_approval' || approval.status === 'needs_evidence'),
    [approvals.data],
  )
  const latestRun = evaluations.data?.find((run) => run.status === 'completed')
  const previousRun = evaluations.data?.filter((run) => run.status === 'completed')[1]

  /* ---- Priority queue ------------------------------------------------- */
  const priorityItems = useMemo<PriorityItem[]>(() => {
    const items: PriorityItem[] = []

    pendingApprovals.forEach((approval) => {
      items.push({
        id: `apr-${approval.id}`,
        kind: 'approval',
        title: approval.title,
        reason: approval.rationale,
        href: `/approvals/${approval.id}`,
        actionLabel: 'Review request',
        severity: approval.risk === 'high' ? 'high' : approval.risk === 'medium' ? 'medium' : 'low',
        meta: (
          <>
            <RiskBadge risk={approval.risk} size="sm" />
            <StatusBadge tone="neutral" size="sm" icon={<Clock aria-hidden />}>
              Due {formatRelativeTime(approval.dueAt)}
            </StatusBadge>
            <span className="text-caption text-ink-400">
              Raised by {approval.requestedBy} ({approval.requestedByKind})
            </span>
          </>
        ),
      })
    })

    const knowledgeIssues = (knowledgeBases.data ?? []).filter((base) => base.status !== 'ready')
    knowledgeIssues.forEach((base) => {
      items.push({
        id: `kb-${base.id}`,
        kind: 'knowledge',
        title: `${base.name} needs attention`,
        reason:
          base.status === 'attention'
            ? 'Retrieval quality has drifted below the 0.85 review threshold. One document is mid-indexing and a second failed to embed.'
            : 'Indexing is still in progress, so this knowledge base cannot yet answer questions.',
        href: `/knowledge?base=${base.id}`,
        actionLabel: 'Open knowledge base',
        severity: base.status === 'attention' ? 'medium' : 'low',
        meta: (
          <>
            <StatusBadge tone={base.status === 'attention' ? 'warning' : 'info'} size="sm">
              {base.status === 'attention' ? 'Quality drift' : 'Indexing'}
            </StatusBadge>
            <span className="text-caption text-ink-400">
              {base.documentCount} documents · {base.department}
            </span>
          </>
        ),
      })
    })

    if (latestRun && latestRun.hallucinationCount > 0) {
      items.push({
        id: `eval-${latestRun.id}`,
        kind: 'evaluation',
        title: `${latestRun.hallucinationCount} unsupported claims found in the latest evaluation`,
        reason:
          'Answers extended beyond the retrieved passages in the fallback-routing and procurement cases. Both are recorded with the failing case and the suggested fix.',
        href: `/evaluation/runs/${latestRun.id}`,
        actionLabel: 'Review failures',
        severity: 'high',
        meta: (
          <>
            <StatusBadge tone="danger" size="sm">
              Faithfulness {Math.round((latestRun.metrics.find((metric) => metric.key === 'faithfulness')?.value ?? 0) * 100)}%
            </StatusBadge>
            <span className="text-caption text-ink-400">
              {latestRun.name} · {formatRelativeTime(latestRun.startedAt)}
            </span>
          </>
        ),
      })
    }

    if (security.data) {
      security.data.securityEvents.slice(0, 1).forEach((event) => {
        items.push({
          id: `sec-${event.id}`,
          kind: 'security',
          title: event.result === 'denied' ? 'Access denied by retrieval filter — no exposure' : 'Permission change recorded',
          reason: event.summary,
          href: '/security',
          actionLabel: 'Open security centre',
          severity: event.result === 'denied' ? 'low' : 'medium',
          meta: (
            <>
              <StatusBadge tone={event.result === 'denied' ? 'success' : 'warning'} size="sm">
                {event.result === 'denied' ? 'Control held' : 'Review'}
              </StatusBadge>
              <span className="text-caption text-ink-400">
                {event.actorName} · {formatRelativeTime(event.at)}
              </span>
            </>
          ),
        })
      })
    }

    return items.slice(0, 5)
  }, [pendingApprovals, latestRun, security.data, knowledgeBases.data])

  /* ---- Recent intelligence -------------------------------------------- */
  const intelligenceFeed = useMemo<IntelligenceEvent[]>(() => {
    const feed: IntelligenceEvent[] = [
      {
        id: 'ev-expense',
        title: 'Finance Agent identified an expense policy conflict',
        detail:
          'Two approved documents state different daily meal caps. A recommendation to archive the superseded annexe is awaiting review.',
        at: '2026-09-15T09:26:00Z',
        href: '/decisions/dec_expense_conflict',
        action: 'Open decision',
        kind: 'Agent',
      },
      {
        id: 'ev-payment',
        title: 'Support Agent detected a payment failure spike',
        detail:
          'Ticket volume rose 28% week over week, concentrated on one acquiring provider after a configuration change.',
        at: '2026-09-15T07:05:00Z',
        href: '/decisions/dec_payment_failures',
        action: 'Review evidence',
        kind: 'Agent',
      },
      {
        id: 'ev-leave',
        title: 'HR policy document updated and re-indexed',
        detail:
          'Employee Handbook — Leave Policy.pdf v4.2 is ready for AI. 218 passages re-embedded; recommendations filter is unchanged.',
        at: '2026-09-15T06:10:00Z',
        href: '/knowledge/doc_leave_policy',
        action: 'Open document',
        kind: 'Knowledge',
      },
      {
        id: 'ev-onboarding',
        title: 'Onboarding playbook is still processing',
        detail:
          'Three HR questions returned insufficient evidence while the playbook was at the embedding stage. No partial index was committed.',
        at: '2026-09-15T06:40:00Z',
        href: '/knowledge/doc_onboarding',
        action: 'View pipeline',
        kind: 'Knowledge',
      },
      {
        id: 'ev-approval',
        title: 'Approval requested for support workflow',
        detail:
          'Support Agent raised a HIGH-risk recommendation for fallback payment routing with an 11-hour SLA.',
        at: '2026-09-15T07:08:00Z',
        href: '/approvals/apr_1',
        action: 'Open approval',
        kind: 'Approval',
      },
      {
        id: 'ev-eval',
        title: 'Nightly evaluation completed with 13 failures',
        detail:
          'Retrieval quality held at 91%, faithfulness slipped to 87% with two unsupported-claim cases now recorded.',
        at: '2026-09-14T22:15:00Z',
        href: '/evaluation',
        action: 'Review run',
        kind: 'Evaluation',
      },
    ]
    return feed.filter((event) => {
      if (event.href.startsWith('/decisions') && !can('decisions:view')) return false
      if (event.href.startsWith('/approvals') && !can('approvals:view')) return false
      if (event.href.startsWith('/evaluation') && !can('evaluation:view')) return false
      if (event.href.startsWith('/knowledge') && !can('knowledge:view')) return false
      return true
    })
  }, [can])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const openDecisionCount = useMemo(
    () =>
      (decisions.data ?? []).filter(
        (decision) => decision.status === 'awaiting_approval' || decision.status === 'needs_evidence',
      ).length,
    [decisions.data],
  )

  const qualityMetrics = latestRun?.metrics ?? []
  const overallScore = latestRun?.overallScore ?? null

  const quickActions = [
    { label: 'Ask AI', description: 'Question against approved knowledge', icon: Sparkles, href: '/assistant', permission: 'assistant:use' as const },
    { label: 'Upload knowledge', description: 'Add a document to a knowledge base', icon: Upload, href: '/knowledge?action=upload', permission: 'knowledge:manage' as const },
    { label: 'Create knowledge base', description: 'Start a governed collection', icon: BookOpen, href: '/knowledge?action=create-base', permission: 'knowledge:manage' as const },
    { label: 'Review approvals', description: `${pendingApprovals.length} waiting on a decision`, icon: ClipboardCheck, href: '/approvals', permission: 'approvals:view' as const },
    { label: 'Run evaluation', description: 'Test retrieval, faithfulness and citations', icon: BadgeCheck, href: '/evaluation', permission: 'evaluation:run' as const },
  ].filter((action) => can(action.permission))

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-content px-4 pb-5 pt-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-caption text-ink-400">
                {organization?.name ?? 'Northwind Industries'} · {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
              </p>
              <h1 className="mt-1.5 text-display text-ink-900">
                {greeting}, {user?.name.split(' ')[0]}
              </h1>
              <p className="mt-1.5 text-body text-ink-500">Here’s what needs your attention today.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {quickActions.slice(0, 3).map((action) => (
                <Button
                  key={action.label}
                  variant={action.label === 'Ask AI' ? 'primary' : 'secondary'}
                  size="md"
                  iconLeft={<action.icon aria-hidden />}
                  onClick={() => navigate(action.href)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <PageBody className="space-y-6">
        {/* -------------------------------------------------------------- */}
        {/* Priority                                                        */}
        {/* -------------------------------------------------------------- */}
        <section aria-labelledby="priority-heading">
          <SectionHeading
            id="priority-heading"
            title="Requires your attention"
            description={`${priorityItems.length} items across approvals, recommendations, knowledge, evaluation and security · ${openDecisionCount} decision${
              openDecisionCount === 1 ? '' : 's'
            } open in the Decision Centre.`}
            icon={<CircleAlert aria-hidden />}
            actions={
              can('approvals:view') ? (
                <Button variant="ghost" size="sm" onClick={() => navigate('/approvals')} iconRight={<ArrowRight aria-hidden />}>
                  Open approval queue
                </Button>
              ) : undefined
            }
          />

          {approvals.initialLoading ? (
            <Card>
              <LoadingState label="Loading today’s priorities" rows={4} />
            </Card>
          ) : approvals.error ? (
            <ErrorState
              title="Priorities could not be loaded"
              cause={approvals.error.message}
              status={`http_${approvals.error.status ?? 'network'}`}
              onRetry={approvals.reload}
            />
          ) : priorityItems.length === 0 ? (
            <Card>
              <EmptyState
                icon={ClipboardCheck}
                title="Nothing requires your attention"
                description="No approvals, recommendations, knowledge or security items are open for your role. New items appear here automatically."
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line-subtle">
                {priorityItems.map((item) => (
                  <PriorityRow key={item.id} item={item} />
                ))}
              </ul>
            </Card>
          )}
        </section>

        {/* -------------------------------------------------------------- */}
        {/* AI activity                                                     */}
        {/* -------------------------------------------------------------- */}
        <section aria-labelledby="activity-heading">
          <SectionHeading
            id="activity-heading"
            title="AI activity"
            description="Last 30 days, organisation-wide. Values from /api/analytics/."
            icon={<Activity aria-hidden />}
          />

          {analytics.initialLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index}>
                  <LoadingState rows={2} />
                </Card>
              ))}
            </div>
          ) : analytics.error ? (
            <ErrorState title="Analytics unavailable" cause={analytics.error.message} onRetry={analytics.reload} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {(analytics.data?.kpis ?? []).slice(0, 5).map((kpi) => (
                <MetricCard
                  key={kpi.key}
                  label={kpi.label}
                  value={
                    kpi.unit === 'percent'
                      ? `${kpi.value.toFixed(1)}%`
                      : kpi.unit === 'ms'
                        ? formatDuration(kpi.value)
                        : formatNumber(kpi.value)
                  }
                  delta={kpi.deltaPct}
                  hint={kpi.hint}
                  icon={
                    kpi.key === 'queries' ? <MessageSquarePlus aria-hidden /> :
                    kpi.key === 'active_users' ? <Users aria-hidden /> :
                    kpi.key === 'agent_executions' ? <Bot aria-hidden /> :
                    kpi.key === 'avg_latency' ? <Clock aria-hidden /> : <TrendingUp aria-hidden />
                  }
                  footer={
                    analytics.data?.queryVolume ? (
                      <Sparkline
                        data={analytics.data.queryVolume.map((point) => ({ date: point.date, value: point.queries }))}
                        height={26}
                      />
                    ) : undefined
                  }
                />
              ))}

              {/* Success resolution emphasised as the outcome metric */}
              {analytics.data?.kpis
                .filter((kpi) => kpi.key === 'resolution_rate')
                .map((kpi) => (
                  <MetricCard
                    key={kpi.key}
                    label={kpi.label}
                    value={`${kpi.value.toFixed(1)}%`}
                    delta={kpi.deltaPct}
                    hint={kpi.hint}
                    icon={<BadgeCheck aria-hidden />}
                    className="sm:col-span-2 xl:col-span-1"
                  />
                ))}
            </div>
          )}
        </section>

        {/* -------------------------------------------------------------- */}
        {/* AI quality + recent intelligence                                */}
        {/* -------------------------------------------------------------- */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* AI quality ---------------------------------------------------- */}
          <section aria-labelledby="quality-heading" className="space-y-3">
            <SectionHeading
              id="quality-heading"
              title="AI quality"
              description="Measured by the evaluation harness, not estimated."
              icon={<BadgeCheck aria-hidden />}
              actions={
                can('evaluation:view') ? (
                  <Button variant="ghost" size="sm" onClick={() => navigate('/evaluation')} iconRight={<ArrowRight aria-hidden />}>
                    Reliability centre
                  </Button>
                ) : undefined
              }
            />

            <Card>
              <div className="flex flex-wrap items-center gap-5 border-b border-line px-4 py-4">
                <ScoreRing value={overallScore} label="Overall AI quality" sublabel={latestRun?.name} unavailable={!latestRun || overallScore === null} />
                <div className="min-w-0 flex-1">
                  <p className="text-h3 text-ink-900">
                    {latestRun ? latestRun.name : 'No completed evaluation run'}
                  </p>
                  <p className="mt-1 text-body-sm leading-relaxed text-ink-500">
                    {latestRun
                      ? `Golden set of ${latestRun.caseCount} questions, evaluated ${formatRelativeTime(latestRun.startedAt)}. Pass rate ${Math.round((latestRun.passRate ?? 0) * 100)}% with ${latestRun.failureCount} failing cases.`
                      : 'Scores appear once an evaluation run completes against the approved golden set.'}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {latestRun && previousRun && latestRun.overallScore !== null && previousRun.overallScore !== null && (
                      <span className="flex items-center gap-1.5 text-caption text-ink-400">
                        vs. previous run
                        <DeltaPill value={((latestRun.overallScore - previousRun.overallScore) / previousRun.overallScore) * 100} />
                      </span>
                    )}
                    <StatusBadge tone="neutral" size="sm">
                      Threshold: release blocked below 75
                    </StatusBadge>
                  </div>
                </div>
              </div>

              {latestRun ? (
                <ul className="divide-y divide-line-subtle">
                  {qualityMetrics.map((metric) => {
                    const measured = metric.availability === 'measured' && metric.value !== null
                    const percent = metric.unit === 'percent'
                    const displayValue = measured
                      ? percent
                        ? `${Math.round((metric.value as number) * 100)}%`
                        : formatDuration(metric.value as number)
                      : '—'
                    const targetValue = percent ? `${Math.round(metric.target * 100)}%` : formatDuration(metric.target)
                    const meetsTarget = measured && (percent ? (metric.value as number) >= metric.target : (metric.value as number) <= metric.target)

                    return (
                      <li key={metric.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-body-sm font-medium text-ink-800">{metric.label}</p>
                          <p className="mt-0.5 text-caption leading-relaxed text-ink-400">{metric.description}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn('tnum text-body font-semibold', measured ? 'text-ink-900' : 'text-ink-300')}>
                            {displayValue}
                          </span>
                          {measured ? (
                            <StatusBadge tone={meetsTarget ? 'success' : 'warning'} size="sm">
                              {meetsTarget ? 'At target' : 'Below target'} {targetValue}
                            </StatusBadge>
                          ) : (
                            <StatusBadge tone="neutral" size="sm">
                              Pending run
                            </StatusBadge>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={BadgeCheck}
                  title="No evaluation run yet"
                  description="Run the golden set to measure retrieval quality, faithfulness, citation accuracy and latency before presenting any quality claim."
                />
              )}

              <div className="border-t border-line px-4 py-3">
                <DataProvenanceBanner
                  source={latestRun?.datasetName ?? 'SmartCorp golden set v3'}
                  detail="Connect /api/evaluations/ to replace these figures with results measured on your own knowledge base."
                />
              </div>
            </Card>
          </section>

          {/* Recent intelligence ------------------------------------------- */}
          <section aria-labelledby="intelligence-heading" className="space-y-3">
            <SectionHeading
              id="intelligence-heading"
              title="Recent intelligence"
              description="Events raised by agents, knowledge processing and approvals — each one actionable."
              icon={<Sparkles aria-hidden />}
              actions={
                can('audit:view') ? (
                  <Button variant="ghost" size="sm" onClick={() => navigate('/audit-logs')} iconRight={<ArrowRight aria-hidden />}>
                    Full activity trail
                  </Button>
                ) : undefined
              }
            />

            <Card className="overflow-hidden">
              {notifications.initialLoading ? (
                <LoadingState rows={5} />
              ) : (
                <ol className="divide-y divide-line-subtle">
                  {intelligenceFeed.map((event) => (
                    <li key={event.id} className="px-4 py-3.5 transition-colors hover:bg-surface-muted/60">
                      <div className="flex items-start gap-3">
                        <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                            <p className="text-body font-medium text-ink-900">{event.title}</p>
                            <span className="shrink-0 text-caption text-ink-400">{formatRelativeTime(event.at)}</span>
                          </div>
                          <p className="mt-1 text-body-sm leading-relaxed text-ink-500">{event.detail}</p>
                          <div className="mt-2 flex items-center gap-2.5">
                            <StatusBadge tone="neutral" size="sm">
                              {event.kind}
                            </StatusBadge>
                            <Link
                              to={event.href}
                              className="inline-flex items-center gap-1 text-caption font-semibold text-brand-700 hover:text-brand-800"
                            >
                              {event.action}
                              <ArrowRight className="size-3" aria-hidden />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </section>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Agent status + quick actions                                    */}
        {/* -------------------------------------------------------------- */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section aria-labelledby="agents-heading" className="space-y-3">
            <SectionHeading
              id="agents-heading"
              title="Agents"
              description="Specialised agents, their scope and current health."
              icon={<Bot aria-hidden />}
              actions={
                can('agents:view') ? (
                  <Button variant="ghost" size="sm" onClick={() => navigate('/agents')} iconRight={<ArrowRight aria-hidden />}>
                    Agent control centre
                  </Button>
                ) : undefined
              }
            />
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line-subtle">
                {(agents.data ?? []).map((agent) => (
                  <li key={agent.id}>
                    <Link
                      to={`/agents/${agent.id}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-surface-muted/60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-body font-medium text-ink-900">{agent.name}</span>
                          {agent.status !== 'active' && (
                            <StatusBadge tone={agent.status === 'degraded' ? 'warning' : 'neutral'} size="sm">
                              {agent.status === 'degraded' ? 'Degraded' : 'Paused'}
                            </StatusBadge>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-caption text-ink-400">{agent.purpose}</span>
                      </span>
                      <span className="flex items-center gap-5">
                        <span className="text-right">
                          <span className="tnum block text-body-sm font-medium text-ink-800">{formatNumber(agent.queriesProcessed)}</span>
                          <span className="block text-[11px] text-ink-400">queries</span>
                        </span>
                        <span className="text-right">
                          <span className="tnum block text-body-sm font-medium text-ink-800">
                            {agent.successRate === null ? '—' : `${Math.round(agent.successRate * 100)}%`}
                          </span>
                          <span className="block text-[11px] text-ink-400">resolved</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <section aria-labelledby="quick-heading" className="space-y-3">
            <SectionHeading id="quick-heading" title="Quick actions" description="Only the tasks you actually perform from here." />
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line-subtle">
                {quickActions.map((action) => (
                  <li key={action.label}>
                    <button
                      type="button"
                      onClick={() => navigate(action.href)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted/60"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-surface text-ink-500" aria-hidden>
                        <action.icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-body-sm font-medium text-ink-900">{action.label}</span>
                        <span className="block text-caption text-ink-400">{action.description}</span>
                      </span>
                      <ArrowRight className="size-3.5 shrink-0 text-ink-300" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-4">
              <p className="text-body-sm font-medium text-ink-800">Your scope affects what the AI can retrieve</p>
              <p className="mt-1 text-caption leading-relaxed text-ink-500">
                You are signed in as <span className="font-medium text-ink-700">{user?.role}</span>. Retrieval is filtered to
                your permitted knowledge bases before ranking, and the same rule is enforced by the Django API — the
                interface never decides access on its own.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(user?.knowledgeScope ?? []).map((scope) => (
                  <StatusBadge key={scope} tone="outline" size="sm">
                    {scope.replace('kb_', '').toUpperCase()}
                  </StatusBadge>
                ))}
                {(user?.knowledgeScope ?? []).length === 0 && (
                  <StatusBadge tone="warning" size="sm">
                    No knowledge scope
                  </StatusBadge>
                )}
              </div>
            </Card>
          </section>
        </div>
      </PageBody>
    </>
  )
}
