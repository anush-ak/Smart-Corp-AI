/**
 * SmartCorp AI — mock corpus (intelligence, governance and analytics).
 *
 * Continues `corpus.ts`. All content is sample data bundled for demonstration.
 * Anything representing *measured model quality* carries an explicit
 * availability flag so the UI can render "Not measured yet" instead of
 * presenting a sample figure as a production measurement.
 */

import type {
  AgentRun,
  AnalyticsSnapshot,
  AuditEvent,
  ConversationMessage,
  EvaluationRun,
  Meeting,
  Notification,
  SecurityOverview,
} from '@/types'
import { MOCK_DOCUMENTS } from './corpus'

/* -------------------------------------------------------------------------- */
/* Date helpers for deterministic series (relative to "today" in the demo)     */
/* -------------------------------------------------------------------------- */

const DAY = 24 * 60 * 60 * 1000
const TODAY = new Date('2026-09-15T09:00:00Z')

export function dayKey(offsetFromToday: number) {
  return new Date(TODAY.getTime() - offsetFromToday * DAY).toISOString().slice(0, 10)
}

/* -------------------------------------------------------------------------- */
/* Agent runs — the Agent Execution Inspector feeds off these                  */
/* -------------------------------------------------------------------------- */

const leavePolicyDoc = MOCK_DOCUMENTS.find((doc) => doc.id === 'doc_leave_policy')!
const expenseDoc = MOCK_DOCUMENTS.find((doc) => doc.id === 'doc_expense_policy')!
const incidentDoc = MOCK_DOCUMENTS.find((doc) => doc.id === 'doc_payment_failures')!
const slaDoc = MOCK_DOCUMENTS.find((doc) => doc.id === 'doc_sla_matrix')!
const releaseDoc = MOCK_DOCUMENTS.find((doc) => doc.id === 'doc_release_notes')!

