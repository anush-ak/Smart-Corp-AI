/**
 * SmartCorp AI — shared domain types.
 *
 * These mirror the Django REST API contract defined in the project
 * specification (`/api/knowledge-bases/`, `/api/documents/`, `/api/chat/`,
 * `/api/agents/`, `/api/decisions/`, `/api/approvals/`, `/api/evaluations/`,
 * `/api/analytics/`, `/api/audit-logs/`). The frontend is written against these
 * shapes so that connecting the real backend means replacing the mock
 * transport, not rewriting UI.
 */

/* -------------------------------------------------------------------------- */
/* Identity, roles and permissions                                            */
/* -------------------------------------------------------------------------- */

export type Role = 'admin' | 'hr' | 'finance' | 'support' | 'employee'

export type Permission =
  | 'overview:view'
  | 'assistant:use'
  | 'knowledge:view'
  | 'knowledge:manage'
  | 'agents:view'
  | 'agents:manage'
  | 'decisions:view'
  | 'decisions:approve'
  | 'approvals:view'
  | 'approvals:act'
  | 'evaluation:view'
  | 'evaluation:run'
  | 'analytics:view'
  | 'meetings:view'
  | 'users:view'
  | 'users:manage'
  | 'audit:view'
  | 'security:view'
  | 'settings:manage'

export type Department = 'HR' | 'Finance' | 'Support' | 'Engineering' | 'Operations' | 'General'

export interface Organization {
  id: string
  name: string
  domain: string
  plan: string
  /** Region the tenant data is processed in — surfaced in the security center. */
  dataRegion: string
  mfaRequired: boolean
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  department: Department
  jobTitle: string
  status: 'active' | 'invited' | 'suspended'
  lastActiveAt: string
  /** Knowledge bases this user may retrieve from; drives RAG filtering. */
  knowledgeScope: string[]
  agentScope: string[]
  avatarColor: string
}

export interface RoleDefinition {
  role: Role
  label: string
  summary: string
  permissions: Permission[]
  knowledgeScopeDescription: string
}

/* -------------------------------------------------------------------------- */
/* Knowledge                                                                  */
/* -------------------------------------------------------------------------- */

export type AccessLevel = 'organization' | 'department' | 'restricted'
export type DocumentStatus = 'uploading' | 'processing' | 'indexing' | 'ready' | 'failed'

export interface KnowledgeBase {
  id: string
  name: string
  description: string
  department: Department
  documentCount: number
  chunkCount: number
  lastUpdatedAt: string
  accessLevel: AccessLevel
  status: 'ready' | 'indexing' | 'attention'
  ownerName: string
  embeddingModel: string
  retrievalQuality: number | null
  agents: string[]
}

export interface DocumentVersion {
  version: string
  author: string
  createdAt: string
  note: string
}

export interface ProcessingStep {
  key: 'uploaded' | 'extracted' | 'chunked' | 'embedded' | 'indexed'
  label: string
  status: 'complete' | 'active' | 'pending' | 'failed'
  detail: string
  at?: string
}

export interface DocumentUsage {
  retrievalCount: number
  agents: string[]
  recentQuestions: { question: string; askedAt: string; conversationId: string }[]
}

export interface KnowledgeDocument {
  id: string
  name: string
  extension: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'md' | 'txt' | 'csv'
  sizeBytes: number
  knowledgeBaseId: string
  department: Department
  version: string
  ownerName: string
  status: DocumentStatus
  accessLevel: AccessLevel
  updatedAt: string
  createdAt: string
  pages: number
  chunkCount: number
  /** Percentage of the active pipeline stage, used by processing UI. */
  progress: number
  pipeline: ProcessingStep[]
  failureReason?: string
  versionHistory: DocumentVersion[]
  usage: DocumentUsage
  accessList: { userId: string; name: string; role: Role; via: string }[]
  tags: string[]
}

/* -------------------------------------------------------------------------- */
/* AI: conversations, retrieval and agents                                    */
/* -------------------------------------------------------------------------- */

export interface Source {
  id: string
  documentId: string
  documentName: string
  knowledgeBaseId: string
  knowledgeBaseName: string
  page: number | null
  section: string | null
  accessLevel: AccessLevel
  score: number
  snippet: string
  department: Department
  updatedAt: string
}

export interface AgentSummary {
  id: string
  name: string
  department: Department
  purpose: string
  status: 'active' | 'degraded' | 'paused'
  queriesProcessed: number
  successRate: number | null
  avgLatencyMs: number
  knowledgeBaseIds: string[]
  permissions: string[]
  lastExecutionAt: string
  escalationOwner: string
  accent: string
  model: string
}

