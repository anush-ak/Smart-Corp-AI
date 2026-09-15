import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell, SkipLink } from '@/layouts/app-shell'
import { RequireAuth, RequirePermission } from '@/routes/guards'
import {
  LazyAgentDetailPage,
  LazyAgentRunDetailPage,
  LazyAgentsPage,
  LazyAnalyticsPage,
  LazyApprovalDetailPage,
  LazyApprovalsPage,
  LazyAuditLogsPage,
  LazyDecisionDetailPage,
  LazyDecisionsPage,
  LazyDocumentDetailPage,
  LazyEvaluationPage,
  LazyEvaluationRunPage,
  LazyKnowledgePage,
  LazyMeetingDetailPage,
  LazyMeetingsPage,
  LazyOverviewPage,
  LazySecurityPage,
  LazySettingsPage,
  LazyUsersPage,
  LazyAssistantPage,
  withPageSuspense,
} from '@/routes/lazy-pages'
import { NotFoundPage } from '@/pages/not-found'
import { LoginPage } from '@/pages/login'

/* Pages are lazily imported and wrapped with a page-shaped loading state. */
const Overview = withPageSuspense(LazyOverviewPage)
const Assistant = withPageSuspense(LazyAssistantPage)
const Knowledge = withPageSuspense(LazyKnowledgePage)
const DocumentDetail = withPageSuspense(LazyDocumentDetailPage)
const Agents = withPageSuspense(LazyAgentsPage)
const AgentDetail = withPageSuspense(LazyAgentDetailPage)
const AgentRunDetail = withPageSuspense(LazyAgentRunDetailPage)
const Decisions = withPageSuspense(LazyDecisionsPage)
const DecisionDetail = withPageSuspense(LazyDecisionDetailPage)
const Approvals = withPageSuspense(LazyApprovalsPage)
const ApprovalDetail = withPageSuspense(LazyApprovalDetailPage)
const Evaluation = withPageSuspense(LazyEvaluationPage)
const EvaluationRun = withPageSuspense(LazyEvaluationRunPage)
const Analytics = withPageSuspense(LazyAnalyticsPage)
const Meetings = withPageSuspense(LazyMeetingsPage)
const MeetingDetail = withPageSuspense(LazyMeetingDetailPage)
const Users = withPageSuspense(LazyUsersPage)
const AuditLogs = withPageSuspense(LazyAuditLogsPage)
const Security = withPageSuspense(LazySecurityPage)
const Settings = withPageSuspense(LazySettingsPage)

/**
 * Route map.
 *
 * The journey the product is designed around runs in this order:
 * login → overview → ask AI → router → retrieval → evidence → recommendation →
 * decision → human approval → action → audit → evaluation.
 *
 * Every protected route declares the capability required to open it. The guard is
 * a usability affordance only — the Django API validates the same permission on
 * the request, and the retrieval layer filters knowledge by scope before ranking.
 */
export function App() {
  return (
    <>
      <SkipLink />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/overview" replace />} />

          {/* Workspace ---------------------------------------------------- */}
          <Route
            path="/overview"
            element={
              <RequirePermission permission="overview:view">
                <Overview />
              </RequirePermission>
            }
          />
          <Route
            path="/assistant"
            element={
              <RequirePermission permission="assistant:use">
                <Assistant />
              </RequirePermission>
            }
          />
          <Route
            path="/assistant/:conversationId"
            element={
              <RequirePermission permission="assistant:use">
                <Assistant />
              </RequirePermission>
            }
          />
          <Route
            path="/knowledge"
            element={
              <RequirePermission permission="knowledge:view">
                <Knowledge />
              </RequirePermission>
            }
          />
          <Route
            path="/knowledge/:documentId"
            element={
              <RequirePermission permission="knowledge:view">
                <DocumentDetail />
              </RequirePermission>
            }
          />
          <Route
            path="/agents"
            element={
              <RequirePermission permission="agents:view">
                <Agents />
              </RequirePermission>
            }
          />
          <Route
            path="/agents/runs/:runId"
            element={
              <RequirePermission permission="agents:view">
                <AgentRunDetail />
              </RequirePermission>
            }
          />
          <Route
            path="/agents/:agentId"
            element={
              <RequirePermission permission="agents:view">
                <AgentDetail />
              </RequirePermission>
            }
          />
          <Route
            path="/decisions"
            element={
              <RequirePermission permission="decisions:view">
                <Decisions />
              </RequirePermission>
            }
          />
          <Route
            path="/decisions/:decisionId"
            element={
              <RequirePermission permission="decisions:view">
                <DecisionDetail />
              </RequirePermission>
            }
          />
          <Route
            path="/approvals"
            element={
              <RequirePermission permission="approvals:view">
                <Approvals />
              </RequirePermission>
            }
          />
          <Route
            path="/approvals/:approvalId"
            element={
              <RequirePermission permission="approvals:view">
                <ApprovalDetail />
              </RequirePermission>
            }
          />

          {/* Intelligence ------------------------------------------------- */}
          <Route
            path="/evaluation"
            element={
              <RequirePermission permission="evaluation:view">
                <Evaluation />
              </RequirePermission>
            }
          />
          <Route
            path="/evaluation/runs/:runId"
            element={
              <RequirePermission permission="evaluation:view">
                <EvaluationRun />
              </RequirePermission>
            }
          />
          <Route
            path="/analytics"
            element={
              <RequirePermission permission="analytics:view">
                <Analytics />
              </RequirePermission>
            }
          />
          <Route
            path="/meetings"
            element={
              <RequirePermission permission="meetings:view">
                <Meetings />
              </RequirePermission>
            }
          />
          <Route
            path="/meetings/:meetingId"
            element={
              <RequirePermission permission="meetings:view">
                <MeetingDetail />
              </RequirePermission>
            }
          />

          {/* Governance --------------------------------------------------- */}
          <Route
            path="/users"
            element={
              <RequirePermission permission="users:view">
                <Users />
              </RequirePermission>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <RequirePermission permission="audit:view">
                <AuditLogs />
              </RequirePermission>
            }
          />
          <Route
            path="/security"
            element={
              <RequirePermission permission="security:view">
                <Security />
              </RequirePermission>
            }
          />
          <Route
            path="/settings"
            element={
              <RequirePermission permission="settings:manage" fallbackPermission="overview:view">
                <Settings />
              </RequirePermission>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  )
}
