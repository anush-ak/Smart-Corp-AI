import { AlertTriangle, Bot, Check, Clock, Loader2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProgressBar } from '@/components/ui/states'
import { AccessBadge, DocumentStatusBadge, StatusBadge } from '@/components/ui/status-badge'
import { Tooltip } from '@/components/ui/tooltip'
import type { DocumentStatus, KnowledgeBase, KnowledgeDocument, ProcessingStep } from '@/types'
import { cn, formatBytes, formatFileCount, formatRelativeTime } from '@/utils/format'

/* -------------------------------------------------------------------------- */
/* File type mark — restrained, consistent across the product                  */
/* -------------------------------------------------------------------------- */

const EXTENSION_TONE: Record<string, string> = {
  pdf: 'border-danger-200 bg-danger-50 text-danger-700',
  docx: 'border-info-200 bg-info-50 text-info-700',
  xlsx: 'border-success-200 bg-success-50 text-success-700',
  pptx: 'border-warning-200 bg-warning-50 text-warning-700',
  md: 'border-line bg-surface-muted text-ink-600',
  txt: 'border-line bg-surface-muted text-ink-600',
  csv: 'border-success-200 bg-success-50 text-success-700',
}

export function FileTypeMark({ extension, size = 'md' }: { extension: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-sm border font-semibold uppercase',
        EXTENSION_TONE[extension] ?? EXTENSION_TONE.md,
        size === 'sm' ? 'size-5 text-[9px]' : 'size-7 text-[10px]',
      )}
      aria-hidden
    >
      {extension}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Processing timeline — Uploaded → Extracted → Chunked → Embedded → Indexed    */
/* -------------------------------------------------------------------------- */

