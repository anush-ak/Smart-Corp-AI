import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  KeyRound,
  FileText,
  UserCheck,
  Activity,
  RotateCw,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { AuditEvent } from '../types';
import { API_BASE_URL } from '../config';

interface AuditTrailFeedProps {
  className?: string;
  showTitle?: boolean;
  maxEvents?: number;
}

export const AuditTrailFeed: React.FC<AuditTrailFeedProps> = ({
  className = '',
  showTitle = true,
  maxEvents,
}) => {
  const { token, user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditEvents = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/audit-events`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load audit events (${response.status})`);
      }

      const data: AuditEvent[] = await response.json();
      setEvents(data);
    } catch (err: any) {
      console.error('Audit trail fetch error:', err);
      setError(err.message || 'Unable to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAuditEvents();
  }, [fetchAuditEvents]);

  // Connect WebSocket to receive live audit events in real-time
  const handleAuditEventWs = useCallback((payload: any) => {
    if (payload && payload.id) {
      setEvents((prev) => {
        if (prev.some((e) => e.id === payload.id)) return prev;
        return [payload, ...prev];
      });
    }
  }, []);

  useWebSocket({
    onAuditEvent: handleAuditEventWs,
  });

  const formatTimestamp = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return isoString;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'USER_LOGIN':
        return {
          icon: <KeyRound size={13} className="text-indigo-600 dark:text-indigo-400" strokeWidth={1.75} />,
          badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          label: 'LOGIN',
        };
      case 'ORGANIZATION_INITIALIZED':
        return {
          icon: <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />,
          badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          label: 'ORG_INIT',
        };
      case 'WORKLOAD_AUDITED':
        return {
          icon: <Activity size={13} className="text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />,
          badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          label: 'AUDIT',
        };
      case 'PROJECT_CREATED':
        return {
          icon: <Layers size={13} className="text-sky-600 dark:text-sky-400" strokeWidth={1.75} />,
          badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
          label: 'PROJECT',
        };
      case 'TASK_STARTED':
      case 'TASK_CREATED':
      case 'TASK_BATCH_CREATED':
      case 'TASKS_BATCH_CREATED':
      case 'TASK_UPDATED':
        return {
          icon: <FileText size={13} className="text-amber-600 dark:text-amber-400" strokeWidth={1.75} />,
          badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          label: 'TASK',
        };
      case 'USER_INVITED':
        return {
          icon: <UserCheck size={13} className="text-indigo-600 dark:text-indigo-400" strokeWidth={1.75} />,
          badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          label: 'USER',
        };
      default:
        return {
          icon: <Clock size={13} className="text-zinc-500 dark:text-zinc-400" strokeWidth={1.75} />,
          badgeClass: 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08]',
          label: action.replace(/_/g, ' ').slice(0, 10),
        };
    }
  };

  const displayedEvents = maxEvents ? events.slice(0, maxEvents) : events;

  return (
    <div
      className={`flex flex-col h-full bg-surface border-l border-border transition-colors ${className}`}
    >
      {/* Panel Header */}
      {showTitle && (
        <div className="h-14 px-4 border-b border-border flex items-center justify-between shrink-0 bg-surface/80 backdrop-blur">
          <div className="flex items-center space-x-2">
            <ShieldCheck size={15} className="text-indigo-600 dark:text-indigo-400" strokeWidth={1.75} />
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Tenant Audit Trail
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Live
            </span>
          </div>
          <button
            onClick={fetchAuditEvents}
            disabled={isLoading}
            title="Refresh Audit Trail"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCw
              size={13}
              className={isLoading ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}
              strokeWidth={1.75}
            />
          </button>
        </div>
      )}

      {/* Events Sub-banner */}
      <div className="px-4 py-2 border-b border-border bg-subtle/40 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="font-mono text-[10px] uppercase tracking-wider">
          Immutable Log Feed
        </span>
        <span className="font-mono tabular-nums text-[10px] text-zinc-700 dark:text-zinc-300 font-medium">
          {events.length} {events.length === 1 ? 'event' : 'events'} recorded
        </span>
      </div>

      {/* Events List Scrollable Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {isLoading && events.length === 0 ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse space-y-2 py-2">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-20 bg-zinc-200 dark:bg-white/[0.04] rounded" />
                  <div className="h-3 w-12 bg-zinc-200 dark:bg-white/[0.04] rounded" />
                </div>
                <div className="h-3 w-full bg-zinc-100 dark:bg-white/[0.02] rounded" />
              </div>
            ))}
          </div>
        ) : error && events.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <AlertCircle size={20} className="text-rose-500 dark:text-rose-400 mx-auto" strokeWidth={1.75} />
            <div className="text-xs text-zinc-800 dark:text-zinc-300 font-medium">Failed to sync audit feed</div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">{error}</div>
            <button
              onClick={fetchAuditEvents}
              className="mt-2 text-xs px-2.5 py-1 rounded bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/[0.1] transition-colors cursor-pointer border border-border"
            >
              Retry
            </button>
          </div>
        ) : displayedEvents.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Clock size={20} className="text-zinc-400 mx-auto" strokeWidth={1.75} />
            <div className="text-xs text-zinc-500 dark:text-zinc-400">No events logged yet for this organization.</div>
          </div>
        ) : (
          displayedEvents.map((event) => {
            const badge = getActionBadge(event.action);
            return (
              <div
                key={event.id}
                className="p-3.5 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors space-y-1.5"
              >
                {/* Event Top Row: Action Pill & Timestamp */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${badge.badgeClass}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>
                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[130px]">
                      {event.user_name || 'System'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>

                {/* Details Description */}
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed break-words">
                  {event.details || event.action}
                </p>

                {/* Resource Metadata Pill */}
                {event.resource_type && (
                  <div className="flex items-center space-x-2 pt-0.5">
                    <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 bg-subtle px-1.5 py-0.5 rounded border border-border">
                      ref: {event.resource_type}
                      {event.resource_id ? `#${event.resource_id}` : ''}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-border bg-surface text-[10px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
        <span className="truncate">Org #{user?.org_id} Tenant Vault</span>
        <span className="text-emerald-600 dark:text-emerald-400/80 font-medium">Tamper-Proof</span>
      </div>
    </div>
  );
};
