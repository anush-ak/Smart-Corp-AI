import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Sparkles,
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
import { DraftTask } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const SAMPLE_MEETING_NOTES = `Sprint Planning & Operations Sync — Q4 Deliverables
Date: Nov 24, 2026 | Attendees: Sarah Chen (Admin), Alex Rivera (Manager), Elena Rostova (HR), David Kim (Employee)

Key Discussion Points & Decisions:
1. Enterprise Migration v2:
   - David Kim to complete PostgreSQL connection pooling and load-test async session pool by Friday (2026-11-28). Estimated 12 hours of deep work.
   - Alex Rivera will review and merge David's microservice auth PR tomorrow. Needs 4 hours.

2. SOC-2 Type II Compliance Evidence:
   - Sarah Chen to finalize vendor risk assessments and sign off on external security audit policies by end of month (2026-11-30). Est 6 hours.
   - We need someone to perform IAM access control audit and revoke inactive test accounts. High priority, est 8 hours, no specific owner assigned yet.

3. People Ops & Workplace Policies:
   - Elena Rostova will update the Remote Work equipment stipend guidelines in the employee handbook by next Monday. Est 4 hours.
   - Action item: Draft quarterly engineering performance review schedule. Est 3 hours, due date pending HR leadership approval.
`;

const AVAILABLE_ASSIGNEES = [
  'Unassigned',
  'Sarah Chen',
  'Alex Rivera',
  'Elena Rostova',
  'David Kim',
];