export const MOCK_AGENT_RUNS: AgentRun[] = [
  {
    id: 'run_8841',
    conversationId: 'conv_1',
    agentId: 'agent_hr',
    question: 'Can employees carry forward unused leave?',
    requestedBy: 'Tomás Alvarez',
    requestedByRole: 'employee',
    startedAt: '2026-09-15T09:12:00Z',
    durationMs: 1840,
    status: 'completed',
    routing: {
      question: 'Can employees carry forward unused leave?',
      detectedIntent: 'HR / Leave policy',
      intentCategory: 'HR',
      confidence: 96,
      candidates: [
        { category: 'HR', score: 96, reason: 'Entities "leave" and "carry forward" match the HR policy intent set; requester department is Engineering.' },
        { category: 'Finance', score: 12, reason: '"Carry forward" also appears in expense carry-forward rules, but no monetary entity is present.' },
        { category: 'General', score: 8, reason: 'Question is answerable from approved organisational knowledge.' },
      ],
      selectedAgentId: 'agent_hr',
      selectionReason: 'Highest intent score with in-scope HR knowledge available to the requester’s role.',
      knowledgeBaseIds: ['kb_hr'],
      toolsUsed: [
        { name: 'pgvector.similarity_search', detail: 'top_k=8, filter: department IN (HR), access_level IN (organization, department)', durationMs: 320 },
        { name: 'rerank.cross_encoder', detail: 'Re-ranked 8 candidates, 4 passed the relevance floor', durationMs: 210 },
        { name: 'citation.extract', detail: 'Mapped 3 statements to page and section references', durationMs: 140 },
      ],
      decidedAt: '2026-09-15T09:12:00Z',
    },
    retrieved: [
      {
        id: 'ret_1', rank: 1, included: true, documentId: leavePolicyDoc.id, documentName: leavePolicyDoc.name,
        knowledgeBaseId: 'kb_hr', knowledgeBaseName: 'HR Policy Library', page: 14,
        section: 'Leave Carry Forward', accessLevel: 'organization', score: 0.94, department: 'HR',
        updatedAt: leavePolicyDoc.updatedAt,
        snippet:
          'Employees may carry forward up to 10 unused leave days into the following calendar year. Carried-forward days must be used before 31 March and lapse thereafter.',
      },
      {
        id: 'ret_2', rank: 2, included: true, documentId: leavePolicyDoc.id, documentName: leavePolicyDoc.name,
        knowledgeBaseId: 'kb_hr', knowledgeBaseName: 'HR Policy Library', page: 15,
        section: 'Leave Encashment', accessLevel: 'organization', score: 0.81, department: 'HR',
        updatedAt: leavePolicyDoc.updatedAt,
        snippet:
          'Leave encashment is not available during the probation period. Post-confirmation encashment is limited to 5 days per calendar year.',
      },
      {
        id: 'ret_3', rank: 3, included: true, documentId: leavePolicyDoc.id, documentName: leavePolicyDoc.name,
        knowledgeBaseId: 'kb_hr', knowledgeBaseName: 'HR Policy Library', page: 9,
        section: 'Leave Accrual', accessLevel: 'organization', score: 0.72, department: 'HR',
        updatedAt: leavePolicyDoc.updatedAt,
        snippet: 'Casual leave accrues at 1.25 days per completed quarter for confirmed employees.',
      },
      {
        id: 'ret_4', rank: 4, included: false, exclusionReason: 'Below the relevance floor (score 0.38) — excluded from answer synthesis.',
        documentId: expenseDoc.id, documentName: expenseDoc.name, knowledgeBaseId: 'kb_finance',
        knowledgeBaseName: 'Finance & Expense Policies', page: 6, section: 'Carry-forward of unspent advances',
        accessLevel: 'department', score: 0.38, department: 'Finance', updatedAt: expenseDoc.updatedAt,
        snippet: 'Unspent travel advances must be returned within 15 days; carry-forward of advances is not permitted.',
      },
    ],
    answer:
      'Yes — with limits. Employees may carry forward a maximum of **10 unused leave days** into the following calendar year. Carried-forward days must be used before **31 March**, after which they lapse and are not encashable.\n\nTwo related conditions apply: leave encashment is not available during probation, and post-confirmation encashment is limited to 5 days per calendar year.',
    answerState: 'answered',
    citations: [
      { id: 'cit_1', documentId: leavePolicyDoc.id, documentName: leavePolicyDoc.name, page: 14, section: 'Leave Carry Forward', claim: 'Maximum of 10 unused leave days may be carried forward.' },
      { id: 'cit_2', documentId: leavePolicyDoc.id, documentName: leavePolicyDoc.name, page: 14, section: 'Leave Carry Forward', claim: 'Carried-forward days must be used before 31 March and lapse thereafter.' },
      { id: 'cit_3', documentId: leavePolicyDoc.id, documentName: leavePolicyDoc.name, page: 15, section: 'Leave Encashment', claim: 'Encashment is unavailable during probation and capped at 5 days per year afterwards.' },
    ],
    auditEventIds: ['aud_101', 'aud_102'],
    tokenUsage: { prompt: 3120, completion: 286 },
    model: 'gpt-4o-mini',
  },
  {
    id: 'run_8842',
    conversationId: 'conv_3',
    agentId: 'agent_support',
    question: 'What is causing the increase in payment failures this week?',
    requestedBy: 'Meera Shah',
    requestedByRole: 'support',
    startedAt: '2026-09-15T07:05:00Z',
    durationMs: 4120,
    status: 'awaiting_approval',
    routing: {
      question: 'What is causing the increase in payment failures this week?',
      detectedIntent: 'Support / Incident triage',
      intentCategory: 'Support',
      confidence: 92,
      candidates: [
        { category: 'Support', score: 92, reason: 'Incident and ticket entities detected; requester holds the Support role with incident knowledge in scope.' },
        { category: 'Finance', score: 34, reason: 'Monetary impact mentioned, but the question asks for a cause rather than a financial policy.' },
        { category: 'General', score: 6, reason: 'Requires organisational incident knowledge, not general reasoning.' },
      ],
      selectedAgentId: 'agent_support',
      selectionReason: 'Support Agent owns incident knowledge and may open a decision for human approval.',
      knowledgeBaseIds: ['kb_support', 'kb_product'],
      toolsUsed: [
        { name: 'pgvector.similarity_search', detail: 'top_k=12, filter: department IN (Support, Engineering), access_level <= department', durationMs: 480 },
        { name: 'rerank.cross_encoder', detail: '4 of 12 candidates passed the relevance floor', durationMs: 260 },
        { name: 'telemetry.query', detail: 'Payment failure rate by provider, last 14 days', durationMs: 610 },
        { name: 'decision.propose', detail: 'Drafted a HIGH-risk recommendation and routed it for approval', durationMs: 320 },
      ],
      decidedAt: '2026-09-15T07:05:00Z',
    },
    retrieved: [
      {
        id: 'ret_10', rank: 1, included: true, documentId: incidentDoc.id, documentName: incidentDoc.name,
        knowledgeBaseId: 'kb_support', knowledgeBaseName: 'Support Operations', page: 3,
        section: 'Observed failure signature', accessLevel: 'department', score: 0.93, department: 'Support',
        updatedAt: incidentDoc.updatedAt,
        snippet: 'Error code GATEWAY_TIMEOUT_PROVB accounted for 84% of failures on 11 September, concentrated in card-not-present transactions above ₹50,000.',
      },
      {
        id: 'ret_11', rank: 2, included: true, documentId: releaseDoc.id, documentName: releaseDoc.name,
        knowledgeBaseId: 'kb_product', knowledgeBaseName: 'Product Knowledge', page: 7,
        section: 'Fallback routing', accessLevel: 'organization', score: 0.88, department: 'Engineering',
        updatedAt: releaseDoc.updatedAt,
        snippet: 'Fallback payment routing is generally available and already enabled for the enterprise card-not-present segment.',
      },
      {
        id: 'ret_12', rank: 3, included: true, documentId: slaDoc.id, documentName: slaDoc.name,
        knowledgeBaseId: 'kb_support', knowledgeBaseName: 'Support Operations', page: 2,
        section: 'Escalation thresholds', accessLevel: 'department', score: 0.79, department: 'Support',
        updatedAt: slaDoc.updatedAt,
        snippet: 'Payment-impacting incidents affecting more than 25 enterprise accounts must be escalated to the incident channel within 30 minutes.',
      },
      {
        id: 'ret_13', rank: 4, included: false, exclusionReason: 'Permission filter: requester role does not include Finance department knowledge.',
        documentId: expenseDoc.id, documentName: expenseDoc.name, knowledgeBaseId: 'kb_finance',
        knowledgeBaseName: 'Finance & Expense Policies', page: 12, section: 'Refund handling',
        accessLevel: 'department', score: 0.66, department: 'Finance', updatedAt: expenseDoc.updatedAt,
        snippet: 'Refunds for failed transactions must be reconciled within the same settlement cycle.',
      },
    ],
    answer:
      'Payment failures this week concentrate on a single acquiring provider. Support telemetry shows 218 failure tickets in five days (up from a 61-ticket baseline), with **84% reporting error code GATEWAY_TIMEOUT_PROVB**. Failures cluster in card-not-present transactions above ₹50,000.\n\nThe September incident report documents the same signature at a lower volume on 11 September, before the gateway configuration change on 10 September. Because more than 25 enterprise accounts are affected, the SLA matrix requires escalation.\n\nA recommendation has been raised for human approval.',
    answerState: 'answered',
    citations: [
      { id: 'cit_10', documentId: incidentDoc.id, documentName: incidentDoc.name, page: 3, section: 'Observed failure signature', claim: '84% of failures carried error code GATEWAY_TIMEOUT_PROVB.' },
      { id: 'cit_11', documentId: releaseDoc.id, documentName: releaseDoc.name, page: 7, section: 'Fallback routing', claim: 'Fallback routing is available for the enterprise card-not-present segment.' },
      { id: 'cit_12', documentId: slaDoc.id, documentName: slaDoc.name, page: 2, section: 'Escalation thresholds', claim: 'Incidents affecting more than 25 enterprise accounts require escalation.' },
    ],
    recommendedAction: {
      id: 'rec_fallback',
      title: 'Temporarily route affected transactions through the fallback provider',
      detail: 'Enable fallback routing for Prov-B card-not-present transactions above ₹50,000 until the gateway configuration is reviewed. Reversible from the payments console.',
      impact: 'Recovers ~₹41L in at-risk monthly transaction volume for the affected segment.',
      effort: 'low',
      reversible: true,
    },
    auditEventIds: ['aud_105', 'aud_106', 'aud_107'],
    tokenUsage: { prompt: 5240, completion: 512 },
    model: 'gpt-4o-mini',
  },
  {
    id: 'run_8843',
    conversationId: 'conv_1',
    agentId: 'agent_hr',
    question: 'What is the sabbatical eligibility period for engineering managers?',
    requestedBy: 'Tomás Alvarez',
    requestedByRole: 'employee',
    startedAt: '2026-09-14T16:20:00Z',
    durationMs: 2260,
    status: 'completed',
    routing: {
      question: 'What is the sabbatical eligibility period for engineering managers?',
      detectedIntent: 'HR / Leave policy',
      intentCategory: 'HR',
      confidence: 88,
      candidates: [
        { category: 'HR', score: 88, reason: 'Sabbatical is an HR policy entity.' },
        { category: 'General', score: 15, reason: 'Possibly answerable from the wider handbook.' },
      ],
      selectedAgentId: 'agent_hr',
      selectionReason: 'HR knowledge in scope, but the specific subsection was not present in approved sources.',
      knowledgeBaseIds: ['kb_hr'],
      toolsUsed: [
        { name: 'pgvector.similarity_search', detail: 'top_k=8 — best candidate scored 0.41, below the 0.62 floor', durationMs: 300 },
      ],
      decidedAt: '2026-09-14T16:20:00Z',
    },
    retrieved: [
      {
        id: 'ret_20', rank: 1, included: false, exclusionReason: 'Below the relevance floor (0.41 < 0.62) — evidence insufficient for a confident answer.',
        documentId: leavePolicyDoc.id, documentName: leavePolicyDoc.name, knowledgeBaseId: 'kb_hr',
        knowledgeBaseName: 'HR Policy Library', page: 21, section: 'Sabbatical Leave',
        accessLevel: 'organization', score: 0.41, department: 'HR', updatedAt: leavePolicyDoc.updatedAt,
        snippet: 'Sabbatical leave may be requested by eligible employees in accordance with the conditions set out by the People team.',
      },
    ],
    answer:
      'I could not find enough information in your organisation’s approved knowledge sources to answer this confidently. The HR Policy Library references sabbatical leave but does not state the eligibility period for engineering managers.\n\nYou can request a policy update, or ask a People Operations administrator to publish the missing detail.',
    answerState: 'insufficient_evidence',
    citations: [],
    auditEventIds: ['aud_110'],
    tokenUsage: { prompt: 1280, completion: 96 },
    model: 'gpt-4o-mini',
  },
]

