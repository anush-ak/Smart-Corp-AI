import {
  ArrowUp,
  Bot,
  BookOpen,
  Check,
  Copy,
  Database,
  Gavel,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Route,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AgentMark } from '@/components/brand'
import { EvidencePanel } from '@/components/ai/evidence-card'
import { RouterExplanation, RunPipeline } from '@/components/ai/agent-run-timeline'
import { Button } from '@/components/ui/button'
import { ConfidenceBadge } from '@/components/ui/metrics'
import { EmptyState, LoadingState } from '@/components/ui/states'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tooltip } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import { useAgents, useConversationMessages, useConversations } from '@/hooks/use-api'
import { useProgressiveStages } from '@/hooks/use-async'
import { chatService } from '@/services'
import type { AgentRun, AgentSummary, ConversationMessage, RetrievedSource } from '@/types'
import { cn, formatRelativeTime } from '@/utils/format'

/* -------------------------------------------------------------------------- */
/* Loading stages: contextual, not a generic spinner                           */
/* -------------------------------------------------------------------------- */

const ANSWER_STAGES = ['Understanding question', 'Searching knowledge', 'Evaluating evidence', 'Preparing answer']

function ProcessingStages({ stageIndex }: { stageIndex: number }) {
  return (
    <ol className="space-y-1.5" aria-live="polite">
      {ANSWER_STAGES.map((stage, index) => {
        const done = index < stageIndex
        const active = index === stageIndex
        return (
          <li key={stage} className="flex items-center gap-2 text-body-sm">
            {done ? (
              <Check className="size-3.5 shrink-0 text-success-600" aria-hidden />
            ) : active ? (
              <span className="relative grid size-3.5 shrink-0 place-items-center" aria-hidden>
                <span className="absolute size-3.5 animate-pulse-soft rounded-full bg-brand-200" />
                <span className="size-1.5 rounded-full bg-brand-600" />
              </span>
            ) : (
              <span className="size-3.5 shrink-0 rounded-full border border-line" aria-hidden />
            )}
            <span className={cn(done ? 'text-ink-400' : active ? 'text-ink-800' : 'text-ink-300')}>{stage}</span>
          </li>
        )
      })}
    </ol>
  )
}

/* -------------------------------------------------------------------------- */
/* Retrieval trace strip                                                       */
/* -------------------------------------------------------------------------- */

function TraceStrip({ run, agent }: { run: AgentRun; agent?: AgentSummary }) {
  const cited = run.retrieved.filter((source) => source.included).length
  const excluded = run.retrieved.length - cited

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-line bg-surface-muted/50 px-4 py-2.5">
      <span className="flex items-center gap-1.5 text-caption text-ink-600">
        <Route className="size-3.5 text-ink-400" aria-hidden />
        <span className="font-medium">{run.routing.detectedIntent}</span>
        <span className="text-ink-400">at {run.routing.confidence}% confidence</span>
      </span>
      <span className="flex items-center gap-1.5 text-caption text-ink-600">
        <Bot className="size-3.5 text-ink-400" aria-hidden />
        {agent?.name}
      </span>
      <span className="flex items-center gap-1.5 text-caption text-ink-600">
        <Database className="size-3.5 text-ink-400" aria-hidden />
        {cited} cited{excluded > 0 ? ` · ${excluded} excluded` : ''}
      </span>
      <Link to={`/agents/runs/${run.id}`} className="ml-auto text-caption font-semibold text-brand-700 hover:text-brand-800">
        Inspect run →
      </Link>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Message rendering                                                           */
/* -------------------------------------------------------------------------- */

function AnswerBody({ content }: { content: string }) {
  // Minimal, safe formatting: paragraphs, bullet lines and **emphasis** only.
  const blocks = content.split('\n\n')
  return (
    <div className="answer-body">
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').filter(Boolean)
        if (lines.every((line) => line.trimStart().startsWith('- '))) {
          return (
            <ul key={blockIndex}>
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInline(line.replace(/^\s*-\s/, ''))}</li>
              ))}
            </ul>
          )
        }
        return <p key={blockIndex}>{renderInline(block)}</p>
      })}
    </div>
  )
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part,
  )
}

