/**
 * SmartCorp AI — data hooks.
 *
 * One hook per API resource. Components read from these instead of calling
 * services directly, which keeps loading/error/empty handling consistent and
 * keeps transport concerns out of the view layer.
 */

import {
  agentService,
  analyticsService,
  approvalService,
  authService,
  auditService,
  chatService,
  decisionService,
  evaluationService,
  knowledgeService,
  meetingService,
  notificationService,
  securityService,
  taskService,
  userService,
} from '@/services'
import { useAsyncQuery } from './use-async'

/* -- Identity -------------------------------------------------------------- */

export function useUsers() {
  return useAsyncQuery(() => userService.list(), [])
}

/**
 * Demo aid: the identities available to sign in as. Returns an empty list when
 * the environment does not expose one (e.g. SSO-only production).
 */
export function useDemoAccounts() {
  return useAsyncQuery(() => authService.demoAccounts(), [])
}

export function useRoleDefinitions() {
  return useAsyncQuery(() => userService.roles(), [])
}

/* -- Knowledge ------------------------------------------------------------- */

export function useKnowledgeBases() {
  return useAsyncQuery(() => knowledgeService.listBases(), [])
}

export function useKnowledgeBase(id?: string) {
  return useAsyncQuery(() => (id ? knowledgeService.getBase(id) : Promise.resolve(null)), [id], { enabled: Boolean(id) })
}

export function useDocuments(params?: { knowledgeBaseId?: string }) {
  return useAsyncQuery(() => knowledgeService.listDocuments(params), [params?.knowledgeBaseId])
}

export function useDocument(id?: string) {
  return useAsyncQuery(() => (id ? knowledgeService.getDocument(id) : Promise.resolve(null)), [id], { enabled: Boolean(id) })
}

/* -- Assistant ------------------------------------------------------------- */

export function useConversations() {
  return useAsyncQuery(() => chatService.listConversations(), [])
}

export function useConversationMessages(conversationId?: string) {
  return useAsyncQuery(
    () => (conversationId ? chatService.getMessages(conversationId) : Promise.resolve([])),
    [conversationId],
    { enabled: Boolean(conversationId) },
  )
}

/* -- Agents ---------------------------------------------------------------- */

export function useAgents() {
  return useAsyncQuery(() => agentService.list(), [])
}

export function useAgent(id?: string) {
  return useAsyncQuery(() => (id ? agentService.get(id) : Promise.resolve(null)), [id], { enabled: Boolean(id) })
}

export function useAgentRuns(agentId?: string) {
  return useAsyncQuery(() => agentService.listRuns(agentId ? { agentId } : undefined), [agentId])
}

export function useAgentRun(id?: string) {
  return useAsyncQuery(() => (id ? agentService.getRun(id) : Promise.resolve(null)), [id], { enabled: Boolean(id) })
}

/* -- Decisions, approvals and tasks ---------------------------------------- */

export function useDecisions() {
  return useAsyncQuery(() => decisionService.list(), [])
}

export function useDecision(id?: string) {
  return useAsyncQuery(() => (id ? decisionService.get(id) : Promise.resolve(null)), [id], { enabled: Boolean(id) })
}

export function useApprovals() {
  return useAsyncQuery(() => approvalService.list(), [])
}

export function useApproval(id?: string) {
  return useAsyncQuery(() => (id ? approvalService.get(id) : Promise.resolve(null)), [id], { enabled: Boolean(id) })
}

export function useTasks() {
  return useAsyncQuery(() => taskService.list(), [])
}

export function useDecisionTasks(decisionId?: string) {
  return useAsyncQuery(
    () => (decisionId ? taskService.listForDecision(decisionId) : Promise.resolve([])),
    [decisionId],
    { enabled: Boolean(decisionId) },
  )
}

/* -- Intelligence ---------------------------------------------------------- */

export function useEvaluationRuns() {
  return useAsyncQuery(() => evaluationService.listRuns(), [])
}

export function useEvaluationRun(id?: string) {
  return useAsyncQuery(() => (id ? evaluationService.getRun(id) : Promise.resolve(null)), [id], { enabled: Boolean(id) })
}

export function useAnalytics(window?: string) {
  return useAsyncQuery(() => analyticsService.snapshot(window ? { window } : undefined), [window])
}

export function useMeetings() {
  return useAsyncQuery(() => meetingService.list(), [])
}

export function useMeeting(id?: string) {
  return useAsyncQuery(() => (id ? meetingService.get(id) : Promise.resolve(null)), [id], { enabled: Boolean(id) })
}

/* -- Governance ------------------------------------------------------------ */

export function useAuditEvents() {
  return useAsyncQuery(() => auditService.list(), [])
}

export function useSecurityOverview() {
  return useAsyncQuery(() => securityService.overview(), [])
}

export function useNotifications() {
  return useAsyncQuery(() => notificationService.list(), [])
}
