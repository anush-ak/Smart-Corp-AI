import { Bell, Bot, Building2, Database, KeyRound, Save, Sparkles, UserCog } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, DefinitionList, PageBody, PageHeader, Tabs } from '@/components/ui/primitives'
import { Input, Select, Switch, Textarea } from '@/components/ui/input-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tooltip } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import { useSecurityOverview } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import { USE_MOCK_API } from '@/services/api-client'
import { cn } from '@/utils/format'

/**
 * Settings — workspace, AI behaviour, data handling and personal preferences.
 *
 * The AI section states the fallback threshold and citation policy explicitly,
 * because those settings determine whether the assistant guesses or refuses.
 */
export function SettingsPage() {
  const { user, organization } = useAuth()
  const { can, roleLabel, scopeSummary } = usePermissions()
  const { toast } = useToast()

  const [tab, setTab] = useState<'workspace' | 'ai' | 'data' | 'profile'>('workspace')
  // Security posture is reported by the API, not restated by hand here.
  const security = useSecurityOverview()
  const posture = (label: RegExp) => security.data?.organizationStatus.find((item) => label.test(item.label))

  // Local drafts — saved explicitly so an accidental toggle cannot change behaviour.
  const [workspaceName, setWorkspaceName] = useState(organization?.name ?? 'Northwind Industries')
  const [fallbackThreshold, setFallbackThreshold] = useState('0.62')
  const [routingThreshold, setRoutingThreshold] = useState('70')
  const [requireCitations, setRequireCitations] = useState(true)
  const [autoDecisionOnHighRisk, setAutoDecisionOnHighRisk] = useState(false)
  const [storePrompts, setStorePrompts] = useState(true)
  const [notifyApprovals, setNotifyApprovals] = useState(true)
  const [notifyEvaluation, setNotifyEvaluation] = useState(true)
  const [notifySecurity, setNotifySecurity] = useState(true)

  const save = (section: string) =>
    toast({
      title: `${section} saved`,
      description: 'Changes take effect immediately and are recorded in the audit log.',
      tone: 'success',
    })

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure the workspace, AI behaviour and data handling. Anything that changes how answers are produced is stated in plain language."
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <Building2 className="size-3.5 text-ink-400" aria-hidden />
              {organization?.name} · {organization?.plan}
            </span>
            <StatusBadge tone={USE_MOCK_API ? 'warning' : 'success'} size="sm">
              {USE_MOCK_API ? 'Sample data mode' : 'Connected to Django API'}
            </StatusBadge>
          </>
        }
        tabs={
          <Tabs
            ariaLabel="Settings sections"
            value={tab}
            onChange={(value) => setTab(value as typeof tab)}
            items={[
              { id: 'workspace', label: 'Workspace' },
              { id: 'ai', label: 'AI behaviour' },
              { id: 'data', label: 'Data & security' },
              { id: 'profile', label: 'Profile & notifications' },
            ]}
          />
        }
      />

      <PageBody className="space-y-6">
        {tab === 'workspace' && (
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Organisation" description="Identity and regional settings for this workspace." icon={<Building2 aria-hidden />} />
              <CardBody className="space-y-4">
                <Input label="Workspace name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
                <Input label="Primary domain" value={organization?.domain ?? 'northwind.example'} readOnly hint="Managed through the identity provider and not editable here." />
                <Select
                  label="Data region"
                  value="ap-south-1"
                  onChange={() => undefined}
                  options={[{ value: 'ap-south-1', label: 'ap-south-1 (Mumbai) — selected' }, { value: 'eu-central-1', label: 'eu-central-1 (Frankfurt)' }]}
                  hint="Knowledge, embeddings and audit records stay in this region. Changing it requires a migration window."
                />
                <div className="rounded-md border border-line-subtle bg-surface-muted px-3 py-2.5">
                  <p className="text-caption font-medium text-ink-600">Plan</p>
                  <p className="mt-0.5 text-body-sm text-ink-700">
                    {organization?.plan} · unlimited knowledge bases, evaluation harness and full audit retention
                  </p>
                </div>
                <Button variant="primary" iconLeft={<Save aria-hidden />} disabled={!can('settings:manage')} onClick={() => save('Workspace settings')}>
                  Save workspace
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Roles in this workspace" description="Role definitions are shared across the platform." icon={<KeyRound aria-hidden />} />
              <CardBody className="space-y-3">
                <DefinitionList
                  columns={1}
                  items={[
                    { label: 'Your role', value: `${roleLabel} (${user?.department})` },
                    { label: 'Your retrieval scope', value: scopeSummary },
                    { label: 'Your agent access', value: (user?.agentScope ?? []).join(', ') || 'None assigned' },
                  ]}
                />
                <p className="border-t border-line-subtle pt-3.5 text-caption leading-relaxed text-ink-500">
                  Roles and permissions are managed in Users &amp; Roles. Changes there apply immediately to new requests and
                  are enforced by the API — never by the interface alone.
                </p>
                <Button variant="secondary" size="sm" onClick={() => (window.location.href = '/users')}>
                  Open Users & Roles
                </Button>
              </CardBody>
            </Card>
          </div>
        )}

        {tab === 'ai' && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader
                title="Answering behaviour"
                description="These settings decide when SmartCorp answers, when it refuses, and what it must cite."
                icon={<Sparkles aria-hidden />}
              />
              <CardBody className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Evidence floor (relevance score)"
                    value={fallbackThreshold}
                    onChange={(event) => setFallbackThreshold(event.target.value)}
                    hint="Passages below this score are excluded and the assistant returns insufficient evidence."
                    disabled={!can('settings:manage')}
                  />
                  <Input
                    label="Routing confidence threshold (%)"
                    value={routingThreshold}
                    onChange={(event) => setRoutingThreshold(event.target.value)}
                    hint="Below this, the question is clarified with the requester instead of being routed to a specialist agent."
                    disabled={!can('settings:manage')}
                  />
                </div>

                <div className="space-y-4 border-t border-line-subtle pt-4">
                  <Switch
                    checked={requireCitations}
                    onChange={setRequireCitations}
                    label="Require a citation for every normative statement"
                    description="Statements without a supporting passage are withheld. This is what keeps answers auditable."
                    disabled={!can('settings:manage')}
                  />
                  <Switch
                    checked={autoDecisionOnHighRisk}
                    onChange={setAutoDecisionOnHighRisk}
                    label="Allow high-risk actions to execute without approval"
                    description="Not recommended, and blocked by policy: consequential actions must be approved by a person. SmartCorp records the attempt if enabled."
                    disabled={!can('settings:manage')}
                  />
                </div>

                {autoDecisionOnHighRisk && (
                  <div role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2.5">
                    <p className="text-body-sm font-semibold text-danger-800">This configuration weakens the control model</p>
                    <p className="mt-1 text-caption leading-relaxed text-danger-800/85">
                      Enabling autonomous execution for high-risk actions removes the human decision point that the rest of
                      this platform is built around. If it is enabled, SmartCorp still records every execution and its
                      approver field will read “automatic”.
                    </p>
                  </div>
                )}

                <Button variant="primary" iconLeft={<Save aria-hidden />} disabled={!can('settings:manage')} onClick={() => save('AI behaviour')}>
                  Save AI settings
                </Button>
              </CardBody>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Guardrails in effect" description="Applied to every agent on every execution." icon={<Bot aria-hidden />} />
                <CardBody padded={false}>
                  <ul className="divide-y divide-line-subtle">
                    {[
                      { label: 'Pre-ranking permission filter', value: 'Enforced', tone: 'success' as const, hint: 'Department and access level match inside the vector query.' },
                      { label: 'Citation binding', value: requireCitations ? 'Required' : 'Relaxed', tone: requireCitations ? ('success' as const) : ('warning' as const), hint: 'Every normative statement must resolve to a passage.' },
                      { label: 'Safe fallback', value: `Below ${fallbackThreshold}`, tone: 'success' as const, hint: 'Insufficient evidence is returned rather than a guess.' },
                      { label: 'Human approval for state changes', value: autoDecisionOnHighRisk ? 'Disabled' : 'Required', tone: autoDecisionOnHighRisk ? ('danger' as const) : ('success' as const), hint: 'Agents recommend; people authorise.' },
                      { label: 'Full audit trail', value: 'Always on', tone: 'success' as const, hint: 'Cannot be disabled — it is a platform invariant.' },
                    ].map((guardrail) => (
                      <li key={guardrail.label} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-body-sm font-medium text-ink-800">{guardrail.label}</p>
                          <p className="text-caption text-ink-400">{guardrail.hint}</p>
                        </div>
                        <StatusBadge tone={guardrail.tone} size="sm">
                          {guardrail.value}
                        </StatusBadge>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Model and retrieval configuration" description="Current pipeline settings, for reference." icon={<Database aria-hidden />} />
                <CardBody>
                  <DefinitionList
                    columns={1}
                    items={[
                      { label: 'Answer model', value: <span className="font-mono text-body-sm">gpt-4o-mini</span> },
                      { label: 'Embedding model', value: <span className="font-mono text-body-sm">text-embedding-3-large</span> },
                      { label: 'Vector store', value: <span className="font-mono text-body-sm">PostgreSQL 16 + pgvector (HNSW, cosine)</span> },
                      { label: 'Top-k', value: '8 candidates → 4 after reranking' },
                      { label: 'Chunking', value: '900 tokens with 15% overlap, section-aware' },
                    ]}
                  />
                  <p className="mt-4 border-t border-line-subtle pt-3.5 text-caption leading-relaxed text-ink-500">
                    Changing the embedding model requires re-indexing every knowledge base. SmartCorp queues the re-index
                    automatically and keeps the previous vectors until the new index is complete.
                  </p>
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Data handling" description="What is stored, where, and for how long." icon={<Database aria-hidden />} />
              <CardBody className="space-y-4">
                <Switch
                  checked={storePrompts}
                  onChange={setStorePrompts}
                  label="Store question text for evaluation"
                  description="Questions are stored to build the evaluation set and identify knowledge gaps. Answers always store their citations regardless of this setting."
                  disabled={!can('settings:manage')}
                />
                <div className="space-y-3 border-t border-line-subtle pt-4">
                  <DefinitionList
                    columns={1}
                    items={[
                      { label: 'Data region', value: organization?.dataRegion ?? 'ap-south-1 (Mumbai)' },
                      { label: 'Audit retention', value: '730 days, append-only' },
                      { label: 'Document retention', value: 'Superseded versions retained for comparison' },
                      { label: 'Model training on your data', value: 'Never — no customer content is used to train models' },
                    ]}
                  />
                </div>
                <Button variant="primary" iconLeft={<Save aria-hidden />} disabled={!can('settings:manage')} onClick={() => save('Data settings')}>
                  Save data settings
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Security configuration" description="Authentication and access policy." icon={<KeyRound aria-hidden />} />
              <CardBody className="space-y-4">
                <div className="rounded-md border border-line bg-surface-muted/50 px-3 py-2.5">
                  <p className="flex items-center justify-between gap-3 text-body-sm">
                    <span className="text-ink-700">Single sign-on</span>
                    <StatusBadge tone="success" size="sm">
                      {posture(/single sign-on/i)?.value ?? 'Required for all users'}
                    </StatusBadge>
                  </p>
                  <p className="flex items-center justify-between gap-3 text-body-sm mt-2">
                    <span className="text-ink-700">Multi-factor authentication</span>
                    <StatusBadge
                      tone={posture(/multi-factor/i)?.state === 'ok' ? 'success' : 'warning'}
                      size="sm"
                    >
                      {posture(/multi-factor/i)?.value ?? 'Not reported by the API'}
                    </StatusBadge>
                  </p>
                  <p className="flex items-center justify-between text-body-sm mt-2">
                    <span className="text-ink-700">Managed device policy</span>
                    <StatusBadge tone="success" size="sm">
                      Enforced
                    </StatusBadge>
                  </p>
                  <p className="flex items-center justify-between text-body-sm mt-2">
                    <span className="text-ink-700">Session length</span>
                    <span className="text-ink-600">8 hours</span>
                  </p>
                </div>
                <p className="text-caption leading-relaxed text-ink-500">
                  Access control is applied at three layers — API authorisation, query-level filtering and pre-ranking
                  retrieval filtering. Frontend visibility is never treated as enforcement.
                </p>
                <Button variant="secondary" size="sm" onClick={() => (window.location.href = '/security')}>
                  Open security centre
                </Button>
              </CardBody>
            </Card>
          </div>
        )}

        {tab === 'profile' && (
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Profile" description="How you appear across the platform." icon={<UserCog aria-hidden />} />
              <CardBody className="space-y-4">
                <Input label="Full name" defaultValue={user?.name} />
                <Input label="Email" defaultValue={user?.email} readOnly />
                <Input label="Job title" defaultValue={user?.jobTitle} />
                <Select
                  label="Default landing page"
                  value="overview"
                  onChange={() => undefined}
                  options={[
                    { value: 'overview', label: 'Overview' },
                    { value: 'assistant', label: 'AI Assistant' },
                    { value: 'approvals', label: 'Approvals' },
                  ]}
                />
                <Textarea label="Signature for approval notes" rows={2} placeholder="e.g. Reviewed with the payments on-call engineer." />
                <Button variant="primary" iconLeft={<Save aria-hidden />} onClick={() => save('Profile')}>
                  Save profile
                </Button>
              </CardBody>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Notifications" description="What reaches you, and how urgently." icon={<Bell aria-hidden />} />
                <CardBody className="space-y-4">
                  <Switch
                    checked={notifyApprovals}
                    onChange={setNotifyApprovals}
                    label="Approval requests"
                    description="Immediate notification when a request is assigned to you, and a reminder before the SLA is breached."
                  />
                  <Switch
                    checked={notifyEvaluation}
                    onChange={setNotifyEvaluation}
                    label="Evaluation results"
                    description="Notify when a run completes, and escalate immediately if unsupported claims are detected."
                  />
                  <Switch
                    checked={notifySecurity}
                    onChange={setNotifySecurity}
                    label="Security events"
                    description="Permission changes, denials and authentication policy blocks."
                  />
                  <Button variant="primary" iconLeft={<Save aria-hidden />} onClick={() => save('Notification preferences')}>
                    Save preferences
                  </Button>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Connection" description="How this interface is talking to the backend." />
                <CardBody>
                  <DefinitionList
                    columns={1}
                    items={[
                      { label: 'API base URL', value: <span className="font-mono text-body-sm">/api (proxied to Django REST)</span> },
                      {
                        label: 'Mode',
                        value: (
                          <Tooltip label="Set VITE_USE_MOCK_API=false to connect the live Django API.">
                            <span className={cn('font-mono text-body-sm', USE_MOCK_API ? 'text-warning-700' : 'text-success-700')}>
                              {USE_MOCK_API ? 'mock adapter (sample data)' : 'live API'}
                            </span>
                          </Tooltip>
                        ),
                      },
                      { label: 'Authentication', value: 'JWT bearer token, refreshed on session restore' },
                      { label: 'Frontend build', value: 'React · TypeScript · Tailwind · Recharts' },
                    ]}
                  />
                  <p className="mt-4 border-t border-line-subtle pt-3.5 text-caption leading-relaxed text-ink-500">
                    Mock data lives in <code className="rounded-xs bg-surface-muted px-1 font-mono text-[11px]">src/services/mocks</code> and
                    is registered per endpoint, so pointing the interface at the Django API is a configuration change rather
                    than a rewrite.
                  </p>
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </PageBody>
    </>
  )
}
