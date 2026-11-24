import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Layers,
  AlertTriangle,
  CheckCircle2,
  Clock4,
  Sliders,
  RotateCw,
  SlidersHorizontal,
  Info,
  TrendingDown,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { AuditTrailFeed } from '../components/AuditTrailFeed';
import { DashboardSummary, TeamWorkloadMember } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Semantic Donut Chart Palette
const STATUS_COLORS: Record<string, string> = {
  Todo: '#71717A', // Zinc 500
  'In Progress': '#6366F1', // Indigo 500
  'Pending Approval': '#F59E0B', // Amber 500
  Done: '#10B981', // Emerald 500
};

export const DashboardPage: React.FC = () => {
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuditPanelOpen, setIsAuditPanelOpen] = useState<boolean>(true);

  // Dynamic Recharts Theme-Aware Colors
  const axisStroke = isDark ? '#52525B' : '#D4D4D8';
  const axisTickColor = isDark ? '#A1A1AA' : '#52525B';
  const axisTickLine = isDark ? '#27272A' : '#E4E4E7';
  const baselineBarFill = isDark ? '#52525B' : '#94A3B8';

  // What-If Simulation State
  const [employeeAId, setEmployeeAId] = useState<number | null>(null);
  const [employeeBId, setEmployeeBId] = useState<number | null>(null);
  const [shiftHours, setShiftHours] = useState<number>(12);

  // Fetch Dashboard Summary
  const fetchSummary = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard summary (${response.status})`);
      }

      const data: DashboardSummary = await response.json();
      setSummary(data);

      // Pre-select employee A (highest workload) and employee B (lowest workload)
      if (data.team_workload && data.team_workload.length >= 2) {
        setEmployeeAId((prev) => (prev !== null ? prev : data.team_workload[0].user_id));
        setEmployeeBId((prev) =>
          prev !== null ? prev : data.team_workload[data.team_workload.length - 1].user_id
        );
      }
    } catch (err: any) {
      console.error('Error fetching dashboard summary:', err);
      setError(err.message || 'Unable to load executive dashboard metrics.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Connect WebSocket to automatically refresh KPIs when tasks are modified or batch-created
  useWebSocket({
    onTaskUpdated: () => {
      fetchSummary();
    },
    onAuditEvent: () => {
      fetchSummary();
    },
  });

  // Fallback defaults if state isn't initialized yet
  const teamWorkload = summary?.team_workload || [];

  const employeeA = useMemo<TeamWorkloadMember | undefined>(() => {
    return teamWorkload.find((u) => u.user_id === employeeAId) || teamWorkload[0];
  }, [teamWorkload, employeeAId]);

  const employeeB = useMemo<TeamWorkloadMember | undefined>(() => {
    return (
      teamWorkload.find((u) => u.user_id === employeeBId) ||
      teamWorkload[teamWorkload.length - 1]
    );
  }, [teamWorkload, employeeBId]);

  // 100% Deterministic Client-Side What-If Calculations (GEMINI.md Rule 1)
  const simulation = useMemo(() => {
    const hoursA = employeeA ? employeeA.est_hours : 38;
    const hoursB = employeeB ? employeeB.est_hours : 12;

    const newHoursA = Math.max(0, hoursA - shiftHours);
    const newHoursB = hoursB + shiftHours;

    const baselineBottleneck = Math.max(hoursA, hoursB);
    const baselineDays = Math.ceil(baselineBottleneck / 8);

    const simulatedBottleneck = Math.max(newHoursA, newHoursB);
    const simulatedDays = Math.ceil(simulatedBottleneck / 8);

    const daysSaved = Math.max(0, baselineDays - simulatedDays);

    return {
      hoursA,
      hoursB,
      newHoursA,
      newHoursB,
      baselineBottleneck,
      baselineDays,
      simulatedBottleneck,
      simulatedDays,
      daysSaved,
    };
  }, [employeeA, employeeB, shiftHours]);

  // Recharts Data for What-If Live Comparison Preview
  const whatIfChartData = useMemo(() => {
    if (!employeeA || !employeeB) return [];
    return [
      {
        name: employeeA.full_name.split(' ')[0], // First name for clean display
        fullName: employeeA.full_name,
        Baseline: simulation.hoursA,
        Simulated: simulation.newHoursA,
      },
      {
        name: employeeB.full_name.split(' ')[0],
        fullName: employeeB.full_name,
        Baseline: simulation.hoursB,
        Simulated: simulation.newHoursB,
      },
    ];
  }, [employeeA, employeeB, simulation]);

  // Total tasks count for donut chart center
  const totalTasksCount = useMemo(() => {
    if (!summary?.task_status_breakdown) return 0;
    return summary.task_status_breakdown.reduce((acc, curr) => acc + curr.count, 0);
  }, [summary?.task_status_breakdown]);

  const canViewAudit = user?.role === 'Admin' || user?.role === 'Manager';

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Control Tower Header */}
      <header className="h-14 border-b border-border px-6 flex items-center justify-between shrink-0 bg-surface/80 backdrop-blur z-10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <SlidersHorizontal size={16} strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Control Tower Executive Analytics
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Phase 2 Active
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-zinc-500 dark:text-zinc-400 bg-subtle border border-border px-3 py-1.5 rounded-md">
            <span className="text-zinc-400 dark:text-zinc-500">Tenant:</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-medium">{user?.org_name}</span>
          </div>

          <button
            onClick={fetchSummary}
            disabled={isLoading}
            title="Refresh Analytics"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors border border-border cursor-pointer"
          >
            <RotateCw
              size={14}
              className={isLoading ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}
              strokeWidth={1.75}
            />
          </button>

          {canViewAudit && (
            <button
              onClick={() => setIsAuditPanelOpen((prev) => !prev)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-subtle hover:bg-elevated transition-colors border border-border cursor-pointer"
              title={isAuditPanelOpen ? 'Collapse Audit Trail' : 'Expand Audit Trail'}
            >
              {isAuditPanelOpen ? (
                <>
                  <PanelRightClose size={14} strokeWidth={1.75} />
                  <span className="hidden md:inline text-[11px]">Hide Audit</span>
                </>
              ) : (
                <>
                  <PanelRightOpen size={14} strokeWidth={1.75} />
                  <span className="hidden md:inline text-[11px]">Audit Feed</span>
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Body with Optional Right-Hand Audit Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left/Center Dashboard Grid Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={fetchSummary}
                className="underline hover:text-rose-700 dark:hover:text-rose-300 font-mono text-[11px] cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* 1. Top 4-Column KPI Strip */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Projects */}
            <div className="p-4 rounded-xl bg-surface border border-border space-y-2 hover:border-zinc-300 dark:hover:border-white/[0.12] transition-colors shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Active Projects</span>
                <Layers size={16} className="text-indigo-600 dark:text-indigo-400" strokeWidth={1.75} />
              </div>
              <div className="text-3xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
                {isLoading && !summary ? '--' : summary?.active_projects}
              </div>
              <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                <span>Enterprise pipeline</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">Deterministic</span>
              </div>
            </div>

            {/* Overdue Tasks */}
            <div className="p-4 rounded-xl bg-surface border border-border space-y-2 hover:border-zinc-300 dark:hover:border-white/[0.12] transition-colors shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Overdue Tasks</span>
                <AlertTriangle
                  size={16}
                  className={(summary?.overdue_tasks || 0) > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-zinc-400 dark:text-zinc-500'}
                  strokeWidth={1.75}
                />
              </div>
              <div
                className={`text-3xl font-bold font-mono tabular-nums ${
                  (summary?.overdue_tasks || 0) > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {isLoading && !summary ? '--' : summary?.overdue_tasks}
              </div>
              <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                <span>Immediate triage</span>
                {(summary?.overdue_tasks || 0) > 0 ? (
                  <span className="font-mono text-rose-500 dark:text-rose-400 font-medium">Critical Attention</span>
                ) : (
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">On Track</span>
                )}
              </div>
            </div>

            {/* Tasks Completed */}
            <div className="p-4 rounded-xl bg-surface border border-border space-y-2 hover:border-zinc-300 dark:hover:border-white/[0.12] transition-colors shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Tasks Completed</span>
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
              </div>
              <div className="text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                {isLoading && !summary ? '--' : summary?.completed_tasks}
              </div>
              <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                <span>Sprint velocity</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">100% Validated</span>
              </div>
            </div>

            {/* Pending Approvals */}
            <div className="p-4 rounded-xl bg-surface border border-border space-y-2 hover:border-zinc-300 dark:hover:border-white/[0.12] transition-colors shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Pending Approvals</span>
                <Clock4 size={16} className="text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
              </div>
              <div className="text-3xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                {isLoading && !summary ? '--' : summary?.pending_approvals}
              </div>
              <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                <span>Manager review gate</span>
                <span className="font-mono text-amber-600 dark:text-amber-400">Sign-off Queued</span>
              </div>
            </div>
          </section>

          {/* 2. Middle 2-Column Row (Donut Chart & Horizontal Bar Chart) */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Task Status Donut Chart */}
            <div className="p-5 rounded-xl bg-surface border border-border flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    Task Status Breakdown
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Live distribution across Todo, In Progress, Review, and Done
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-subtle text-zinc-600 dark:text-zinc-400 border border-border">
                  {totalTasksCount} Total Tasks
                </span>
              </div>

              {/* Donut Chart Container */}
              <div className="h-64 w-full relative flex items-center justify-center">
                {isLoading && !summary ? (
                  <div className="animate-pulse text-xs text-zinc-500 font-mono">
                    Loading task breakdown...
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0];
                              const color = STATUS_COLORS[data.name as string] || '#6366F1';
                              return (
                                <div className="bg-surface border border-border px-3 py-2 rounded-lg shadow-xl text-xs space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: color }}
                                    />
                                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{data.name}</span>
                                  </div>
                                  <div className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400 text-[11px]">
                                    Count: <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{data.value}</span> tasks
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Pie
                          data={summary?.task_status_breakdown || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={88}
                          paddingAngle={3}
                          dataKey="count"
                          nameKey="status"
                        >
                          {(summary?.task_status_breakdown || []).map((entry) => (
                            <Cell
                              key={`cell-${entry.status}`}
                              fill={STATUS_COLORS[entry.status] || '#6366F1'}
                              stroke={isDark ? 'rgba(0,0,0,0.4)' : '#FFFFFF'}
                              strokeWidth={1}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Donut Center Label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {totalTasksCount}
                      </span>
                      <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">
                        Tasks
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Status Breakdown Legend Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-border">
                {(summary?.task_status_breakdown || []).map((item) => {
                  const color = STATUS_COLORS[item.status] || '#6366F1';
                  const pct =
                    totalTasksCount > 0 ? Math.round((item.count / totalTasksCount) * 100) : 0;
                  return (
                    <div
                      key={item.status}
                      className="p-2 rounded-lg bg-subtle border border-border flex flex-col space-y-0.5"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate">
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500 tabular-nums">
                        <span className="text-zinc-900 dark:text-zinc-200 font-semibold">{item.count}</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Team Workload Horizontal Bar Chart */}
            <div className="p-5 rounded-xl bg-surface border border-border flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    Team Workload Distribution
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Non-completed task backlog hours with 40h weekly capacity line
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                  <span>≥36h Overload</span>
                </div>
              </div>

              {/* Workload Horizontal Bar Chart Container */}
              <div className="h-64 w-full">
                {isLoading && !summary ? (
                  <div className="h-full flex items-center justify-center animate-pulse text-xs text-zinc-500 font-mono">
                    Loading team workload...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={summary?.team_workload || []}
                      margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                    >
                      <XAxis
                        type="number"
                        domain={[0, 50]}
                        stroke={axisStroke}
                        tick={{ fill: axisTickColor, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                        tickLine={{ stroke: axisTickLine }}
                        unit="h"
                      />
                      <YAxis
                        type="category"
                        dataKey="full_name"
                        stroke={axisStroke}
                        width={90}
                        tick={{ fill: axisTickColor, fontSize: 11 }}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as TeamWorkloadMember;
                            const isOverloaded = data.est_hours >= 36;
                            return (
                              <div className="bg-surface border border-border px-3.5 py-2.5 rounded-lg shadow-xl text-xs space-y-1.5">
                                <div className="font-semibold text-zinc-900 dark:text-zinc-100">{data.full_name}</div>
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                                  Role: {data.role} • {data.department || 'Operations'}
                                </div>
                                <div className="flex items-center space-x-2 pt-1 border-t border-border font-mono tabular-nums text-xs">
                                  <span className="text-zinc-500 dark:text-zinc-400">Active Workload:</span>
                                  <span
                                    className={`font-bold ${
                                      isOverloaded ? 'text-rose-500 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'
                                    }`}
                                  >
                                    {data.est_hours} hrs
                                  </span>
                                </div>
                                {isOverloaded && (
                                  <div className="text-[10px] font-mono text-rose-500 dark:text-rose-400/90 flex items-center space-x-1">
                                    <AlertTriangle size={11} strokeWidth={1.75} />
                                    <span>Near or exceeds 40h weekly threshold</span>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {/* Subtle 40h weekly capacity reference line */}
                      <ReferenceLine
                        x={40}
                        stroke="#F43F5E"
                        strokeDasharray="3 3"
                        label={{
                          value: '40h Capacity',
                          fill: '#F43F5E',
                          fontSize: 10,
                          position: 'top',
                          fontFamily: 'JetBrains Mono',
                        }}
                      />
                      <Bar dataKey="est_hours" radius={[0, 4, 4, 0]}>
                        {(summary?.team_workload || []).map((entry) => (
                          <Cell
                            key={`workload-${entry.user_id}`}
                            fill={entry.est_hours >= 36 ? '#F43F5E' : '#6366F1'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Workload Metric Legend */}
              <div className="flex items-center justify-between pt-3 border-t border-border text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                <span>Deterministic SQL Aggregate</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                  {summary?.team_workload?.length || 0} Teammates Monitored
                </span>
              </div>
            </div>
          </section>

          {/* 3. Bottom: Visual "What-If" Workload Slider */}
          <section className="p-5 rounded-xl bg-surface border border-border space-y-5 shadow-xs">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Sliders size={15} strokeWidth={1.75} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Visual "What-If" Workload Rebalancer
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      Client Simulation
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Model turnaround time impact by shifting backlog hours between team members in real-time.
                  </p>
                </div>
              </div>

              {/* Simulation Safety Badge */}
              <div className="flex items-center space-x-1.5 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 bg-subtle border border-border px-2.5 py-1 rounded-md shrink-0">
                <Info size={13} className="text-indigo-600 dark:text-indigo-400" strokeWidth={1.75} />
                <span>Client-side simulation — live DB unchanged</span>
              </div>
            </div>

            {/* Dropdowns & Precision Range Slider */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-subtle p-4 rounded-lg border border-border">
              {/* Employee A Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block">
                  Overloaded Teammate (A)
                </label>
                <select
                  value={employeeAId || ''}
                  onChange={(e) => setEmployeeAId(Number(e.target.value))}
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  {teamWorkload.map((u) => (
                    <option key={`emp-a-${u.user_id}`} value={u.user_id}>
                      {u.full_name} ({u.est_hours}h - {u.role})
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-zinc-500 font-mono">
                  Source capacity donor
                </div>
              </div>

              {/* Slider Controller */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Reallocation Shift</span>
                  <span className="font-mono tabular-nums text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    +{shiftHours} hrs shifted
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={shiftHours}
                  onChange={(e) => setShiftHours(Number(e.target.value))}
                  className="w-full accent-indigo-500 bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span>0 hrs</span>
                  <div className="space-x-1">
                    {[4, 8, 12, 16].map((hrs) => (
                      <button
                        key={hrs}
                        onClick={() => setShiftHours(hrs)}
                        className={`px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                          shiftHours === hrs
                            ? 'bg-indigo-600 text-white'
                            : 'bg-surface text-zinc-600 dark:text-zinc-400 hover:bg-elevated border border-border'
                        }`}
                      >
                        +{hrs}h
                      </button>
                    ))}
                    <button
                      onClick={() => setShiftHours(0)}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-surface text-zinc-600 dark:text-zinc-400 hover:bg-elevated border border-border cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                  <span>30 hrs</span>
                </div>
              </div>

              {/* Employee B Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block">
                  Target Teammate (B)
                </label>
                <select
                  value={employeeBId || ''}
                  onChange={(e) => setEmployeeBId(Number(e.target.value))}
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  {teamWorkload.map((u) => (
                    <option key={`emp-b-${u.user_id}`} value={u.user_id}>
                      {u.full_name} ({u.est_hours}h - {u.role})
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-zinc-500 font-mono">
                  Recipient recipient buffer
                </div>
              </div>
            </div>

            {/* Side-by-Side Baseline vs. Simulated Metric Cards & Live Recharts Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
              {/* Card 1: Baseline State */}
              <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    Baseline (Live DB)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-subtle text-zinc-600 dark:text-zinc-400">
                    Active State
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-[130px]">
                      {employeeA?.full_name || 'Teammate A'}:
                    </span>
                    <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200 font-semibold">
                      {simulation.hoursA} hrs
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-[130px]">
                      {employeeB?.full_name || 'Teammate B'}:
                    </span>
                    <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200 font-semibold">
                      {simulation.hoursB} hrs
                    </span>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Bottleneck Duration:</span>
                    <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100 font-bold text-sm">
                      {simulation.baselineDays} Days
                    </span>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-zinc-500 pt-1">
                  Bottleneck: {simulation.baselineBottleneck} critical path hrs
                </div>
              </div>

              {/* Card 2: Simulated State & Impact Banner */}
              <div className="p-4 rounded-lg bg-surface border border-indigo-500/30 flex flex-col justify-between space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <span>Simulated State</span>
                  </span>

                  {/* Crisp Emerald "Saves X Days" Pill when daysSaved > 0 */}
                  {simulation.daysSaved > 0 ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs animate-pulse">
                      <TrendingDown size={13} strokeWidth={2} />
                      <span>
                        Saves {simulation.daysSaved} {simulation.daysSaved === 1 ? 'Day' : 'Days'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-subtle text-zinc-500 dark:text-zinc-400 border border-border">
                      0 Days Saved
                    </span>
                  )}
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[130px]">
                      {employeeA?.full_name || 'Teammate A'}:
                    </span>
                    <div className="flex items-center space-x-1.5 font-mono tabular-nums">
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        {simulation.newHoursA} hrs
                      </span>
                      {shiftHours > 0 && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">(-{shiftHours}h)</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[130px]">
                      {employeeB?.full_name || 'Teammate B'}:
                    </span>
                    <div className="flex items-center space-x-1.5 font-mono tabular-nums">
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        {simulation.newHoursB} hrs
                      </span>
                      {shiftHours > 0 && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">(+{shiftHours}h)</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">New Turnaround:</span>
                    <span
                      className={`font-mono tabular-nums font-bold text-sm ${
                        simulation.daysSaved > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      {simulation.simulatedDays} Days
                    </span>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-zinc-500 pt-1 flex items-center justify-between">
                  <span>Simulated Bottleneck: {simulation.simulatedBottleneck}h</span>
                  {simulation.daysSaved > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      +{Math.round((simulation.daysSaved / simulation.baselineDays) * 100)}% Speedup
                    </span>
                  )}
                </div>
              </div>

              {/* Card 3: Live Recharts Preview */}
              <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    Live Impact Chart
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">Baseline vs. Sim</span>
                </div>

                <div className="h-28 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={whatIfChartData}
                      margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="name"
                        stroke={axisStroke}
                        tick={{ fill: axisTickColor, fontSize: 10 }}
                        tickLine={false}
                      />
                      <YAxis
                        stroke={axisStroke}
                        tick={{ fill: axisTickColor, fontSize: 9, fontFamily: 'JetBrains Mono' }}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-surface border border-border px-2.5 py-1.5 rounded shadow-lg text-[11px] font-mono space-y-1">
                                <div className="text-zinc-900 dark:text-zinc-200 font-semibold">
                                  {payload[0].payload.fullName}
                                </div>
                                <div className="text-zinc-500 dark:text-zinc-400">
                                  Baseline: <span className="text-zinc-800 dark:text-zinc-200">{payload[0].value}h</span>
                                </div>
                                <div className="text-indigo-600 dark:text-indigo-400">
                                  Simulated: <span className="text-indigo-700 dark:text-white font-bold">{payload[1].value}h</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="Baseline" fill={baselineBarFill} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Simulated" fill="#6366F1" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-center space-x-4 pt-2 border-t border-border text-[10px] font-mono">
                  <div className="flex items-center space-x-1 text-zinc-500 dark:text-zinc-400">
                    <span className="w-2 h-2 rounded-xs inline-block" style={{ backgroundColor: baselineBarFill }} />
                    <span>Baseline</span>
                  </div>
                  <div className="flex items-center space-x-1 text-indigo-600 dark:text-indigo-400">
                    <span className="w-2 h-2 rounded-xs bg-indigo-500 inline-block" />
                    <span>Simulated</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right-Hand Docked Audit Trail Feed Panel (Visible for Admin and Manager) */}
        {canViewAudit && isAuditPanelOpen && (
          <aside className="w-80 xl:w-96 shrink-0 h-full hidden lg:block">
            <AuditTrailFeed className="h-full" />
          </aside>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