export function ProcessingTimeline({
  pipeline,
  failureReason,
  onRetry,
  compact,
}: {
  pipeline: ProcessingStep[]
  failureReason?: string
  onRetry?: () => void
  compact?: boolean
}) {
  return (
    <div className="space-y-3">
      <ol className={cn('flex flex-wrap items-center gap-x-2 gap-y-2', compact && 'gap-x-1.5')}>
        {pipeline.map((step, index) => {
          const done = step.status === 'complete'
          const active = step.status === 'active'
          const failed = step.status === 'failed'
          return (
            <li key={step.key} className="flex items-center gap-2">
              <Tooltip label={step.detail}>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] font-medium',
                    done && 'border-success-200 bg-success-50 text-success-800',
                    active && 'border-brand-200 bg-brand-50 text-brand-800',
                    failed && 'border-danger-200 bg-danger-50 text-danger-800',
                    step.status === 'pending' && 'border-line bg-surface-muted text-ink-400',
                  )}
                >
                  {done ? (
                    <Check className="size-3" aria-hidden />
                  ) : active ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                  ) : failed ? (
                    <X className="size-3" aria-hidden />
                  ) : (
                    <Clock className="size-3" aria-hidden />
                  )}
                  {step.label}
                </span>
              </Tooltip>
              {index < pipeline.length - 1 && <span aria-hidden className="text-ink-200">→</span>}
            </li>
          )
        })}
      </ol>

      {failureReason && (
        <div className="flex items-start gap-2.5 rounded-md border border-danger-200 bg-danger-50/70 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger-600" aria-hidden />
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-danger-800">Processing failed</p>
            <p className="mt-0.5 text-caption leading-relaxed text-danger-800/85">{failureReason}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-caption font-semibold text-danger-700 underline decoration-danger-200 underline-offset-2 hover:decoration-danger-600"
              >
                Retry processing
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Inline progress used inside document rows. */
export function DocumentProgress({ status, progress }: { status: DocumentStatus; progress: number }) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-success-800">
        <Check className="size-3" aria-hidden />
        100%
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-danger-800">
        <X className="size-3" aria-hidden />
        Stopped at {progress}%
      </span>
    )
  }
  const label =
    status === 'uploading' ? 'Uploading' : status === 'processing' ? 'Extracting' : 'Generating embeddings'
  return (
    <span className="block min-w-[104px]">
      <span className="mb-1 flex items-center justify-between gap-2 text-[11px] text-ink-500">
        <span>{label}</span>
        <span className="tnum">{progress}%</span>
      </span>
      <ProgressBar value={progress} label={`${label} ${progress}%`} />
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Knowledge base card                                                         */
/* -------------------------------------------------------------------------- */

export function KnowledgeBaseCard({
  base,
  onOpen,
  onUpload,
  className,
}: {
  base: KnowledgeBase
  onOpen: () => void
  onUpload?: () => void
  className?: string
}) {
  return (
    <article className={cn('sc-card flex flex-col transition-colors hover:border-line-strong', className)}>
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <h3 className="truncate text-h3 text-ink-900">{base.name}</h3>
          <p className="mt-1 line-clamp-2 text-body-sm leading-relaxed text-ink-500">{base.description}</p>
        </div>
        <StatusBadge tone={base.status === 'ready' ? 'success' : base.status === 'attention' ? 'warning' : 'info'} size="sm">
          {base.status === 'ready' ? 'Ready' : base.status === 'attention' ? 'Needs attention' : 'Indexing'}
        </StatusBadge>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-line-subtle px-4 py-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-400">Documents</dt>
          <dd className="tnum mt-0.5 text-body-sm font-medium text-ink-800">{formatFileCount(base.documentCount)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-400">Passages</dt>
          <dd className="tnum mt-0.5 text-body-sm font-medium text-ink-800">{base.chunkCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-400">Department</dt>
          <dd className="mt-0.5 text-body-sm font-medium text-ink-800">{base.department}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-400">Access</dt>
          <dd className="mt-0.5">
            <AccessBadge level={base.accessLevel} size="sm" />
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span className="text-caption text-ink-400">Updated {formatRelativeTime(base.lastUpdatedAt)}</span>
        {base.agents.length > 0 && (
          <span className="flex items-center gap-1 text-caption text-ink-400">
            <Bot className="size-3" aria-hidden />
            {base.agents.map((agent) => agent.replace('agent_', '')).join(', ')}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {onUpload && (
            <button
              type="button"
              onClick={onUpload}
              className="text-caption font-medium text-ink-500 hover:text-ink-800"
            >
              Upload
            </button>
          )}
          <button
            type="button"
            onClick={onOpen}
            className="text-caption font-semibold text-brand-700 hover:text-brand-800"
          >
            Open →
          </button>
        </div>
      </div>
    </article>
  )
}

/* -------------------------------------------------------------------------- */
/* Document row — used by the knowledge table and document lists                */
/* -------------------------------------------------------------------------- */

export function DocumentRow({
  document,
  onOpen,
  onRetry,
  className,
}: {
  document: KnowledgeDocument
  onOpen: () => void
  onRetry?: () => void
  className?: string
}) {
  return (
    <li className={cn('flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-surface-muted/60', className)}>
      <FileTypeMark extension={document.extension} />

      <div className="min-w-0 flex-1">
        <Link to={`/knowledge/${document.id}`} className="text-body font-medium text-ink-900 hover:text-brand-700">
          {document.name}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-ink-400">
          <span>{document.department}</span>
          <span>·</span>
          <span>{document.version}</span>
          <span>·</span>
          <span>{formatBytes(document.sizeBytes)}</span>
          <span>·</span>
          <span>{document.ownerName}</span>
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        <AccessBadge level={document.accessLevel} size="sm" />
        <div className="min-w-[116px]">
          <DocumentProgress status={document.status} progress={document.progress} />
        </div>
        <DocumentStatusBadge status={document.status} size="sm" />
        <span className="w-[92px] text-right text-caption text-ink-400">{formatRelativeTime(document.updatedAt)}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpen}
            className="text-caption font-semibold text-brand-700 hover:text-brand-800"
          >
            Open
          </button>
          {document.status === 'failed' && onRetry && (
            <button type="button" onClick={onRetry} className="text-caption font-medium text-danger-700 hover:text-danger-800">
              Retry
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

/** Compact document reference used inside decision evidence and agent detail. */
export function DocumentChip({ document }: { document: KnowledgeDocument }) {
  return (
    <Link
      to={`/knowledge/${document.id}`}
      className="inline-flex max-w-full items-center gap-2 rounded-md border border-line bg-surface px-2 py-1 text-caption text-ink-600 transition-colors hover:border-line-strong hover:text-ink-900"
    >
      <FileTypeMark extension={document.extension} size="sm" />
      <span className="truncate">{document.name}</span>
    </Link>
  )
}