export type AnswerState = 'answered' | 'insufficient_evidence' | 'needs_clarification' | 'declined'

export interface RetrievedSource extends Source {
  rank: number
  included: boolean
  exclusionReason?: string
}

export interface Citation {
  id: string
  documentId: string
  documentName: string
  page: number | null
  section: string | null
  claim: string
}

export interface RoutingDecision {
  question: string
  detectedIntent: string
  intentCategory: 'HR' | 'Finance' | 'Support' | 'General'
  confidence: number
  candidates: { category: 'HR' | 'Finance' | 'Support' | 'General'; score: number; reason: string }[]
  selectedAgentId: string
  selectionReason: string
  knowledgeBaseIds: string[]
  toolsUsed: { name: string; detail: string; durationMs: number }[]
  decidedAt: string
}

export interface AgentRun {
  id: string
  conversationId: string
  agentId: string
  question: string
  requestedBy: string
  requestedByRole: Role
  startedAt: string
  durationMs: number
  status: 'completed' | 'failed' | 'awaiting_approval'
  routing: RoutingDecision
  retrieved: RetrievedSource[]
  answer: string
  answerState: AnswerState
  citations: Citation[]
  recommendedAction?: RecommendedAction
  auditEventIds: string[]
  tokenUsage: { prompt: number; completion: number }
  model: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  at: string
  run?: AgentRun
  /** Assistant thinking stages shown while the response streams in. */
  pendingStage?: string
}

export interface Conversation {
  id: string
  title: string
  updatedAt: string
  department: Department
  messageCount: number
  agentId: string | null
  pinned?: boolean
}

/* -------------------------------------------------------------------------- */
/* Decisions and approvals                                                    */
/* -------------------------------------------------------------------------- */

export type RiskLevel = 'low' | 'medium' | 'high'
export type DecisionStatus = 'awaiting_approval' | 'approved' | 'rejected' | 'needs_evidence' | 'in_progress'

export interface RecommendedAction {
  id: string
  title: string
  detail: string
  impact: string
  effort: 'low' | 'medium' | 'high'
  reversible: boolean
}

export interface Decision {
  id: string
  title: string
  issue: string
  detectedBy: { agentId: string; agentName: string }
  detectedAt: string
  department: Department
  status: DecisionStatus
  risk: RiskLevel
  confidence: number
  analysis: string
  evidence: EvidenceItem[]
  recommendation: RecommendedAction
  businessImpact: { label: string; value: string; direction: 'up' | 'down' | 'flat' }[]
  requesterName: string
  requesterRole: Role
  approverName: string | null
  slaDueAt: string | null
  timeline: DecisionTimelineEvent[]
  resultingTaskId: string | null
}

export interface EvidenceItem {
  id: string
  kind: 'ticket' | 'document' | 'incident' | 'metric' | 'transcript' | 'log'
  title: string
  source: string
  detail: string
  at: string
  href: string
  strength: 'strong' | 'moderate' | 'weak'
}

export interface DecisionTimelineEvent {
  id: string
  label: string
  actor: string
  actorKind: 'ai' | 'human' | 'system'
  at: string
  detail: string
}

export interface ApprovalRequest {
  id: string
  decisionId: string
  kind: 'decision' | 'document_publish' | 'agent_permission' | 'access_request'
  title: string
  summary: string
  rationale: string
  risk: RiskLevel
  evidenceCount: number
  status: DecisionStatus
  requestedBy: string
  requestedByKind: 'ai' | 'human'
  approverName: string
  approverRole: Role
  dueAt: string
  createdAt: string
  ifApproved: string
  ifRejected: string
  comments: { id: string; author: string; role: Role; at: string; body: string }[]
  resolution?: {
    outcome: 'approved' | 'rejected'
    by: string
    at: string
    note: string
    resultingTaskId: string | null
  }
}

export interface Task {
  id: string
  title: string
  owner: string
  department: Department
  dueDate: string
  status: 'todo' | 'in_progress' | 'blocked' | 'done'
  origin: 'decision' | 'meeting' | 'manual'
  originRef: string
  priority: 'low' | 'medium' | 'high'
}

/* -------------------------------------------------------------------------- */
/* Evaluation                                                                 */
/* -------------------------------------------------------------------------- */

export type MetricAvailability = 'measured' | 'not_measured'

