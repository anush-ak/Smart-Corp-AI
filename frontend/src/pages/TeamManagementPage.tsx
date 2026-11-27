import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, Mail, Briefcase, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { TeamMember } from '../types';
import { PageHeader, Badge, EmptyState, ErrorBanner, LoadingState, Button } from '../components/ui/Primitives';

const ROLE_TONE: Record<string, 'indigo' | 'sky' | 'amber' | 'emerald'> = {
  Admin: 'indigo',
  Manager: 'sky',
  HR: 'amber',
  Employee: 'emerald',
};

export const TeamManagementPage: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');

  const fetchTeam = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/team`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch team directory (${res.status})`);
      setMembers(await res.json());
    } catch (err: any) {
      setError(err.message || 'Unable to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [token]);

  const departments = useMemo(() => {
    const s = new Set<string>();
    members.forEach((m) => s.add(m.department || 'Operations'));
    return ['All', ...Array.from(s).sort()];
  }, [members]);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (departmentFilter !== 'All' && m.department !== departmentFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q) ||
          m.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [members, departmentFilter, search]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas text-text-primary transition-colors">
      <PageHeader
        title="Team Management"
        subtitle="Organization directory, role permissions, and real-time capacity utilization"
        icon={Users}
        badge={<Badge tone="neutral">{members.length} Active</Badge>}
      />

      <div className="px-4 sm:px-6 py-3 border-b border-border bg-surface flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team members..."
              className="pl-8 pr-3 py-1.5 bg-canvas border border-border rounded-md text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-indigo-500 w-56"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="bg-canvas border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500"
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d === 'All' ? 'All Departments' : d}
              </option>
            ))}
          </select>
        </div>

        <span className="text-[11px] font-mono text-text-muted">
          40h weekly capacity benchmark
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
        {error && <ErrorBanner message={error} onRetry={fetchTeam} />}

        {isLoading ? (
          <LoadingState label="Loading organization directory..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Matching Team Members"
            description="Try clearing your search or selecting another department."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((member) => {
              const overloaded = member.est_hours >= 36;
              const pct = Math.min(100, Math.round((member.est_hours / 40) * 100));
              const initials = member.name
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={member.id}
                  className="p-4 rounded-xl bg-surface border border-border hover:border-indigo-500/30 transition-colors space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center text-xs font-mono font-semibold shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <h3 className="text-sm font-semibold text-text-primary truncate">
                            {member.name}
                          </h3>
                          {member.id === user?.id && (
                            <Badge tone="neutral">You</Badge>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-text-muted truncate">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <Badge tone={ROLE_TONE[member.role] || 'neutral'}>{member.role}</Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs text-text-muted pt-1">
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase size={12} />
                      <span>{member.department}</span>
                    </span>
                    <span className="font-mono tabular-nums">
                      {member.open_tasks} open {member.open_tasks === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-canvas border border-border space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-text-muted">Active Workload</span>
                      <span
                        className={`font-semibold tabular-nums flex items-center gap-1 ${
                          overloaded ? 'text-rose-500' : 'text-emerald-500'
                        }`}
                      >
                        {overloaded ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                        {member.est_hours}h / 40h
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-subtle overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          overloaded ? 'bg-rose-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate('/email-writer')}
                    >
                      <Mail size={12} />
                      <span>Draft Message</span>
                    </Button>
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