export const MeetingConverterPage: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [notes, setNotes] = useState<string>('');
  const [draftTasks, setDraftTasks] = useState<DraftTask[]>([]);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<boolean>(false);

  const canExtractAndPublish = user?.role === 'Admin' || user?.role === 'Manager';

  // Load sample notes
  const handleLoadSample = () => {
    setNotes(SAMPLE_MEETING_NOTES);
    setExtractError(null);
    setPublishSuccess(false);
  };

  // Call Gemini extraction API
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
      console.error('Extraction error:', err);
      setExtractError(err.message || 'Failed to extract tasks. Check server logs.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Update a single draft task field
  const handleUpdateTask = (index: number, field: keyof DraftTask, value: any) => {
    setDraftTasks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Delete draft task card
  const handleDeleteTask = (index: number) => {
    setDraftTasks((prev) => prev.filter((_, i) => i !== index));
  };

  // Add empty manual action item
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

  // Publish all approved tasks to PostgreSQL via batch API
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
      console.error('Publish batch tasks error:', err);
      setExtractError(err.message || 'Failed to publish tasks to database.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Uncertainty stats
  const uncertainCount = draftTasks.filter(
    (t) => t.assignee === 'Unassigned' || !t.due_date
  ).length;

  const totalEstHours = draftTasks.reduce((acc, t) => acc + (Number(t.est_hours) || 0), 0);
  // Deterministic saving: ~0.4 days saved per automated task breakdown & ticket setup
  const estimatedDaysSaved = Math.max(1, Math.round(draftTasks.length * 0.4));

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Top Header */}
      <header className="h-14 border-b border-border px-6 flex items-center justify-between shrink-0 bg-surface">
        <div className="flex items-center space-x-3">
          <FileSpreadsheet size={16} className="text-indigo-600 dark:text-indigo-400" strokeWidth={1.75} />
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Meeting Notes to Action Items</h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-subtle text-zinc-600 dark:text-zinc-400 border border-border">
            Phase 4 Workbench
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Tenant: <span className="text-zinc-800 dark:text-zinc-200 font-medium">{user?.org_name}</span> | Role:{' '}
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">{user?.role}</span>
          </div>
        </div>
      </header>

      {/* Role Notice if not Admin/Manager */}
      {!canExtractAndPublish && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center space-x-2 text-xs text-amber-700 dark:text-amber-400 shrink-0">
          <ShieldAlert size={14} strokeWidth={1.75} />
          <span>
            You are logged in as <strong>{user?.role}</strong>. Only <strong>Admin</strong> or{' '}
            <strong>Manager</strong> can execute batch task extraction and database publishing.
          </span>
        </div>
      )}

      {/* Main 50/50 Workbench */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border overflow-hidden">
        {/* Left Column: Raw Meeting Notes Editor */}
        <div className="flex flex-col h-full overflow-hidden bg-surface p-5">
          <div className="flex items-center justify-between pb-3 shrink-0">
            <div className="flex items-center space-x-2">
              <FileText size={15} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1.75} />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Raw Meeting Transcript
              </span>
            </div>
            <button
              type="button"
              onClick={handleLoadSample}
              className="inline-flex items-center space-x-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-subtle hover:bg-elevated px-2.5 py-1 rounded border border-border transition-colors cursor-pointer"
            >
              <FileText size={12} strokeWidth={1.75} className="text-indigo-600 dark:text-indigo-400" />
              <span>Load Sample Meeting Notes</span>
            </button>
          </div>

          <div className="flex-1 flex flex-col min-h-0 relative">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste raw meeting notes, transcripts, or minutes here... (e.g. 'David will complete load-testing by Friday. Elena to update handbook.')"
              className="w-full flex-1 p-4 rounded-lg bg-canvas border border-border text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 text-xs font-mono leading-relaxed resize-none focus:outline-none focus:border-indigo-500/60 transition-colors"
            />
          </div>

          {extractError && (
            <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2 shrink-0">
              <AlertTriangle size={14} strokeWidth={1.75} className="shrink-0" />
              <span>{extractError}</span>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between shrink-0 pt-2 border-t border-border">
            <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
              {notes.length} characters | {notes.split(/\s+/).filter(Boolean).length} words
            </span>

            <button
              type="button"
              onClick={handleExtract}
              disabled={isExtracting || !canExtractAndPublish || !notes.trim()}
              className="inline-flex items-center space-x-2 text-xs font-medium px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors cursor-pointer shadow-xs"
            >
              {isExtracting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Extracting Action Items...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} strokeWidth={1.75} />
                  <span>Extract Action Items</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Editable Draft Task Cards */}
        <div className="flex flex-col h-full overflow-hidden bg-surface p-5">
          <div className="flex items-center justify-between pb-3 shrink-0">
            <div className="flex items-center space-x-2">
              <CheckCircle2 size={15} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1.75} />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Action Items Workbench
              </span>
              {draftTasks.length > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {draftTasks.length} {draftTasks.length === 1 ? 'task' : 'tasks'}
                </span>
              )}
            </div>

            {draftTasks.length > 0 && (
              <div className="flex items-center space-x-2">
                {/* Emerald Saves X Days Badge */}
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-mono font-medium">
                  <Check size={11} strokeWidth={2} />
                  <span>Saves ~{estimatedDaysSaved} Days</span>
                </div>

                <button
                  type="button"
                  onClick={handleAddManualTask}
                  className="inline-flex items-center space-x-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-subtle hover:bg-elevated px-2.5 py-1 rounded border border-border transition-colors cursor-pointer"
                >
                  <Plus size={12} strokeWidth={1.75} />
                  <span>Add Item</span>
                </button>
              </div>
            )}
          </div>

          {/* Uncertainty Review Warning Banner */}
          {uncertainCount > 0 && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center space-x-2 shrink-0">
              <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" strokeWidth={1.75} />
              <span>
                <strong>{uncertainCount}</strong> task {uncertainCount === 1 ? 'has' : 'have'}{' '}
                unassigned owners or missing dates. Highlighted in amber below for verification.
              </span>
            </div>
          )}

          {/* Success Banner after batch publishing */}
          {publishSuccess && (
            <div className="mb-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <CheckCircle2 size={15} strokeWidth={1.75} />
                <span>
                  Successfully published {draftTasks.length} tasks to PostgreSQL and broadcast over WebSocket!
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/tasks')}
                className="inline-flex items-center space-x-1 font-semibold text-emerald-700 dark:text-emerald-300 hover:underline underline-offset-2 ml-3 cursor-pointer"
              >
                <span>View Task Board</span>
                <ArrowRight size={12} />
              </button>
            </div>
          )}

          {/* Task Cards List */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
            {draftTasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center rounded-lg bg-subtle/50 border border-border text-zinc-500 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                  <FileSpreadsheet size={18} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No Action Items Extracted Yet</p>
                  <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
                    Paste meeting notes on the left or click "Load Sample Meeting Notes", then click "Extract Action Items" to generate structured tasks.
                  </p>
                </div>
              </div>
            ) : (
              draftTasks.map((task, idx) => {
                const isAssigneeUncertain = task.assignee === 'Unassigned';
                const isDateUncertain = !task.due_date;
                const hasUncertainty = isAssigneeUncertain || isDateUncertain;

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg bg-surface transition-colors shadow-xs ${
                      hasUncertainty
                        ? 'border border-amber-500/40 bg-amber-500/[0.04]'
                        : 'border border-border'
                    }`}
                  >
                    {/* Top Row: Title + Delete */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) => handleUpdateTask(idx, 'title', e.target.value)}
                          className="w-full bg-transparent text-xs font-medium text-zinc-900 dark:text-zinc-100 border-b border-border focus:border-indigo-500 focus:outline-none pb-1"
                          placeholder="Task title..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(idx)}
                        className="text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-1 cursor-pointer"
                        title="Remove task"
                      >
                        <Trash2 size={13} strokeWidth={1.75} />
                      </button>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      {/* Assignee Selection */}
                      <div>
                        <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1 flex items-center space-x-1">
                          <User size={10} />
                          <span>Assignee</span>
                          {isAssigneeUncertain && (
                            <span className="text-amber-500 dark:text-amber-400 font-bold">*</span>
                          )}
                        </label>
                        <select
                          value={task.assignee}
                          onChange={(e) => handleUpdateTask(idx, 'assignee', e.target.value)}
                          className={`w-full text-xs rounded px-2 py-1.5 bg-canvas focus:outline-none focus:border-indigo-500 ${
                            isAssigneeUncertain
                              ? 'border border-amber-500/60 text-amber-700 dark:text-amber-300'
                              : 'border border-border text-zinc-800 dark:text-zinc-200'
                          }`}
                        >
                          {AVAILABLE_ASSIGNEES.map((member) => (
                            <option key={member} value={member}>
                              {member}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Due Date */}
                      <div>
                        <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1 flex items-center space-x-1">
                          <Calendar size={10} />
                          <span>Due Date</span>
                          {isDateUncertain && (
                            <span className="text-amber-500 dark:text-amber-400 font-bold">*</span>
                          )}
                        </label>
                        <input
                          type="date"
                          value={task.due_date || ''}
                          onChange={(e) =>
                            handleUpdateTask(idx, 'due_date', e.target.value || null)
                          }
                          className={`w-full text-xs rounded px-2 py-1 bg-canvas focus:outline-none focus:border-indigo-500 ${
                            isDateUncertain
                              ? 'border border-amber-500/60 text-amber-700 dark:text-amber-300'
                              : 'border border-border text-zinc-800 dark:text-zinc-200'
                          }`}
                        />
                      </div>

                      {/* Est Hours & Priority */}
                      <div className="flex items-center space-x-2">
                        <div className="w-1/2">
                          <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1 flex items-center space-x-1">
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
                            className="w-full text-xs rounded px-2 py-1 bg-canvas border border-border text-zinc-800 dark:text-zinc-200 font-mono tabular-nums focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="w-1/2">
                          <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">
                            Priority
                          </label>
                          <select
                            value={task.priority}
                            onChange={(e) => handleUpdateTask(idx, 'priority', e.target.value)}
                            className="w-full text-xs rounded px-2 py-1.5 bg-canvas border border-border text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Uncertainty alert tag */}
                    {hasUncertainty && (
                      <div className="mt-2.5 pt-2 border-t border-amber-500/20 flex items-center space-x-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-mono">
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

          {/* Bottom Action Footer */}
          {draftTasks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between shrink-0">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Total Workload:{' '}
                <span className="text-zinc-900 dark:text-zinc-200 font-semibold tabular-nums">{totalEstHours}h</span>
              </div>

              <button
                type="button"
                onClick={handlePublishAll}
                disabled={isPublishing || !canExtractAndPublish}
                className="inline-flex items-center space-x-2 text-xs font-medium px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors cursor-pointer shadow-xs"
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
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
