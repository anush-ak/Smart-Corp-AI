/**
 * SmartCorp AI — service modules.
 *
 * Every function here maps to one Django REST endpoint. UI components consume
 * these through hooks (`src/hooks`) and never call the transport directly, so
 * connecting the live API requires no component changes.
 */

import { request } from './api-client'
import './mocks/handlers'
import type {
  AgentRun,
  AgentSummary,
  AnalyticsSnapshot,
  ApprovalRequest,
  AuditEvent,
  Conversation,
  ConversationMessage,
  Decision,
  EvaluationRun,
  KnowledgeBase,
  KnowledgeDocument,
  Meeting,
  Notification,
  Organization,
  RoleDefinition,
  SecurityOverview,
  Task,
  User,
} from '@/types'

/* -------------------------------------------------------------------------- */
/* /api/auth/  ·  /api/organizations/  ·  /api/users/                          */
/* -------------------------------------------------------------------------- */

/** Shape returned by every auth endpoint (DRF: /api/auth/*). */
export interface AuthSession {
  token?: string
  user: User
  organization: Organization
  roles: RoleDefinition[]
}

export const authService = {
  /**
   * Demo aid only. Lists the identities the demo can sign in as and the
   * organisation they belong to; a real deployment authenticates via SSO and
   * removes this endpoint entirely.
   */
  demoAccounts: () =>
    request<{ users: User[]; organization: Organization }>({
      endpoint: 'auth.demoAccounts',
      path: '/auth/demo-accounts/',
    }),

  login: (email: string, password: string) =>
    request<AuthSession>({
      endpoint: 'auth.login',
      method: 'post',
      path: '/auth/login/',
      body: { email, password },
    }),

  session: () =>
    request<AuthSession>({
      endpoint: 'auth.session',
      path: '/auth/session/',
    }),

  switchRole: (userId: string) =>
    request<AuthSession>({
      endpoint: 'auth.switchRole',
      method: 'post',
      path: '/auth/switch-role/',
      body: { userId },
    }),

  logout: () =>
    request<{ detail: string }>({
      endpoint: 'auth.session',
      method: 'post',
      path: '/auth/logout/',
      mockPayload: { detail: 'ok' },
    }),
}

export const organizationService = {
  current: () => request<Organization>({ endpoint: 'organizations.current', path: '/organizations/current/' }),
}

export const userService = {
  list: () => request<User[]>({ endpoint: 'users.list', path: '/users/' }),
  roles: () => request<RoleDefinition[]>({ endpoint: 'users.roles', path: '/users/roles/' }),
  updateScope: (payload: { userId: string; role?: User['role']; knowledgeScope?: string[]; agentScope?: string[] }) =>
    request<User>({ endpoint: 'users.updateScope', method: 'patch', path: `/users/${payload.userId}/scope/`, body: payload }),
}

/* -------------------------------------------------------------------------- */
/* /api/knowledge-bases/  ·  /api/documents/                                   */
/* -------------------------------------------------------------------------- */

export const knowledgeService = {
  listBases: () => request<KnowledgeBase[]>({ endpoint: 'knowledge.bases', path: '/knowledge-bases/' }),

  getBase: (id: string) =>
    request<KnowledgeBase | null>({ endpoint: 'knowledge.base', path: `/knowledge-bases/${id}/`, params: { id } }),

  createBase: (payload: { name: string; description: string; department: string; accessLevel: string }) =>
    request<KnowledgeBase>({ endpoint: 'knowledge.createBase', method: 'post', path: '/knowledge-bases/', body: payload }),

  listDocuments: (params?: { knowledgeBaseId?: string }) =>
    request<KnowledgeDocument[]>({ endpoint: 'knowledge.documents', path: '/documents/', params }),

  getDocument: (id: string) =>
    request<KnowledgeDocument | null>({ endpoint: 'knowledge.document', path: `/documents/${id}/`, params: { id } }),

  upload: (payload: {
    name: string
    sizeBytes: number
    extension: KnowledgeDocument['extension']
    knowledgeBaseId: string
    file?: File
  }) =>
    request<KnowledgeDocument>({
      endpoint: 'knowledge.upload',
      method: 'post',
      path: '/documents/',
      // Multipart in the live API; the mock only needs the metadata envelope.
      body: payload,
    }),

  retryProcessing: (id: string) =>
    request<KnowledgeDocument | null>({
      endpoint: 'knowledge.retry',
      method: 'post',
      path: `/documents/${id}/retry/`,
      body: { id },
    }),
}

/* -------------------------------------------------------------------------- */
/* /api/chat/  ·  /api/rag/                                                    */
/* -------------------------------------------------------------------------- */

