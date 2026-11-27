import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarCheck2,
  Plus,
  Check,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Calendar,
  Sliders,
  Ban,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { API_BASE_URL } from '../config';
import {
  LeaveBalance,
  LeaveRequestItem,
  LeaveSummary,
  LeaveType,
  TeamMember,
} from '../types';
import {
  PageHeader,
  Button,
  Badge,
  Modal,
  EmptyState,
  ErrorBanner,
  LoadingState,
} from '../components/ui/Primitives';

const LEAVE_TYPES: LeaveType[] = [
  'Casual Leave',
  'Sick Leave',
  'Earned Leave',
  'Unpaid Leave',
];

const STATUS_TONE: Record<string, 'amber' | 'emerald' | 'rose' | 'neutral'> = {
  Pending: 'amber',
  Approved: 'emerald',
  Rejected: 'rose',
  Cancelled: 'neutral',
};

const countWorkingDays = (startStr: string, endStr: string): number => {
  if (!startStr || !endStr) return 0;
  const s = new Date(`${startStr}T00:00:00`);
  const e = new Date(`${endStr}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  let guard = 0;
  while (cur <= e && guard < 120) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return count;
};

export const LeaveManagementPage: React.FC = () => {
  const { user, token } = useAuth();
  const isApprover =
    user?.role === 'Admin' || user?.role === 'Manager' || user?.role === 'HR';
  const canConfigureBalances = user?.role === 'Admin' || user?.role === 'HR';

  const [activeTab, setActiveTab] = useState<'mine' | 'team' | 'calendar' | 'balances'>('mine');
  const [summary, setSummary] = useState<LeaveSummary | null>(null);
  const [myRequests, setMyRequests] = useState<LeaveRequestItem[]>([]);
  const [teamRequests, setTeamRequests] = useState<LeaveRequestItem[]>([]);
  const [teamCalendar, setTeamCalendar] = useState<LeaveRequestItem[]>([]);
  const [allBalances, setAllBalances] = useState<LeaveBalance[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Team Filters
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterStart, setFilterStart] = useState<string>('');
  const [filterEnd, setFilterEnd] = useState<string>('');

  // Apply Modal
  const [applyOpen, setApplyOpen] = useState<boolean>(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('Casual Leave');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Reject Modal
  const [rejectTarget, setRejectTarget] = useState<LeaveRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  // Balance Edit Modal
  const [editBalTarget, setEditBalTarget] = useState<LeaveBalance | null>(null);
  const [editTotalDays, setEditTotalDays] = useState<string>('');
  const [isSavingBal, setIsSavingBal] = useState<boolean>(false);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const reqs: Promise<Response>[] = [
        fetch(`${API_BASE_URL}/api/leaves/summary`, { headers }),
        fetch(`${API_BASE_URL}/api/leaves?scope=mine`, { headers }),
        fetch(`${API_BASE_URL}/api/leaves/team-calendar`, { headers }),
        fetch(`${API_BASE_URL}/api/team`, { headers }),
      ];

      if (isApprover) {
        const params = new URLSearchParams({ scope: 'team' });
        if (filterStatus !== 'All') params.set('status', filterStatus);
        if (filterEmployee !== 'all') params.set('employee_id', filterEmployee);
        if (filterDepartment !== 'All') params.set('department', filterDepartment);
        if (filterStart) params.set('start_date', filterStart);
        if (filterEnd) params.set('end_date', filterEnd);
        reqs.push(fetch(`${API_BASE_URL}/api/leaves?${params.toString()}`, { headers }));
        reqs.push(fetch(`${API_BASE_URL}/api/leaves/balances?all_users=true`, { headers }));
      }

      const responses = await Promise.all(reqs);
      if (!responses[0].ok) throw new Error('Failed to load leave summary');

      setSummary(await responses[0].json());
      if (responses[1].ok) setMyRequests(await responses[1].json());
      if (responses[2].ok) setTeamCalendar(await responses[2].json());
      if (responses[3].ok) setTeamMembers(await responses[3].json());
      if (isApprover && responses[4]?.ok) setTeamRequests(await responses[4].json());
      if (isApprover && responses[5]?.ok) setAllBalances(await responses[5].json());
    } catch (err: any) {
      setError(err.message || 'Unable to load leave management data');
    } finally {
      setIsLoading(false);
    }
  }, [
    token,
    isApprover,
    filterStatus,
    filterEmployee,
    filterDepartment,
    filterStart,
    filterEnd,
  ]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useWebSocket({
    onMessage: (msg) => {
      if (msg.type === 'LEAVE_UPDATED') {
        fetchAll();
      }
    },
  });

  const computedDays = useMemo(
    () => countWorkingDays(startDate, endDate),
    [startDate, endDate]
  );

  const selectedBalance = useMemo(() => {
    return summary?.balances.find((b) => b.leave_type === leaveType);
  }, [summary, leaveType]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!startDate || !endDate) {
      setApplyError('Please select both start and end dates.');
      return;
    }
    if (endDate < startDate) {
      setApplyError('End date cannot be earlier than start date.');
      return;
    }
    if (computedDays <= 0) {
      setApplyError('Selected range must include at least one working day (Mon–Fri).');
      return;
    }
    if (leaveType !== 'Unpaid Leave' && selectedBalance && computedDays > selectedBalance.remaining_days) {
      setApplyError(
        `Insufficient ${leaveType} balance: requesting ${computedDays}d, available ${selectedBalance.remaining_days}d.`
      );
      return;
    }
    if (reason.trim().length < 3) {
      setApplyError('Please provide a clear reason (at least 3 characters).');
      return;
    }

    setIsSubmitting(true);
    setApplyError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim(),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to submit request (${res.status})`);
      }
      setApplyOpen(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      await fetchAll();
    } catch (err: any) {
      setApplyError(err.message || 'Could not submit leave request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (reqItem: LeaveRequestItem) => {
    if (!token) return;
    setIsReviewing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/${reqItem.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ review_note: 'Approved' }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Approval failed (${res.status})`);
      }
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Failed to approve leave request');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !rejectTarget || !rejectReason.trim()) return;
    setIsReviewing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/${rejectTarget.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Rejection failed (${res.status})`);
      }
      setRejectTarget(null);
      setRejectReason('');
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Failed to reject leave request');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleCancelRequest = async (id: number) => {
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/${id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Cancellation failed (${res.status})`);
      }
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel leave request');
    }
  };

  const handleSaveBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editBalTarget) return;
    setIsSavingBal(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/balances`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: editBalTarget.user_id,
          leave_type: editBalTarget.leave_type,
          total_days: parseFloat(editTotalDays),
          year: editBalTarget.year,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Update failed (${res.status})`);
      }
      setEditBalTarget(null);
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Failed to update balance');
    } finally {
      setIsSavingBal(false);
    }
  };

  const departments = useMemo(() => {
    const s = new Set<string>();
    teamMembers.forEach((m) => s.add(m.department || 'Operations'));
    return ['All', ...Array.from(s).sort()];
  }, [teamMembers]);

  const counts = isApprover ? summary?.org_counts : summary?.my_counts;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas text-text-primary transition-colors">
      <PageHeader
        title="Leave Management"
        subtitle="Track balances, submit time-off requests, and manage team approvals"
        icon={CalendarCheck2}
        actions={
          <Button variant="primary" size="sm" onClick={() => setApplyOpen(true)}>
            <Plus size={13} strokeWidth={2} />
            <span>Apply for Leave</span>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
        {error && <ErrorBanner message={error} onRetry={fetchAll} onDismiss={() => setError(null)} />}

        {/* Balances + Status Dashboard Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
          {(summary?.balances || []).map((bal) => {
            const pct = bal.total_days > 0 ? Math.min(100, (bal.used_days / bal.total_days) * 100) : 0;
            return (
              <div
                key={bal.id}
                className="p-4 rounded-xl bg-surface border border-border space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-primary truncate">
                    {bal.leave_type}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">{bal.year}</span>
                </div>
                <div className="flex items-baseline space-x-1.5 font-mono tabular-nums">
                  <span className="text-2xl font-bold text-indigo-500">
                    {bal.remaining_days}
                  </span>
                  <span className="text-xs text-text-muted">/ {bal.total_days}d avail</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-subtle overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${100 - pct}%` }}
                  />
                </div>
                <div className="text-[10px] font-mono text-text-muted">
                  Used: {bal.used_days} days
                </div>
              </div>
            );
          })}

          <div className="p-4 rounded-xl bg-surface border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-text-muted">
              <span>Pending</span>
              <Clock size={14} className="text-amber-500" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-500">
              {counts?.pending ?? 0}
            </div>
            <div className="text-[10px] font-mono text-text-muted">
              {isApprover ? 'Org awaiting review' : 'Your pending'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-text-muted">
              <span>Approved</span>
              <CheckCircle2 size={14} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-500">
              {counts?.approved ?? 0}
            </div>
            <div className="text-[10px] font-mono text-text-muted">
              {isApprover ? 'Org approved' : 'Your approved'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-text-muted">
              <span>Rejected</span>
              <XCircle size={14} className="text-rose-500" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-rose-500">
              {counts?.rejected ?? 0}
            </div>
            <div className="text-[10px] font-mono text-text-muted">
              {isApprover ? 'Org rejected' : 'Your rejected'}
            </div>
          </div>
        </section>

        {/* Sub-navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="inline-flex flex-wrap gap-1.5 bg-surface p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('mine')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'mine'
                  ? 'bg-indigo-600 text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              My Leave History ({myRequests.length})
            </button>

            {isApprover && (
              <button
                type="button"
                onClick={() => setActiveTab('team')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'team'
                    ? 'bg-indigo-600 text-white'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Team Requests ({teamRequests.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-indigo-600 text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Team Leave Calendar
            </button>

            {isApprover && (
              <button
                type="button"
                onClick={() => setActiveTab('balances')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'balances'
                    ? 'bg-indigo-600 text-white'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Leave Balances
              </button>
            )}
          </div>
        </div>

        {/* Tab Views */}
        {isLoading && !summary ? (
          <LoadingState label="Loading leave records..." />
        ) : activeTab === 'mine' ? (
          myRequests.length === 0 ? (
            <EmptyState
              icon={CalendarCheck2}
              title="No Leave Requests Yet"
              description="Submit a leave request to track approvals and automatically update your balance once approved."
              action={
                <Button size="sm" onClick={() => setApplyOpen(true)}>
                  <Plus size={13} />
                  <span>Apply for Leave</span>
                </Button>
              }
            />
          ) : (
            <div className="rounded-xl border border-border bg-surface overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-subtle/50 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Dates</th>
                    <th className="py-3 px-4">Days</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Reviewer / Note</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {myRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-subtle/30">
                      <td className="py-3 px-4 font-medium text-text-primary whitespace-nowrap">
                        {req.leave_type}
                      </td>
                      <td className="py-3 px-4 font-mono text-text-muted whitespace-nowrap">
                        {req.start_date} → {req.end_date}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-text-primary">
                        {req.days_count}d
                      </td>
                      <td className="py-3 px-4 text-text-muted max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone={STATUS_TONE[req.status] || 'neutral'}>{req.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-text-muted text-[11px]">
                        {req.reviewer_name ? (
                          <span>
                            {req.reviewer_name}
                            {req.review_note ? ` — "${req.review_note}"` : ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {req.status === 'Pending' && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleCancelRequest(req.id)}
                          >
                            <Ban size={11} />
                            <span>Cancel</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'team' && isApprover ? (
          <div className="space-y-4">
            {/* Filters */}
            <div className="p-3.5 rounded-xl bg-surface border border-border flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center space-x-1.5 text-text-muted">
                <Filter size={13} />
                <span className="font-medium">Filters:</span>
              </div>
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="bg-canvas border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary"
              >
                <option value="all">All Employees</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.name}
                  </option>
                ))}
              </select>

              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="bg-canvas border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d === 'All' ? 'All Departments' : d}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-canvas border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <input
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                className="bg-canvas border border-border rounded-md px-2.5 py-1.5 text-xs font-mono text-text-primary"
                title="From date"
              />
              <input
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                className="bg-canvas border border-border rounded-md px-2.5 py-1.5 text-xs font-mono text-text-primary"
                title="To date"
              />
            </div>

            {teamRequests.length === 0 ? (
              <EmptyState
                icon={CalendarCheck2}
                title="No Team Leave Requests Match"
                description="Adjust the filters above to view other employee leave requests."
              />
            ) : (
              <div className="rounded-xl border border-border bg-surface overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-subtle/50 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Dates</th>
                      <th className="py-3 px-4">Days</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teamRequests.map((req) => {
                      const isSelf = req.user_id === user?.id;
                      return (
                        <tr key={req.id} className="hover:bg-subtle/30">
                          <td className="py-3 px-4">
                            <div className="font-medium text-text-primary">{req.employee_name}</div>
                            <div className="text-[10px] font-mono text-text-muted">
                              {req.department} • {req.employee_role}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">{req.leave_type}</td>
                          <td className="py-3 px-4 font-mono text-text-muted whitespace-nowrap">
                            {req.start_date} → {req.end_date}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums">{req.days_count}d</td>
                          <td className="py-3 px-4 text-text-muted max-w-xs truncate" title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="py-3 px-4">
                            <Badge tone={STATUS_TONE[req.status] || 'neutral'}>{req.status}</Badge>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {req.status === 'Pending' ? (
                              isSelf ? (
                                <span className="text-[10px] font-mono text-text-muted italic">
                                  Self-approval blocked
                                </span>
                              ) : (
                                <div className="inline-flex items-center space-x-1.5">
                                  <Button
                                    variant="success"
                                    size="sm"
                                    disabled={isReviewing}
                                    onClick={() => handleApprove(req)}
                                  >
                                    <Check size={12} />
                                    <span>Approve</span>
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    disabled={isReviewing}
                                    onClick={() => {
                                      setRejectTarget(req);
                                      setRejectReason('');
                                    }}
                                  >
                                    <X size={12} />
                                    <span>Reject</span>
                                  </Button>
                                </div>
                              )
                            ) : (
                              <span className="text-[11px] text-text-muted">
                                {req.reviewer_name ? `By ${req.reviewer_name}` : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'calendar' ? (
          /* Team Leave Calendar */
          teamCalendar.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No Scheduled Team Leaves"
              description="Approved team leaves (and pending requests for managers/HR) appear here."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {teamCalendar.map((lv) => (
                <div
                  key={`cal-${lv.id}`}
                  className="p-4 rounded-xl bg-surface border border-border space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-text-primary">
                        {lv.employee_name}
                      </div>
                      <div className="text-[11px] font-mono text-text-muted">
                        {lv.department} • {lv.leave_type}
                      </div>
                    </div>
                    <Badge tone={STATUS_TONE[lv.status] || 'neutral'}>{lv.status}</Badge>
                  </div>
                  <div className="p-2.5 rounded-md bg-canvas border border-border flex items-center justify-between text-xs font-mono">
                    <span>
                      {lv.start_date} → {lv.end_date}
                    </span>
                    <span className="text-indigo-500 font-semibold">{lv.days_count}d</span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Leave Balances Admin/HR/Manager View */
          <div className="rounded-xl border border-border bg-surface overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-subtle/50 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Quota</th>
                  <th className="py-3 px-4">Used</th>
                  <th className="py-3 px-4">Remaining</th>
                  {canConfigureBalances && <th className="py-3 px-4 text-right">Configure</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allBalances.map((b) => (
                  <tr key={b.id} className="hover:bg-subtle/30">
                    <td className="py-3 px-4 font-medium text-text-primary">{b.user_name}</td>
                    <td className="py-3 px-4 text-text-muted">{b.department}</td>
                    <td className="py-3 px-4">{b.leave_type}</td>
                    <td className="py-3 px-4 font-mono tabular-nums">{b.total_days}d</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-text-muted">
                      {b.used_days}d
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-emerald-500 font-semibold">
                      {b.remaining_days}d
                    </td>
                    {canConfigureBalances && (
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditBalTarget(b);
                            setEditTotalDays(String(b.total_days));
                          }}
                        >
                          <Sliders size={11} />
                          <span>Adjust Quota</span>
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply for Leave Modal */}
      <Modal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title="Apply for Leave"
        subtitle="Working days (Monday–Friday) are validated against your available balance"
        icon={CalendarCheck2}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleApplySubmit} className="space-y-4 text-xs">
          {applyError && <ErrorBanner message={applyError} />}

          <div className="space-y-1.5">
            <label className="font-medium text-text-primary">Leave Type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs text-text-primary"
            >
              {LEAVE_TYPES.map((lt) => (
                <option key={lt} value={lt}>
                  {lt}
                </option>
              ))}
            </select>
            {selectedBalance && (
              <div className="text-[11px] font-mono text-text-muted">
                Available balance: <span className="text-indigo-500 font-semibold">{selectedBalance.remaining_days} days</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs font-mono text-text-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">End Date</label>
              <input
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs font-mono text-text-primary"
              />
            </div>
          </div>

          {startDate && endDate && (
            <div className="p-2.5 rounded-lg bg-subtle border border-border flex items-center justify-between font-mono text-[11px]">
              <span className="text-text-muted">Calculated Working Days:</span>
              <span className="text-indigo-500 font-semibold">{computedDays} days</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-medium text-text-primary">Reason</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide context and handover coverage details..."
              className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs text-text-primary resize-y"
            />
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-end space-x-2">
            <Button variant="secondary" onClick={() => setApplyOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reject Reason Modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject Leave Request"
        subtitle={rejectTarget ? `${rejectTarget.employee_name} • ${rejectTarget.leave_type}` : undefined}
        icon={XCircle}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-medium text-text-primary">
              Rejection Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this leave request cannot be approved..."
              className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs text-text-primary"
            />
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-end space-x-2">
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={isReviewing}>
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>

      {/* Adjust Leave Balance Modal (Admin/HR) */}
      <Modal
        open={!!editBalTarget}
        onClose={() => setEditBalTarget(null)}
        title="Configure Leave Quota"
        subtitle={editBalTarget ? `${editBalTarget.user_name} • ${editBalTarget.leave_type}` : undefined}
        icon={Sliders}
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleSaveBalance} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-medium text-text-primary">Annual Allocation (Days)</label>
            <input
              type="number"
              step="0.5"
              min={editBalTarget?.used_days ?? 0}
              max={365}
              required
              value={editTotalDays}
              onChange={(e) => setEditTotalDays(e.target.value)}
              className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs font-mono text-text-primary"
            />
            {editBalTarget && (
              <div className="text-[11px] font-mono text-text-muted">
                Already used: {editBalTarget.used_days} days
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-end space-x-2">
            <Button variant="secondary" onClick={() => setEditBalTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSavingBal}>
              Save Quota
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
