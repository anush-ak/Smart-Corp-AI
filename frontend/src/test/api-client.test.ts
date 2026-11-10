import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveApiBaseUrl } from '@/services/api-client'

describe('resolveApiBaseUrl / API_BASE_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults to /api when VITE_API_BASE_URL is unset or blank', async () => {
    expect(resolveApiBaseUrl(undefined)).toBe('/api')
    expect(resolveApiBaseUrl('')).toBe('/api')
    expect(resolveApiBaseUrl('   ')).toBe('/api')

    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.resetModules()
    const mod = await import('@/services/api-client')
    expect(mod.API_BASE_URL).toBe('/api')
  })

  it('preserves /api and relative /api paths', async () => {
    expect(resolveApiBaseUrl('/api')).toBe('/api')
    expect(resolveApiBaseUrl('/api/')).toBe('/api')

    vi.stubEnv('VITE_API_BASE_URL', '/api')
    vi.resetModules()
    const mod = await import('@/services/api-client')
    expect(mod.API_BASE_URL).toBe('/api')
  })

  it('normalizes full https URLs with and without trailing slashes or /api', async () => {
    expect(resolveApiBaseUrl('https://smartcorp-api.onrender.com')).toBe(
      'https://smartcorp-api.onrender.com/api',
    )
    expect(resolveApiBaseUrl('https://smartcorp-api.onrender.com/')).toBe(
      'https://smartcorp-api.onrender.com/api',
    )
    expect(resolveApiBaseUrl('https://smartcorp-api.onrender.com/api')).toBe(
      'https://smartcorp-api.onrender.com/api',
    )
    expect(resolveApiBaseUrl('https://smartcorp-api.onrender.com/api/')).toBe(
      'https://smartcorp-api.onrender.com/api',
    )

    vi.stubEnv('VITE_API_BASE_URL', 'https://smartcorp-api.onrender.com/')
    vi.resetModules()
    const mod = await import('@/services/api-client')
    expect(mod.API_BASE_URL).toBe('https://smartcorp-api.onrender.com/api')
  })

  it('preserves explicit http URLs without upgrading to https', async () => {
    expect(resolveApiBaseUrl('http://localhost:8000')).toBe('http://localhost:8000/api')
    expect(resolveApiBaseUrl('http://127.0.0.1:8000/api')).toBe('http://127.0.0.1:8000/api')

    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8000')
    vi.resetModules()
    const mod = await import('@/services/api-client')
    expect(mod.API_BASE_URL).toBe('http://127.0.0.1:8000/api')
  })

  it('prepends https:// when given a bare hostname', async () => {
    expect(resolveApiBaseUrl('smartcorp-api.onrender.com')).toBe(
      'https://smartcorp-api.onrender.com/api',
    )
    expect(resolveApiBaseUrl('smartcorp-api.onrender.com/')).toBe(
      'https://smartcorp-api.onrender.com/api',
    )
    expect(resolveApiBaseUrl('smartcorp-api.onrender.com/api')).toBe(
      'https://smartcorp-api.onrender.com/api',
    )

    vi.stubEnv('VITE_API_BASE_URL', 'smartcorp-api.onrender.com')
    vi.resetModules()
    const mod = await import('@/services/api-client')
    expect(mod.API_BASE_URL).toBe('https://smartcorp-api.onrender.com/api')
  })
})
