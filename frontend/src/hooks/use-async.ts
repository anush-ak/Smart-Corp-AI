import { useCallback, useEffect, useRef, useState } from 'react'
import { AppError, type AppErrorShape } from '@/services/api-client'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  /** True only on the first load, so refresh spinners do not replace content. */
  initialLoading: boolean
  error: AppErrorShape | null
  reload: () => void
  setData: (next: T | null) => void
}

function toAppError(error: unknown): AppErrorShape {
  if (error instanceof AppError) return error
  return {
    status: null,
    code: 'unexpected_error',
    message: error instanceof Error ? error.message : 'Something unexpected happened. Try again.',
    isNetworkError: false,
  }
}

/**
 * useAsyncQuery — the loading/error/data contract every page uses.
 *
 * Deliberately not a cache: each page owns its fetch, matching the Django REST
 * boundary. `initialLoading` drives skeletons; `loading` drives quiet refreshes.
 */
export function useAsyncQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: { enabled?: boolean; keepPreviousData?: boolean } = {},
): AsyncState<T> {
  const { enabled = true, keepPreviousData = true } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [initialLoading, setInitialLoading] = useState(enabled)
  const [error, setError] = useState<AppErrorShape | null>(null)
  const [nonce, setNonce] = useState(0)
  const mounted = useRef(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setInitialLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    fetcherRef
      .current()
      .then((result) => {
        if (cancelled || !mounted.current) return
        setData(result)
      })
      .catch((caught) => {
        if (cancelled || !mounted.current) return
        setError(toAppError(caught))
        if (!keepPreviousData) setData(null)
      })
      .finally(() => {
        if (cancelled || !mounted.current) return
        setLoading(false)
        setInitialLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  return { data, loading, initialLoading, error, reload, setData }
}

/**
 * useAsyncAction — for mutations (approve, reject, upload, retry).
 * Tracks busy state and surfaces a normalised error for toasts or inline alerts.
 */
export function useAsyncAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
): {
  run: (...args: Args) => Promise<Result | null>
  busy: boolean
  error: AppErrorShape | null
  reset: () => void
} {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AppErrorShape | null>(null)

  const run = useCallback(
    async (...args: Args) => {
      setBusy(true)
      setError(null)
      try {
        return await action(...args)
      } catch (caught) {
        setError(toAppError(caught))
        return null
      } finally {
        setBusy(false)
      }
    },
    [action],
  )

  return { run, busy, error, reset: () => setError(null) }
}

/** Debounce any fast-changing value (search inputs). */
export function useDebouncedValue<T>(value: T, delayMs = 220) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/**
 * useProgressiveStages — powers the contextual AI loading experience
 * ("Understanding question → Searching knowledge → Evaluating evidence →
 * Preparing answer") without implying hidden chain-of-thought.
 */
export function useProgressiveStages(stages: string[], active: boolean, stepMs = 620) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!active) {
      setIndex(0)
      return
    }
    setIndex(0)
    const timer = window.setInterval(() => {
      setIndex((current) => Math.min(current + 1, stages.length - 1))
    }, stepMs)
    return () => window.clearInterval(timer)
  }, [active, stages.length, stepMs])

  return { index, label: stages[index], isLast: index === stages.length - 1 }
}
