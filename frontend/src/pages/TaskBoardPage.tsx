import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  CheckSquare,
  Calendar,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Search,
  Filter,
  Layers,
  RotateCw,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { TaskItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const COLUMNS = [
  { id: 'Todo', title: 'To Do', color: 'border-zinc-300 dark:border-zinc-700' },
  { id: 'In Progress', title: 'In Progress', color: 'border-indigo-500/40' },
  { id: 'Done', title: 'Completed', color: 'border-emerald-500/40' },
];

export const TaskBoardPage: React.FC = () => {
  const { user, token } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  // Fetch tasks from PostgreSQL
  const fetchTasks = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load tasks (${response.status})`);
      }

      const data: TaskItem[] = await response.json();
      setTasks(data);
    } catch (err: any) {
      console.error('Fetch tasks error:', err);
      setError(err.message || 'Unable to load task board');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Connect WebSocket for real-time live sync
  const handleTaskUpdatedWs = useCallback((payload: any) => {
    if (!payload) return;

    setTasks((prevTasks) => {
      // If batch list of tasks was broadcast
      if (Array.isArray(payload)) {
        const payloadMap = new Map(payload.map((t: TaskItem) => [t.id, t]));
        const updated = prevTasks.map((t) => (payloadMap.has(t.id) ? payloadMap.get(t.id)! : t));
        // Add any newly created tasks not in prevTasks
        for (const item of payload) {
          if (!prevTasks.some((t) => t.id === item.id)) {
            updated.unshift(item);
          }
        }
        return updated;
      }

      // If single task was updated
      const singleTask = payload as TaskItem;
      const index = prevTasks.findIndex((t) => t.id === singleTask.id);
      if (index >= 0) {
        const copy = [...prevTasks];
        copy[index] = singleTask;
        return copy;
      } else {
        return [singleTask, ...prevTasks];
      }
    });
  }, []);

  const { isConnected } = useWebSocket({
    onTaskUpdated: handleTaskUpdatedWs,
  });

  // Handle task status update via PATCH /api/tasks/{task_id}
  const handleStatusChange = async (taskId: number, newStatus: string) => {
    if (!token) return;

    // Optimistic update
    setUpdatingTaskId(taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Update failed (${response.status})`);
      }

      const updatedTask: TaskItem = await response.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));
    } catch (err: any) {
      console.error('Task update failed:', err);
      setError(err.message || 'Failed to update task status');
      // Revert by re-fetching
      fetchTasks();
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Determine if current user can update this task
  const canUpdateTask = (task: TaskItem): boolean => {
    if (user?.role === 'Admin' || user?.role === 'Manager') return true;
    if (user?.role === 'Employee' && task.assignee_id === user.id) return true;
    return false;
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Assignee filter
      if (filterAssignee !== 'all') {
        if (filterAssignee === 'unassigned') {
          if (task.assignee_name && task.assignee_name !== 'Unassigned') return false;
        } else if (task.assignee_name !== filterAssignee) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchAssignee = (task.assignee_name || '').toLowerCase().includes(q);
        const matchProject = (task.project_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchAssignee && !matchProject) return false;
      }

      return true;
    });
  }, [tasks, filterAssignee, searchQuery]);

  // Unique assignees for filter
  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.assignee_name && t.assignee_name !== 'Unassigned') {
        set.add(t.assignee_name);
      }
    });
    return Array.from(set).sort();
  }, [tasks]);

  // Summary Metrics
  const totalHours = useMemo(() => {
    return tasks.reduce((sum, t) => sum + (Number(t.estimated_hours) || 0), 0);
  }, [tasks]);

  const activeHours = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'Done')
      .reduce((sum, t) => sum + (Number(t.estimated_hours) || 0), 0);
  }, [tasks]);

  const completedHours = useMemo(() => {
    return tasks
      .filter((t) => t.status === 'Done')
      .reduce((sum, t) => sum + (Number(t.estimated_hours) || 0), 0);
  }, [tasks]);

  const now = new Date();

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Top Header */}
      <header className="h-14 border-b border-border px-6 flex items-center justify-between shrink-0 bg-surface">
        <div className="flex items-center space-x-3">
          <CheckSquare size={16} className="text-indigo-600 dark:text-indigo-400" strokeWidth={1.75} />
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Live Task Board</h1>

          {/* WebSocket Status Indicator */}
          <div
            className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-subtle text-zinc-500 border-border'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-zinc-400 dark:bg-zinc-500'
              }`}
            />
            <span>{isConnected ? 'Real-Time Sync Active' : 'Connecting...'}</span>
          </div>
        </div>

        {/* Header Right: Workload Stats */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 text-xs font-mono">
            <span className="text-zinc-500">
              Total: <span className="text-zinc-800 dark:text-zinc-200 tabular-nums">{tasks.length} tasks</span> (
              <span className="text-zinc-800 dark:text-zinc-200 tabular-nums">{totalHours}h</span>)
            </span>
            <span className="text-zinc-400 dark:text-zinc-600">|</span>
            <span className="text-zinc-500">
              Active: <span className="text-amber-600 dark:text-amber-400 tabular-nums font-semibold">{activeHours}h</span>
            </span>
            <span className="text-zinc-400 dark:text-zinc-600">|</span>
            <span className="text-zinc-500">
              Completed: <span className="text-emerald-600 dark:text-emerald-400 tabular-nums font-semibold">{completedHours}h</span>
            </span>
          </div>

          <button
            type="button"
            onClick={fetchTasks}
            title="Refresh Board"
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 bg-subtle hover:bg-elevated rounded border border-border transition-colors cursor-pointer"
          >
            <RotateCw size={13} strokeWidth={1.75} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="h-12 border-b border-border px-6 flex items-center justify-between shrink-0 bg-surface">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
              strokeWidth={1.75}
            />
            <input
              type="text"
              placeholder="Search tasks, assignees, or projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-canvas border border-border rounded text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60 w-64 transition-colors"
            />
          </div>

          <div className="flex items-center space-x-1.5">
            <Filter size={13} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1.75} />
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="bg-canvas border border-border text-xs text-zinc-800 dark:text-zinc-300 rounded px-2.5 py-1 focus:outline-none focus:border-indigo-500/60"
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">Unassigned Only</option>
              {uniqueAssignees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="text-xs text-rose-500 dark:text-rose-400 flex items-center space-x-1.5">
            <AlertCircle size={13} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Kanban Board 3-Column Layout */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 h-full">
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => {
              if (col.id === 'Todo') return t.status === 'Todo';
              if (col.id === 'In Progress') return t.status === 'In Progress' || t.status === 'In Review';
              if (col.id === 'Done') return t.status === 'Done';
              return false;
            });

            const colHours = colTasks.reduce(
              (acc, t) => acc + (Number(t.estimated_hours) || 0),
              0
            );

            return (
              <div
                key={col.id}
                className="flex flex-col h-full rounded-xl bg-surface border border-border overflow-hidden shadow-xs"
              >
                {/* Column Header */}
                <div className="p-3.5 border-b border-border bg-subtle flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">{col.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface text-zinc-600 dark:text-zinc-400 border border-border">
                      {colTasks.length}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono tabular-nums text-zinc-500">
                    {colHours}h total
                  </span>
                </div>

                {/* Column Tasks Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {colTasks.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-center text-xs text-zinc-400 dark:text-zinc-600 border border-dashed border-border rounded-lg">
                      No tasks in {col.title}
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const isOverdue =
                        task.due_date &&
                        new Date(task.due_date) < now &&
                        task.status !== 'Done';

                      const isUnassigned =
                        !task.assignee_name || task.assignee_name === 'Unassigned';

                      const userPermitted = canUpdateTask(task);

                      // Priority styling
                      let priorityClass = 'border-border bg-subtle text-zinc-600 dark:text-zinc-400';
                      if (task.priority === 'Urgent') {
                        priorityClass = 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400';
                      } else if (task.priority === 'High') {
                        priorityClass = 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
                      } else if (task.priority === 'Medium') {
                        priorityClass = 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400';
                      }

                      return (
                        <div
                          key={task.id}
                          className="p-3.5 rounded-lg bg-canvas border border-border hover:border-zinc-300 dark:hover:border-white/[0.16] transition-all space-y-2.5 shadow-xs"
                        >
                          {/* Priority and Hours row */}
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${priorityClass}`}
                            >
                              {task.priority}
                            </span>

                            <span className="font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300 bg-subtle px-2 py-0.5 rounded border border-border">
                              {task.estimated_hours}h
                            </span>
                          </div>

                          {/* Title */}
                          <h4 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
                            {task.title}
                          </h4>

                          {/* Project Tag if available */}
                          {task.project_name && (
                            <div className="flex items-center space-x-1 text-[11px] text-zinc-500 font-mono">
                              <Layers size={11} strokeWidth={1.75} />
                              <span className="truncate">{task.project_name}</span>
                            </div>
                          )}

                          {/* Meta: Assignee + Due Date */}
                          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
                            {/* Assignee Badge */}
                            <div className="flex items-center space-x-1.5">
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                  isUnassigned
                                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                    : 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                                }`}
                              >
                                {isUnassigned ? (
                                  '?'
                                ) : (
                                  task.assignee_name
                                    ?.split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .slice(0, 2)
                                )}
                              </div>
                              <span
                                className={`truncate max-w-[100px] ${
                                  isUnassigned ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                {task.assignee_name || 'Unassigned'}
                              </span>
                            </div>

                            {/* Due Date Indicator */}
                            {task.due_date ? (
                              <div
                                className={`flex items-center space-x-1 font-mono text-[10px] tabular-nums ${
                                  isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-zinc-500 dark:text-zinc-400'
                                }`}
                              >
                                <Calendar size={11} strokeWidth={1.75} />
                                <span>{task.due_date.split('T')[0]}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono">No date</span>
                            )}
                          </div>

                          {/* Quick Status Control Buttons */}
                          <div className="pt-2 border-t border-border flex items-center justify-between gap-1">
                            {!userPermitted ? (
                              <div className="text-[10px] text-zinc-500 italic flex items-center space-x-1">
                                <ShieldAlert size={10} />
                                <span>Assigned to {task.assignee_name}</span>
                              </div>
                            ) : (
                              <>
                                {/* Move Back Button */}
                                {col.id !== 'Todo' && (
                                  <button
                                    type="button"
                                    disabled={updatingTaskId === task.id}
                                    onClick={() =>
                                      handleStatusChange(
                                        task.id,
                                        col.id === 'Done' ? 'In Progress' : 'Todo'
                                      )
                                    }
                                    className="flex-1 py-1 px-1.5 rounded bg-subtle hover:bg-elevated text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-border text-[10px] font-medium flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                                  >
                                    <ArrowLeft size={10} />
                                    <span>{col.id === 'Done' ? 'In Progress' : 'To Do'}</span>
                                  </button>
                                )}

                                {/* Move Forward Button */}
                                {col.id !== 'Done' && (
                                  <button
                                    type="button"
                                    disabled={updatingTaskId === task.id}
                                    onClick={() =>
                                      handleStatusChange(
                                        task.id,
                                        col.id === 'Todo' ? 'In Progress' : 'Done'
                                      )
                                    }
                                    className="flex-1 py-1 px-1.5 rounded bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 border border-indigo-500/30 text-[10px] font-medium flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                                  >
                                    <span>{col.id === 'Todo' ? 'Start' : 'Complete'}</span>
                                    {col.id === 'In Progress' ? (
                                      <Check size={10} />
                                    ) : (
                                      <ArrowRight size={10} />
                                    )}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
