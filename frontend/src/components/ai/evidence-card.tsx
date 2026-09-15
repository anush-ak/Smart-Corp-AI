import { ArrowUpRight, Check, FileText, Gauge, Ticket, TriangleAlert, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EvidenceStrengthBadge, StatusBadge } from '@/components/ui/status-badge'
import { ConfidenceMeter } from '@/components/ui/metrics'
import { Tooltip } from '@/components/ui/tooltip'
import type { EvidenceItem, RetrievedSource } from '@/types'
import { cn, formatRelativeTime } from '@/utils/format'

/* -------------------------------------------------------------------------- */
/* SourceCard — one retrieved passage, with the reason it was (or was not) used */
/* -------------------------------------------------------------------------- */

export function SourceCard({
  source,
  onOpenEvidence,
  className,
  compact,
}: {
  source: RetrievedSource
  defaultOpen?: boolean
  onOpenEvidence?: (source: RetrievedSource) => void
  className?: string
  compact?: boolean
}) {
  const included = source.included
  return (
    <li
      className={cn(
        'group rounded-md border bg-surface transition-colors',
        included ? 'border-line hover:border-line-strong' : 'border-dashed border-line bg-surface-muted/50',
        className,
      )}
    >
      <div className={cn('flex items-start gap-3', compact ? 'p-3' : 'p-3.5')}>
        <span
          className={cn(
            'mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border font-mono text-[11px] font-semibold',
            included ? 'border-line bg-surface-muted text-ink-600' : 'border-line bg-surface text-ink-400',
          )}
          aria-hidden
        >
          {source.rank}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <div className="min-w-0">
              <p className={cn('truncate font-medium', included ? 'text-ink-900' : 'text-ink-500', compact ? 'text-body-sm' : 'text-body')}>
                {source.documentName}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-ink-400">
                <span className="font-medium text-ink-500">{source.knowledgeBaseName}</span>
                {source.page !== null && <span>Page {source.page}</span>}
                {source.section && <span className="truncate">· {source.section}</span>}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Tooltip
                label={`Retrieval score ${source.score.toFixed(2)} — cosine similarity after cross-encoder reranking`}
              >
                <span className="tnum font-mono text-caption text-ink-500">{source.score.toFixed(2)}</span>
              </Tooltip>
              {included ? (
                <StatusBadge tone="success" size="sm" icon={<Check aria-hidden />}>
                  Cited
                </StatusBadge>
              ) : (
                <StatusBadge tone="neutral" size="sm" icon={<X aria-hidden />}>
                  Excluded
                </StatusBadge>
              )}
            </div>
          </div>

          <p
            className={cn(
              'mt-2 border-l-2 pl-2.5 text-body-sm leading-relaxed',
              included ? 'border-brand-200 text-ink-600' : 'border-line text-ink-400',
            )}
          >
            “{source.snippet}”
          </p>

          {!included && source.exclusionReason && (
            <p className="mt-2 flex items-start gap-1.5 text-caption text-warning-800">
              <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
              {source.exclusionReason}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <StatusBadge tone="outline" size="sm">
              {source.accessLevel === 'organization' ? 'Org-wide' : source.accessLevel === 'department' ? `${source.department} only` : 'Restricted'}
            </StatusBadge>
            <span className="text-[11px] text-ink-400">Updated {formatRelativeTime(source.updatedAt)}</span>
            {included && (
              <button
                type="button"
                onClick={() => onOpenEvidence?.(source)}
                className="ml-auto inline-flex items-center gap-1 text-caption font-medium text-brand-700 hover:text-brand-800"
              >
                View source
                <ArrowUpRight className="size-3" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/* Evidence type icon — one vocabulary across decisions and runs               */
/* -------------------------------------------------------------------------- */

const EVIDENCE_ICON = {
  ticket: Ticket,
  document: FileText,
  incident: TriangleAlert,
  metric: Gauge,
  transcript: FileText,
  log: FileText,
}

export function EvidenceItemCard({
  item,
  index,
  className,
}: {
  item: EvidenceItem
  index?: number
  className?: string
}) {
  const Icon = EVIDENCE_ICON[item.kind]
  return (
    <li className={cn('rounded-md border border-line bg-surface p-3.5 transition-colors hover:border-line-strong', className)}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-surface-muted text-ink-500" aria-hidden>
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <p className="text-body font-medium text-ink-900">
              {typeof index === 'number' && <span className="mr-1.5 font-mono text-caption text-ink-400">E{index + 1}</span>}
              {item.title}
            </p>
            <EvidenceStrengthBadge strength={item.strength} />
          </div>
          <p className="mt-1 text-body-sm leading-relaxed text-ink-600">{item.detail}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-400">
            <span className="font-mono">{item.source}</span>
            <span>{formatRelativeTime(item.at)}</span>
            <Link to={item.href} className="ml-auto inline-flex items-center gap-1 font-medium text-brand-700 hover:text-brand-800">
              Open
              <ArrowUpRight className="size-3" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </li>
  )
}

/**
 * EvidencePanel — the "Where did this come from?" surface. Used in the assistant
 * side panel and on decision detail, so provenance looks identical everywhere.
 */
export function EvidencePanel({
  sources,
  citations,
  className,
  onOpenEvidence,
}: {
  sources: RetrievedSource[]
  citations?: { id: string; claim: string; documentName: string; page: number | null; section: string | null }[]
  className?: string
  onOpenEvidence?: (source: RetrievedSource) => void
}) {
  const included = sources.filter((source) => source.included)
  const excluded = sources.filter((source) => !source.included)

  return (
    <div className={cn('space-y-5', className)}>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-h3 text-ink-900">Evidence</h3>
          <span className="tnum text-caption text-ink-400">
            {included.length} cited · {excluded.length} excluded
          </span>
        </div>
        {included.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong bg-surface-muted/50 p-3.5">
            <p className="text-body-sm font-medium text-ink-700">No passages passed the relevance floor</p>
            <p className="mt-1 text-caption leading-relaxed text-ink-500">
              SmartCorp returned an insufficient-evidence answer rather than guessing. This is the safe fallback, and it
              is recorded so the knowledge gap can be fixed.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {included.map((source) => (
              <SourceCard key={source.id} source={source} compact onOpenEvidence={onOpenEvidence} />
            ))}
          </ul>
        )}
      </section>

      {citations && citations.length > 0 && (
        <section>
          <h3 className="mb-2 text-h3 text-ink-900">Citations</h3>
          <ul className="space-y-1.5">
            {citations.map((citation) => (
              <li key={citation.id} className="flex items-start gap-2.5 rounded-md border border-line-subtle bg-surface-muted/60 px-3 py-2">
                <ConfidenceMeter value={100} tone="success" className="mt-1.5 w-6 shrink-0" />
                <div className="min-w-0">
                  <p className="text-body-sm text-ink-700">{citation.claim}</p>
                  <p className="mt-0.5 text-caption text-ink-400">
                    {citation.documentName}
                    {citation.page !== null && ` · page ${citation.page}`}
                    {citation.section && ` · ${citation.section}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {excluded.length > 0 && (
        <section>
          <h3 className="mb-2 text-h3 text-ink-900">Excluded candidates</h3>
          <ul className="space-y-2">
            {excluded.map((source) => (
              <SourceCard key={source.id} source={source} compact />
            ))}
          </ul>
          <p className="mt-2 text-caption leading-relaxed text-ink-400">
            Exclusions are shown deliberately: seeing what the system rejected — and why — is part of trusting the answer.
          </p>
        </section>
      )}
    </div>
  )
}