export interface EvaluationMetric {
  key: 'retrieval_quality' | 'faithfulness' | 'citation_accuracy' | 'answer_relevance' | 'latency'
  label: string
  description: string
  value: number | null
  unit: 'percent' | 'ms'
  target: number
  /** Change vs. the previous run, in percentage points (null when unavailable). */
  delta: number | null
  availability: MetricAvailability
  series: { date: string; value: number }[]
}

export interface EvaluationCase {
  id: string
  question: string
  expectedAnswer: string
  expectedSources: string[]
  actualAnswer: string
  retrievedSources: string[]
  retrievalScore: number
  faithfulnessScore: number
  citationScore: number
  relevanceScore: number
  latencyMs: number
  result: 'pass' | 'partial' | 'fail'
  failureKind?: 'hallucination' | 'missing_retrieval' | 'citation_mismatch' | 'low_relevance' | 'latency'
  failureReason?: string
}

export interface EvaluationRun {
  id: string
  name: string
  datasetName: string
  caseCount: number
  startedAt: string
  durationMs: number
  triggeredBy: string
  status: 'completed' | 'running' | 'failed'
  overallScore: number | null
  passRate: number | null
  metrics: EvaluationMetric[]
  failureCount: number
  hallucinationCount: number
  cases: EvaluationCase[]
}

/* -------------------------------------------------------------------------- */
/* Meetings                                                                   */
/* -------------------------------------------------------------------------- */

export interface Meeting {
  id: string
  title: string
  date: string
  durationMinutes: number
  owner: string
  attendees: string[]
  department: Department
  transcriptStatus: 'uploaded' | 'processing' | 'ready' | 'failed'
  summary: string | null
  keyDecisions: { id: string; decision: string; rationale: string; madeBy: string }[]
  actionItems: Task[]
  risks: { id: string; risk: string; severity: RiskLevel; owner: string }[]
  followUps: { id: string; question: string; owner: string; suggestedBy: string }[]
  sourceFile: { name: string; sizeBytes: number }
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                  */
/* -------------------------------------------------------------------------- */

export interface AnalyticsSnapshot {
  windowLabel: string
  availability: MetricAvailability
  kpis: {
    key: string
    label: string
    value: number
    unit: 'count' | 'percent' | 'ms' | 'currency'
    deltaPct: number | null
    hint: string
  }[]
  queryVolume: { date: string; queries: number; approvals: number }[]
  agentUsage: { name: string; department: Department; executions: number; successRate: number }[]
  latency: { bucket: string; count: number }[]
  unanswered: { question: string; count: number; department: Department; suggestedFix: string }[]
  topDocuments: { documentName: string; retrievalCount: number; department: Department }[]
  cost: { date: string; amount: number }[] | null
  approvalVolume: { date: string; requested: number; approved: number; rejected: number }[]
}

/* -------------------------------------------------------------------------- */
/* Governance                                                                 */
/* -------------------------------------------------------------------------- */

export type AuditResult = 'success' | 'failure' | 'denied'

export interface AuditEvent {
  id: string
  at: string
  actorName: string
  actorRole: Role | 'system'
  action:
    | 'login'
    | 'logout'
    | 'document_uploaded'
    | 'document_accessed'
    | 'document_published'
    | 'ai_query'
    | 'agent_executed'
    | 'decision_generated'
    | 'approval_granted'
    | 'approval_rejected'
    | 'permission_changed'
    | 'permission_denied'
    | 'evaluation_run'
    | 'meeting_processed'
  summary: string
  resource: { type: string; id: string; label: string }
  result: AuditResult
  ipAddress: string
  userAgent: string
  requestId: string
  technical: Record<string, string | number | boolean>
}

export interface SecurityOverview {
  organizationStatus: { label: string; value: string; state: 'ok' | 'attention' | 'critical' }[]
  accessControl: { label: string; value: string; state: 'ok' | 'attention' | 'critical'; hint: string }[]
  restrictedDocuments: { id: string; name: string; department: Department; accessLevel: AccessLevel; restriction: string }[]
  permissionChanges: AuditEvent[]
  securityEvents: AuditEvent[]
  authenticationActivity: { date: string; success: number; failed: number; mfa: number }[]
  auditStatus: { retentionDays: number; lastIntegrityCheck: string; exportedAt: string | null; coveragePct: number }
}

export interface Notification {
  id: string
  title: string
  body: string
  at: string
  kind: 'approval' | 'agent' | 'evaluation' | 'security' | 'knowledge'
  read: boolean
  href: string
}

/* -------------------------------------------------------------------------- */
/* Transport helpers                                                          */
/* -------------------------------------------------------------------------- */

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