/* -------------------------------------------------------------------------- */
/* Conversation transcripts (the demo thread)                                  */
/* -------------------------------------------------------------------------- */

export function buildConversationMessages(conversationId: string): ConversationMessage[] {
  if (conversationId === 'conv_1') {
    const run = MOCK_AGENT_RUNS[0]
    return [
      { id: 'msg_1', role: 'user', content: 'Can employees carry forward unused leave?', at: '2026-09-15T09:12:00Z' },
      { id: 'msg_2', role: 'assistant', content: run.answer, at: '2026-09-15T09:12:02Z', run },
      { id: 'msg_3', role: 'user', content: 'What happens to them if they are not used by the deadline?', at: '2026-09-15T09:14:00Z' },
      {
        id: 'msg_4',
        role: 'assistant',
        content:
          'Carried-forward days **lapse on 31 March** and cannot be encashed afterwards. Employees confirmed in service may encash up to 5 days per calendar year from their accrued balance, but not from carried-forward days.',
        at: '2026-09-15T09:14:02Z',
        run: { ...run, id: 'run_8844', question: 'What happens to carried-forward days if they are not used?', answerState: 'answered' as const },
      },
    ]
  }
  if (conversationId === 'conv_3') {
    const run = MOCK_AGENT_RUNS[1]
    return [
      { id: 'msg_10', role: 'user', content: 'What is causing the increase in payment failures this week?', at: '2026-09-15T07:05:00Z' },
      { id: 'msg_11', role: 'assistant', content: run.answer, at: '2026-09-15T07:05:04Z', run },
    ]
  }
  if (conversationId === 'conv_2') {
    const run = MOCK_AGENT_RUNS[2]
    return [
      { id: 'msg_20', role: 'user', content: 'What is the daily meal reimbursement cap for domestic travel?', at: '2026-09-15T08:30:00Z' },
      {
        id: 'msg_21',
        role: 'assistant',
        content:
          'The current cap is **₹2,500 per day** for domestic travel, per section 4.2 of the Travel & Expense Reimbursement Policy (updated 14 September 2026).\n\nNote: the 2025 regional annexe still states ₹2,000 and has not been marked superseded, so answers may differ depending on which document is retrieved. The Finance Agent has raised this conflict for review.',
        at: '2026-09-15T08:30:03Z',
        run: {
          ...run,
          id: 'run_8850',
          question: 'What is the daily meal reimbursement cap for domestic travel?',
          conversationId: 'conv_2',
          agentId: 'agent_finance',
          requestedBy: 'Daniel Okonkwo',
          requestedByRole: 'finance',
          startedAt: '2026-09-15T08:30:00Z',
          recommendedAction: {
            id: 'rec_archive_annexe',
            title: 'Archive the superseded regional annexe and add a supersession note',
            detail: 'Mark the 2025 annexe superseded and re-index the finance knowledge base so retrieval returns one authoritative cap.',
            impact: 'Removes an ambiguity affecting 240 employees who file domestic travel expenses.',
            effort: 'low',
            reversible: true,
          },
          routing: {
            ...run.routing,
            question: 'What is the daily meal reimbursement cap for domestic travel?',
            detectedIntent: 'Finance / Expense policy',
            intentCategory: 'Finance',
            confidence: 94,
            selectedAgentId: 'agent_finance',
            knowledgeBaseIds: ['kb_finance'],
            candidates: [
              { category: 'Finance', score: 94, reason: 'Expense and reimbursement entities detected; requester holds the Finance role.' },
              { category: 'HR', score: 18, reason: 'Meal allowances also appear in HR relocation policy, but no relocation entity is present.' },
              { category: 'General', score: 4, reason: 'Policy-specific, needs approved finance knowledge.' },
            ],
          },
        },
      },
    ]
  }
  if (conversationId === 'conv_6') {
    const run = MOCK_AGENT_RUNS[1]
    return [
      { id: 'msg_30', role: 'user', content: 'What is the first response target for enterprise customers?', at: '2026-09-15T08:48:00Z' },
      {
        id: 'msg_31',
        role: 'assistant',
        content:
          'Enterprise tier customers have a **30-minute first-response target** during business hours, and **60 minutes** outside business hours and on weekends (Customer Support SLA Matrix, sheet “Coverage”).',
        at: '2026-09-15T08:48:02Z',
        run: {
          ...run,
          id: 'run_8851',
          question: 'What is the first response target for enterprise customers?',
          conversationId: 'conv_6',
          requestedBy: 'Meera Shah',
          startedAt: '2026-09-15T08:48:00Z',
          citations: [
            { id: 'cit_30', documentId: slaDoc.id, documentName: slaDoc.name, page: 2, section: 'Coverage windows', claim: 'Enterprise first-response target is 30 minutes in hours and 60 minutes out of hours.' },
          ],
        },
      },
    ]
  }
  return []
}

/* -------------------------------------------------------------------------- */
/* Evaluation                                                                 */
/* -------------------------------------------------------------------------- */

function series(base: number, drift: number, points = 14) {
  return Array.from({ length: points }).map((_, index) => {
    const offset = points - 1 - index
    const noise = ((index * 37) % 7) / 7 - 0.5
    return { date: dayKey(offset), value: Number((base + drift * index + noise * 2.4).toFixed(2)) }
  })
}

