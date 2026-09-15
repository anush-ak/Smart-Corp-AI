import {
  ArrowLeft,
  Bot,
  Check,
  ExternalLink,
  History,
  Link2,
  MessageSquare,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, DefinitionList, PageBody, PageHeader, SectionHeading } from '@/components/ui/primitives'
import { AccessBadge, DocumentStatusBadge, StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { ConfirmationDialog } from '@/components/ui/overlays'
import { Tooltip } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'
import { FileTypeMark, ProcessingTimeline } from '@/components/knowledge/document-components'
import { useAgents, useAuditEvents, useDocument, useKnowledgeBase } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import { knowledgeService } from '@/services'
import { formatBytes, formatDateTime, formatNumber, formatRelativeTime } from '@/utils/format'

/**
 * DocumentDetails — a document *intelligence* page rather than a metadata sheet.
 *
 * Answers five questions in order: what is this, how is it processed, who can
 * see it, how is the AI using it, and what changed over time.
 */
export function DocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const { toast } = useToast()

  const documentQuery = useDocument(documentId)
  const baseQuery = useKnowledgeBase(documentQuery.data?.knowledgeBaseId)
  const agentsQuery = useAgents()
  const auditQuery = useAuditEvents()

  const [retryOpen, setRetryOpen] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const document = documentQuery.data

  if (documentQuery.initialLoading) {
    return (
      <PageBody>
        <Card>
          <LoadingState label="Loading document" rows={5} />
        </Card>
      </PageBody>
    )
  }

  if (documentQuery.error) {
    // 403 comes from the API's own authorisation check — state that plainly
    // rather than presenting it as a generic failure.
    const denied = documentQuery.error.status === 403
    return (
      <PageBody>
        <ErrorState
          title={denied ? 'This document is outside your access scope' : 'This document could not be loaded'}
          cause={documentQuery.error.message}
          status={`http_${documentQuery.error.status ?? 'network'}`}
          onRetry={denied ? undefined : documentQuery.reload}
        />
        {denied && (
          <p className="mt-4 text-body-sm text-ink-500">
            Retrieval filters candidate passages by access level, so this document is also excluded from AI answers for
            your role. Request access from the knowledge owner if you need it.
          </p>
        )}
      </PageBody>
    )
  }

  if (!document) {
    return (
      <PageBody>
        <EmptyState
          icon={ScrollText}
          title="Document not found"
          description="It may have been removed, or it sits outside your permitted knowledge scope."
          primaryAction={{ label: 'Back to Knowledge', onClick: () => navigate('/knowledge') }}
        />
      </PageBody>
    )
  }

  const agentsUsingDocument = (agentsQuery.data ?? []).filter((agent) => document.usage.agents.includes(agent.id))
  // Audit history for this resource, straight from the audit endpoint.
  const relatedAudit = (auditQuery.data ?? []).filter((event) => event.resource.id === document.id)

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Knowledge', to: '/knowledge' }, { label: document.name }]}
        title={
          <span className="flex items-center gap-3">
            <FileTypeMark extension={document.extension} />
            <span className="min-w-0 break-words">{document.name}</span>
          </span>
        }
        description={baseQuery.data?.description ?? 'Document indexed in a permission-scoped knowledge base.'}
        meta={
          <>
            <DocumentStatusBadge status={document.status} />
            <AccessBadge level={document.accessLevel} />
            <span>{document.version}</span>
            <span>Owned by {document.ownerName}</span>
            <span>Updated {formatRelativeTime(document.updatedAt)}</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-ink-400" aria-hidden />
              Retrieval filtered by role
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" iconLeft={<ArrowLeft aria-hidden />} onClick={() => navigate('/knowledge')}>
              Back
            </Button>
            {can('knowledge:manage') && document.status === 'failed' && (
              <Button variant="primary" iconLeft={<RefreshCw aria-hidden />} onClick={() => setRetryOpen(true)}>
                Retry processing
              </Button>
            )}
            <Button variant="secondary" iconLeft={<Sparkles aria-hidden />} onClick={() => navigate('/assistant')}>
              Ask about this
            </Button>
          </>
        }
      />

      <PageBody className="space-y-6">
        {document.status === 'failed' && (
          <Card className="border-danger-200">
            <div className="flex items-start gap-3 p-4">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm border border-danger-200 bg-danger-50 text-danger-700">
                <RefreshCw className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-danger-800">{document.name} could not be indexed</p>
                <p className="mt-1 text-body-sm leading-relaxed text-danger-800/85">{document.failureReason}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {can('knowledge:manage') && (
                    <Button variant="secondary" size="sm" iconLeft={<RefreshCw aria-hidden />} onClick={() => setRetryOpen(true)}>
                      Retry processing
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => navigate('/audit-logs')}>
                    View audit trail
                  </Button>
                  <span className="font-mono text-[11px] text-danger-700/70">stage: embedded (batch 1 of 148)</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Overview + processing ---------------------------------------- */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Overview" description="Source of truth for this document’s identity." icon={<ScrollText aria-hidden />} />
            <CardBody>
              <DefinitionList
                columns={2}
                items={[
                  { label: 'Document type', value: document.extension.toUpperCase() },
                  { label: 'Version', value: document.version },
                  { label: 'Owner', value: document.ownerName },
                  { label: 'Department', value: document.department },
                  { label: 'Created', value: formatDateTime(document.createdAt) },
                  { label: 'Last updated', value: formatDateTime(document.updatedAt) },
                  { label: 'Pages', value: formatNumber(document.pages) },
                  { label: 'Passages indexed', value: formatNumber(document.chunkCount) },
                  { label: 'File size', value: formatBytes(document.sizeBytes) },
                  {
                    label: 'Knowledge base',
                    value: (
                      <Link to={`/knowledge?base=${document.knowledgeBaseId}`} className="text-brand-700 hover:text-brand-800">
                        {baseQuery.data?.name ?? document.knowledgeBaseId}
                      </Link>
                    ),
                  },
                  { label: 'Embedding model', value: <span className="font-mono text-body-sm">{baseQuery.data?.embeddingModel ?? '—'}</span> },
                  { label: 'Retrieval filter', value: <span className="font-mono text-body-sm">department + access_level</span> },
                ]}
              />

              {document.tags.length > 0 && (
                <div className="mt-4 border-t border-line-subtle pt-3.5">
                  <p className="text-[11px] uppercase tracking-wide text-ink-400">Tags used by retrieval</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {document.tags.map((tag) => (
                      <StatusBadge key={tag} tone="outline" size="sm">
                        {tag}
                      </StatusBadge>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Processing pipeline"
              description="Validation → storage → extraction → cleaning → chunking → embeddings → ready."
              icon={<RefreshCw aria-hidden />}
              actions={
                <StatusBadge tone={document.status === 'ready' ? 'success' : document.status === 'failed' ? 'danger' : 'info'} size="sm">
                  {document.status === 'ready' ? 'Complete' : document.status === 'failed' ? 'Halted' : `${document.progress}% complete`}
                </StatusBadge>
              }
            />
            <CardBody className="space-y-4">
              <ProcessingTimeline
                pipeline={document.pipeline}
                failureReason={document.failureReason}
                onRetry={can('knowledge:manage') ? () => setRetryOpen(true) : undefined}
              />

              <ul className="space-y-2.5 border-t border-line-subtle pt-3.5">
                {document.pipeline.map((step) => (
                  <li key={step.key} className="flex items-start gap-3">
                    <span
                      className={
                        step.status === 'complete'
                          ? 'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-success-600 text-white'
                          : step.status === 'active'
                            ? 'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 border-brand-500'
                            : step.status === 'failed'
                              ? 'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-danger-600 text-white'
                              : 'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-line'
                      }
                      aria-hidden
                    >
                      {step.status === 'complete' && <Check className="size-2.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-body-sm text-ink-800">
                        <span className="font-medium">{step.label}</span>
                        {step.at && <span className="text-caption text-ink-400">{formatDateTime(step.at)}</span>}
                      </p>
                      <p className="text-caption leading-relaxed text-ink-500">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="rounded-md border border-line-subtle bg-surface-muted px-3 py-2.5 text-caption leading-relaxed text-ink-500">
                A document becomes retrievable only after indexing succeeds. Partial indexes are never committed, so an
                in-flight upload cannot produce a half-accurate answer.
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Access + AI usage ------------------------------------------- */}
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Access"
              description="Who can retrieve this document, and on what basis."
              icon={<ShieldCheck aria-hidden />}
              actions={<AccessBadge level={document.accessLevel} size="sm" />}
            />
            <CardBody padded={false}>
              <ul className="divide-y divide-line-subtle">
                {document.accessList.map((entry) => (
                  <li key={entry.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-body-sm font-medium text-ink-800">{entry.name}</p>
                      <p className="text-caption text-ink-400">{entry.via}</p>
                    </div>
                    <StatusBadge tone="neutral" size="sm">
                      {entry.role}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line bg-surface-muted/60 px-4 py-3">
                <p className="flex items-start gap-2 text-caption leading-relaxed text-ink-500">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ink-400" aria-hidden />
                  Access shown here reflects the retrieval filter applied inside the vector query. The same rule is
                  enforced by the Django API — hiding a document in the interface is never the control.
                </p>
                {can('users:manage') && (
                  <Button variant="secondary" size="sm" className="mt-2.5" onClick={() => navigate('/users')}>
                    Manage access
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="AI usage"
              description="How often this document actually answers questions."
              icon={<Bot aria-hidden />}
              actions={
                <span className="tnum text-caption text-ink-500">
                  {formatNumber(document.usage.retrievalCount)} retrievals
                </span>
              }
            />
            <CardBody className="space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-400">Agents using this document</p>
                {agentsUsingDocument.length === 0 ? (
                  <p className="mt-1.5 text-body-sm text-ink-400">
                    No agent currently retrieves this document. It is indexed and will be used once an agent with matching
                    scope answers a related question.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {agentsUsingDocument.map((agent) => (
                      <li key={agent.id}>
                        <Link
                          to={`/agents/${agent.id}`}
                          className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2 transition-colors hover:border-line-strong"
                        >
                          <span className="min-w-0">
                            <span className="block text-body-sm font-medium text-ink-800">{agent.name}</span>
                            <span className="block truncate text-caption text-ink-400">{agent.purpose}</span>
                          </span>
                          <ExternalLink className="size-3.5 shrink-0 text-ink-300" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-line-subtle pt-3.5">
                <p className="text-[11px] uppercase tracking-wide text-ink-400">Recent questions referencing it</p>
                {document.usage.recentQuestions.length === 0 ? (
                  <p className="mt-1.5 text-body-sm text-ink-400">No questions have cited this document yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {document.usage.recentQuestions.map((question) => (
                      <li key={question.conversationId + question.askedAt}>
                        <Link
                          to={`/assistant/${question.conversationId}`}
                          className="flex items-start gap-2.5 rounded-md border border-line-subtle bg-surface-muted/50 px-3 py-2 transition-colors hover:border-line"
                        >
                          <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-ink-400" aria-hidden />
                          <span className="min-w-0">
                            <span className="block text-body-sm text-ink-700">{question.question}</span>
                            <span className="block text-caption text-ink-400">{formatRelativeTime(question.askedAt)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Version + audit history ------------------------------------- */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section aria-labelledby="versions-heading">
            <SectionHeading id="versions-heading" title="Version history" description="Previous versions are retained for audit and comparison." icon={<History aria-hidden />} />
            <Card>
              <ol className="divide-y divide-line-subtle">
                {document.versionHistory.map((version, index) => (
                  <li key={version.version} className="flex items-start gap-3 px-4 py-3.5">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border border-line bg-surface-muted font-mono text-[10px] text-ink-500" aria-hidden>
                      {index === 0 ? 'NOW' : `v${version.version.replace(/^v/, '')}`.slice(0, 3)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-body-sm">
                        <span className="font-medium text-ink-900">{version.version}</span>
                        {index === 0 && (
                          <StatusBadge tone="success" size="sm">
                            Current
                          </StatusBadge>
                        )}
                        <span className="text-caption text-ink-400">
                          {version.author} · {formatDateTime(version.createdAt)}
                        </span>
                      </p>
                      <p className="mt-1 text-caption leading-relaxed text-ink-500">{version.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </section>

          <section aria-labelledby="audit-history-heading">
            <SectionHeading
              id="audit-history-heading"
              title="Audit history"
              description="Important events for this document, written by the API."
              icon={<ScrollText aria-hidden />}
              actions={
                can('audit:view') ? (
                  <Button variant="ghost" size="sm" onClick={() => navigate('/audit-logs')}>
                    Open audit log
                  </Button>
                ) : undefined
              }
            />
            <Card>
              {relatedAudit.length === 0 ? (
                <EmptyState
                  variant="inline"
                  icon={Link2}
                  title="No document events recorded in this window"
                  description="Uploads, access changes and retrievals appear here as they occur."
                />
              ) : (
                <ul className="divide-y divide-line-subtle">
                  {relatedAudit.map((event) => (
                    <li key={event.id} className="px-4 py-3.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-body-sm text-ink-800">{event.summary}</p>
                        <Tooltip label={formatDateTime(event.at)}>
                          <span className="shrink-0 text-caption text-ink-400">{formatRelativeTime(event.at)}</span>
                        </Tooltip>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-caption text-ink-400">
                        <span>{event.actorName}</span>
                        <span>·</span>
                        <span className="font-mono">{event.action}</span>
                        <span>·</span>
                        <span className="font-mono">{event.requestId}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
      </PageBody>

      <ConfirmationDialog
        open={retryOpen}
        onClose={() => setRetryOpen(false)}
        title="Retry processing"
        body={`SmartCorp will re-run extraction, chunking and embedding for “${document.name}”. Existing vectors are replaced, never duplicated.`}
        confirmLabel="Retry processing"
        busy={retrying}
        onConfirm={async () => {
          setRetrying(true)
          await knowledgeService.retryProcessing(document.id)
          setRetrying(false)
          setRetryOpen(false)
          documentQuery.reload()
          toast({ title: 'Processing restarted', description: 'The pipeline will resume from text extraction.', tone: 'info' })
        }}
      />
    </>
  )
}
