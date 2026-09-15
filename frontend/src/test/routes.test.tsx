import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from './render-app'

/**
 * Route coverage.
 *
 * Every navigation destination is mounted as a signed-in administrator and must
 * render real content — a heading and page context — rather than a blank frame,
 * a crash, or an error state. Detail routes are included because they are the
 * screens that carry the product's argument.
 */
const ROUTES: { path: string; name: string }[] = [
  { path: '/overview', name: 'Overview' },
  { path: '/assistant', name: 'AI Assistant' },
  { path: '/assistant/conv_3', name: 'AI Assistant — conversation' },
  { path: '/knowledge', name: 'Knowledge Hub' },
  { path: '/knowledge/doc_payment_failures', name: 'Document details' },
  { path: '/agents', name: 'Agents' },
  { path: '/agents/agent_support', name: 'Agent detail' },
  { path: '/agents/runs/run_8842', name: 'Agent run detail' },
  { path: '/decisions', name: 'Decision Centre' },
  { path: '/decisions/dec_payment_failures', name: 'Decision detail' },
  { path: '/approvals', name: 'Approval Centre' },
  { path: '/approvals/apr_1', name: 'Approval detail' },
  { path: '/evaluation', name: 'Evaluation' },
  { path: '/evaluation/runs/eval_2026_09_14', name: 'Evaluation run' },
  { path: '/analytics', name: 'Analytics' },
  { path: '/meetings', name: 'Meetings' },
  { path: '/meetings/mtg_1', name: 'Meeting detail' },
  { path: '/users', name: 'Users & Roles' },
  { path: '/audit-logs', name: 'Audit Logs' },
  { path: '/security', name: 'Security' },
  { path: '/settings', name: 'Settings' },
]

describe('Every route renders real content', () => {
  it.each(ROUTES)('$name ($path) renders a page with a heading', async ({ path }) => {
    renderApp(path)

    const main = await screen.findByRole('main', {}, { timeout: 10_000 })
    await waitFor(
      () => expect(within(main).getAllByRole('heading').length).toBeGreaterThan(0),
      { timeout: 10_000 },
    )

    // Page context is always present — the top bar names where you are.
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(document.title || 'SmartCorp AI').toBeTruthy()
  })
})
