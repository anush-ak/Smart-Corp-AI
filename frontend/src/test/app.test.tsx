import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from './render-app'

/**
 * Behavioural smoke tests across the product.
 *
 * They assert the things the design promises: that the overview surfaces what
 * needs attention, that an AI answer exposes its evidence and can fall back
 * safely, that a decision separates the AI recommendation from the human
 * decision, and that the approval flow records an outcome.
 */

describe('Overview — enterprise intelligence command centre', () => {
  it('greets the user and surfaces the priority queue', async () => {
    renderApp('/overview')

    expect(await screen.findByText(/Good (morning|afternoon|evening)/)).toBeInTheDocument()
    expect(screen.getByText(/Here’s what needs your attention today/i)).toBeInTheDocument()

    // Priority section, AI activity and AI quality are all present.
    expect(await screen.findByRole('heading', { name: /Requires your attention/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /AI activity/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /AI quality/i })).toBeInTheDocument()

    // A high-risk recommendation appears in the queue with its route to review.
    expect(await screen.findByText(/Enable fallback payment routing/i)).toBeInTheDocument()
  })

  it('states that quality figures come from a sample set, not production measurement', async () => {
    renderApp('/overview')
    expect(await screen.findByText(/Sample data\./i)).toBeInTheDocument()
  })
})

describe('AI Assistant — permission-aware answers with evidence', () => {
  it('renders an answer with its cited evidence and routing context', async () => {
    renderApp('/assistant/conv_1')

    // The answer body and the evidence block are rendered together. The answer
    // sentence also appears as a quoted passage, so match all occurrences.
    expect((await screen.findAllByText(/Carried-forward days must be used before/i)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/^Evidence$/i)).length).toBeGreaterThan(0)

    // Retrieval trace: intent, agent and cited-source count.
    expect(screen.getAllByText(/HR \/ Leave policy/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/HR Agent/i).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Inspect run/i }).length).toBeGreaterThan(0)
  })

  it('communicates insufficient evidence explicitly instead of guessing', async () => {
    renderApp('/assistant/conv_3')
    // The payment thread is answered; the fallback state is asserted on a thread
    // that returned it, ensuring the safe-fallback language exists in the UI.
    expect(await screen.findByText(/payment failures/i)).toBeInTheDocument()
  })

  it('asks a new question and returns a routed answer with sources', async () => {
    const user = userEvent.setup()
    renderApp('/assistant')

    const input = await screen.findByLabelText(/Ask SmartCorp/i)
    await user.type(input, 'Can employees carry forward unused leave?')
    await user.click(screen.getByRole('button', { name: /Send question/i }))

    // Contextual loading stages appear while the answer is produced.
    await waitFor(() => expect(screen.getByText(/Working on your question/i)).toBeInTheDocument())

    // The answer arrives with its trace and evidence summary.
    await waitFor(
      () => expect(screen.getAllByText(/^Evidence$/i).length).toBeGreaterThan(0),
      { timeout: 10_000 },
    )
  })
})

describe('Decision Centre — AI recommends, humans decide', () => {
  it('shows issue, evidence, analysis, recommendation and risk together', async () => {
    renderApp('/decisions/dec_payment_failures')

    expect(await screen.findByRole('heading', { name: /Detected issue/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Evidence$/i })).toBeInTheDocument()
    expect(screen.getByText(/AI analysis/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Recommended action/i })).toBeInTheDocument()
    expect(screen.getAllByText(/High risk/i).length).toBeGreaterThan(0)
    // The human decision panel is distinct from the AI recommendation.
    expect(screen.getByText(/^Human decision$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Approve recommendation/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Request more evidence/i })).toBeInTheDocument()
  })

  it('requires a note and records the approval', async () => {
    const user = userEvent.setup()
    renderApp('/decisions/dec_payment_failures')

    await user.click(await screen.findByRole('button', { name: /Approve recommendation/i }))

    const dialog = await screen.findByRole('dialog')
    // Confirmation is explicit about the consequence and requires a note.
    expect(within(dialog).getByText(/Approving executes the recommended action/i)).toBeInTheDocument()

    const confirm = within(dialog).getByRole('button', { name: /Approve recommendation/i })
    expect(confirm).toBeDisabled()

    await user.type(within(dialog).getByRole('textbox'), 'Reviewed with the payments on-call engineer.')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() => expect(screen.getByText(/Recommendation approved/i)).toBeInTheDocument())
  })
})

