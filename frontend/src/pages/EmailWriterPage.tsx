import React, { useState, useEffect } from 'react';
import {
  MailCheck,
  Send,
  Copy,
  Check,
  RefreshCw,
  Scissors,
  Wand2,
  RotateCcw,
  FileText,
  User,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import {
  EmailAction,
  EmailMessageType,
  EmailTone,
  EmailWriterResponse,
  TeamMember,
} from '../types';
import { PageHeader, Button, Badge, ErrorBanner } from '../components/ui/Primitives';

const MESSAGE_TYPES: EmailMessageType[] = [
  'Professional email',
  'Internal company message',
  'Meeting follow-up',
  'Leave request',
  'Project update',
  'Announcement',
];

const TONES: EmailTone[] = [
  'Professional',
  'Concise',
  'Friendly',
  'Formal',
  'Persuasive',
];

const QUICK_PRESETS: Array<{
  label: string;
  type: EmailMessageType;
  tone: EmailTone;
  subject: string;
  description: string;
  points: string;
}> = [
  {
    label: 'Sprint Status Update',
    type: 'Project update',
    tone: 'Concise',
    subject: 'Q4 Enterprise Migration — Weekly Progress',
    description: 'Summarize this week’s backend migration progress, database optimization, and upcoming security sign-off.',
    points: 'Auth middleware completed\nDatabase pool latency reduced by 35%\nSOC-2 review scheduled Friday',
  },
  {
    label: 'Meeting Follow-Up',
    type: 'Meeting follow-up',
    tone: 'Professional',
    subject: 'Action Items & Next Steps from Today’s Sync',
    description: 'Recap key decisions and confirm owners and deadlines agreed during our operations sync.',
    points: 'Confirm PR review by tomorrow\nShare compliance evidence checklist\nSync again Monday at 10 AM',
  },
  {
    label: 'Leave Notice',
    type: 'Leave request',
    tone: 'Formal',
    subject: 'Planned Leave Request — Upcoming Dates',
    description: 'Request planned time off next week and confirm coverage for ongoing deliverables.',
    points: 'Handing over active tickets to teammate\nAvailable for urgent escalations',
  },
  {
    label: 'Team Announcement',
    type: 'Announcement',
    tone: 'Friendly',
    subject: 'Welcome & New Policy Updates',
    description: 'Announce updated hybrid work guidelines and invite the team to Friday’s townhall.',
    points: 'Updated remote stipend policy in Company Brain\nTownhall at 3 PM Friday',
  },
];

export const EmailWriterPage: React.FC = () => {
  const { token, user } = useAuth();

  const [messageType, setMessageType] = useState<EmailMessageType>('Professional email');
  const [tone, setTone] = useState<EmailTone>('Professional');
  const [recipient, setRecipient] = useState<string>('');
  const [subjectInput, setSubjectInput] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [importantPoints, setImportantPoints] = useState<string>('');

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [generatedSubject, setGeneratedSubject] = useState<string>('');
  const [generatedBody, setGeneratedBody] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [activeAction, setActiveAction] = useState<EmailAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/team`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TeamMember[]) => setTeam(data))
      .catch(() => {});
  }, [token]);

  const runWriter = async (action: EmailAction) => {
    if (!token) return;
    if (!description.trim() && !generatedBody.trim()) {
      setError('Please describe what you want to communicate before generating.');
      return;
    }

    setIsGenerating(true);
    setActiveAction(action);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/email-writer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: description.trim() || generatedBody.trim(),
          message_type: messageType,
          tone,
          recipient: recipient.trim() || undefined,
          subject: (generatedSubject || subjectInput).trim() || undefined,
          important_points: importantPoints.trim() || undefined,
          action,
          current_draft: generatedBody.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to generate draft (${response.status})`);
      }

      const data: EmailWriterResponse = await response.json();
      setGeneratedSubject(data.subject);
      setGeneratedBody(data.body);
    } catch (err: any) {
      setError(err.message || 'Unable to generate message. Please try again.');
    } finally {
      setIsGenerating(false);
      setActiveAction(null);
    }
  };

  const handleCopy = async () => {
    if (!generatedBody.trim()) return;
    const fullText = generatedSubject.trim()
      ? `Subject: ${generatedSubject.trim()}\n\n${generatedBody}`
      : generatedBody;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard permission denied. Please select and copy the draft manually.');
    }
  };

  const applyPreset = (preset: (typeof QUICK_PRESETS)[number]) => {
    setMessageType(preset.type);
    setTone(preset.tone);
    setSubjectInput(preset.subject);
    setDescription(preset.description);
    setImportantPoints(preset.points);
    setError(null);
  };

  const wordCount = generatedBody.trim() ? generatedBody.trim().split(/\s+/).length : 0;
  const charCount = generatedBody.length;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas text-text-primary transition-colors">
      <PageHeader
        title="AI Email & Message Writer"
        subtitle="Draft, refine, and adapt enterprise communications in seconds"
        icon={MailCheck}
        badge={<Badge tone="indigo">Gemini 2.5</Badge>}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border overflow-hidden">
        {/* Left Panel: Structured Composition Controls */}
        <div className="lg:col-span-5 flex flex-col overflow-y-auto bg-surface p-5 space-y-5">
          {/* Quick Presets */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              Quick Templates
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-subtle hover:bg-elevated text-text-muted hover:text-text-primary border border-border transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-primary flex items-center gap-1.5">
              <FileText size={13} className="text-indigo-500" strokeWidth={1.75} />
              <span>Message Type</span>
            </label>
            <select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value as EmailMessageType)}
              className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-indigo-500"
            >
              {MESSAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Tone Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-primary flex items-center gap-1.5">
              <SlidersHorizontal size={13} className="text-indigo-500" strokeWidth={1.75} />
              <span>Tone</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 gap-1.5">
              {TONES.map((t) => {
                const active = tone === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-canvas text-text-muted hover:text-text-primary border-border hover:bg-subtle'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recipient & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                <User size={13} className="text-text-muted" strokeWidth={1.75} />
                <span>Recipient</span>
              </label>
              <input
                type="text"
                list="team-recipients"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="e.g. Nicholas, Product Team"
                className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-indigo-500"
              />
              <datalist id="team-recipients">
                {team
                  .filter((m) => m.id !== user?.id)
                  .map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.role} • {m.department})
                    </option>
                  ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-primary">Subject (Optional)</label>
              <input
                type="text"
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-primary">
              What do you want to communicate? <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe the purpose, context, and desired outcome of this message..."
              className="w-full bg-canvas border border-border rounded-md px-3 py-2.5 text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-indigo-500 resize-y leading-relaxed"
            />
          </div>

          {/* Important Points */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-primary">
              Key Points to Include (Optional)
            </label>
            <textarea
              rows={3}
              value={importantPoints}
              onChange={(e) => setImportantPoints(e.target.value)}
              placeholder="- Deadlines or dates&#10;- Specific decisions or numbers&#10;- Clear call to action"
              className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-indigo-500 resize-y leading-relaxed"
            />
          </div>

          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          <div className="pt-1">
            <Button
              variant="primary"
              className="w-full"
              disabled={!description.trim() || isGenerating}
              isLoading={isGenerating && activeAction === 'generate'}
              onClick={() => runWriter('generate')}
            >
              <Send size={13} strokeWidth={1.75} />
              <span>Generate Message</span>
            </Button>
          </div>
        </div>

        {/* Right Panel: Editable Output Studio */}
        <div className="lg:col-span-7 flex flex-col overflow-hidden bg-canvas">
          {/* Toolbar */}
          <div className="px-5 py-3 border-b border-border bg-surface flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-text-primary">Draft Editor</span>
              {generatedBody && (
                <Badge tone="neutral">
                  {wordCount} words • {charCount} chars
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={!generatedBody.trim() || isGenerating}
                isLoading={isGenerating && activeAction === 'rewrite'}
                onClick={() => runWriter('rewrite')}
              >
                <RotateCcw size={12} strokeWidth={1.75} />
                <span>Rewrite</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!generatedBody.trim() || isGenerating}
                isLoading={isGenerating && activeAction === 'shorten'}
                onClick={() => runWriter('shorten')}
              >
                <Scissors size={12} strokeWidth={1.75} />
                <span>Shorten</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!generatedBody.trim() || isGenerating}
                isLoading={isGenerating && activeAction === 'improve'}
                onClick={() => runWriter('improve')}
              >
                <Wand2 size={12} strokeWidth={1.75} />
                <span>Improve</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!description.trim() || isGenerating}
                isLoading={isGenerating && activeAction === 'regenerate'}
                onClick={() => runWriter('regenerate')}
              >
                <RefreshCw size={12} strokeWidth={1.75} />
                <span>Regenerate</span>
              </Button>
              <Button
                variant={copied ? 'success' : 'primary'}
                size="sm"
                disabled={!generatedBody.trim()}
                onClick={handleCopy}
              >
                {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={1.75} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
          </div>

          {/* Editor Canvas */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            {!generatedBody && !isGenerating ? (
              <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl bg-surface/50 p-8 space-y-3">
                <div className="w-11 h-11 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center">
                  <MailCheck size={20} strokeWidth={1.75} />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-sm font-semibold text-text-primary">Ready to Compose</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Choose a message type, select your tone, and describe your objective on the left. Your editable draft will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto rounded-xl bg-surface border border-border overflow-hidden flex flex-col h-full min-h-[420px]">
                {/* Editable Subject Row */}
                <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-subtle/40">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted shrink-0">
                    Subject
                  </span>
                  <input
                    type="text"
                    value={generatedSubject}
                    onChange={(e) => setGeneratedSubject(e.target.value)}
                    placeholder="Email subject line..."
                    disabled={isGenerating}
                    className="flex-1 bg-transparent text-xs font-medium text-text-primary focus:outline-none"
                  />
                </div>

                {/* Editable Body */}
                <div className="flex-1 relative flex flex-col">
                  {isGenerating && (
                    <div className="absolute inset-0 bg-surface/80 backdrop-blur-[1px] z-10 flex items-center justify-center">
                      <div className="px-4 py-2.5 rounded-lg bg-elevated border border-border flex items-center space-x-2 text-xs font-mono text-text-primary">
                        <RefreshCw size={13} className="animate-spin text-indigo-500" />
                        <span>Composing {tone.toLowerCase()} {messageType.toLowerCase()}...</span>
                      </div>
                    </div>
                  )}
                  <textarea
                    value={generatedBody}
                    onChange={(e) => setGeneratedBody(e.target.value)}
                    placeholder="Generated message body..."
                    className="w-full flex-1 p-5 bg-transparent text-sm text-text-primary leading-relaxed resize-none focus:outline-none"
                  />
                </div>

                <div className="px-4 py-2.5 border-t border-border bg-subtle/30 flex items-center justify-between text-[11px] font-mono text-text-muted">
                  <span>
                    Type: {messageType} • Tone: {tone}
                  </span>
                  <span>Direct edit enabled</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