export const MOCK_EVALUATION_RUNS: EvaluationRun[] = [
  {
    id: 'eval_2026_09_14',
    name: 'Nightly regression — 14 Sept 2026',
    datasetName: 'SmartCorp golden set v3 (108 questions)',
    caseCount: 108,
    startedAt: '2026-09-14T22:00:00Z',
    durationMs: 742_000,
    triggeredBy: 'Scheduled job',
    status: 'completed',
    overallScore: 84,
    passRate: 0.81,
    failureCount: 13,
    hallucinationCount: 2,
    metrics: [
      {
        key: 'retrieval_quality', label: 'Retrieval quality', description: 'Recall@k and mean reciprocal rank over the golden set, before reranking.',
        value: 0.91, unit: 'percent', target: 0.9, delta: 1.4, availability: 'measured', series: series(88, 0.22),
      },
      {
        key: 'faithfulness', label: 'Faithfulness', description: 'Share of answer statements fully entailed by the retrieved passages (claim-level check).',
        value: 0.87, unit: 'percent', target: 0.9, delta: -0.8, availability: 'measured', series: series(85, 0.16),
      },
      {
        key: 'citation_accuracy', label: 'Citation accuracy', description: 'Share of citations that resolve to a passage supporting the attached claim.',
        value: 0.93, unit: 'percent', target: 0.92, delta: 2.1, availability: 'measured', series: series(90, 0.24),
      },
      {
        key: 'answer_relevance', label: 'Answer relevance', description: 'Judge-scored relevance of the answer to the asked question.',
        value: 0.88, unit: 'percent', target: 0.88, delta: 0.4, availability: 'measured', series: series(86, 0.15),
      },
      {
        key: 'latency', label: 'Average latency', description: 'End-to-end time from question submission to first complete answer.',
        value: 2180, unit: 'ms', target: 2500, delta: -3.2, availability: 'measured', series: series(2380, -14),
      },
    ],
    cases: [
      {
        id: 'case_1',
        question: 'Can employees carry forward unused leave?',
        expectedAnswer: 'Yes, up to 10 days, which must be used before 31 March.',
        expectedSources: ['Employee Handbook — Leave Policy.pdf'],
        actualAnswer: 'Yes — up to 10 unused days, to be used before 31 March, after which they lapse.',
        retrievedSources: ['Employee Handbook — Leave Policy.pdf · p.14'], 
        retrievalScore: 0.94, faithfulnessScore: 1, citationScore: 1, relevanceScore: 1, latencyMs: 1840, result: 'pass',
      },
      {
        id: 'case_2',
        question: 'What is the daily meal cap for domestic travel?',
        expectedAnswer: '₹2,500 per day per the current policy.',
        expectedSources: ['Travel & Expense Reimbursement Policy.pdf'],
        actualAnswer: 'The cap is ₹2,500 per day, though a superseded annexe states ₹2,000.',
        retrievedSources: ['Travel & Expense Reimbursement Policy.pdf · p.11', 'Regional Expense Annexe 2025.pdf · p.4'],
        retrievalScore: 0.89, faithfulnessScore: 0.8, citationScore: 0.5, relevanceScore: 1, latencyMs: 2260, result: 'partial',
        failureKind: 'citation_mismatch',
        failureReason: 'The superseded annexe was cited alongside the current policy without a supersession marker. Fix: mark the annexe superseded so the retrieval filter excludes it.',
      },
      {
        id: 'case_3',
        question: 'How many days of paid paternity leave are available?',
        expectedAnswer: '15 working days as per the leave policy.',
        expectedSources: ['Employee Handbook — Leave Policy.pdf'],
        actualAnswer: 'I could not find enough information in your organisation’s approved knowledge sources to answer this confidently.',
        retrievedSources: [],
        retrievalScore: 0.42, faithfulnessScore: 1, citationScore: 1, relevanceScore: 0.3, latencyMs: 1620, result: 'fail',
        failureKind: 'missing_retrieval',
        failureReason: 'The paternity-leave section sits on a scanned page with no recoverable text layer. Fix: enable OCR for low-text-density pages during extraction.',
      },
      {
        id: 'case_4',
        question: 'What is the approval threshold for capital expenditure?',
        expectedAnswer: 'Anything above ₹5L requires the Financial Controller’s approval.',
        expectedSources: ['Travel & Expense Reimbursement Policy.pdf', 'Procurement Thresholds.docx'],
        actualAnswer: 'Capital expenditure above ₹5L requires the Financial Controller’s approval. Below that, department heads may approve.',
        retrievedSources: ['Travel & Expense Reimbursement Policy.pdf · p.17'],
        retrievalScore: 0.86, faithfulnessScore: 0.75, citationScore: 0.75, relevanceScore: 1, latencyMs: 2480, result: 'partial',
        failureKind: 'citation_mismatch',
        failureReason: 'One claim (“below that, department heads may approve”) had no supporting citation. Fix: require a citation for every normative statement before the answer is released.',
      },
      {
        id: 'case_5',
        question: 'Who is the current Chief Financial Officer?',
        expectedAnswer: 'Not answerable from the knowledge base.',
        expectedSources: [],
        actualAnswer: 'The Finance & Expense Policies knowledge base does not contain current leadership information.',
        retrievedSources: [],
        retrievalScore: 0.3, faithfulnessScore: 1, citationScore: 1, relevanceScore: 1, latencyMs: 1180, result: 'pass',
      },
      {
        id: 'case_6',
        question: 'What is the SLA for enterprise first response after hours?',
        expectedAnswer: '60 minutes outside business hours.',
        expectedSources: ['Customer Support SLA Matrix.xlsx'],
        actualAnswer: 'Enterprise first response is 60 minutes outside business hours per the SLA matrix.',
        retrievedSources: ['Customer Support SLA Matrix.xlsx · sheet Coverage'],
        retrievalScore: 0.92, faithfulnessScore: 1, citationScore: 1, relevanceScore: 1, latencyMs: 1740, result: 'pass',
      },
      {
        id: 'case_7',
        question: 'Does the platform support fallback payment routing?',
        expectedAnswer: 'Yes, it is generally available for the enterprise card-not-present segment.',
        expectedSources: ['Platform Release Notes — Q3 2026.md'],
        actualAnswer: 'Yes. Fallback routing is generally available and enabled for enterprise card-not-present transactions. It is documented as the recommended mitigation during provider degradation, and support leadership has confirmed it is the preferred approach for APAC merchants during peak season.',
        retrievedSources: ['Platform Release Notes — Q3 2026.md · section Fallback routing'],
        retrievalScore: 0.9, faithfulnessScore: 0.5, citationScore: 0.5, relevanceScore: 1, latencyMs: 2320, result: 'fail',
        failureKind: 'hallucination',
        failureReason: 'The final two sentences have no supporting passage — they extend a documented capability into claims about leadership preference that no approved source contains. Fix: tighten the answer-length instruction and enforce sentence-level entailment before release.',
      },
      {
        id: 'case_8',
        question: 'How do I request a new laptop?',
        expectedAnswer: 'Raise an IT request; manager approval required above ₹60,000.',
        expectedSources: ['New Hire Onboarding Playbook.docx'],
        actualAnswer: 'The onboarding playbook is still processing, so I cannot cite the current procedure. The known step is to raise an IT request, with manager approval above ₹60,000.',
        retrievedSources: ['IT Asset Policy.md'],
        retrievalScore: 0.68, faithfulnessScore: 0.9, citationScore: 0.8, relevanceScore: 0.9, latencyMs: 2050, result: 'partial',
        failureKind: 'low_relevance',
        failureReason: 'The richer source was mid-indexing at evaluation time, leaving a lower-relevance document to answer. Fix: re-run this case after the knowledge base finishes indexing.',
      },
      {
        id: 'case_9',
        question: 'What is the overnight escalation path for a payment outage?',
        expectedAnswer: 'Escalate to the incident channel within 30 minutes, page the payments on-call.',
        expectedSources: ['Customer Support SLA Matrix.xlsx', 'Payment Failure Incident Report — Sept 2026.pdf'],
        actualAnswer: 'Escalate to the incident channel within 30 minutes for outages affecting more than 25 enterprise accounts, and page the payments on-call engineer.',
        retrievedSources: ['Customer Support SLA Matrix.xlsx · sheet Escalation', 'Payment Failure Incident Report — Sept 2026.pdf · p.3'],
        retrievalScore: 0.95, faithfulnessScore: 1, citationScore: 1, relevanceScore: 1, latencyMs: 2890, result: 'pass',
      },
      {
        id: 'case_10',
        question: 'Summarise all compensation bands across departments.',
        expectedAnswer: 'Refuse — outside the requester’s permitted knowledge scope.',
        expectedSources: [],
        actualAnswer: 'I cannot answer this. Compensation banding sits outside your permitted knowledge scope, so the relevant documents were excluded before retrieval.',
        retrievedSources: [],
        retrievalScore: 1, faithfulnessScore: 1, citationScore: 1, relevanceScore: 1, latencyMs: 980, result: 'pass',
      },
    ],
  },
  {
    id: 'eval_2026_09_13',
    name: 'Nightly regression — 13 Sept 2026',
    datasetName: 'SmartCorp golden set v3 (108 questions)',
    caseCount: 108,
    startedAt: '2026-09-13T22:00:00Z',
    durationMs: 788_000,
    triggeredBy: 'Scheduled job',
    status: 'completed',
    overallScore: 81,
    passRate: 0.77,
    failureCount: 18,
    hallucinationCount: 3,
    metrics: [
      { key: 'retrieval_quality', label: 'Retrieval quality', description: 'Recall@k and MRR over the golden set.', value: 0.89, unit: 'percent', target: 0.9, delta: 0.3, availability: 'measured', series: series(87, 0.18) },
      { key: 'faithfulness', label: 'Faithfulness', description: 'Claim-level entailment against retrieved passages.', value: 0.84, unit: 'percent', target: 0.9, delta: -1.9, availability: 'measured', series: series(86, 0.1) },
      { key: 'citation_accuracy', label: 'Citation accuracy', description: 'Citations resolving to supporting passages.', value: 0.9, unit: 'percent', target: 0.92, delta: -0.6, availability: 'measured', series: series(91, 0.1) },
      { key: 'answer_relevance', label: 'Answer relevance', description: 'Judge-scored answer relevance.', value: 0.86, unit: 'percent', target: 0.88, delta: 0.2, availability: 'measured', series: series(85, 0.12) },
      { key: 'latency', label: 'Average latency', description: 'End-to-end answer latency.', value: 2260, unit: 'ms', target: 2500, delta: 1.4, availability: 'measured', series: series(2240, 2) },
    ],
    cases: [],
  },
  {
    id: 'eval_2026_09_15',
    name: 'Post-change regression — 15 Sept 2026',
    datasetName: 'SmartCorp golden set v3 (108 questions)',
    caseCount: 108,
    startedAt: '2026-09-15T09:40:00Z',
    durationMs: 0,
    triggeredBy: 'Anush Kannan',
    status: 'running',
    overallScore: null,
    passRate: null,
    failureCount: 0,
    hallucinationCount: 0,
    metrics: [
      { key: 'retrieval_quality', label: 'Retrieval quality', description: 'Awaiting run completion.', value: null, unit: 'percent', target: 0.9, delta: null, availability: 'not_measured', series: [] },
      { key: 'faithfulness', label: 'Faithfulness', description: 'Awaiting run completion.', value: null, unit: 'percent', target: 0.9, delta: null, availability: 'not_measured', series: [] },
      { key: 'citation_accuracy', label: 'Citation accuracy', description: 'Awaiting run completion.', value: null, unit: 'percent', target: 0.92, delta: null, availability: 'not_measured', series: [] },
      { key: 'answer_relevance', label: 'Answer relevance', description: 'Awaiting run completion.', value: null, unit: 'percent', target: 0.88, delta: null, availability: 'not_measured', series: [] },
      { key: 'latency', label: 'Average latency', description: 'Awaiting run completion.', value: null, unit: 'ms', target: 2500, delta: null, availability: 'not_measured', series: [] },
    ],
    cases: [],
  },
]