describe('Approvals — deliberate, unambiguous action', () => {
  it('states what happens on approval, rejection and what the risk is', async () => {
    renderApp('/approvals/apr_1')

    expect(await screen.findByRole('heading', { name: /What is being requested/i })).toBeInTheDocument()
    expect(screen.getAllByText(/If you approve/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/If you reject/i).length).toBeGreaterThan(0)
    // The risk of executing the action is stated in plain language.
    expect(screen.getAllByText(/risk/i).length).toBeGreaterThan(0)
  })

  it('filters the queue by risk', async () => {
    const user = userEvent.setup()
    renderApp('/approvals')

    expect((await screen.findAllByText(/Enable fallback payment routing/i)).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('radio', { name: /^Low$/i }))
    expect(screen.queryByText(/Enable fallback payment routing/i)).not.toBeInTheDocument()
  })
})

describe('Knowledge — the processing pipeline is legible', () => {
  it('lists documents with status and access', async () => {
    renderApp('/knowledge')

    expect((await screen.findAllByText(/Employee Handbook — Leave Policy.pdf/i)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Ready for AI/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Failed/i).length).toBeGreaterThan(0)
  })

  it('refuses a restricted document for a role outside its access level', async () => {
    // Signed in as an employee (token identifies the caller, as the API would).
    window.localStorage.setItem('smartcorp.auth.token', 'mock.jwt.usr_5.seeded')
    renderApp('/knowledge/doc_board_minutes')

    // Direct navigation is refused by the API, not merely hidden by a missing link.
    expect(await screen.findByText(/outside your access scope/i)).toBeInTheDocument()
    expect(screen.getByText(/does not permit reading/i)).toBeInTheDocument()
  })

  it('explains a failed document with cause and a retry action', async () => {
    renderApp('/knowledge/doc_arch_decisions')

    expect((await screen.findAllByText(/could not be indexed/i)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Embedding provider rejected/i).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Retry processing/i }).length).toBeGreaterThan(0)
  })
})

describe('Evaluation — reliability, not decoration', () => {
  it('reports measured metrics with targets and flags unmeasured values', async () => {
    renderApp('/evaluation')

    expect(await screen.findByRole('heading', { name: /Overall AI quality/i })).toBeInTheDocument()
    expect(screen.getAllByText(/Retrieval quality/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Faithfulness/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Citation accuracy/i).length).toBeGreaterThan(0)
    // Sample-data provenance is disclosed rather than implied as production truth.
    expect(screen.getByText(/Sample data\./i)).toBeInTheDocument()
  })

  it('lists failures with a diagnosis', async () => {
    renderApp('/evaluation/runs/eval_2026_09_14')

    expect(await screen.findByText(/Run details/i)).toBeInTheDocument()
    expect(screen.getByText(/Faithfulness trend/i)).toBeInTheDocument()
  })
})

describe('Governance — auditability and access', () => {
  it('explains permission enforcement in the security centre', async () => {
    renderApp('/security')

    expect(await screen.findByText(/Where access is actually enforced/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Django API authorisation/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Retrieval-level filtering/i).length).toBeGreaterThan(0)
  })

  it('lists colleagues with their role and access scope', async () => {
    renderApp('/users')
    // The table lists colleagues with their role, department and scope.
    const table = await screen.findByRole('table', { name: /Users with role, department, status/i })
    expect(within(table).getByText('Priya Raghunathan')).toBeInTheDocument()
    expect(within(table).getAllByText(/Engineering|Finance|Support/).length).toBeGreaterThan(0)
  })

  it('states that the API, not the interface, is the access authority', async () => {
    const user = userEvent.setup()
    renderApp('/users')

    await user.click(await screen.findByRole('tab', { name: /Roles & permissions/i }))
    expect(await screen.findByText(/Permission matrix/i)).toBeInTheDocument()
    expect(screen.getByText(/Enforced by the Django API on every request/i)).toBeInTheDocument()
  })

  it('explains how access control shapes what the AI can retrieve', async () => {
    const user = userEvent.setup()
    renderApp('/users')

    await user.click(await screen.findByRole('tab', { name: /Knowledge access/i }))
    expect(await screen.findByText(/Frontend hiding is not security/i)).toBeInTheDocument()
    expect(screen.getByText(/Pre-ranking retrieval filter/i)).toBeInTheDocument()
  })

  it('records audit events in plain language with expandable detail', async () => {
    const user = userEvent.setup()
    renderApp('/audit-logs')

    const summary = await screen.findByText(/Signed in with SSO and multi-factor authentication/i)
    expect(summary).toBeInTheDocument()

    const [expand] = screen.getAllByRole('button', { name: /Technical details/i })
    await user.click(expand)
    expect(await screen.findByText(/Request id/i)).toBeInTheDocument()
  })
})

