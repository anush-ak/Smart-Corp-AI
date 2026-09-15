/**
 * SmartCorp AI — mock adapter registry.
 *
 * Registers one handler per logical endpoint. Services call `request()` with an
 * endpoint id; when VITE_USE_MOCK_API is true the adapter resolves from here.
 * Replacing mocks with the Django API is therefore a configuration change.
 */

import { AppError, readToken, registerMocks } from '../api-client'
import {
  MOCK_AGENTS,
  MOCK_APPROVALS,
  MOCK_CONVERSATIONS,
  MOCK_DECISIONS,
  MOCK_DOCUMENTS,
  MOCK_KNOWLEDGE_BASES,
  MOCK_ORGANIZATION,
  MOCK_ROLE_DEFINITIONS,
  MOCK_TASKS,
  MOCK_USERS,
} from './corpus'
import {
  MOCK_AGENT_RUNS,
  MOCK_ANALYTICS,
  MOCK_AUDIT_EVENTS,
  MOCK_EVALUATION_RUNS,
  MOCK_MEETINGS,
  MOCK_NOTIFICATIONS,
  MOCK_SECURITY_OVERVIEW,
  buildConversationMessages,
} from './corpus-intelligence'
import type {
  ApprovalRequest,
  Conversation,
  ConversationMessage,
  Decision,
  KnowledgeBase,
  KnowledgeDocument,
  Notification,
  User,
} from '@/types'

/* -------------------------------------------------------------------------- */
/* Caller identity & permission-aware retrieval                               */
/*                                                                            */
/* The mock API authorises the way the Django API does: it resolves the caller */
/* from the bearer token, then filters knowledge before it is returned. The    */
/* interface reflects that decision — it never makes it.                      */
/* -------------------------------------------------------------------------- */

function currentUser(): User {
  const token = readToken()
  const userId = token?.startsWith('mock.jwt.') ? token.split('.')[2] : undefined
  return MOCK_USERS.find((candidate) => candidate.id === userId) ?? MOCK_USERS[0]
}

function mayReadBase(user: User, base: KnowledgeBase) {
  return user.role === 'admin' || user.knowledgeScope.includes(base.id)
}

function mayReadDocument(user: User, document: KnowledgeDocument) {
  if (user.role === 'admin') return true
  if (!user.knowledgeScope.includes(document.knowledgeBaseId)) return false
  if (document.accessLevel === 'organization') return true
  if (document.accessLevel === 'restricted') return false
  return document.department === user.department
}

/* -------------------------------------------------------------------------- */
/* Mutable session state                                                      */
/* -------------------------------------------------------------------------- */

let decisions: Decision[] = structuredClone(MOCK_DECISIONS)
let approvals: ApprovalRequest[] = structuredClone(MOCK_APPROVALS)
let notifications: Notification[] = structuredClone(MOCK_NOTIFICATIONS)
let documents: KnowledgeDocument[] = structuredClone(MOCK_DOCUMENTS)

export function resetMockState() {
  decisions = structuredClone(MOCK_DECISIONS)
  approvals = structuredClone(MOCK_APPROVALS)
  notifications = structuredClone(MOCK_NOTIFICATIONS)
  documents = structuredClone(MOCK_DOCUMENTS)
}

/* -------------------------------------------------------------------------- */
/* Domain events: mutations also append audit-shaped side effects             */
/* -------------------------------------------------------------------------- */

const generatedEvents: { at: string; summary: string; actor: string; action: string }[] = []

export function takeGeneratedEvents() {
  const events = [...generatedEvents]
  generatedEvents.length = 0
  return events
}

function record(summary: string, actor: string, action: string) {
  generatedEvents.unshift({ at: new Date().toISOString(), summary, actor, action })
}

/* -------------------------------------------------------------------------- */
/* Handlers                                                                   */
/* -------------------------------------------------------------------------- */