/* -------------------------------------------------------------------------- */
/* Meetings                                                                   */
/* -------------------------------------------------------------------------- */

export const MOCK_MEETINGS: Meeting[] = [
  {
    id: 'mtg_1',
    title: 'Payment degradation — incident bridge',
    date: '2026-09-12T09:00:00Z',
    durationMinutes: 42,
    owner: 'Meera Shah',
    attendees: ['Meera Shah', 'Tomás Alvarez', 'Daniel Okonkwo', 'Anush Kannan'],
    department: 'Support',
    transcriptStatus: 'ready',
    summary:
      'The bridge confirmed that payment failures concentrated on a single acquiring provider and agreed to evaluate fallback routing before the weekend peak. Participants noted that the existing incident report documents the same signature at lower volume. Finance raised that fallback fees are approximately 0.4% higher and asked for a review date if routing is enabled. Ownership of the post-incident review was assigned to Support operations.',
    sourceFile: { name: 'payment-bridge-2026-09-12.vtt', sizeBytes: 148_000 },
    keyDecisions: [
      { id: 'kd_1', decision: 'Evaluate fallback routing for the affected segment before the weekend peak.', rationale: 'Failure rate on the affected provider is 3.4% versus 0.4% baseline.', madeBy: 'Meera Shah' },
      { id: 'kd_2', decision: 'Do not change provider configuration until the post-incident review completes.', rationale: 'Avoid compounding the change that preceded the degradation.', madeBy: 'Tomás Alvarez' },
      { id: 'kd_3', decision: 'Add a review date if fallback routing is enabled.', rationale: 'Fallback provider fees are ~0.4% higher.', madeBy: 'Daniel Okonkwo' },
    ],
    actionItems: [
      { id: 'task_incident_retro', title: 'Run post-incident review for the September payment degradation', owner: 'Meera Shah', department: 'Support', dueDate: '2026-09-19', status: 'todo', origin: 'meeting', originRef: 'mtg_1', priority: 'high' },
      { id: 'task_fallback_runbook', title: 'Update the fallback routing runbook with the new thresholds', owner: 'Tomás Alvarez', department: 'Engineering', dueDate: '2026-09-22', status: 'todo', origin: 'meeting', originRef: 'mtg_1', priority: 'medium' },
      { id: 'task_gateway_review', title: 'Review Prov-B gateway configuration change from 10 Sept', owner: 'Tomás Alvarez', department: 'Engineering', dueDate: '2026-09-16', status: 'in_progress', origin: 'decision', originRef: 'dec_payment_failures', priority: 'high' },
    ],
    risks: [
      { id: 'rk_1', risk: 'Fallback provider capacity may not absorb peak weekend volume.', severity: 'high', owner: 'Tomás Alvarez' },
      { id: 'rk_2', risk: 'Higher transaction fees inflate the monthly payment cost line.', severity: 'medium', owner: 'Daniel Okonkwo' },
    ],
    followUps: [
      { id: 'fu_1', question: 'Confirm fallback provider throughput limit for the APAC region.', owner: 'Tomás Alvarez', suggestedBy: 'Support Agent' },
      { id: 'fu_2', question: 'Quantify the fee impact at current failure volumes.', owner: 'Daniel Okonkwo', suggestedBy: 'Support Agent' },
    ],
  },
  {
    id: 'mtg_2',
    title: 'Monthly finance review — September',
    date: '2026-09-09T14:00:00Z',
    durationMinutes: 55,
    owner: 'Daniel Okonkwo',
    attendees: ['Daniel Okonkwo', 'Anush Kannan', 'Priya Raghunathan'],
    department: 'Finance',
    transcriptStatus: 'ready',
    summary:
      'The review approved the refreshed travel and expense policy, raising the domestic meal cap to ₹2,500 per day and adding a pre-approval requirement for client entertainment. Participants agreed to retire the 2025 regional annexe but noted that the archive step was not completed. Retrieval cost per query was requested as a standing line in the monthly report.',
    sourceFile: { name: 'finance-review-2026-09-09.vtt', sizeBytes: 212_000 },
    keyDecisions: [
      { id: 'kd_4', decision: 'Raise the domestic meal cap to ₹2,500 per day.', rationale: 'Aligns with regional cost-of-living adjustments.', madeBy: 'Daniel Okonkwo' },
      { id: 'kd_5', decision: 'Require pre-approval for client entertainment above ₹10,000.', rationale: 'Controls discretionary spend growth.', madeBy: 'Daniel Okonkwo' },
      { id: 'kd_6', decision: 'Retire the 2025 regional expense annexe.', rationale: 'Superseded by the primary policy.', madeBy: 'Anush Kannan' },
    ],
    actionItems: [
      { id: 'task_annexe_archive', title: 'Confirm annexe supersession note in the finance knowledge base', owner: 'Daniel Okonkwo', department: 'Finance', dueDate: '2026-09-18', status: 'todo', origin: 'decision', originRef: 'dec_expense_conflict', priority: 'medium' },
      { id: 'task_cost_report', title: 'Add retrieval cost per query to the monthly finance report', owner: 'Daniel Okonkwo', department: 'Finance', dueDate: '2026-09-25', status: 'todo', origin: 'meeting', originRef: 'mtg_2', priority: 'low' },
    ],
    risks: [{ id: 'rk_3', risk: 'Superseded annexe may continue answering employee questions until archived.', severity: 'medium', owner: 'Daniel Okonkwo' }],
    followUps: [{ id: 'fu_3', question: 'Confirm the archive step completed and re-index has run.', owner: 'Daniel Okonkwo', suggestedBy: 'Finance Agent' }],
  },
  {
    id: 'mtg_3',
    title: 'HR policy sync — Q3 onboarding refresh',
    date: '2026-09-15T06:30:00Z',
    durationMinutes: 18,
    owner: 'Priya Raghunathan',
    attendees: ['Priya Raghunathan', 'Ruth Bekele'],
    department: 'HR',
    transcriptStatus: 'processing',
    summary: null,
    sourceFile: { name: 'hr-policy-sync-2026-09-15.vtt', sizeBytes: 64_000 },
    keyDecisions: [],
    actionItems: [],
    risks: [],
    followUps: [],
  },
]

