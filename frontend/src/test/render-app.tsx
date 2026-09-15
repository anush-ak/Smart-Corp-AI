import { render, type RenderResult } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from '@/app/App'
import { AuthProvider } from '@/contexts/auth-context'
import { ToastProvider } from '@/components/ui/toast'

/**
 * Renders the real application at a given route, with the same provider stack
 * used in `main.tsx`. Tests therefore exercise routing, guards, services and the
 * mock adapter exactly as the shipped app does.
 */
export function renderApp(route = '/overview'): RenderResult {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}
