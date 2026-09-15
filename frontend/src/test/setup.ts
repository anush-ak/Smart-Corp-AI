import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetMockState } from '@/services/mocks/handlers'

/**
 * Test environment setup.
 *
 * jsdom lacks a few browser APIs the shell depends on (matchMedia, ResizeObserver
 * for Recharts, scrollIntoView). They are stubbed here so tests exercise real
 * component behaviour rather than skipping rendering.
 */

beforeEach(() => {
  // Mutations (approvals, retries, scope changes) must not leak between tests.
  resetMockState()
  window.localStorage.clear()
  // Seed a session so AuthProvider restores an admin user and the shell renders.
  window.localStorage.setItem('smartcorp.auth.token', 'mock.jwt.usr_1.test')
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as never)

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined
}