export const chatService = {
  listConversations: () => request<Conversation[]>({ endpoint: 'chat.conversations', path: '/chat/conversations/' }),

  getMessages: (conversationId: string) =>
    request<ConversationMessage[]>({
      endpoint: 'chat.messages',
      path: `/chat/conversations/${conversationId}/messages/`,
      params: { conversationId },
    }),

  ask: (payload: { question: string; conversationId?: string }) =>
    request<AgentRun>({ endpoint: 'chat.ask', method: 'post', path: '/chat/', body: payload }),
}

/* -------------------------------------------------------------------------- */
/* /api/agents/                                                                */
/* -------------------------------------------------------------------------- */

export const agentService = {
  list: () => request<AgentSummary[]>({ endpoint: 'agents.list', path: '/agents/' }),

  get: (id: string) => request<AgentSummary | null>({ endpoint: 'agents.detail', path: `/agents/${id}/`, params: { id } }),

  listRuns: (params?: { agentId?: string }) =>
    request<AgentRun[]>({ endpoint: 'agents.runs', path: '/agents/runs/', params }),

  getRun: (id: string) => request<AgentRun>({ endpoint: 'agents.run.detail', path: `/agents/runs/${id}/`, params: { id } }),

  setStatus: (agentId: string, status: AgentSummary['status']) =>
    request<AgentSummary>({ endpoint: 'agents.setStatus', method: 'post', path: `/agents/${agentId}/status/`, body: { agentId, status } }),
}

/* -------------------------------------------------------------------------- */
/* /api/decisions/  ·  /api/approvals/  ·  /api/tasks/                          */
/* -------------------------------------------------------------------------- */

export const decisionService = {
  list: () => request<Decision[]>({ endpoint: 'decisions.list', path: '/decisions/' }),

  get: (id: string) => request<Decision | null>({ endpoint: 'decisions.detail', path: `/decisions/${id}/`, params: { id } }),

  resolve: (payload: { id: string; outcome: 'approved' | 'rejected' | 'needs_evidence'; note: string; by: string }) =>
    request<Decision | null>({ endpoint: 'decisions.resolve', method: 'post', path: `/decisions/${payload.id}/resolve/`, body: payload }),
}

export const approvalService = {
  list: () => request<ApprovalRequest[]>({ endpoint: 'approvals.list', path: '/approvals/' }),

  get: (id: string) =>
    request<ApprovalRequest | null>({ endpoint: 'approvals.detail', path: `/approvals/${id}/`, params: { id } }),

  comment: (payload: { id: string; author: string; role: string; body: string }) =>
    request<ApprovalRequest | null>({ endpoint: 'approvals.comment', method: 'post', path: `/approvals/${payload.id}/comments/`, body: payload }),
}

export const taskService = {
  list: () => request<Task[]>({ endpoint: 'tasks.list', path: '/tasks/' }),

  listForDecision: (decisionId: string) =>
    request<Task[]>({ endpoint: 'tasks.forDecision', path: `/tasks/?decision=${decisionId}`, params: { decisionId } }),
}

/* -------------------------------------------------------------------------- */
/* /api/evaluations/  ·  /api/analytics/  ·  /api/meetings/                     */
/* -------------------------------------------------------------------------- */

export const evaluationService = {
  listRuns: () => request<EvaluationRun[]>({ endpoint: 'evaluations.runs', path: '/evaluations/' }),

  getRun: (id: string) => request<EvaluationRun | null>({ endpoint: 'evaluations.run', path: `/evaluations/${id}/`, params: { id } }),

  startRun: (payload?: { datasetId?: string }) =>
    request<{ id: string; status: EvaluationRun['status'] }>({
      endpoint: 'evaluations.start',
      method: 'post',
      path: '/evaluations/',
      body: payload ?? {},
    }),
}

export const analyticsService = {
  snapshot: (params?: { window?: string }) =>
    request<AnalyticsSnapshot>({ endpoint: 'analytics.snapshot', path: '/analytics/', params }),
}

export const meetingService = {
  list: () => request<Meeting[]>({ endpoint: 'meetings.list', path: '/meetings/' }),
  get: (id: string) => request<Meeting | null>({ endpoint: 'meetings.detail', path: `/meetings/${id}/`, params: { id } }),
}

/* -------------------------------------------------------------------------- */
/* /api/audit-logs/  ·  /api/security/  ·  /api/notifications/                 */
/* -------------------------------------------------------------------------- */

export const auditService = {
  list: () => request<AuditEvent[]>({ endpoint: 'audit.list', path: '/audit-logs/' }),
}

export const securityService = {
  overview: () => request<SecurityOverview>({ endpoint: 'security.overview', path: '/security/' }),
}

export const notificationService = {
  list: () => request<Notification[]>({ endpoint: 'notifications.list', path: '/notifications/' }),
  markRead: (payload: { id?: string; all?: boolean }) =>
    request<Notification[]>({ endpoint: 'notifications.read', method: 'post', path: '/notifications/read/', body: payload }),
}
