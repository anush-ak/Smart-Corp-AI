import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  Trash2,
  Plus,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DraftTask, TeamMember } from '../types';
import { API_BASE_URL } from '../config';
import { PageHeader, Button, Badge, ErrorBanner } from '../components/ui/Primitives';

const SAMPLE_MEETING_NOTES = `Sprint Planning & Operations Sync — Q4 Deliverables
Date: Nov 24, 2026 | Attendees: Anush (Admin), Nicholas (Manager), Sidharth (HR), Hitesh (Employee)

Key Discussion Points & Decisions:
1. Enterprise Migration v2:
   - Hitesh to complete PostgreSQL connection pooling and load-test async session pool by Friday (2026-11-28). Estimated 12 hours of deep work.
   - Nicholas will review and merge Hitesh's microservice auth PR tomorrow. Needs 4 hours.

2. SOC-2 Type II Compliance Evidence:
   - Anush to finalize vendor risk assessments and sign off on external security audit policies by end of month (2026-11-30). Est 6 hours.
   - We need someone to perform IAM access control audit and revoke inactive test accounts. High priority, est 8 hours, no specific owner assigned yet.

3. People Ops & Workplace Policies:
   - Sidharth will update the Remote Work equipment stipend guidelines in the employee handbook by next Monday. Est 4 hours.
   - Action item: Draft quarterly engineering performance review schedule. Est 3 hours, due date pending HR leadership approval.
`;

