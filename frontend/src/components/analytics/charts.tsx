import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState } from '@/components/ui/states'
import { BarChart3 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn, formatNumber } from '@/utils/format'

/**
 * Chart primitives.
 *
 * House rules enforced here so every chart answers a question:
 *  · a title and a time/unit statement are always supplied by the caller,
 *  · axes stay thin and gridlines stay faint,
 *  · a tooltip is always present,
 *  · loading and empty states are handled, never a blank box.
 */

export const CHART_COLORS = {
  brand: '#6366F1',
  brandSoft: '#C6CBFF',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
  ink: '#3A3F4A',
  muted: '#A6ACB8',
  grid: '#EEF0F3',
}

const axisProps = {
  stroke: CHART_COLORS.muted,
  tick: { fill: '#868D9A', fontSize: 11 },
  tickLine: false as const,
  axisLine: false as const,
}

function TooltipShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-surface px-2.5 py-2 shadow-pop">
      <div className="text-caption text-ink-600">{children}</div>
    </div>
  )
}

/** Standard chart frame: title, unit/time context, optional legend, children. */
export function ChartFrame({
  title,
  context,
  actions,
  children,
  className,
  height = 220,
  loading,
  empty,
  footer,
  id,
}: {
  title: string
  context: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
  height?: number
  loading?: boolean
  empty?: boolean
  footer?: ReactNode
  id?: string
}) {
  return (
    <section className={cn('sc-card flex flex-col', className)} aria-labelledby={id}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h3 id={id} className="text-h3 text-ink-900">
            {title}
          </h3>
          <p className="mt-0.5 text-caption text-ink-400">{context}</p>
        </div>
        {actions}
      </header>

      <div className="flex-1 p-4" style={{ minHeight: height }}>
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="w-full space-y-3">
              <div className="h-24 animate-pulse-soft rounded-md bg-surface-sunken" />
              <div className="h-24 animate-pulse-soft rounded-md bg-surface-sunken" />
            </div>
          </div>
        ) : empty ? (
          <EmptyState
            variant="inline"
            icon={BarChart3}
            title="No data in this period"
            description="Once queries, decisions or approvals are recorded for this window, the chart renders here."
          />
        ) : (
          children
        )}
      </div>

      {footer && <footer className="border-t border-line-subtle px-4 py-2.5 text-caption text-ink-500">{footer}</footer>}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Query volume                                                               */
/* -------------------------------------------------------------------------- */

