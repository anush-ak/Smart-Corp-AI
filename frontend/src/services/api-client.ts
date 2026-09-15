import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

/**
 * SmartCorp AI — API transport.
 *
 * Every network call in the product goes through this module. UI components
 * never call axios directly; they call a service function, which either talks
 * to the Django REST API or to the mock adapter.
 *
 *   React Frontend → Django REST API → PostgreSQL + pgvector → RAG → Agents
 *
 * Environment:
 *   VITE_API_BASE_URL   Base URL for the Django API (default: `/api`, proxied
 *                       by the dev server to http://127.0.0.1:8000).
 *   VITE_USE_MOCK_API   `true` (default) serves the in-memory mock adapter so
 *                       the interface is fully demonstrable before every Django
 *                       endpoint exists. Set to `false` to hit the live API.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
export const USE_MOCK_API = (import.meta.env.VITE_USE_MOCK_API ?? 'true') !== 'false'

export const AUTH_TOKEN_KEY = 'smartcorp.auth.token'

export function readToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function writeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token)
    else window.localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    /* storage disabled — session stays in memory only */
  }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

/* --------------------------------------------------------------------------
 * Request: attach the JWT issued by /api/auth/login/
 * ------------------------------------------------------------------------ */
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = readToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers['X-Client'] = 'smartcorp-web'
  return config
})

/* --------------------------------------------------------------------------
 * Response: normalise DRF errors into a single AppError shape the UI can render
 * ------------------------------------------------------------------------ */
export interface AppErrorShape {
  status: number | null
  code: string
  message: string
  /** Field-level errors from DRF serializers. */
  fieldErrors?: Record<string, string[]>
  requestId?: string
  isNetworkError: boolean
}

export class AppError extends Error implements AppErrorShape {
  status: number | null
  code: string
  fieldErrors?: Record<string, string[]>
  requestId?: string
  isNetworkError: boolean

  constructor(shape: AppErrorShape) {
    super(shape.message)
    this.name = 'AppError'
    this.status = shape.status
    this.code = shape.code
    this.fieldErrors = shape.fieldErrors
    this.requestId = shape.requestId
    this.isNetworkError = shape.isNetworkError
  }
}

function normaliseError(error: AxiosError): AppError {
  if (!error.response) {
    return new AppError({
      status: null,
      code: 'network_error',
      message: 'SmartCorp could not reach the API. Check your connection and try again.',
      isNetworkError: true,
    })
  }

  const { status, data } = error.response
  const payload = (data ?? {}) as Record<string, unknown>
  const detail =
    (typeof payload.detail === 'string' && payload.detail) ||
    (typeof payload.message === 'string' && payload.message) ||
    (status === 401
      ? 'Your session has expired. Sign in again to continue.'
      : status === 403
        ? 'Your role does not permit this action. Access is enforced by the API.'
        : status === 404
          ? 'This resource no longer exists.'
          : 'The API returned an unexpected error.')

  const fieldErrors = Object.entries(payload).reduce<Record<string, string[]>>((accumulator, [key, value]) => {
    if (key === 'detail' || key === 'message') return accumulator
    if (Array.isArray(value)) accumulator[key] = value.map(String)
    else if (typeof value === 'string') accumulator[key] = [value]
    return accumulator
  }, {})

  return new AppError({
    status,
    code: typeof payload.code === 'string' ? payload.code : `http_${status}`,
    message: detail,
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
    requestId: (error.response.headers['x-request-id'] as string) ?? undefined,
    isNetworkError: false,
  })
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(normaliseError(error)),
)

/** Thin typed helpers so services stay free of axios specifics. */
export const http = {
  get: async <T>(url: string, params?: Record<string, unknown>) =>
    (await apiClient.get<T>(url, { params })).data,
  post: async <T>(url: string, body?: unknown) => (await apiClient.post<T>(url, body)).data,
  patch: async <T>(url: string, body?: unknown) => (await apiClient.patch<T>(url, body)).data,
  put: async <T>(url: string, body?: unknown) => (await apiClient.put<T>(url, body)).data,
  delete: async <T>(url: string) => (await apiClient.delete<T>(url)).data,
}

/* --------------------------------------------------------------------------
 * Mock transport
 *
 * When USE_MOCK_API is true, services resolve through this function instead of
 * `http`. Keeping one seam means switching to the live Django API is a change
 * in `.env`, not in components.
 * ------------------------------------------------------------------------ */

export interface MockHandler {
  /** Matched against the endpoint id declared by the service, e.g. 'decisions.list'. */
  endpoint: string
  resolve: (payload?: unknown) => Promise<unknown> | unknown
  /** Simulated latency so loading and empty states are exercised in the demo. */
  latencyMs?: number
}

const mockRegistry = new Map<string, MockHandler>()

export function registerMock(handler: MockHandler) {
  mockRegistry.set(handler.endpoint, handler)
}

export function registerMocks(handlers: MockHandler[]) {
  handlers.forEach(registerMock)
}

export function mockAdapter<T>(endpoint: string, payload?: unknown): Promise<T> {
  const handler = mockRegistry.get(endpoint)
  if (!handler) {
    return Promise.reject(
      new AppError({
        status: 501,
        code: 'mock_not_implemented',
        message: `No mock handler registered for "${endpoint}". Register one in src/services/mocks or connect the Django endpoint.`,
        isNetworkError: false,
      }),
    )
  }
  const latency = handler.latencyMs ?? 260
  return new Promise<T>((resolve, reject) => {
    window.setTimeout(() => {
      try {
        Promise.resolve(handler.resolve(payload)).then((value) => resolve(value as T)).catch(reject)
      } catch (error) {
        reject(error)
      }
    }, latency)
  })
}

/**
 * `request()` — the single entry point used by every service function.
 *
 * @param endpoint logical API endpoint, e.g. 'decisions.approve'
 * @param config   live-API method, path and payload
 * @param mock     optional mock payload override
 */
export async function request<T>({
  endpoint,
  method = 'get',
  path,
  params,
  body,
  mockPayload,
  mockLatencyMs,
}: {
  endpoint: string
  method?: 'get' | 'post' | 'patch' | 'put' | 'delete'
  path: string
  params?: Record<string, unknown>
  body?: unknown
  mockPayload?: unknown
  mockLatencyMs?: number
}): Promise<T> {
  if (USE_MOCK_API) {
    if (mockLatencyMs !== undefined) {
      const handler = mockRegistry.get(endpoint)
      if (handler) handler.latencyMs = mockLatencyMs
    }
    return mockAdapter<T>(endpoint, { params, body, mockPayload })
  }
  switch (method) {
    case 'post':
      return http.post<T>(path, body)
    case 'patch':
      return http.patch<T>(path, body)
    case 'put':
      return http.put<T>(path, body)
    case 'delete':
      return http.delete<T>(path)
    default:
      return http.get<T>(path, params)
  }
}