export const MeetingConverterPage: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [notes, setNotes] = useState<string>('');
  const [draftTasks, setDraftTasks] = useState<DraftTask[]>([]);
  const [assignees, setAssignees] = useState<string[]>(['Unassigned']);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<boolean>(false);

  const canExtractAndPublish = user?.role === 'Admin' || user?.role === 'Manager';

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/team`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((members: TeamMember[]) => {
        if (members.length > 0) {
          setAssignees(['Unassigned', ...members.map((m) => m.name)]);
        }
      })
      .catch(() => {});
  }, [token]);

  const handleLoadSample = () => {
    setNotes(SAMPLE_MEETING_NOTES);
    setExtractError(null);
    setPublishSuccess(false);
  };

  const handleExtract = async () => {
    if (!notes.trim()) {
      setExtractError('Please enter or paste meeting notes to extract action items.');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setPublishSuccess(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/meetings/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Extraction failed with status ${response.status}`);
      }

      const data = await response.json();
      setDraftTasks(data.tasks || []);
    } catch (err: any) {
      setExtractError(err.message || 'Failed to extract tasks. Check server logs.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleUpdateTask = (index: number, field: keyof DraftTask, value: any) => {
    setDraftTasks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteTask = (index: number) => {
    setDraftTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddManualTask = () => {
    setDraftTasks((prev) => [
      ...prev,
      {
        title: 'New Action Item',
        assignee: 'Unassigned',
        priority: 'Medium',
        due_date: null,
        est_hours: 4.0,
      },
    ]);
  };

  const handlePublishAll = async () => {
    if (draftTasks.length === 0) return;

    setIsPublishing(true);
    setExtractError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tasks: draftTasks }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to create batch tasks (${response.status})`);
      }

      setPublishSuccess(true);
    } catch (err: any) {
      setExtractError(err.message || 'Failed to publish tasks to database.');
    } finally {
      setIsPublishing(false);
    }
  };

  const uncertainCount = draftTasks.filter(
    (t) => t.assignee === 'Unassigned' || !t.due_date
  ).length;
  const totalEstHours = draftTasks.reduce((acc, t) => acc + (Number(t.est_hours) || 0), 0);
  const estimatedDaysSaved = Math.max(1, Math.round(draftTasks.length * 0.4));

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas text-text-primary transition-colors">
      <PageHeader
        title="Meeting Notes to Action Items"
        subtitle="Extract structured, schema-validated deliverables from transcripts"
        icon={FileSpreadsheet}
        badge={<Badge tone="indigo">Structured JSON</Badge>}
      />

      {!canExtractAndPublish && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center space-x-2 text-xs text-amber-600 dark:text-amber-400 shrink-0">
          <ShieldAlert size={14} strokeWidth={1.75} />
          <span>
            You are logged in as <strong>{user?.role}</strong>. Only <strong>Admin</strong> or{' '}
            <strong>Manager</strong> can execute batch task extraction and database publishing.
          </span>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border overflow-hidden">
        {/* Left: Raw Meeting Transcript */}
        <div className="flex flex-col h-full overflow-hidden bg-surface p-5">
          <div className="flex items-center justify-between pb-3 shrink-0">
            <div className="flex items-center space-x-2">
              <FileText size={15} className="text-text-muted" strokeWidth={1.75} />
              <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                Raw Meeting Transcript
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={handleLoadSample}>
              <FileText size={12} className="text-indigo-500" />
              <span>Load Sample Meeting Notes</span>
            </Button>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste raw meeting notes, transcripts, or minutes here..."
              className="w-full flex-1 p-4 rounded-lg bg-canvas border border-border text-text-primary placeholder:text-text-muted/60 text-xs font-mono leading-relaxed resize-none focus:outline-none focus:border-indigo-500"
            />
          </div>

          {extractError && (
            <div className="mt-3 shrink-0">
              <ErrorBanner message={extractError} onDismiss={() => setExtractError(null)} />
            </div>
          )}

          <div className="mt-4 flex items-center justify-between shrink-0 pt-3 border-t border-border">
            <span className="text-[11px] font-mono text-text-muted tabular-nums">
              {notes.length} characters | {notes.split(/\s+/).filter(Boolean).length} words
            </span>

            <Button
              variant="primary"
              onClick={handleExtract}
              disabled={isExtracting || !canExtractAndPublish || !notes.trim()}
              isLoading={isExtracting}
            >
              <Cpu size={13} strokeWidth={1.75} />
              <span>{isExtracting ? 'Extracting Action Items...' : 'Extract Action Items'}</span>
            </Button>
          </div>
        </div>

        {/* Right: Action Items Workbench */}
        <div className="flex flex-col h-full overflow-hidden bg-surface p-5">
          <div className="flex items-center justify-between pb-3 shrink-0">
            <div className="flex items-center space-x-2">
              <CheckCircle2 size={15} className="text-text-muted" strokeWidth={1.75} />
              <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                Action Items Workbench
              </span>
              {draftTasks.length > 0 && (
                <Badge tone="indigo">
                  {draftTasks.length} {draftTasks.length === 1 ? 'task' : 'tasks'}
                </Badge>
              )}
            </div>

            {draftTasks.length > 0 && (
              <div className="flex items-center space-x-2">
                <Badge tone="emerald">
                  <Check size={11} strokeWidth={2} />
                  <span>Saves ~{estimatedDaysSaved} Days</span>
                </Badge>
                <Button variant="secondary" size="sm" onClick={handleAddManualTask}>
                  <Plus size={12} />
                  <span>Add Item</span>
                </Button>
              </div>
            )}
          </div>

          {uncertainCount > 0 && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs flex items-center space-x-2 shrink-0">
              <AlertTriangle size={14} className="shrink-0" strokeWidth={1.75} />
              <span>
                <strong>{uncertainCount}</strong> task {uncertainCount === 1 ? 'has' : 'have'}{' '}
                unassigned owners or missing dates. Highlighted in amber below for verification.
              </span>
            </div>
          )}

          {publishSuccess && (
            <div className="mb-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <CheckCircle2 size={15} strokeWidth={1.75} />
                <span>
                  Successfully published {draftTasks.length} tasks to PostgreSQL and broadcast over WebSocket!
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/tasks')}
                className="inline-flex items-center space-x-1 font-semibold hover:underline underline-offset-2 ml-3 cursor-pointer"
              >
                <span>View Task Board</span>
                <ArrowRight size={12} />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
            {draftTasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center rounded-lg bg-canvas border border-dashed border-border text-text-muted space-y-3">
                <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center">
                  <FileSpreadsheet size={18} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-primary">No Action Items Extracted Yet</p>
                  <p className="text-[11px] text-text-muted mt-1 max-w-xs">
                    Paste meeting notes on the left or click "Load Sample Meeting Notes", then click "Extract Action Items".
                  </p>
                </div>
              </div>
            ) : (
              draftTasks.map((task, idx) => {
                const isAssigneeUncertain = task.assignee === 'Unassigned';
                const isDateUncertain = !task.due_date;
                const hasUncertainty = isAssigneeUncertain || isDateUncertain;
                const selectAssignees = assignees.includes(task.assignee)
                  ? assignees
                  : [...assignees, task.assignee];

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg bg-canvas transition-colors ${
                      hasUncertainty
                        ? 'border border-amber-500/40 bg-amber-500/[0.04]'
                        : 'border border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) => handleUpdateTask(idx, 'title', e.target.value)}
                          className="w-full bg-transparent text-xs font-medium text-text-primary border-b border-border focus:border-indigo-500 focus:outline-none pb-1"
                          placeholder="Task title..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(idx)}
                        className="text-text-muted hover:text-rose-500 transition-colors p-1 cursor-pointer"
                        title="Remove task"
                      >
                        <Trash2 size={13} strokeWidth={1.75} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div>
                        <label className="text-[10px] uppercase font-mono text-text-muted mb-1 flex items-center space-x-1">
                          <User size={10} />
                          <span>Assignee</span>
                          {isAssigneeUncertain && <span className="text-amber-500 font-bold">*</span>}
                        </label>
                        <select
                          value={task.assignee}
                          onChange={(e) => handleUpdateTask(idx, 'assignee', e.target.value)}
                          className={`w-full text-xs rounded px-2 py-1.5 bg-surface focus:outline-none focus:border-indigo-500 ${
                            isAssigneeUncertain
                              ? 'border border-amber-500/60 text-amber-500'
                              : 'border border-border text-text-primary'
                          }`}
                        >
                          {selectAssignees.map((member) => (
                            <option key={member} value={member}>
                              {member}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-mono text-text-muted mb-1 flex items-center space-x-1">
                          <Calendar size={10} />
                          <span>Due Date</span>
                          {isDateUncertain && <span className="text-amber-500 font-bold">*</span>}
                        </label>
                        <input
                          type="date"
                          value={task.due_date || ''}
                          onChange={(e) =>
                            handleUpdateTask(idx, 'due_date', e.target.value || null)
                          }
                          className={`w-full text-xs rounded px-2 py-1 bg-surface focus:outline-none focus:border-indigo-500 ${
                            isDateUncertain
                              ? 'border border-amber-500/60 text-amber-500'
                              : 'border border-border text-text-primary'
                          }`}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="w-1/2">
                          <label className="text-[10px] uppercase font-mono text-text-muted mb-1 flex items-center space-x-1">
                            <Clock size={10} />
                            <span>Hours</span>
                          </label>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={task.est_hours}
                            onChange={(e) =>
                              handleUpdateTask(idx, 'est_hours', parseFloat(e.target.value) || 1.0)
                            }
                            className="w-full text-xs rounded px-2 py-1 bg-surface border border-border text-text-primary font-mono tabular-nums focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="w-1/2">
                          <label className="block text-[10px] uppercase font-mono text-text-muted mb-1">
                            Priority
                          </label>
                          <select
                            value={task.priority}
                            onChange={(e) => handleUpdateTask(idx, 'priority', e.target.value)}
                            className="w-full text-xs rounded px-2 py-1.5 bg-surface border border-border text-text-primary focus:outline-none focus:border-indigo-500"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {hasUncertainty && (
                      <div className="mt-2.5 pt-2 border-t border-amber-500/20 flex items-center space-x-1.5 text-[11px] text-amber-500 font-mono">
                        <AlertTriangle size={12} strokeWidth={1.75} />
                        <span>
                          {isAssigneeUncertain && isDateUncertain
                            ? 'Assignee and deadline require confirmation'
                            : isAssigneeUncertain
                            ? 'Assignee needs confirmation'
                            : 'Target completion date not specified'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {draftTasks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between shrink-0">
              <div className="text-xs text-text-muted font-mono">
                Total Workload:{' '}
                <span className="text-text-primary font-semibold tabular-nums">{totalEstHours}h</span>
              </div>

              <Button
                variant="primary"
                onClick={handlePublishAll}
                disabled={isPublishing || !canExtractAndPublish}
                isLoading={isPublishing}
              >
                {isPublishing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Publishing to Database...</span>
                  </>
                ) : (
                  <>
                    <span>Publish All to Task Board</span>
                    <ArrowRight size={13} strokeWidth={1.75} />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