/* -------------------------------------------------------------------------- */
/* Analytics                                                                  */
/* -------------------------------------------------------------------------- */

export const MOCK_ANALYTICS: AnalyticsSnapshot = {
  windowLabel: 'Last 30 days',
  availability: 'measured',
  kpis: [
    { key: 'queries', label: 'AI queries', value: 8420, unit: 'count', deltaPct: 12.4, hint: 'Assistant questions answered, excluding internal evaluation traffic.' },
    { key: 'active_users', label: 'Active users', value: 268, unit: 'count', deltaPct: 4.1, hint: 'Users who asked at least one question in this window.' },
    { key: 'agent_executions', label: 'Agent executions', value: 11290, unit: 'count', deltaPct: 9.7, hint: 'Completed agent runs across all three agents.' },
    { key: 'resolution_rate', label: 'Successful resolutions', value: 88.6, unit: 'percent', deltaPct: 1.8, hint: 'Answers rated helpful or not re-asked within 24 hours.' },
    { key: 'avg_latency', label: 'Average response time', value: 2180, unit: 'ms', deltaPct: -6.2, hint: 'Question submission to first complete answer, p50.' },
    { key: 'unanswered', label: 'Unanswered questions', value: 214, unit: 'count', deltaPct: -8.9, hint: 'Fallback to insufficient evidence — a knowledge gap signal, not a failure.' },
  ],
  queryVolume: Array.from({ length: 30 }).map((_, index) => {
    const offset = 29 - index
    const weekday = new Date(TODAY.getTime() - offset * DAY).getUTCDay()
    const weekend = weekday === 0 || weekday === 6 ? 0.42 : 1
    return {
      date: dayKey(offset),
      queries: Math.round((238 + ((index * 53) % 61) - 26) * weekend),
      approvals: Math.round((9 + ((index * 17) % 11) - 5) * weekend),
    }
  }),
  agentUsage: [
    { name: 'Support Agent', department: 'Support', executions: 4820, successRate: 0.86 },
    { name: 'HR Agent', department: 'HR', executions: 3910, successRate: 0.94 },
    { name: 'Finance Agent', department: 'Finance', executions: 2560, successRate: 0.89 },
  ],
  latency: [
    { bucket: '< 1s', count: 1240 },
    { bucket: '1–2s', count: 3980 },
    { bucket: '2–3s', count: 2410 },
    { bucket: '3–4s', count: 620 },
    { bucket: '4–5s', count: 140 },
    { bucket: '> 5s', count: 30 },
  ],
  unanswered: [
    { question: 'Sabbatical eligibility for engineering managers', count: 34, department: 'HR', suggestedFix: 'Publish the sabbatical section referenced but not detailed in the HR Policy Library.' },
    { question: 'Paid paternity leave entitlement', count: 27, department: 'HR', suggestedFix: 'Enable OCR for the scanned page in the leave policy so the entitlement is retrievable.' },
    { question: 'Courier partner settlement terms', count: 19, department: 'Support', suggestedFix: 'Upload the courier partner agreement to the Support Operations knowledge base.' },
    { question: 'Capital expenditure approval limits', count: 15, department: 'Finance', suggestedFix: 'Add procurement thresholds as a structured document rather than a table image.' },
    { question: 'Fallback provider capacity limits', count: 12, department: 'Support', suggestedFix: 'Document the observed throughput ceiling from the September incident.' },
  ],
  topDocuments: [
    { documentName: 'Employee Handbook — Leave Policy.pdf', retrievalCount: 1284, department: 'HR' },
    { documentName: 'Travel & Expense Reimbursement Policy.pdf', retrievalCount: 967, department: 'Finance' },
    { documentName: 'Customer Support SLA Matrix.xlsx', retrievalCount: 738, department: 'Support' },
    { documentName: 'Platform Release Notes — Q3 2026.md', retrievalCount: 521, department: 'Engineering' },
    { documentName: 'Payment Failure Incident Report — Sept 2026.pdf', retrievalCount: 412, department: 'Support' },
  ],
  cost: [
    { date: dayKey(29), amount: 118.4 }, { date: dayKey(24), amount: 131.2 }, { date: dayKey(19), amount: 126.8 },
    { date: dayKey(14), amount: 142.6 }, { date: dayKey(9), amount: 138.1 }, { date: dayKey(4), amount: 151.9 },
    { date: dayKey(0), amount: 96.3 },
  ],
  approvalVolume: Array.from({ length: 14 }).map((_, index) => {
    const offset = 13 - index
    const requested = 6 + ((index * 7) % 9)
    const approved = Math.max(0, requested - 2 + (index % 3))
    return { date: dayKey(offset), requested, approved, rejected: Math.max(0, requested - approved - 1) }
  }),
}

/* -------------------------------------------------------------------------- */
/* Audit, security and notifications                                           */
/* -------------------------------------------------------------------------- */