function InsufficientEvidence({ content, run }: { content: string; run?: AgentRun }) {
  const bestScore = run?.retrieved[0]?.score
  return (
    <div className="rounded-lg border border-warning-200 bg-warning-50/70 p-4">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-700" aria-hidden />
        <div className="min-w-0">
          <p className="text-body font-semibold text-warning-800">Insufficient evidence</p>
          <div className="mt-1.5 text-body-sm text-warning-800/85">
            <AnswerBody content={content} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge tone="warning" size="sm">
              Safe fallback — no answer was invented
            </StatusBadge>
            {bestScore !== undefined && (
              <span className="font-mono text-[11px] text-warning-800/70">
                best candidate {bestScore.toFixed(2)} · floor 0.62
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" iconLeft={<BookOpen aria-hidden />}>
              Request a document
            </Button>
            <Button variant="ghost" size="sm" iconLeft={<Gavel aria-hidden />}>
              Raise as a knowledge gap
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeedbackRow({ runId }: { runId: string }) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-caption text-ink-400">Was this helpful?</span>
      <div className="flex items-center gap-0.5">
        <Button
          variant={feedback === 'up' ? 'subtle' : 'ghost'}
          size="icon-xs"
          label="This answer was helpful"
          aria-pressed={feedback === 'up'}
          onClick={() => {
            setFeedback('up')
            toast({ title: 'Thanks — recorded', description: `Feedback attached to run ${runId} for the next evaluation.`, tone: 'success' })
          }}
        >
          <ThumbsUp aria-hidden className={feedback === 'up' ? 'text-success-600' : undefined} />
        </Button>
        <Button
          variant={feedback === 'down' ? 'subtle' : 'ghost'}
          size="icon-xs"
          label="This answer was not helpful"
          aria-pressed={feedback === 'down'}
          onClick={() => {
            setFeedback('down')
            toast({
              title: 'Recorded as an evaluation candidate',
              description: 'Negative feedback adds this question to the next evaluation run for review.',
              tone: 'info',
            })
          }}
        >
          <ThumbsDown aria-hidden className={feedback === 'down' ? 'text-danger-600' : undefined} />
        </Button>
      </div>
      <span aria-hidden className="h-4 w-px bg-line" />
      <Button
        variant="ghost"
        size="xs"
        iconLeft={copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        onClick={() => {
          setCopied(true)
          toast({ title: 'Copied with citations', tone: 'success' })
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

function AssistantMessage({
  message,
  onOpenEvidence,
  activeEvidenceId,
  agentsById,
}: {
  message: ConversationMessage
  onOpenEvidence: (source: RetrievedSource) => void
  activeEvidenceId?: string
  /** Agents the API returned for this workspace, keyed by id. */
  agentsById: Map<string, AgentSummary>
}) {
  const run = message.run
  const agent = run ? agentsById.get(run.agentId) : undefined
  const insufficient = run?.answerState === 'insufficient_evidence'

  return (
    <article className="group" aria-label="SmartCorp answer">
      <div className="flex items-start gap-3.5 px-4 py-4 sm:px-6">
        <AgentMark name={agent?.name ?? 'SmartCorp'} accent={agent?.accent} size={30} className="mt-0.5" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-body font-semibold text-ink-900">{agent?.name ?? 'SmartCorp AI'}</span>
            {run && <ConfidenceBadge value={run.routing.confidence} label="Routing confidence" />}
            {run && <span className="text-caption text-ink-400">{formatRelativeTime(message.at)}</span>}
          </div>

          <div className="mt-2.5">
            {insufficient && run ? (
              <InsufficientEvidence content={message.content} run={run} />
            ) : (
              <AnswerBody content={message.content} />
            )}
          </div>

          {/* Recommended action — visually distinct from the answer --------- */}
          {run?.recommendedAction && (
            <div className="mt-3.5 overflow-hidden rounded-lg border border-brand-200 bg-brand-50/50">
              <div className="flex items-center gap-2 border-b border-brand-200/70 px-3.5 py-2">
                <Gavel className="size-3.5 text-brand-700" aria-hidden />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-800">Recommended action</p>
                <StatusBadge tone="warning" size="sm" className="ml-auto">
                  Requires approval
                </StatusBadge>
              </div>
              <div className="px-3.5 py-3">
                <p className="text-body font-medium text-ink-900">{run.recommendedAction.title}</p>
                <p className="mt-1 text-body-sm leading-relaxed text-ink-600">{run.recommendedAction.detail}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link to="/approvals">
                    <Button variant="primary" size="sm">
                      Review recommendation
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm">
                    Dismiss for now
                  </Button>
                  <span className="ml-auto text-caption text-ink-500">
                    Effort {run.recommendedAction.effort} · {run.recommendedAction.reversible ? 'reversible' : 'not reversible'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Evidence summary -------------------------------------------- */}
          {run && run.retrieved.length > 0 && (
            <div className="mt-3.5 rounded-lg border border-line bg-surface-muted/50 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-body-sm font-semibold text-ink-800">
                  Evidence
                  <span className="ml-2 font-normal text-ink-500">
                    {run.retrieved.filter((source) => source.included).length} cited sources
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => run.retrieved[0] && onOpenEvidence(run.retrieved[0])}
                  className="text-caption font-semibold text-brand-700 hover:text-brand-800"
                >
                  Show evidence panel
                </button>
              </div>

              <ul className="mt-2.5 space-y-1.5">
                {run.retrieved.filter((source) => source.included).slice(0, 3).map((source) => (
                  <li key={source.id}>
                    <button
                      type="button"
                      onClick={() => onOpenEvidence(source)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md border bg-surface px-2.5 py-2 text-left transition-colors',
                        activeEvidenceId === source.id ? 'border-brand-300 ring-1 ring-brand-200' : 'border-line hover:border-line-strong',
                      )}
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded-xs bg-surface-muted font-mono text-[10px] text-ink-500" aria-hidden>
                        {source.rank}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm text-ink-800">{source.documentName}</span>
                        <span className="block truncate text-[11px] text-ink-400">
                          {source.page !== null && `Page ${source.page} · `}
                          {source.section ?? source.knowledgeBaseName}
                        </span>
                      </span>
                      <span className="tnum shrink-0 font-mono text-[11px] text-ink-400">{source.score.toFixed(2)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {run && <div className="mt-3">{<FeedbackRow runId={run.id} />}</div>}
        </div>
      </div>

      {run && <TraceStrip run={run} agent={agentsById.get(run.agentId)} />}
    </article>
  )
}

function UserMessage({ message }: { message: ConversationMessage }) {
  const { user } = useAuth()
  return (
    <div className="flex items-start justify-end gap-3.5 px-4 py-4 sm:px-6">
      <div className="max-w-[85%] rounded-lg rounded-tr-sm border border-line bg-surface px-3.5 py-2.5 shadow-xs">
        <p className="text-body text-ink-900">{message.content}</p>
        <p className="mt-1.5 text-right text-[11px] text-ink-400">
          {user?.name} · {formatRelativeTime(message.at)}
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function AssistantPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const conversations = useConversations()
  const messagesQuery = useConversationMessages(conversationId)
  const agentsQuery = useAgents()
  const agentsById = useMemo(
    () => new Map((agentsQuery.data ?? []).map((agent) => [agent.id, agent])),
    [agentsQuery.data],
  )

  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [draft, setDraft] = useState('')
  const [asking, setAsking] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [activeSource, setActiveSource] = useState<RetrievedSource | null>(null)
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false)

  const { index: stageIndex } = useProgressiveStages(ANSWER_STAGES, asking, 520)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Hydrate from the API whenever the conversation changes.
  useEffect(() => {
    if (messagesQuery.data) {
      setMessages(messagesQuery.data)
      const firstRun = messagesQuery.data.find((message) => message.run && message.run.retrieved.some((source) => source.included))
      setActiveSource(firstRun?.run?.retrieved.find((source) => source.included) ?? null)
    } else if (!conversationId) {
      setMessages([])
      setActiveSource(null)
    }
  }, [messagesQuery.data, conversationId])

  const scrollToBottom = useCallback(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, asking, scrollToBottom])

  const activeRun = useMemo(() => {
    const withRun = [...messages].reverse().find((message) => message.run)
    return withRun?.run ?? null
  }, [messages])

  const evidenceSources = activeRun?.retrieved ?? []

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault()
    const question = draft.trim()
    if (!question || asking) return

    const userMessage: ConversationMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content: question,
      at: new Date().toISOString(),
    }
    setMessages((current) => [...current, userMessage])
    setDraft('')
    setAsking(true)

    try {
      const run = await chatService.ask({ question, conversationId })
      const assistantMessage: ConversationMessage = {
        id: `local-assistant-${run.id}`,
        role: 'assistant',
        content: run.answer,
        at: new Date().toISOString(),
        run,
      }
      setMessages((current) => [...current, assistantMessage])
      setActiveSource(run.retrieved.find((source) => source.included) ?? null)
      if (run.answerState === 'insufficient_evidence') {
        toast({
          title: 'Insufficient evidence',
          description: 'SmartCorp returned the safe fallback rather than answering without support.',
          tone: 'warning',
        })
      }
    } catch {
      toast({ title: 'The assistant could not complete this request', description: 'Try again, or check the API connection.', tone: 'danger' })
    } finally {
      setAsking(false)
    }
  }

  const currentConversation = conversations.data?.find((conversation) => conversation.id === conversationId)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0">
      {/* ---------------------------------------------------------------- */}
      {/* History                                                           */}
      {/* ---------------------------------------------------------------- */}
      <aside
        className={cn(
          'flex w-[268px] shrink-0 flex-col border-r border-line bg-surface',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:w-[280px]',
          mobileHistoryOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
          'transition-transform lg:translate-x-0',
        )}
        aria-label="Conversation history"
      >
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
          <p className="text-h3 text-ink-900">Conversations</p>
          <Button
            variant="primary"
            size="xs"
            iconLeft={<Plus aria-hidden />}
            onClick={() => navigate('/assistant')}
          >
            New
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {conversations.initialLoading ? (
            <LoadingState rows={6} />
          ) : (conversations.data ?? []).length === 0 ? (
            <EmptyState
              variant="inline"
              icon={MessageSquare}
              title="No conversations yet"
              description="Ask your first question to start a thread."
            />
          ) : (
            <ul className="space-y-0.5">
              {(conversations.data ?? []).map((conversation) => {
                const active = conversation.id === conversationId
                return (
                  <li key={conversation.id}>
                    <Link
                      to={`/assistant/${conversation.id}`}
                      onClick={() => setMobileHistoryOpen(false)}
                      className={cn(
                        'block rounded-md px-2.5 py-2 transition-colors',
                        active ? 'bg-brand-50' : 'hover:bg-surface-muted',
                      )}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className={cn('min-w-0 flex-1 text-body-sm font-medium', active ? 'text-brand-800' : 'text-ink-800')}>
                          {conversation.title}
                        </span>
                        {conversation.pinned && (
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand-500" aria-label="Pinned" />
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
                        <span>{conversation.department}</span>
                        <span>·</span>
                        <span>{conversation.messageCount} messages</span>
                        <span>·</span>
                        <span>{formatRelativeTime(conversation.updatedAt)}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-line p-3">
          <p className="text-caption leading-relaxed text-ink-400">
            Every answer is retrievable and auditable. Conversations in your history are limited to knowledge your role
            may access.
          </p>
        </div>
      </aside>

      {/* ---------------------------------------------------------------- */}
      {/* Conversation                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="flex min-w-0 flex-1 flex-col bg-canvas" aria-label="Conversation">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            label="Open conversation history"
            className="lg:hidden"
            onClick={() => setMobileHistoryOpen((open) => !open)}
          >
            <MessageSquare aria-hidden />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-h3 text-ink-900">
              {currentConversation?.title ?? (conversationId ? 'Conversation' : 'New question')}
            </p>
            <p className="truncate text-[11px] text-ink-400">
              {currentConversation
                ? `${currentConversation.department} · ${currentConversation.messageCount} messages`
                : 'Permission-aware answers with citations'}
            </p>
          </div>

          <StatusBadge tone="brand" size="sm" className="hidden sm:inline-flex">
            Enterprise AI workspace
          </StatusBadge>

          <Tooltip label={panelOpen ? 'Hide evidence panel' : 'Show evidence panel'}>
            <Button
              variant="ghost"
              size="icon-sm"
              label={panelOpen ? 'Hide evidence panel' : 'Show evidence panel'}
              onClick={() => setPanelOpen((open) => !open)}
              aria-pressed={panelOpen}
            >
              {panelOpen ? <PanelRightClose aria-hidden /> : <PanelRightOpen aria-hidden />}
            </Button>
          </Tooltip>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 && !asking ? (
            <div className="mx-auto max-w-[720px] px-6 py-10">
              <div className="flex items-center gap-3">
                <AgentMark name="SmartCorp" accent="indigo" size={34} />
                <div>
                  <h2 className="text-h2 text-ink-900">Ask SmartCorp</h2>
                  <p className="text-body-sm text-ink-500">
                    Answers come from your organisation’s approved knowledge, with the evidence attached.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {[
                  { label: 'HR', question: 'Can employees carry forward unused leave?', icon: BookOpen },
                  { label: 'Finance', question: 'What is the daily meal reimbursement cap for domestic travel?', icon: BookOpen },
                  { label: 'Support', question: 'What is causing the increase in payment failures this week?', icon: TriangleAlert },
                  { label: 'Cross-domain', question: 'Which policy governs excess baggage on international travel?', icon: Route },
                ].map((example) => (
                  <button
                    key={example.question}
                    type="button"
                    onClick={() => setDraft(example.question)}
                    className="rounded-md border border-line bg-surface p-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      <example.icon className="size-3" aria-hidden />
                      {example.label}
                    </span>
                    <span className="mt-1.5 block text-body-sm text-ink-700">{example.question}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-lg border border-line bg-surface p-4">
                <p className="text-body-sm font-semibold text-ink-800">How a SmartCorp answer is produced</p>
                <ul className="mt-2 space-y-1.5 text-caption leading-relaxed text-ink-500">
                  <li>1 · Your role is checked, and retrieval is filtered to permitted knowledge before ranking.</li>
                  <li>2 · Intent is classified and routed to HR, Finance or Support with a confidence score.</li>
                  <li>3 · Passages below the relevance floor are excluded and their exclusion recorded.</li>
                  <li>4 · Every statement in the answer is bound to a page or section reference.</li>
                  <li>5 · If evidence is insufficient, SmartCorp says so rather than guessing.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[860px] divide-y divide-line-subtle">
              {messages.map((message) =>
                message.role === 'user' ? (
                  <UserMessage key={message.id} message={message} />
                ) : (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    agentsById={agentsById}
                    onOpenEvidence={(source) => {
                      setActiveSource(source)
                      setPanelOpen(true)
                    }}
                    activeEvidenceId={activeSource?.id}
                  />
                ),
              )}

              {asking && (
                <div className="flex items-start gap-3.5 px-4 py-4 sm:px-6">
                  <AgentMark name="SmartCorp" accent="indigo" size={30} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-semibold text-ink-900">Working on your question</p>
                    <div className="mt-2.5">
                      <ProcessingStages stageIndex={stageIndex} />
                    </div>
                    <p className="mt-2.5 text-caption text-ink-400">
                      Retrieval filters are applied inside the query, so only knowledge permitted for your role is scored.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer ------------------------------------------------------- */}
        <div className="shrink-0 border-t border-line bg-surface px-4 py-3 sm:px-6">
          <form onSubmit={submit} className="mx-auto max-w-[860px]">
            <div className="flex items-end gap-2 rounded-lg border border-line bg-surface p-1.5 shadow-xs transition-colors focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20">
              <label htmlFor="assistant-input" className="sr-only">
                Ask SmartCorp
              </label>
              <textarea
                id="assistant-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void submit()
                  }
                }}
                rows={1}
                placeholder="Ask about a policy, a customer issue or an incident…"
                className="max-h-40 min-h-[34px] flex-1 resize-none bg-transparent px-2 py-1.5 text-body text-ink-900 placeholder:text-ink-300 focus:outline-none"
              />
              <Button
                type="submit"
                variant="primary"
                size="icon"
                label="Send question"
                loading={asking}
                disabled={!draft.trim()}
              >
                <ArrowUp aria-hidden />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-400">
              <span>
                Enter to send · Shift + Enter for a new line
              </span>
              <span className="flex items-center gap-1.5">
                <Database className="size-3" aria-hidden />
                Retrieval scoped to {(activeRun?.routing.knowledgeBaseIds ?? []).length > 0
                  ? activeRun?.routing.knowledgeBaseIds.map((id) => id.replace('kb_', '').toUpperCase()).join(', ')
                  : 'your permitted knowledge'}
              </span>
            </div>
          </form>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Evidence / context panel                                          */}
      {/* ---------------------------------------------------------------- */}
      {panelOpen && (
        <aside
          className="flex w-[360px] shrink-0 flex-col border-l border-line bg-surface max-xl:hidden"
          aria-label="Evidence and context"
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
            <p className="text-h3 text-ink-900">Evidence & context</p>
            <Button variant="ghost" size="icon-sm" label="Close evidence panel" onClick={() => setPanelOpen(false)} className="xl:hidden">
              <PanelRightClose aria-hidden />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!activeRun ? (
              <EmptyState
                variant="inline"
                icon={Sparkles}
                title="No answer selected"
                description="Ask a question or select a message to see the evidence, routing decision and citations behind it."
              />
            ) : (
              <div className="space-y-5">
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-h3 text-ink-900">Response metadata</h3>
                    <StatusBadge tone={activeRun.answerState === 'answered' ? 'success' : 'warning'} size="sm">
                      {activeRun.answerState === 'answered' ? 'Answered from evidence' : 'Safe fallback'}
                    </StatusBadge>
                  </div>
                  <dl className="space-y-2 rounded-md border border-line bg-surface-muted/40 p-3">
                    {[
                      { label: 'Run', value: activeRun.id },
                      { label: 'Model', value: activeRun.model },
                      { label: 'Duration', value: `${activeRun.durationMs} ms` },
                      { label: 'Tokens', value: `${activeRun.tokenUsage.prompt} in / ${activeRun.tokenUsage.completion} out` },
                      { label: 'Audit events', value: activeRun.auditEventIds.join(', ') },
                    ].map((row) => (
                      <div key={row.label} className="flex items-baseline justify-between gap-3">
                        <dt className="text-caption text-ink-400">{row.label}</dt>
                        <dd className="truncate font-mono text-[11px] text-ink-700">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-2">
                    <RunPipeline run={activeRun} />
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-h3 text-ink-900">Why this agent</h3>
                  <RouterExplanation run={activeRun} />
                </section>

                <EvidencePanel
                  sources={evidenceSources}
                  citations={activeRun.citations}
                  onOpenEvidence={(source) => setActiveSource(source)}
                />

                {activeSource && (
                  <section className="rounded-md border border-brand-200 bg-brand-50/50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-800">Selected source</p>
                    <p className="mt-1 text-body-sm font-medium text-ink-900">{activeSource.documentName}</p>
                    <p className="mt-0.5 text-caption text-ink-500">
                      {activeSource.knowledgeBaseName}
                      {activeSource.page !== null && ` · page ${activeSource.page}`}
                      {activeSource.section && ` · ${activeSource.section}`}
                    </p>
                    <p className="mt-2 border-l-2 border-brand-300 pl-2.5 text-body-sm text-ink-600">“{activeSource.snippet}”</p>
                    <Link
                      to={`/knowledge/${activeSource.documentId}`}
                      className="mt-2 inline-block text-caption font-semibold text-brand-700 hover:text-brand-800"
                    >
                      Open document →
                    </Link>
                  </section>
                )}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
