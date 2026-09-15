import { Database, Info } from 'lucide-react'
import { cn } from '@/utils/format'
import { USE_MOCK_API } from '@/services/api-client'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tooltip } from '@/components/ui/tooltip'

/**
 * DataProvenanceBanner — the project specification is explicit that example
 * metrics must not be presented as real measurements. Wherever sample content is
 * shown, this banner states it plainly and names the source that will replace it.
 */
export function DataProvenanceBanner({
  source,
  detail,
  className,
}: {
  /** The bundled sample set currently in use, e.g. "golden set v3 (108 questions)". */
  source: string
  detail?: string
  className?: string
}) {
  if (!USE_MOCK_API) return null

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-md border border-info-200 bg-info-50 px-3 py-2.5 text-body-sm text-info-800',
        className,
      )}
      role="note"
    >
      <Database className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <p className="leading-relaxed">
        <span className="font-semibold">Sample data.</span> These figures come from the bundled demonstration set
        {' '}
        <span className="font-medium">{source}</span> and are not production measurements. They are replaced by live
        results from <code className="rounded-xs bg-white/70 px-1 font-mono text-[11px]">/api/evaluations/</code> when the
        Django API is connected.
        {detail && <span className="mt-0.5 block text-info-800/80">{detail}</span>}
      </p>
    </div>
  )
}

/**
 * MetricProvenance — explains where a single KPI number comes from. Used beside
 * AI-quality values so a reader can tell a measurement from an estimate.
 */
export function MetricProvenance({
  measured,
  window,
  method,
  className,
}: {
  measured: boolean
  window: string
  method: string
  className?: string
}) {
  return (
    <Tooltip
      side="top"
      label={
        <span className="block space-y-1">
          <span className="block font-semibold">{measured ? 'Measured value' : 'Not measured yet'}</span>
          <span className="block text-white/75">Window: {window}</span>
          <span className="block text-white/75">Method: {method}</span>
        </span>
      }
    >
      <span className={cn('inline-flex items-center gap-1 text-[11px] text-ink-400', className)}>
        <Info className="size-3" aria-hidden />
        {measured ? 'Measured' : 'Pending run'}
      </span>
    </Tooltip>
  )
}

/** Marks a capability that exists in the API but is not yet connected. */
export function NotConnectedBadge({ label = 'Not connected' }: { label?: string }) {
  return (
    <StatusBadge tone="neutral" size="sm" icon={<Database aria-hidden />}>
      {label}
    </StatusBadge>
  )
}