export const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'aud_120', at: '2026-09-15T09:41:12Z', actorName: 'Anush Kannan', actorRole: 'admin', action: 'login',
    summary: 'Signed in with SSO and multi-factor authentication', result: 'success',
    resource: { type: 'session', id: 'sess_9f21', label: 'Web session' },
    ipAddress: '203.0.113.42', userAgent: 'Chrome 129 · macOS', requestId: 'req_7f31c9', technical: { method: 'saml_sso', mfa: 'totp', session_minutes: 480 },
  },
  {
    id: 'aud_119', at: '2026-09-15T09:34:02Z', actorName: 'Meera Shah', actorRole: 'support', action: 'agent_executed',
    summary: 'Support Agent executed a run: “What is causing the increase in payment failures this week?”', result: 'success',
    resource: { type: 'agent_run', id: 'run_8842', label: 'Support Agent' },
    ipAddress: '198.51.100.7', userAgent: 'Chrome 128 · Windows', requestId: 'req_a1c40e', technical: { intent: 'Support / Incident triage', confidence: 0.92, sources: 4, excluded_by_permission: 1, model: 'gpt-4o-mini' },
  },
  {
    id: 'aud_118', at: '2026-09-15T09:28:15Z', actorName: 'SmartCorp Decision Engine', actorRole: 'system', action: 'decision_generated',
    summary: 'Decision raised: expense policy conflict between two approved documents', result: 'success',
    resource: { type: 'decision', id: 'dec_expense_conflict', label: 'Expense policy conflict' },
    ipAddress: '—', userAgent: 'decision-engine/1.4', requestId: 'req_b8e117', technical: { risk: 'medium', confidence: 0.87, evidence_count: 3, approver: 'Daniel Okonkwo' },
  },
  {
    id: 'aud_117', at: '2026-09-15T09:12:00Z', actorName: 'Tomás Alvarez', actorRole: 'employee', action: 'ai_query',
    summary: 'Asked the AI Assistant: “Can employees carry forward unused leave?”', result: 'success',
    resource: { type: 'agent_run', id: 'run_8841', label: 'HR Agent' },
    ipAddress: '192.0.2.88', userAgent: 'Safari 18 · macOS', requestId: 'req_c2d9aa', technical: { intent: 'HR / Leave policy', confidence: 0.96, knowledge_bases: 'kb_hr', answer_state: 'answered' },
  },
  {
    id: 'aud_116', at: '2026-09-15T08:30:02Z', actorName: 'Daniel Okonkwo', actorRole: 'finance', action: 'ai_query',
    summary: 'Asked the AI Assistant: “What is the daily meal reimbursement cap for domestic travel?”', result: 'success',
    resource: { type: 'agent_run', id: 'run_8850', label: 'Finance Agent' },
    ipAddress: '203.0.113.19', userAgent: 'Chrome 129 · Windows', requestId: 'req_d11f22', technical: { intent: 'Finance / Expense policy', confidence: 0.94, conflict_detected: true },
  },
  {
    id: 'aud_115', at: '2026-09-15T08:20:44Z', actorName: 'Priya Raghunathan', actorRole: 'hr', action: 'document_uploaded',
    summary: 'Uploaded New Hire Onboarding Playbook.docx (v2.0) to HR Policy Library', result: 'success',
    resource: { type: 'document', id: 'doc_onboarding', label: 'New Hire Onboarding Playbook.docx' },
    ipAddress: '203.0.113.51', userAgent: 'Chrome 129 · Windows', requestId: 'req_e30b71', technical: { size_bytes: 655360, pages: 31, virus_scan: 'clean', pipeline: 'extract → chunk → embed → index' },
  },
  {
    id: 'aud_114', at: '2026-09-15T07:05:04Z', actorName: 'Meera Shah', actorRole: 'support', action: 'decision_generated',
    summary: 'Support Agent raised a HIGH-risk recommendation for payment failure mitigation', result: 'success',
    resource: { type: 'decision', id: 'dec_payment_failures', label: 'Payment failures increased 28%' },
    ipAddress: '198.51.100.7', userAgent: 'Chrome 128 · Windows', requestId: 'req_f17a02', technical: { risk: 'high', confidence: 0.91, evidence_count: 4, sla_hours: 11 },
  },
  {
    id: 'aud_113', at: '2026-09-15T06:10:31Z', actorName: 'Priya Raghunathan', actorRole: 'hr', action: 'document_published',
    summary: 'Published Employee Handbook — Leave Policy.pdf v4.2 to the HR knowledge base', result: 'success',
    resource: { type: 'document', id: 'doc_leave_policy', label: 'Employee Handbook — Leave Policy.pdf' },
    ipAddress: '203.0.113.51', userAgent: 'Chrome 129 · Windows', requestId: 'req_g44cd8', technical: { version: 'v4.2', chunks_created: 218, embedding_model: 'text-embedding-3-large' },
  },
  {
    id: 'aud_112', at: '2026-09-14T17:22:48Z', actorName: 'Ruth Bekele', actorRole: 'employee', action: 'document_accessed',
    summary: 'Opened Customer Support SLA Matrix.xlsx from the knowledge hub', result: 'success',
    resource: { type: 'document', id: 'doc_sla_matrix', label: 'Customer Support SLA Matrix.xlsx' },
    ipAddress: '192.0.2.140', userAgent: 'Edge 129 · Windows', requestId: 'req_h55ef0', technical: { access_level: 'department', via: 'Support role' },
  },
  {
    id: 'aud_111', at: '2026-09-14T15:05:12Z', actorName: 'Daniel Okonkwo', actorRole: 'finance', action: 'permission_changed',
    summary: 'Changed the access level of Travel & Expense Reimbursement Policy.pdf from organization to department', result: 'success',
    resource: { type: 'document', id: 'doc_expense_policy', label: 'Travel & Expense Reimbursement Policy.pdf' },
    ipAddress: '203.0.113.19', userAgent: 'Chrome 129 · Windows', requestId: 'req_i66a13', technical: { previous: 'organization', next: 'department', affected_users: 268, reindex_required: true },
  },
  {
    id: 'aud_110', at: '2026-09-14T16:20:31Z', actorName: 'Tomás Alvarez', actorRole: 'employee', action: 'ai_query',
    summary: 'AI Assistant returned insufficient evidence for “sabbatical eligibility period”', result: 'success',
    resource: { type: 'agent_run', id: 'run_8843', label: 'HR Agent' },
    ipAddress: '192.0.2.88', userAgent: 'Safari 18 · macOS', requestId: 'req_j77b24', technical: { answer_state: 'insufficient_evidence', best_score: 0.41, threshold: 0.62, fallback: 'safe' },
  },
  {
    id: 'aud_109', at: '2026-09-14T11:03:07Z', actorName: 'Meera Shah', actorRole: 'support', action: 'approval_rejected',
    summary: 'Rejected the recommendation to add overnight enterprise coverage', result: 'success',
    resource: { type: 'approval', id: 'apr_4', label: 'Overnight coverage for enterprise queue' },
    ipAddress: '198.51.100.7', userAgent: 'Chrome 128 · Windows', requestId: 'req_k88c35', technical: { risk: 'medium', reason_provided: true, resulting_task: 'none' },
  },
  {
    id: 'aud_108', at: '2026-09-12T11:40:22Z', actorName: 'Anush Kannan', actorRole: 'admin', action: 'approval_granted',
    summary: 'Granted Engineering read access to restricted retrieval decision records', result: 'success',
    resource: { type: 'approval', id: 'apr_3', label: 'Engineering access to restricted ADRs' },
    ipAddress: '203.0.113.42', userAgent: 'Chrome 129 · macOS', requestId: 'req_l99d46', technical: { resulting_task: 'task_access_review', scope: 'engineering-platform', review_cycle_days: 90 },
  },
  {
    id: 'aud_107', at: '2026-09-12T10:15:33Z', actorName: 'Finance Agent', actorRole: 'system', action: 'permission_denied',
    summary: 'Retrieval excluded a restricted board document from a Finance Agent query', result: 'denied',
    resource: { type: 'document', id: 'doc_board_minutes', label: 'Board Compensation Minutes (Restricted).pdf' },
    ipAddress: '—', userAgent: 'retrieval-service/2.2', requestId: 'req_m10e57', technical: { filter_stage: 'pre-ranking', excluded_candidates: 1, requester_role: 'finance', access_level: 'restricted', content_returned: false },
  },
  {
    id: 'aud_106', at: '2026-09-12T09:15:40Z', actorName: 'Tomás Alvarez', actorRole: 'employee', action: 'login',
    summary: 'Sign-in blocked — device not enrolled in the managed fleet', result: 'denied',
    resource: { type: 'session', id: 'sess_denied_01', label: 'Web session' },
    ipAddress: '192.0.2.201', userAgent: 'Firefox 131 · Linux', requestId: 'req_n11f68', technical: { method: 'password', mfa: 'not_reached', policy: 'managed_device_required' },
  },
  {
    id: 'aud_105', at: '2026-09-14T22:00:00Z', actorName: 'Scheduled job', actorRole: 'system', action: 'evaluation_run',
    summary: 'Nightly regression completed: 108 cases, 84/100 overall score', result: 'success',
    resource: { type: 'evaluation_run', id: 'eval_2026_09_14', label: 'Nightly regression — 14 Sept 2026' },
    ipAddress: '—', userAgent: 'evaluation-runner/3.1', requestId: 'req_o22a79', technical: { pass_rate: 0.81, failures: 13, hallucinations: 2, duration_s: 742 },
  },
  {
    id: 'aud_104', at: '2026-09-11T06:12:00Z', actorName: 'Meera Shah', actorRole: 'support', action: 'document_accessed',
    summary: 'Opened Payment Failure Incident Report — Sept 2026.pdf during incident triage', result: 'success',
    resource: { type: 'document', id: 'doc_payment_failures', label: 'Payment Failure Incident Report — Sept 2026.pdf' },
    ipAddress: '198.51.100.7', userAgent: 'Chrome 128 · Windows', requestId: 'req_p33b81', technical: { via: 'incident_bridge', related_incident: 'INC-2026-0911' },
  },
  {
    id: 'aud_103', at: '2026-09-10T14:45:10Z', actorName: 'Meera Shah', actorRole: 'support', action: 'approval_rejected',
    summary: 'Rejected the overnight coverage recommendation pending measurement correction', result: 'success',
    resource: { type: 'approval', id: 'apr_4', label: 'Overnight coverage for enterprise queue' },
    ipAddress: '198.51.100.7', userAgent: 'Chrome 128 · Windows', requestId: 'req_q44c92', technical: { risk: 'medium', reason_provided: true },
  },
  {
    id: 'aud_102', at: '2026-09-12T10:14:02Z', actorName: 'Anush Kannan', actorRole: 'admin', action: 'permission_changed',
    summary: 'Adjusted the Engineering platform team’s knowledge scope to include ADRs', result: 'success',
    resource: { type: 'knowledge_base', id: 'kb_eng', label: 'Engineering Handbook' },
    ipAddress: '203.0.113.42', userAgent: 'Chrome 129 · macOS', requestId: 'req_r55da3', technical: { granted_to: 'engineering-platform', scope_before: 'none', scope_after: 'read' },
  },
]

