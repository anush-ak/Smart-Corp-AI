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
import { API_BASE_URL } from '../config';
import { PageHeader, Badge, Button, EmptyState, LoadingState } from '../components/ui/Primitives';

const COLUMNS = [
  { id: 'Todo', title: 'To Do', dot: 'bg-zinc-400' },
  { id: 'In Progress', title: 'In Progress', dot: 'bg-indigo-500' },
  { id: 'Done', title: 'Completed', dot: 'bg-emerald-500' },
];

export const TaskBoardPage: React.FC = () => {
  const { user, token } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

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
      setError(err.message || 'Unable to load task board');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleTaskUpdatedWs = useCallback((payload: any) => {
    if (!payload) return;

    setTasks((prevTasks) => {
      if (Array.isArray(payload)) {
        const payloadMap = new Map(payload.map((t: TaskItem) => [t.id, t]));
        const updated = prevTasks.map((t) => (payloadMap.has(t.id) ? payloadMap.get(t.id)! : t));
        for (const item of payload) {
          if (!prevTasks.some((t) => t.id === item.id)) {
            updated.unshift(item);
          }
        }
        return updated;
      }

      const singleTask = payload as TaskItem;
      const index = prevTasks.findIndex((t) => t.id === singleTask.id);
      if (index >= 0) {
        const copy = [...prevTasks];
        copy[index] = singleTask;
        return copy;
      }
      return [singleTask, ...prevTasks];
    });
  }, []);

  const { isConnected } = useWebSocket({
    onTaskUpdated: handleTaskUpdatedWs,
  });

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    if (!token) return;

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
      setError(err.message || 'Failed to update task status');
      fetchTasks();
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const canUpdateTask = (task: TaskItem): boolean => {
    if (user?.role === 'Admin' || user?.role === 'Manager') return true;
    if (user?.role === 'Employee' && task.assignee_id === user.id) return true;
    return false;
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterAssignee !== 'all') {
        if (filterAssignee === 'unassigned') {
          if (task.assignee_name && task.assignee_name !== 'Unassigned') return false;
        } else if (task.assignee_name !== filterAssignee) {
          return false;
        }
      }

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

  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.assignee_name && t.assignee_name !== 'Unassigned') {
        set.add(t.assignee_name);
      }
    });
    return Array.from(set).sort();
  }, [tasks]);

  const totalHours = useMemo(
    () => tasks.reduce((sum, t) => sum + (Number(t.estimated_hours) || 0), 0),
    [tasks]
  );

  const activeHours = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'Done')
        .reduce((sum, t) => sum + (Number(t.estimated_hours) || 0), 0),
    [tasks]
  );

  const completedHours = useMemo(
    () =>
      tasks
        .filter((t) => t.status === 'Done')
        .reduce((sum, t) => sum + (Number(t.estimated_hours) || 0), 0),
    [tasks]
  );

  const now = new Date();

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas text-text-primary transition-colors">
      <PageHeader
        title="Live Task Board"
        subtitle="Real-time Kanban workflow synchronized over tenant WebSockets"
        icon={CheckSquare}
        badge={
          <Badge tone={isConnected ? 'emerald' : 'neutral'}>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
              }`}
            />
            <span>{isConnected ? 'Real-Time Sync Active' : 'Connecting...'}</span>
          </Badge>
        }
        actions={
          <div className="flex items-center space-x-3">
            <div className="hidden xl:flex items-center space-x-3 text-xs font-mono text-text-muted">
              <span>
                Total: <strong className="text-text-primary tabular-nums">{tasks.length}</strong> ({totalHours}h)
              </span>
              <span>•</span>
              <span>
                Active: <strong className="text-amber-500 tabular-nums">{activeHours}h</strong>
              </span>
              <span>•</span>
              <span>
                Done: <strong className="text-emerald-500 tabular-nums">{completedHours}h</strong>
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchTasks} title="Refresh Board">
              <RotateCw size={13} strokeWidth={1.75} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="px-4 sm:px-6 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-2 shrink-0 bg-surface">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
              strokeWidth={1.75}
            />
            <input
              type="text"
              placeholder="Search tasks, assignees, or projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-canvas border border-border rounded-md text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-indigo-500 w-60"
            />
          </div>

          <div className="flex items-center space-x-1.5">
            <Filter size={13} className="text-text-muted" strokeWidth={1.75} />
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="bg-canvas border border-border text-xs text-text-primary rounded-md px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
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
          <div className="text-xs text-rose-500 flex items-center space-x-1.5">
            <AlertCircle size={13} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto lg:overflow-hidden">
        {isLoading && tasks.length === 0 ? (
          <LoadingState label="Loading tenant task board..." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:h-full">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => {
                if (col.id === 'Todo') return t.status === 'Todo';
                if (col.id === 'In Progress')
                  return t.status === 'In Progress' || t.status === 'In Review' || t.status === 'Pending Approval';
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
                  className="flex flex-col lg:h-full rounded-xl bg-surface border border-border overflow-hidden"
                >
                  <div className="p-3.5 border-b border-border bg-subtle/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span className="text-xs font-semibold text-text-primary">{col.title}</span>
                      <Badge tone="neutral">{colTasks.length}</Badge>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-text-muted">
                      {colHours}h total
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    {colTasks.length === 0 ? (
                      <EmptyState
                        icon={CheckSquare}
                        title={`No tasks in ${col.title}`}
                        description="Tasks assigned to this stage appear here."
                      />
                    ) : (
                      colTasks.map((task) => {
                        const isOverdue =
                          task.due_date &&
                          new Date(task.due_date) < now &&
                          task.status !== 'Done';

                        const isUnassigned =
                          !task.assignee_name || task.assignee_name === 'Unassigned';

                        const userPermitted = canUpdateTask(task);

                        let priorityTone: 'rose' | 'amber' | 'indigo' | 'neutral' = 'neutral';
                        if (task.priority === 'Urgent') priorityTone = 'rose';
                        else if (task.priority === 'High') priorityTone = 'amber';
                        else if (task.priority === 'Medium') priorityTone = 'indigo';

                        return (
                          <div
                            key={task.id}
                            className="p-3.5 rounded-lg bg-canvas border border-border hover:border-indigo-500/40 transition-colors space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <Badge tone={priorityTone}>{task.priority}</Badge>
                              <span className="font-mono text-[11px] tabular-nums text-text-primary bg-subtle px-2 py-0.5 rounded border border-border">
                                {task.estimated_hours}h
                              </span>
                            </div>

                            <h4 className="text-xs font-medium text-text-primary leading-snug">
                              {task.title}
                            </h4>

                            {task.project_name && (
                              <div className="flex items-center space-x-1 text-[11px] text-text-muted font-mono">
                                <Layers size={11} strokeWidth={1.75} />
                                <span className="truncate">{task.project_name}</span>
                              </div>
                            )}

                            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
                              <div className="flex items-center space-x-1.5 min-w-0">
                                <div
                                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                                    isUnassigned
                                      ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                                      : 'bg-indigo-500/20 text-indigo-500 border border-indigo-500/30'
                                  }`}
                                >
                                  {isUnassigned
                                    ? '?'
                                    : task.assignee_name
                                        ?.split(' ')
                                        .map((n) => n[0])
                                        .join('')
                                        .slice(0, 2)}
                                </div>
                                <span
                                  className={`truncate max-w-[110px] ${
                                    isUnassigned ? 'text-amber-500 font-medium' : 'text-text-primary'
                                  }`}
                                >
                                  {task.assignee_name || 'Unassigned'}
                                </span>
                              </div>

                              {task.due_date ? (
                                <div
                                  className={`flex items-center space-x-1 font-mono text-[10px] tabular-nums ${
                                    isOverdue ? 'text-rose-500 font-semibold' : 'text-text-muted'
                                  }`}
                                >
                                  <Calendar size={11} strokeWidth={1.75} />
                                  <span>{task.due_date.split('T')[0]}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-text-muted font-mono">
                                  No date
                                </span>
                              )}
                            </div>

                            <div className="pt-2 border-t border-border flex items-center justify-between gap-1.5">
                              {!userPermitted ? (
                                <div className="text-[10px] text-text-muted italic flex items-center space-x-1">
                                  <ShieldAlert size={10} />
                                  <span>Assigned to {task.assignee_name}</span>
                                </div>
                              ) : (
                                <>
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
                                      className="flex-1 py-1 px-2 rounded bg-subtle hover:bg-elevated text-text-muted hover:text-text-primary border border-border text-[10px] font-medium flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                                    >
                                      <ArrowLeft size={10} />
                                      <span>{col.id === 'Done' ? 'In Progress' : 'To Do'}</span>
                                    </button>
                                  )}

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
                                      className="flex-1 py-1 px-2 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 text-[10px] font-medium flex items-center justify-center space-x-1 transition-colors cursor-pointer"
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
        )}
      </div>
    </div>
  );
};
