import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge conditional class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ---------------------------------------------------------------------------
 * Formatting helpers
 * ------------------------------------------------------------------------- */

export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, ...options }).format(value)
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatPercent(value: number, fractionDigits = 0) {
  return `${value.toFixed(fractionDigits)}%`
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

/** "12 Mar 2026, 09:42" — absolute, unambiguous, used for audit-grade data. */
export function formatDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function formatRelativeTime(iso: string, now: Date = new Date()) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const diff = date.getTime() - now.getTime()
  const abs = Math.abs(diff)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ]
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit)
  }
  return 'just now'
}

export function formatBytes(bytes: number) {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

export function formatFileCount(count: number) {
  return `${formatNumber(count)} ${count === 1 ? 'document' : 'documents'}`
}

/* ---------------------------------------------------------------------------
 * Domain helpers
 * ------------------------------------------------------------------------- */

/** First letters of a display name, used for avatars and agent marks. */
export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim()
}

export function truncate(value: string, length = 120) {
  return value.length <= length ? value : `${value.slice(0, length - 1).trimEnd()}…`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}

/** Deterministic percentage clamp for evidence / confidence displays. */
export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}
