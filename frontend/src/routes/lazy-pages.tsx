import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Skeleton } from '@/components/ui/states'
import { PageBody } from '@/components/ui/primitives'

/**
 * Route-level code splitting.
 *
 * The shell (sidebar, topbar, command palette) loads eagerly because it is on
 * every screen. Pages are split so an enterprise first paint stays fast even as
 * the surface area grows — a reviewer opening the Decisions queue should not pay
 * for the evaluation harness bundle.
 *
 * Each lazy page renders inside a matching skeleton so the transition reads as
 * loading content, never a blank canvas.
 */

function PageFallback() {
  return (
    <PageBody className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-3.5 w-[420px] max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[92px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[320px] rounded-lg" />
    </PageBody>
  )
}

/** Wraps a lazily imported page with its own suspense boundary. */
export function withPageSuspense(Component: ComponentType) {
  return function SuspendedPage(): ReactNode {
    return (
      <Suspense fallback={<PageFallback />}>
        <Component />
      </Suspense>
    )
  }
}

export const LazyOverviewPage = lazy(() => import('@/pages/overview').then((module) => ({ default: module.OverviewPage })))
export const LazyAssistantPage = lazy(() => import('@/pages/assistant').then((module) => ({ default: module.AssistantPage })))
export const LazyKnowledgePage = lazy(() => import('@/pages/knowledge').then((module) => ({ default: module.KnowledgePage })))
export const LazyDocumentDetailPage = lazy(() => import('@/pages/document-detail').then((module) => ({ default: module.DocumentDetailPage })))
export const LazyAgentsPage = lazy(() => import('@/pages/agents').then((module) => ({ default: module.AgentsPage })))
export const LazyAgentDetailPage = lazy(() => import('@/pages/agent-detail').then((module) => ({ default: module.AgentDetailPage })))
export const LazyAgentRunDetailPage = lazy(() => import('@/pages/agent-run-detail').then((module) => ({ default: module.AgentRunDetailPage })))
export const LazyDecisionsPage = lazy(() => import('@/pages/decisions').then((module) => ({ default: module.DecisionsPage })))
export const LazyDecisionDetailPage = lazy(() => import('@/pages/decision-detail').then((module) => ({ default: module.DecisionDetailPage })))
export const LazyApprovalsPage = lazy(() => import('@/pages/approvals').then((module) => ({ default: module.ApprovalsPage })))
export const LazyApprovalDetailPage = lazy(() => import('@/pages/approval-detail').then((module) => ({ default: module.ApprovalDetailPage })))
export const LazyEvaluationPage = lazy(() => import('@/pages/evaluation').then((module) => ({ default: module.EvaluationPage })))
export const LazyEvaluationRunPage = lazy(() => import('@/pages/evaluation-run').then((module) => ({ default: module.EvaluationRunPage })))
export const LazyAnalyticsPage = lazy(() => import('@/pages/analytics').then((module) => ({ default: module.AnalyticsPage })))
export const LazyMeetingsPage = lazy(() => import('@/pages/meetings').then((module) => ({ default: module.MeetingsPage })))
export const LazyMeetingDetailPage = lazy(() => import('@/pages/meeting-detail').then((module) => ({ default: module.MeetingDetailPage })))
export const LazyUsersPage = lazy(() => import('@/pages/users').then((module) => ({ default: module.UsersPage })))
export const LazyAuditLogsPage = lazy(() => import('@/pages/audit-logs').then((module) => ({ default: module.AuditLogsPage })))
export const LazySecurityPage = lazy(() => import('@/pages/security').then((module) => ({ default: module.SecurityPage })))
export const LazySettingsPage = lazy(() => import('@/pages/settings').then((module) => ({ default: module.SettingsPage })))