registerMocks([
  /* -- Auth & identity ---------------------------------------------------- */
  {
    endpoint: 'auth.login',
    latencyMs: 520,
    resolve: (payload) => {
      const { email } = (payload as { body: { email: string } }).body
      const user = MOCK_USERS.find((candidate) => candidate.email === email) ?? MOCK_USERS[0]
      record(`Signed in as ${user.name}`, user.name, 'login')
      return {
        token: `mock.jwt.${user.id}.${Date.now()}`,
        user,
        organization: MOCK_ORGANIZATION,
        roles: MOCK_ROLE_DEFINITIONS,
      }
    },
  },
  {
    endpoint: 'auth.session',
    latencyMs: 120,
    resolve: () => ({ user: currentUser(), organization: MOCK_ORGANIZATION, roles: MOCK_ROLE_DEFINITIONS }),
  },
  { endpoint: 'auth.switchRole', latencyMs: 240, resolve: (payload) => {
    const { userId } = (payload as { body: { userId: string } }).body
    const user = MOCK_USERS.find((candidate) => candidate.id === userId) ?? MOCK_USERS[0]
    record(`Active session switched to ${user.name} (${user.role})`, user.name, 'login')
    return {
      token: `mock.jwt.${user.id}.${Date.now()}`,
      user,
      organization: MOCK_ORGANIZATION,
      roles: MOCK_ROLE_DEFINITIONS,
    }
  } },
  {
    // Demo aid: the identities the login screen and the role switcher offer.
    // A production deployment replaces this with SSO and exposes no such list.
    endpoint: 'auth.demoAccounts',
    latencyMs: 120,
    resolve: () => ({ users: MOCK_USERS, organization: MOCK_ORGANIZATION }),
  },
  { endpoint: 'organizations.current', resolve: () => MOCK_ORGANIZATION },
  { endpoint: 'users.list', latencyMs: 200, resolve: () => MOCK_USERS },
  { endpoint: 'users.roles', resolve: () => MOCK_ROLE_DEFINITIONS },
  {
    endpoint: 'users.updateScope',
    latencyMs: 320,
    resolve: (payload) => {
      const body = (payload as { body: { userId: string; knowledgeScope?: string[]; agentScope?: string[]; role?: User['role'] } }).body
      const index = MOCK_USERS.findIndex((candidate) => candidate.id === body.userId)
      if (index >= 0) {
        MOCK_USERS[index] = {
          ...MOCK_USERS[index],
          role: body.role ?? MOCK_USERS[index].role,
          knowledgeScope: body.knowledgeScope ?? MOCK_USERS[index].knowledgeScope,
          agentScope: body.agentScope ?? MOCK_USERS[index].agentScope,
        }
        record(
          `Updated access for ${MOCK_USERS[index].name}`,
          'Anush Kannan',
          'permission_changed',
        )
        return MOCK_USERS[index]
      }
      return null
    },
  },

  /* -- Knowledge ---------------------------------------------------------- */
  {
    endpoint: 'knowledge.bases',
    latencyMs: 220,
    resolve: () => {
      const user = currentUser()
      return MOCK_KNOWLEDGE_BASES.filter((base) => mayReadBase(user, base))
    },
  },
  {
    endpoint: 'knowledge.base',
    latencyMs: 200,
    resolve: (payload) => {
      const { id } = (payload as { params: { id: string } }).params
      return MOCK_KNOWLEDGE_BASES.find((base) => base.id === id) ?? null
    },
  },
  {
    endpoint: 'knowledge.documents',
    latencyMs: 260,
    resolve: (payload) => {
      const params = (payload as { params?: { knowledgeBaseId?: string } }).params
      const user = currentUser()
      const visible = documents.filter((document) => mayReadDocument(user, document))
      if (!params?.knowledgeBaseId) return visible
      return visible.filter((document) => document.knowledgeBaseId === params.knowledgeBaseId)
    },
  },
  {
    endpoint: 'knowledge.document',
    latencyMs: 200,
    resolve: (payload) => {
      const { id } = (payload as { params: { id: string } }).params
      const document = documents.find((candidate) => candidate.id === id)
      if (!document) return null
      const user = currentUser()
      if (!mayReadDocument(user, document)) {
        throw new AppError({
          status: 403,
          code: 'permission_denied',
          message: `Your role (${user.role}) does not permit reading “${document.name}”. Retrieval is filtered by access level before ranking.`,
          isNetworkError: false,
        })
      }
      return document
    },
  },
  {
    endpoint: 'knowledge.createBase',
    latencyMs: 420,
    resolve: (payload) => {
      const body = (payload as { body: { name: string; description: string; department: string; accessLevel: string } }).body
      const id = `kb_${body.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24)}`
      record(`Created knowledge base “${body.name}”`, 'Anush Kannan', 'permission_changed')
      return {
        id,
        name: body.name,
        description: body.description,
        department: body.department,
        documentCount: 0,
        chunkCount: 0,
        lastUpdatedAt: new Date().toISOString(),
        accessLevel: body.accessLevel,
        status: 'indexing',
        ownerName: 'Anush Kannan',
        embeddingModel: 'text-embedding-3-large',
        retrievalQuality: null,
        agents: [],
      }
    },
  },
  {
    endpoint: 'knowledge.upload',
    latencyMs: 700,
    resolve: (payload) => {
      const body = (payload as { body: { name: string; knowledgeBaseId: string; sizeBytes: number; extension: KnowledgeDocument['extension'] } }).body
      const document: KnowledgeDocument = {
        id: `doc_${Date.now().toString(36)}`,
        name: body.name,
        extension: body.extension,
        sizeBytes: body.sizeBytes,
        knowledgeBaseId: body.knowledgeBaseId,
        department: 'Operations',
        version: 'v1.0',
        ownerName: 'Anush Kannan',
        status: 'processing',
        accessLevel: 'department',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        pages: 0,
        chunkCount: 0,
        progress: 18,
        pipeline: [
          { key: 'uploaded', label: 'Uploaded', status: 'complete', detail: 'Validated and stored in object storage' },
          { key: 'extracted', label: 'Extracted', status: 'active', detail: 'Text extraction in progress' },
          { key: 'chunked', label: 'Chunked', status: 'pending', detail: 'Split into overlapping passages' },
          { key: 'embedded', label: 'Embedded', status: 'pending', detail: 'Vectors generated for pgvector' },
          { key: 'indexed', label: 'Indexed', status: 'pending', detail: 'Available to permission-aware retrieval' },
        ],
        versionHistory: [{ version: 'v1.0', author: 'Anush Kannan', createdAt: new Date().toISOString(), note: 'Initial upload.' }],
        usage: { retrievalCount: 0, agents: [], recentQuestions: [] },
        accessList: [{ userId: 'usr_1', name: 'Anush Kannan', role: 'admin', via: 'Administrator role' }],
        tags: [],
      }
      documents = [document, ...documents]
      record(`Uploaded ${body.name}`, 'Anush Kannan', 'document_uploaded')
      return document
    },
  },
  {
    endpoint: 'knowledge.retry',
    latencyMs: 400,
    resolve: (payload) => {
      const { id } = (payload as { body: { id: string } }).body
      documents = documents.map((document) =>
        document.id === id ? { ...document, status: 'processing' as const, progress: 12, failureReason: undefined } : document,
      )
      record(`Retried processing for document ${id}`, 'Anush Kannan', 'document_uploaded')
      return documents.find((document) => document.id === id) ?? null
    },
  },

  /* -- Assistant & RAG ---------------------------------------------------- */
  { endpoint: 'chat.conversations', latencyMs: 220, resolve: () => MOCK_CONVERSATIONS as Conversation[] },
  {
    endpoint: 'chat.messages',
    latencyMs: 240,
    resolve: (payload) => {
      const { conversationId } = (payload as { params: { conversationId: string } }).params
      return buildConversationMessages(conversationId) as ConversationMessage[]
    },
  },
  {
    endpoint: 'chat.ask',
    latencyMs: 1400,
    resolve: (payload) => {
      const body = (payload as { body: { question: string } }).body
      const question = body.question
      const lowered = question.toLowerCase()

      const finance = /expense|reimburse|invoice|budget|invoice|procure|cost|payment|meal/.test(lowered)
      const support = /ticket|incident|escalat|sla|customer|outage/.test(lowered)
      const hr = /leave|policy|onboard|attendance|benefit|holiday|sabbatical/.test(lowered)
      const category = finance ? 'Finance' : support ? 'Support' : hr ? 'HR' : 'General'
      const agentId = finance ? 'agent_finance' : support ? 'agent_support' : 'agent_hr'
      const base = finance ? MOCK_AGENT_RUNS[2] : support ? MOCK_AGENT_RUNS[1] : MOCK_AGENT_RUNS[0]

      const uncertain = /sabbatical|paternity|adoption|share option|acquisition|roadmap 2027/.test(lowered)

      const run = {
        ...base,
        id: `run_${Date.now().toString(36)}`,
        question,
        startedAt: new Date().toISOString(),
        agentId,
        routing: {
          ...base.routing,
          question,
          intentCategory: category as 'HR' | 'Finance' | 'Support' | 'General',
          detectedIntent: `${category} / ${finance ? 'Expense policy' : support ? 'Incident triage' : 'Policy lookup'}`,
          selectedAgentId: agentId,
          candidates: [
            { category: category as 'HR' | 'Finance' | 'Support' | 'General', score: 88, reason: 'Entities in the question match this domain’s intent set.' },
            { category: 'General' as const, score: 14, reason: 'Question is answerable from approved organisational knowledge.' },
          ],
        },
        answer: uncertain
          ? 'I could not find enough information in your organisation’s approved knowledge sources to answer this confidently. The closest permitted sources reference the topic but do not state the detail you asked for.\n\nYou can request a policy update or ask a knowledge owner to publish the missing section.'
          : base.answer,
        answerState: uncertain ? ('insufficient_evidence' as const) : ('answered' as const),
        citations: uncertain ? [] : base.citations,
        retrieved: uncertain
          ? base.retrieved.map((source, index) => ({ ...source, included: index === 0, exclusionReason: index === 0 ? undefined : 'Below the relevance floor — evidence insufficient for a confident answer.' }))
          : base.retrieved,
      }

      record(`Asked the AI Assistant: “${question}”`, 'Anush Kannan', 'ai_query')
      return run
    },
  },

  /* -- Agents ------------------------------------------------------------- */
  { endpoint: 'agents.list', latencyMs: 220, resolve: () => MOCK_AGENTS },
  {
    endpoint: 'agents.detail',
    latencyMs: 200,
    resolve: (payload) => {
      const { id } = (payload as { params: { id: string } }).params
      return MOCK_AGENTS.find((agent) => agent.id === id) ?? null
    },
  },
  {
    endpoint: 'agents.runs',
    latencyMs: 240,
    resolve: (payload) => {
      const params = (payload as { params?: { agentId?: string } }).params
      if (!params?.agentId) return MOCK_AGENT_RUNS
      return MOCK_AGENT_RUNS.filter((run) => run.agentId === params.agentId)
    },
  },
  {
    endpoint: 'agents.run.detail',
    latencyMs: 220,
    resolve: (payload) => {
      const { id } = (payload as { params: { id: string } }).params
      return MOCK_AGENT_RUNS.find((run) => run.id === id) ?? MOCK_AGENT_RUNS[0]
    },
  },
  {
    endpoint: 'agents.setStatus',
    latencyMs: 280,
    resolve: (payload) => {
      const body = (payload as { body: { agentId: string; status: string } }).body
      record(`Changed agent status to ${body.status}`, 'Anush Kannan', 'permission_changed')
      return { ...MOCK_AGENTS.find((agent) => agent.id === body.agentId)!, status: body.status as 'active' | 'degraded' | 'paused' }
    },
  },

  /* -- Decisions & approvals --------------------------------------------- */
  { endpoint: 'decisions.list', latencyMs: 260, resolve: () => decisions },
  {
    endpoint: 'decisions.detail',
    latencyMs: 200,
    resolve: (payload) => {
      const { id } = (payload as { params: { id: string } }).params
      return decisions.find((decision) => decision.id === id) ?? null
    },
  },
  {
    endpoint: 'decisions.resolve',
    latencyMs: 620,
    resolve: (payload) => {
      const body = (payload as { body: { id: string; outcome: 'approved' | 'rejected' | 'needs_evidence'; note: string; by: string } }).body
      const decision = decisions.find((item) => item.id === body.id)
      if (!decision) return null

      const taskId = body.outcome === 'approved' ? `task_${body.id}_auto` : null
      const updated: Decision = {
        ...decision,
        status: body.outcome,
        approverName: body.by,
        resultingTaskId: taskId,
        timeline: [
          ...decision.timeline,
          {
            id: `tl_${Date.now().toString(36)}`,
            label: body.outcome === 'approved' ? 'Approved' : body.outcome === 'rejected' ? 'Rejected' : 'More evidence requested',
            actor: body.by,
            actorKind: 'human',
            at: new Date().toISOString(),
            detail: body.note || 'No note supplied.',
          },
        ],
      }
      decisions = decisions.map((item) => (item.id === body.id ? updated : item))

      approvals = approvals.map((approval) =>
        approval.decisionId === body.id
          ? {
              ...approval,
              status: body.outcome,
              resolution: {
                outcome: body.outcome === 'approved' ? 'approved' : 'rejected',
                by: body.by,
                at: new Date().toISOString(),
                note: body.note,
                resultingTaskId: taskId,
              },
            }
          : approval,
      )

      record(
        `${body.outcome === 'approved' ? 'Approved' : body.outcome === 'rejected' ? 'Rejected' : 'Requested more evidence for'} “${decision.title}”`,
        body.by,
        body.outcome === 'approved' ? 'approval_granted' : 'approval_rejected',
      )
      return updated
    },
  },
  { endpoint: 'approvals.list', latencyMs: 240, resolve: () => approvals },
  {
    endpoint: 'approvals.detail',
    latencyMs: 180,
    resolve: (payload) => {
      const { id } = (payload as { params: { id: string } }).params
      return approvals.find((approval) => approval.id === id) ?? null
    },
  },
  {
    endpoint: 'approvals.comment',
    latencyMs: 320,
    resolve: (payload) => {
      const body = (payload as { body: { id: string; author: string; role: string; body: string } }).body
      const approval = approvals.find((item) => item.id === body.id)
      if (!approval) return null
      const updated: ApprovalRequest = {
        ...approval,
        comments: [
          ...approval.comments,
          { id: `c_${Date.now().toString(36)}`, author: body.author, role: body.role as ApprovalRequest['approverRole'], at: new Date().toISOString(), body: body.body },
        ],
      }
      approvals = approvals.map((item) => (item.id === body.id ? updated : item))
      return updated
    },
  },

  /* -- Tasks -------------------------------------------------------------- */
  { endpoint: 'tasks.list', latencyMs: 220, resolve: () => MOCK_TASKS },
  {
    endpoint: 'tasks.forDecision',
    latencyMs: 200,
    resolve: (payload) => {
      const { decisionId } = (payload as { params: { decisionId: string } }).params
      const decision = decisions.find((item) => item.id === decisionId)
      if (!decision?.resultingTaskId) return []
      return MOCK_TASKS.filter((task) => task.id === decision.resultingTaskId || task.originRef === decisionId)
    },
  },

  /* -- Evaluation --------------------------------------------------------- */
  { endpoint: 'evaluations.runs', latencyMs: 260, resolve: () => MOCK_EVALUATION_RUNS },
  {
    endpoint: 'evaluations.run',
    latencyMs: 200,
    resolve: (payload) => {
      const { id } = (payload as { params: { id: string } }).params
      return MOCK_EVALUATION_RUNS.find((run) => run.id === id) ?? null
    },
  },
  {
    endpoint: 'evaluations.start',
    latencyMs: 400,
    resolve: () => {
      record('Started an evaluation run against the golden set', 'Anush Kannan', 'evaluation_run')
      return { id: `eval_${Date.now().toString(36)}`, status: 'running' as const }
    },
  },

  /* -- Analytics ---------------------------------------------------------- */
  { endpoint: 'analytics.snapshot', latencyMs: 300, resolve: () => MOCK_ANALYTICS },

  /* -- Meetings ----------------------------------------------------------- */
  { endpoint: 'meetings.list', latencyMs: 240, resolve: () => MOCK_MEETINGS },
  {
    endpoint: 'meetings.detail',
    latencyMs: 200,
    resolve: (payload) => {
      const { id } = (payload as { params: { id: string } }).params
      return MOCK_MEETINGS.find((meeting) => meeting.id === id) ?? null
    },
  },

  /* -- Governance --------------------------------------------------------- */
  { endpoint: 'audit.list', latencyMs: 280, resolve: () => MOCK_AUDIT_EVENTS },
  { endpoint: 'security.overview', latencyMs: 260, resolve: () => MOCK_SECURITY_OVERVIEW },

  /* -- Notifications ------------------------------------------------------ */
  { endpoint: 'notifications.list', latencyMs: 160, resolve: () => notifications },
  {
    endpoint: 'notifications.read',
    latencyMs: 140,
    resolve: (payload) => {
      const body = (payload as { body: { id?: string; all?: boolean } }).body
      notifications = notifications.map((item) =>
        body.all || item.id === body.id ? { ...item, read: true } : item,
      )
      return notifications
    },
  },
])