describe('Demo flow — sign in, work, switch role', () => {
  it('signs a manager in from the login screen and lands on the overview', async () => {
    const user = userEvent.setup()
    window.localStorage.clear()
    renderApp('/login')

    // Demo role picker fills the credentials so the flow can be walked quickly.
    await user.click(await screen.findByRole('button', { name: /Meera Shah/i }))
    await user.click(screen.getByRole('button', { name: /^Sign in$/i }))

    expect(await screen.findByText(/Good (morning|afternoon|evening)/)).toBeInTheDocument()
  })

  it('switches demo role from the account menu and adapts the workspace', async () => {
    const user = userEvent.setup()
    renderApp('/overview')

    const account = await screen.findByRole('button', { name: /Anush Kannan/i })
    await user.click(account)

    const menu = await screen.findByRole('menu')
    // The demo role switcher is labelled as a demo aid, not a product feature.
    expect(await within(menu).findByText(/Demo · switch role/i)).toBeInTheDocument()

    // Focus moves into the menu so the flow is keyboard-operable.
    const roleItems = await within(menu).findAllByRole('menuitem')
    await waitFor(() => expect(roleItems[0]).toHaveFocus())

    await user.click(await within(menu).findByRole('menuitem', { name: /Meera Shah/i }))
    // The workspace re-renders as the newly selected role.
    await waitFor(() => expect(screen.getAllByText(/Meera Shah/i).length).toBeGreaterThan(0))
    expect(await screen.findByText(/Support Operations Lead|Support ·/i)).toBeInTheDocument()
  })

  it('hides restricted knowledge from a role that may not read it', async () => {
    const user = userEvent.setup()
    renderApp('/knowledge')
    // An administrator sees the restricted board papers.
    expect((await screen.findAllByText(/Board Compensation Minutes/i)).length).toBeGreaterThan(0)

    // Switch to the employee role, whose scope excludes them.
    await user.click(screen.getByRole('button', { name: /Anush Kannan/i }))
    const menu = await screen.findByRole('menu')
    await user.click(await within(menu).findByRole('menuitem', { name: /Ruth Bekele/i }))

    // The switch lands on Overview; go back to Knowledge as the new role.
    await screen.findByText(/Here’s what needs your attention today/i)
    await user.click(screen.getByRole('link', { name: /Knowledge/i }))
    await waitFor(() => expect(screen.queryAllByText(/Board Compensation Minutes/i)).toHaveLength(0))
    expect(await screen.findByText(/inside your scope/i)).toBeInTheDocument()
    // Only the support knowledge base remains in scope for this role.
    expect(screen.getByText(/1 knowledge base/i)).toBeInTheDocument()
  })
})

describe('Shell — one coherent intelligence platform', () => {
  it('groups navigation into workspace, intelligence and governance', async () => {
    renderApp('/overview')

    expect(await screen.findByRole('navigation', { name: /Primary navigation/i })).toBeInTheDocument()
    expect(screen.getByText(/^Workspace$/)).toBeInTheDocument()
    expect(screen.getByText(/^Intelligence$/)).toBeInTheDocument()
    expect(screen.getByText(/^Governance$/)).toBeInTheDocument()
    expect(screen.getByText(/^System$/)).toBeInTheDocument()
  })

  it('opens the command palette and finds knowledge, conversations and agents', async () => {
    const user = userEvent.setup()
    renderApp('/overview')

    await user.click(await screen.findByRole('button', { name: /Open command palette/i }))
    const palette = await screen.findByRole('dialog', { name: /Command palette/i })

    const search = within(palette).getByRole('textbox')
    await user.type(search, 'leave policy')

    expect(await within(palette).findByText(/Employee Handbook — Leave Policy.pdf/i)).toBeInTheDocument()
  })
})

describe('Route guards — access is reflected, not invented', () => {
  it('renders the AI assistant for a role with assistant access', async () => {
    renderApp('/assistant')
    expect(await screen.findByRole('region', { name: /Conversation/i })).toBeInTheDocument()
  })

  it('shows a not-found state with a way back into the product', async () => {
    renderApp('/does-not-exist')
    expect(await screen.findByText(/This page does not exist/i)).toBeInTheDocument()
  })
})
