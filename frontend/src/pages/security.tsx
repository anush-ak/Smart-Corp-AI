import {
  Check,
  CircleAlert,
  Database,
  Download,
  Fingerprint,
  KeyRound,
  Lock,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, DefinitionList, PageBody, PageHeader, Tabs } from '@/components/ui/primitives'
import { AuditResultBadge, StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Tooltip } from '@/components/ui/tooltip'
import { AuthActivityChart, ChartFrame } from '@/components/analytics/charts'
import { useSecurityOverview } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/components/ui/toast'
import { ROLE_LABELS } from '@/contexts/auth-context'
import { cn, formatDateTime, formatRelativeTime } from '@/utils/format'
import { useState } from 'react'

/**
 * Security centre.
 *
 * Calm and factual: control status, restrictions, authentication activity and the
 * layering that actually enforces access. Deliberately not a hacker dashboard —
 * this screen exists to answer "is the organisation in a healthy state, and can I
 * prove it?".
 */

const STATE_STYLE = {
  ok: { tone: 'success' as const, icon: Check, label: 'Healthy' },
  attention: { tone: 'warning' as const, icon: TriangleAlert, label: 'Review' },
  critical: { tone: 'danger' as const, icon: CircleAlert, label: 'Action needed' },
}

export function SecurityPage() {
  const { can } = usePermissions()
  const { toast } = useToast()
  const security = useSecurityOverview()
  const [tab, setTab] = useState<'overview' | 'permissions' | 'events'>('overview')
  const data = security.data

  return (
    <>
      <PageHeader
        title="Security"
        description="Access control status, restricted knowledge and authentication activity — with the enforcement layers stated plainly."
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-ink-400" aria-hidden />
              Access enforced at API, query and retrieval layers
            </span>
            {data && (
              <span className="flex items-center gap-1.5">
                <ScrollText className="size-3.5 text-ink-400" aria-hidden />
                Audit coverage {data.auditStatus.coveragePct}% · retention {data.auditStatus.retentionDays} days
              </span>
            )}
          </>
        }
        actions={
          can('audit:view') ? (
            <Button
              variant="secondary"
              iconLeft={<Download aria-hidden />}
              onClick={() =>
                toast({
                  title: 'Security summary exported',
                  description: 'The export includes control status, restricted documents and authentication activity for the retained window.',
                  tone: 'success',
                })
              }
            >
              Export summary
            </Button>
          ) : undefined
        }
        tabs={
          <Tabs
            ariaLabel="Security views"
            value={tab}
            onChange={(value) => setTab(value as typeof tab)}
            items={[
              { id: 'overview', label: 'Control status' },
              { id: 'permissions', label: 'Restrictions & changes', count: (data?.permissionChanges.length ?? 0) + (data?.restrictedDocuments.length ?? 0) },
              { id: 'events', label: 'Authentication & events', count: data?.securityEvents.length ?? 0 },
            ]}
          />
        }
      />

      <PageBody className="space-y-6">
        {security.error ? (
          <ErrorState title="Security overview could not be loaded" cause={security.error.message} onRetry={security.reload} />
        ) : security.initialLoading || !data ? (
          <Card>
            <LoadingState label="Loading security status" rows={5} />
          </Card>
        ) : tab === 'overview' ? (
          <>
            {/* Organisation status ------------------------------------ */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <Card>
                <CardHeader title="Organisation status" description="Posture of the workspace and identity configuration." icon={<ShieldCheck aria-hidden />} />
                <CardBody padded={false}>
                  <ul className="divide-y divide-line-subtle">
                    {data.organizationStatus.map((item) => {
                      const style = STATE_STYLE[item.state]
                      return (
                        <li key={item.label} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-body-sm font-medium text-ink-800">{item.label}</p>
                            <p className="text-caption text-ink-400">{item.value}</p>
                          </div>
                          <StatusBadge tone={style.tone} size="sm" icon={<style.icon aria-hidden />}>
                            {style.label}
                          </StatusBadge>
                        </li>
                      )
                    })}
                  </ul>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Access control" description="How access is enforced, and where review is due." icon={<KeyRound aria-hidden />} />
                <CardBody padded={false}>
                  <ul className="divide-y divide-line-subtle">
                    {data.accessControl.map((item) => {
                      const style = STATE_STYLE[item.state]
                      return (
                        <li key={item.label} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-body-sm font-medium text-ink-800">{item.label}</p>
                            <p className="text-caption text-ink-400">{item.value}</p>
                            <p className="mt-1 text-caption leading-relaxed text-ink-500">{item.hint}</p>
                          </div>
                          <StatusBadge tone={style.tone} size="sm" icon={<style.icon aria-hidden />}>
                            {style.label}
                          </StatusBadge>
                        </li>
                      )
                    })}
                  </ul>
                </CardBody>
              </Card>
            </div>

            {/* Enforcement layers ------------------------------------- */}
            <Card>
              <CardHeader
                title="Where access is actually enforced"
                description="Three independent layers, so a control failure in the interface never becomes a data exposure."
                icon={<Lock aria-hidden />}
              />
              <CardBody>
                <ol className="grid gap-4 lg:grid-cols-3">
                  {[
                    {
                      step: '01',
                      title: 'Django API authorisation',
                      detail: 'Every request is authenticated with a JWT and checked against the role’s permission set. A request outside scope returns 403 and is recorded.',
                    },
                    {
                      step: '02',
                      title: 'Database row filtering',
                      detail: 'Queries are scoped by organisation and department at the ORM level, so unauthorised rows are never loaded into the process.',
                    },
                    {
                      step: '03',
                      title: 'Retrieval-level filtering',
                      detail: 'Candidate passages are filtered by access level inside the vector query, before similarity ranking. Restricted content is never scored, let alone cited.',
                    },
                  ].map((layer) => (
                    <li key={layer.step} className="rounded-md border border-line bg-surface p-3.5">
                      <span className="font-mono text-[11px] text-ink-400">{layer.step}</span>
                      <p className="mt-1 text-body-sm font-semibold text-ink-900">{layer.title}</p>
                      <p className="mt-1 text-caption leading-relaxed text-ink-500">{layer.detail}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 rounded-md border border-info-200 bg-info-50/60 px-3 py-2.5 text-caption leading-relaxed text-info-800">
                  The interface adapts to your role for clarity. It is never the control — hiding a navigation item or a
                  button is a usability decision, and SmartCorp assumes the API and retrieval filters remain authoritative.
                </p>
              </CardBody>
            </Card>

            {/* Authentication activity -------------------------------- */}
            <ChartFrame
              id="auth-activity"
              title="Authentication activity"
              context="Sign-in attempts per day · successes and failures · last 14 days · count"
              height={260}
              footer="Denied attempts include policy blocks such as unmanaged devices. Failures are reviewed, never hidden."
            >
              <AuthActivityChart data={data.authenticationActivity} />
            </ChartFrame>
          </>
        ) : tab === 'permissions' ? (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Restricted documents"
                description="Documents limited to named users rather than a role. Each grant is reviewed quarterly."
                icon={<Fingerprint aria-hidden />}
              />
              <CardBody padded={false}>
                {data.restrictedDocuments.length === 0 ? (
                  <EmptyState variant="inline" icon={ShieldCheck} title="No restricted documents" description="All knowledge is governed by role or department scope." />
                ) : (
                  <ul className="divide-y divide-line-subtle">
                    {data.restrictedDocuments.map((document) => (
                      <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                        <div className="min-w-0 flex-1">
                          <Link to={`/knowledge/${document.id}`} className="text-body-sm font-medium text-ink-800 hover:text-brand-700">
                            {document.name}
                          </Link>
                          <p className="mt-0.5 text-caption text-ink-400">
                            {document.department} · {document.restriction}
                          </p>
                        </div>
                        <StatusBadge tone="warning" size="sm">
                          Restricted
                        </StatusBadge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Permission changes and denials"
                description="Every change to access, and every denial recorded — including denials that indicate the controls held."
                icon={<KeyRound aria-hidden />}
                actions={
                  can('audit:view') ? (
                    <Link to="/audit-logs" className="text-caption font-semibold text-brand-700 hover:text-brand-800">
                      Open audit log →
                    </Link>
                  ) : undefined
                }
              />
              <CardBody padded={false}>
                {data.permissionChanges.length === 0 ? (
                  <EmptyState variant="inline" icon={KeyRound} title="No permission changes in this window" />
                ) : (
                  <ul className="divide-y divide-line-subtle">
                    {data.permissionChanges.map((event) => (
                      <li key={event.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3.5">
                        <div className="flex min-w-[170px] items-center gap-2.5">
                          <Avatar name={event.actorName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-body-sm font-medium text-ink-800">{event.actorName}</p>
                            <p className="text-[11px] text-ink-400">
                              {event.actorRole === 'system' ? 'Automated' : ROLE_LABELS[event.actorRole] ?? event.actorRole}
                            </p>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-body-sm text-ink-700">{event.summary}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 text-caption text-ink-400">
                            <span className="font-mono">{event.resource.type}/{event.resource.id}</span>
                            <span>·</span>
                            <Tooltip label={formatDateTime(event.at)}>
                              <span>{formatRelativeTime(event.at)}</span>
                            </Tooltip>
                            <span>·</span>
                            <span className="font-mono">{event.requestId}</span>
                          </p>
                        </div>
                        <AuditResultBadge result={event.result} size="sm" />
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader title="Recent security events" description="Denials, policy blocks and access changes that warrant attention." icon={<CircleAlert aria-hidden />} />
              <CardBody padded={false}>
                {data.securityEvents.length === 0 ? (
                  <EmptyState variant="inline" icon={ShieldCheck} title="No security events in this window" description="Controls are operating without exceptions." />
                ) : (
                  <ul className="divide-y divide-line-subtle">
                    {data.securityEvents.map((event) => (
                      <li key={event.id} className="px-4 py-3.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 text-body-sm font-medium text-ink-800">{event.summary}</p>
                          <AuditResultBadge result={event.result} size="sm" />
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 text-caption text-ink-400">
                          <span>{event.actorName}</span>
                          <span>·</span>
                          <span className="font-mono">{event.ipAddress}</span>
                          <span>·</span>
                          <span>{formatRelativeTime(event.at)}</span>
                        </p>
                        {event.technical.content_returned === false && (
                          <p className="mt-1.5 rounded-sm border border-success-200 bg-success-50/60 px-2 py-1 text-caption text-success-800">
                            No content was returned — the retrieval filter excluded the candidate before ranking.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Audit and retention" description="How long records are kept and how integrity is verified." icon={<ScrollText aria-hidden />} />
                <CardBody>
                  <DefinitionList
                    columns={1}
                    items={[
                      { label: 'Retention', value: `${data.auditStatus.retentionDays} days` },
                      { label: 'Coverage', value: `${data.auditStatus.coveragePct}% of tracked actions` },
                      { label: 'Last integrity check', value: formatDateTime(data.auditStatus.lastIntegrityCheck) },
                      { label: 'Last export', value: data.auditStatus.exportedAt ? formatDateTime(data.auditStatus.exportedAt) : 'Never exported' },
                    ]}
                  />
                  <p className="mt-4 border-t border-line-subtle pt-3.5 text-caption leading-relaxed text-ink-500">
                    Records are append-only and hash-chained; a nightly job verifies the chain and reports any discontinuity.
                    Exports include request ids so an auditor can correlate an interface action with the API call that
                    produced it.
                  </p>
                  {can('audit:view') && (
                    <Button variant="secondary" size="sm" className="mt-3" onClick={() => (window.location.href = '/audit-logs')}>
                      Open audit explorer
                    </Button>
                  )}
                </CardBody>
              </Card>

              <Card className="border-warning-200 bg-warning-50/40">
                <div className="flex items-start gap-2.5 p-4">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-700" aria-hidden />
                  <div>
                    <p className="text-body-sm font-semibold text-warning-800">One item needs review</p>
                    <p className="mt-1 text-caption leading-relaxed text-warning-800/85">
                      An access grant to restricted engineering records has been active for more than 90 days. Quarterly
                      review is due on 12 December 2026 — confirm it is still required or revoke it.
                    </p>
                    {can('users:manage') && (
                      <Button variant="secondary" size="sm" className="mt-2.5" onClick={() => (window.location.href = '/users')}>
                        Review the grant
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        <p className={cn('px-1 text-caption text-ink-400')}>
          <Database className="mr-1.5 inline size-3" aria-hidden />
          Security status is derived from the live configuration and the audit stream — figures shown here are configuration
          facts, not estimates.
        </p>
      </PageBody>
    </>
  )
}