export function QueryVolumeChart({
  data,
}: {
  data: { date: string; queries: number; approvals: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="queryFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.brand} stopOpacity={0.18} />
            <stop offset="100%" stopColor={CHART_COLORS.brand} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="date"
          {...axisProps}
          tickFormatter={(value: string) => value.slice(8)}
          interval={Math.max(0, Math.floor(data.length / 8))}
        />
        <YAxis {...axisProps} width={40} tickFormatter={(value: number) => formatNumber(value)} />
        <RechartsTooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipShell>
                <p className="font-medium text-ink-900">{String(label)}</p>
                {payload.map((entry) => (
                  <p key={String(entry.dataKey)} className="tnum mt-0.5">
                    {formatNumber(Number(entry.value))} {entry.dataKey === 'queries' ? 'questions asked' : 'approvals raised'}
                  </p>
                ))}
              </TooltipShell>
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="queries"
          stroke={CHART_COLORS.brand}
          strokeWidth={2}
          fill="url(#queryFill)"
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* -------------------------------------------------------------------------- */
/* Metric trend                                                               */
/* -------------------------------------------------------------------------- */

export function MetricTrendChart({
  data,
  unit,
  colour = CHART_COLORS.brand,
  target,
  height = 180,
}: {
  data: { date: string; value: number }[]
  unit: 'percent' | 'ms'
  colour?: string
  target?: number
  height?: number
}) {
  const percent = unit === 'percent'
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="date" {...axisProps} tickFormatter={(value: string) => value.slice(5)} interval={Math.max(0, Math.floor(data.length / 6))} />
        <YAxis
          {...axisProps}
          width={44}
          domain={percent ? [Math.max(0, Math.floor((target ?? 0.9) * 80) - 10), 100] : ['auto', 'auto']}
          tickFormatter={(value: number) => (percent ? `${Math.round(value)}%` : `${Math.round(value)}ms`)}
        />
        <RechartsTooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipShell>
                <p className="font-medium text-ink-900">{String(label)}</p>
                <p className="tnum mt-0.5">
                  {percent ? `${Number(payload[0].value).toFixed(1)}%` : `${formatNumber(Number(payload[0].value))} ms`}
                </p>
                {target !== undefined && (
                  <p className="tnum text-ink-400">
                    Target {percent ? `${(target * 100).toFixed(0)}%` : `${formatNumber(target)} ms`}
                  </p>
                )}
              </TooltipShell>
            ) : null
          }
        />
        <Line type="monotone" dataKey="value" stroke={colour} strokeWidth={2} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* -------------------------------------------------------------------------- */
/* Agent usage / category comparisons                                          */
/* -------------------------------------------------------------------------- */

export function AgentUsageChart({
  data,
  height = 200,
}: {
  data: { name: string; executions: number }[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={(value: number) => formatNumber(value)} />
        <YAxis type="category" dataKey="name" {...axisProps} width={104} />
        <RechartsTooltip
          cursor={{ fill: 'rgba(99,102,241,0.05)' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipShell>
                <p className="font-medium text-ink-900">{String(payload[0].payload.name)}</p>
                <p className="tnum mt-0.5">{formatNumber(Number(payload[0].value))} executions</p>
              </TooltipShell>
            ) : null
          }
        />
        <Bar dataKey="executions" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={[CHART_COLORS.brand, CHART_COLORS.info, CHART_COLORS.success][index % 3]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function LatencyDistributionChart({
  data,
  height = 200,
}: {
  data: { bucket: string; count: number }[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="bucket" {...axisProps} />
        <YAxis {...axisProps} width={44} tickFormatter={(value: number) => formatNumber(value)} />
        <RechartsTooltip
          cursor={{ fill: 'rgba(99,102,241,0.05)' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipShell>
                <p className="font-medium text-ink-900">{String(label)}</p>
                <p className="tnum mt-0.5">{formatNumber(Number(payload[0].value))} answers</p>
              </TooltipShell>
            ) : null
          }
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={28} fill={CHART_COLORS.brandSoft} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* -------------------------------------------------------------------------- */
/* Approvals & evaluations                                                     */
/* -------------------------------------------------------------------------- */

export function ApprovalVolumeChart({
  data,
  height = 220,
}: {
  data: { date: string; requested: number; approved: number; rejected: number }[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="date" {...axisProps} tickFormatter={(value: string) => value.slice(5)} />
        <YAxis {...axisProps} width={40} allowDecimals={false} />
        <RechartsTooltip
          cursor={{ fill: 'rgba(99,102,241,0.05)' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipShell>
                <p className="font-medium text-ink-900">{String(label)}</p>
                {payload.map((entry) => (
                  <p key={String(entry.dataKey)} className="tnum mt-0.5">
                    {String(entry.dataKey)}: {formatNumber(Number(entry.value))}
                  </p>
                ))}
              </TooltipShell>
            ) : null
          }
        />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 11, color: '#666D7A', paddingTop: 6 }}
        />
        <Bar dataKey="approved" name="Approved" stackId="a" fill={CHART_COLORS.success} barSize={16} />
        <Bar dataKey="rejected" name="Rejected" stackId="a" fill={CHART_COLORS.danger} barSize={16} />
        <Bar dataKey="requested" name="Awaiting" stackId="a" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function AuthActivityChart({
  data,
  height = 200,
}: {
  data: { date: string; success: number; failed: number }[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="date" {...axisProps} tickFormatter={(value: string) => value.slice(5)} />
        <YAxis {...axisProps} width={40} allowDecimals={false} />
        <RechartsTooltip
          cursor={{ fill: 'rgba(99,102,241,0.05)' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipShell>
                <p className="font-medium text-ink-900">{String(label)}</p>
                {payload.map((entry) => (
                  <p key={String(entry.dataKey)} className="tnum mt-0.5">
                    {String(entry.dataKey)}: {formatNumber(Number(entry.value))}
                  </p>
                ))}
              </TooltipShell>
            ) : null
          }
        />
        <Bar dataKey="success" name="Successful" stackId="a" fill={CHART_COLORS.success} barSize={14} />
        <Bar dataKey="failed" name="Failed / denied" stackId="a" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Sparkline used inside metric cards — no axes, trend only. */
export function Sparkline({
  data,
  colour = CHART_COLORS.brand,
  height = 32,
}: {
  data: { date: string; value: number }[]
  colour?: string
  height?: number
}) {
  if (data.length === 0) return null
  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="value" stroke={colour} strokeWidth={1.6} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