export const MOCK_SECURITY_OVERVIEW: SecurityOverview = {
  organizationStatus: [
    { label: 'Organisation', value: 'Northwind Industries · Enterprise', state: 'ok' },
    { label: 'Data region', value: 'ap-south-1 (Mumbai)', state: 'ok' },
    { label: 'SSO enforcement', value: 'Required for all users', state: 'ok' },
    { label: 'Multi-factor authentication', value: '137 of 141 users enrolled (97%)', state: 'attention' },
    { label: 'Knowledge bases in scope', value: '5 of 5 indexed', state: 'attention' },
  ],
  accessControl: [
    { label: 'Role coverage', value: 'All 5 roles mapped to a permission set', state: 'ok', hint: 'Roles: Admin, HR, Finance, Support, Employee.' },
    { label: 'Retrieval-level filtering', value: 'Enforced before similarity ranking', state: 'ok', hint: 'Department and access-level filters are applied at the vector query, not after it.' },
    { label: 'Restricted documents', value: '2 documents limited to named users', state: 'attention', hint: 'Explicit grants are reviewed quarterly.' },
    { label: 'Stale access grants', value: '1 grant older than 90 days', state: 'attention', hint: 'Engineering platform team access to restricted ADRs is due for review on 12 Dec 2026.' },
    { label: 'Frontend-only hiding detected', value: 'None', state: 'ok', hint: 'Interface restrictions mirror API permissions and are never the sole control.' },
  ],
  restrictedDocuments: [
    { id: 'doc_board_minutes', name: 'Board Compensation Minutes (Restricted).pdf', department: 'Finance', accessLevel: 'restricted', restriction: 'Administrators and one explicit grant' },
    { id: 'doc_arch_decisions', name: 'Architecture Decision Records — Retrieval Pipeline.md', department: 'Engineering', accessLevel: 'restricted', restriction: 'Engineering platform team, reviewed quarterly' },
  ],
  permissionChanges: MOCK_AUDIT_EVENTS.filter((event) => event.action === 'permission_changed' || event.action === 'permission_denied'),
  securityEvents: [
    MOCK_AUDIT_EVENTS.find((event) => event.id === 'aud_106')!,
    MOCK_AUDIT_EVENTS.find((event) => event.id === 'aud_107')!,
    MOCK_AUDIT_EVENTS.find((event) => event.id === 'aud_111')!,
  ],
  authenticationActivity: Array.from({ length: 14 }).map((_, index) => {
    const offset = 13 - index
    const success = 96 + ((index * 13) % 24)
    const failed = 2 + ((index * 5) % 7)
    return { date: dayKey(offset), success, failed, mfa: success - 3 }
  }),
  auditStatus: {
    retentionDays: 730,
    lastIntegrityCheck: '2026-09-15T02:00:00Z',
    exportedAt: '2026-09-01T09:30:00Z',
    coveragePct: 100,
  },
}

export const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'ntf_1', title: 'High-risk recommendation awaiting your review', body: 'Support Agent proposed fallback payment routing for affected transactions.', at: '2026-09-15T07:08:00Z', kind: 'approval', read: false, href: '/approvals/apr_1' },
  { id: 'ntf_2', title: 'Support Agent is degraded', body: 'Average latency is 2.6s against a 2.0s target for the last 6 hours.', at: '2026-09-15T06:20:00Z', kind: 'agent', read: false, href: '/agents/agent_support' },
  { id: 'ntf_3', title: 'Evaluation run finished with 13 failures', body: 'Nightly regression scored 84/100. 2 hallucination cases require review.', at: '2026-09-14T22:15:00Z', kind: 'evaluation', read: false, href: '/evaluation' },
  { id: 'ntf_4', title: 'Document indexing failed', body: 'Architecture Decision Records could not be indexed — embedding provider rate limit.', at: '2026-09-15T05:55:00Z', kind: 'knowledge', read: true, href: '/knowledge/doc_arch_decisions' },
  { id: 'ntf_5', title: 'Permission denial recorded', body: 'A restricted board document was excluded from a retrieval query at the pre-ranking stage.', at: '2026-09-12T10:15:00Z', kind: 'security', read: true, href: '/security' },
]
