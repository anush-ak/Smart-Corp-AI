import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  CheckSquare,
  CalendarCheck2,
  Trash2,
  Edit3,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { API_BASE_URL } from '../config';
import { CalendarCategory, CalendarEventItem, TeamMember } from '../types';
import {
  PageHeader,
  Button,
  Badge,
  Modal,
  EmptyState,
  ErrorBanner,
  LoadingState,
} from '../components/ui/Primitives';

type CalendarView = 'month' | 'week' | 'day';

const CATEGORY_META: Record<
  CalendarCategory,
  { label: string; pill: string; dot: string }
> = {
  meeting: {
    label: 'Meeting',
    pill: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30',
    dot: 'bg-indigo-500',
  },
  deadline: {
    label: 'Task Deadline',
    pill: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
    dot: 'bg-rose-500',
  },
  review: {
    label: 'Review',
    pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    dot: 'bg-amber-500',
  },
  company: {
    label: 'Company',
    pill: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
    dot: 'bg-sky-500',
  },
  focus: {
    label: 'Focus Block',
    pill: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  leave: {
    label: 'Team Leave',
    pill: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30',
    dot: 'bg-zinc-400',
  },
};

const EDITABLE_CATEGORIES: Array<Exclude<CalendarCategory, 'leave'>> = [
  'meeting',
  'review',
  'company',
  'focus',
  'deadline',
];

const toLocalDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toDatetimeLocalInput = (isoOrDate: string | Date): string => {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

export const SmartCalendarPage: React.FC = () => {
  const { token } = useAuth();

  const [view, setView] = useState<CalendarView>('month');
  const [cursorDate, setCursorDate] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showTasks, setShowTasks] = useState<boolean>(true);
  const [showLeaves, setShowLeaves] = useState<boolean>(true);

  // Detail & Create/Edit Modals
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('meeting');
  const [formStart, setFormStart] = useState<string>('');
  const [formEnd, setFormEnd] = useState<string>('');
  const [formAllDay, setFormAllDay] = useState<boolean>(false);
  const [formLocation, setFormLocation] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formAttendees, setFormAttendees] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchCalendar = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        include_tasks: String(showTasks),
        include_leaves: String(showLeaves),
      });
      if (categoryFilter !== 'all') params.set('category', categoryFilter);

      const res = await fetch(`${API_BASE_URL}/api/calendar/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch calendar (${res.status})`);
      const data: CalendarEventItem[] = await res.json();
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load calendar events');
    } finally {
      setIsLoading(false);
    }
  }, [token, showTasks, showLeaves, categoryFilter]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/team`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TeamMember[]) => setTeam(data))
      .catch(() => {});
  }, [token]);

  useWebSocket({
    onMessage: (msg) => {
      if (
        msg.type === 'CALENDAR_UPDATED' ||
        msg.type === 'TASK_UPDATED' ||
        msg.type === 'LEAVE_UPDATED'
      ) {
        fetchCalendar();
      }
    },
  });

  // Navigation helpers
  const goToday = () => setCursorDate(new Date());
  const goPrev = () => {
    const next = new Date(cursorDate);
    if (view === 'month') next.setMonth(next.getMonth() - 1);
    else if (view === 'week') next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCursorDate(next);
  };
  const goNext = () => {
    const next = new Date(cursorDate);
    if (view === 'month') next.setMonth(next.getMonth() + 1);
    else if (view === 'week') next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCursorDate(next);
  };

  // Build Month Grid (6 weeks x 7 days)
  const monthDays = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0=Sun
    const gridStart = new Date(year, month, 1 - startOffset);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursorDate]);

  // Build Week Days (Sun..Sat containing cursorDate)
  const weekDays = useMemo(() => {
    const start = new Date(cursorDate);
    start.setDate(cursorDate.getDate() - cursorDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursorDate]);

  // Map events onto date keys
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEventItem[]> = {};
    for (const ev of events) {
      const s = new Date(ev.start_time);
      const e = new Date(ev.end_time);
      const sDay = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      const eDay = new Date(e.getFullYear(), e.getMonth(), e.getDate());
      const cur = new Date(sDay);
      let guard = 0;
      while (cur <= eDay && guard < 60) {
        const key = toLocalDateKey(cur);
        if (!map[key]) map[key] = [];
        map[key].push(ev);
        cur.setDate(cur.getDate() + 1);
        guard += 1;
      }
    }
    return map;
  }, [events]);

  // Upcoming events (from start of today)
  const upcomingEvents = useMemo(() => {
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    return events
      .filter((ev) => new Date(ev.end_time) >= startToday)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 10);
  }, [events]);

  const openCreateModal = (day?: Date) => {
    const base = day ? new Date(day) : new Date(cursorDate);
    base.setHours(10, 0, 0, 0);
    const end = new Date(base);
    end.setHours(11, 0, 0, 0);

    setEditingId(null);
    setFormTitle('');
    setFormCategory('meeting');
    setFormStart(toDatetimeLocalInput(base));
    setFormEnd(toDatetimeLocalInput(end));
    setFormAllDay(false);
    setFormLocation('');
    setFormDescription('');
    setFormAttendees([]);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditModal = (ev: CalendarEventItem) => {
    setSelectedEvent(null);
    setEditingId(ev.source_id);
    setFormTitle(ev.title);
    setFormCategory(ev.category);
    setFormStart(toDatetimeLocalInput(ev.start_time));
    setFormEnd(toDatetimeLocalInput(ev.end_time));
    setFormAllDay(ev.all_day);
    setFormLocation(ev.location || '');
    setFormDescription(ev.description || '');
    setFormAttendees(ev.attendees || []);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!formTitle.trim()) {
      setFormError('Event title is required.');
      return;
    }
    const sDate = new Date(formStart);
    const eDate = new Date(formEnd);
    if (Number.isNaN(sDate.getTime()) || Number.isNaN(eDate.getTime())) {
      setFormError('Please provide valid start and end dates.');
      return;
    }
    if (eDate < sDate) {
      setFormError('End time must be after or equal to start time.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const url = editingId
        ? `${API_BASE_URL}/api/calendar/events/${editingId}`
        : `${API_BASE_URL}/api/calendar/events`;
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formTitle.trim(),
          category: formCategory,
          start_time: sDate.toISOString(),
          end_time: eDate.toISOString(),
          all_day: formAllDay,
          location: formLocation.trim() || null,
          description: formDescription.trim() || null,
          attendees: formAttendees,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to save event (${res.status})`);
      }
      setFormOpen(false);
      await fetchCalendar();
    } catch (err: any) {
      setFormError(err.message || 'Unable to save calendar event.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!token || !selectedEvent || selectedEvent.source !== 'event') return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/calendar/events/${selectedEvent.source_id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Delete failed');
      }
      setSelectedEvent(null);
      setConfirmDelete(false);
      await fetchCalendar();
    } catch (err: any) {
      setError(err.message || 'Unable to delete event.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleAttendee = (name: string) => {
    setFormAttendees((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  };

  const headerTitle = useMemo(() => {
    if (view === 'month') {
      return cursorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (view === 'week') {
      const start = weekDays[0];
      const end = weekDays[6];
      return `${start.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} – ${end.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
    }
    return cursorDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [view, cursorDate, weekDays]);

  const todayKey = toLocalDateKey(new Date());

  const formatTime = (iso: string, allDay: boolean) => {
    if (allDay) return 'All day';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas text-text-primary transition-colors">
      <PageHeader
        title="Smart Calendar"
        subtitle="Unified schedule combining team events, task deadlines, and approved leaves"
        icon={CalendarDays}
        actions={
          <Button variant="primary" size="sm" onClick={() => openCreateModal()}>
            <Plus size={13} strokeWidth={2} />
            <span>New Event</span>
          </Button>
        }
      />

      {/* Calendar Controls Bar */}
      <div className="px-4 sm:px-6 py-2.5 border-b border-border bg-surface flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="inline-flex items-center rounded-md border border-border bg-canvas p-0.5">
            <button
              type="button"
              onClick={goPrev}
              className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-subtle cursor-pointer"
              aria-label="Previous"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-subtle rounded cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={goNext}
              className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-subtle cursor-pointer"
              aria-label="Next"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <h2 className="text-sm font-semibold text-text-primary pl-1">{headerTitle}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Layer toggles */}
          <label className="inline-flex items-center space-x-1.5 text-[11px] text-text-muted px-2.5 py-1 rounded-md border border-border bg-canvas cursor-pointer">
            <input
              type="checkbox"
              checked={showTasks}
              onChange={(e) => setShowTasks(e.target.checked)}
              className="accent-indigo-500"
            />
            <span>Task Deadlines</span>
          </label>
          <label className="inline-flex items-center space-x-1.5 text-[11px] text-text-muted px-2.5 py-1 rounded-md border border-border bg-canvas cursor-pointer">
            <input
              type="checkbox"
              checked={showLeaves}
              onChange={(e) => setShowLeaves(e.target.checked)}
              className="accent-indigo-500"
            />
            <span>Approved Leaves</span>
          </label>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-canvas border border-border rounded-md px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>

          {/* View Switcher */}
          <div className="inline-flex rounded-md border border-border bg-canvas p-0.5">
            {(['month', 'week', 'day'] as CalendarView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors cursor-pointer ${
                  view === v
                    ? 'bg-indigo-600 text-white'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area + Right Upcoming Rail */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {error && (
            <div className="mb-4">
              <ErrorBanner message={error} onRetry={fetchCalendar} />
            </div>
          )}

          {isLoading && events.length === 0 ? (
            <LoadingState label="Synchronizing calendar, tasks, and leaves..." />
          ) : view === 'month' ? (
            /* MONTH VIEW */
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="grid grid-cols-7 border-b border-border bg-subtle/60">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div
                    key={day}
                    className="py-2 px-2.5 text-[11px] font-mono uppercase tracking-wider text-text-muted text-center border-r last:border-r-0 border-border"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((day, idx) => {
                  const key = toLocalDateKey(day);
                  const inMonth = day.getMonth() === cursorDate.getMonth();
                  const isToday = key === todayKey;
                  const dayEvents = eventsByDate[key] || [];
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setCursorDate(day);
                        openCreateModal(day);
                      }}
                      className={`min-h-[104px] p-1.5 border-b border-r border-border transition-colors cursor-pointer hover:bg-subtle/40 ${
                        (idx + 1) % 7 === 0 ? 'border-r-0' : ''
                      } ${!inMonth ? 'opacity-45 bg-canvas/40' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1 px-1">
                        <span
                          className={`text-xs font-mono tabular-nums w-6 h-6 rounded-full flex items-center justify-center ${
                            isToday
                              ? 'bg-indigo-600 text-white font-semibold'
                              : 'text-text-primary'
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] font-mono text-text-muted">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((ev) => {
                          const meta = CATEGORY_META[ev.category] || CATEGORY_META.meeting;
                          return (
                            <button
                              key={`${key}-${ev.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(false);
                                setSelectedEvent(ev);
                              }}
                              className={`w-full text-left px-1.5 py-0.5 rounded border text-[10px] font-medium truncate flex items-center gap-1 cursor-pointer hover:opacity-90 ${meta.pill}`}
                              title={ev.title}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                              <span className="truncate">{ev.title}</span>
                            </button>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCursorDate(day);
                              setView('day');
                            }}
                            className="text-[10px] font-mono text-indigo-500 hover:underline px-1 cursor-pointer"
                          >
                            +{dayEvents.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : view === 'week' ? (
            /* WEEK VIEW */
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekDays.map((day) => {
                const key = toLocalDateKey(day);
                const isToday = key === todayKey;
                const dayEvents = eventsByDate[key] || [];
                return (
                  <div
                    key={key}
                    className={`rounded-xl border bg-surface flex flex-col min-h-[380px] overflow-hidden ${
                      isToday ? 'border-indigo-500/50' : 'border-border'
                    }`}
                  >
                    <div
                      className={`px-3 py-2.5 border-b border-border flex items-center justify-between ${
                        isToday ? 'bg-indigo-500/10' : 'bg-subtle/50'
                      }`}
                    >
                      <div>
                        <div className="text-[10px] font-mono uppercase text-text-muted">
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className="text-sm font-semibold font-mono text-text-primary">
                          {day.getDate()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCreateModal(day)}
                        className="p-1 rounded hover:bg-elevated text-text-muted hover:text-text-primary cursor-pointer"
                        title="Add event on this day"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                      {dayEvents.length === 0 ? (
                        <div className="text-[11px] text-text-muted/60 text-center py-8">
                          No events
                        </div>
                      ) : (
                        dayEvents.map((ev) => {
                          const meta = CATEGORY_META[ev.category] || CATEGORY_META.meeting;
                          return (
                            <button
                              key={`${key}-${ev.id}`}
                              type="button"
                              onClick={() => {
                                setConfirmDelete(false);
                                setSelectedEvent(ev);
                              }}
                              className={`w-full text-left p-2 rounded-lg border text-xs space-y-1 cursor-pointer hover:opacity-90 ${meta.pill}`}
                            >
                              <div className="font-medium leading-snug line-clamp-2">
                                {ev.title}
                              </div>
                              <div className="text-[10px] font-mono opacity-80">
                                {formatTime(ev.start_time, ev.all_day)}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* DAY VIEW */
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border">
                <div>
                  <div className="text-xs font-mono uppercase text-text-muted">Daily Agenda</div>
                  <div className="text-base font-semibold text-text-primary mt-0.5">
                    {headerTitle}
                  </div>
                </div>
                <Button size="sm" onClick={() => openCreateModal(cursorDate)}>
                  <Plus size={13} />
                  <span>Schedule Event</span>
                </Button>
              </div>

              {(eventsByDate[toLocalDateKey(cursorDate)] || []).length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Clear Schedule"
                  description="No scheduled meetings, task deadlines, or team leaves on this day."
                  action={
                    <Button size="sm" onClick={() => openCreateModal(cursorDate)}>
                      <Plus size={13} />
                      <span>Add Event</span>
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-2.5">
                  {(eventsByDate[toLocalDateKey(cursorDate)] || []).map((ev) => {
                    const meta = CATEGORY_META[ev.category] || CATEGORY_META.meeting;
                    return (
                      <div
                        key={ev.id}
                        onClick={() => {
                          setConfirmDelete(false);
                          setSelectedEvent(ev);
                        }}
                        className="p-4 rounded-xl bg-surface border border-border hover:border-indigo-500/40 transition-colors cursor-pointer flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono ${meta.pill}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                              {meta.label}
                            </span>
                            <span className="text-xs font-mono text-text-muted">
                              {ev.all_day
                                ? 'All Day'
                                : `${formatTime(ev.start_time, false)} – ${formatTime(
                                    ev.end_time,
                                    false
                                  )}`}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-text-primary">{ev.title}</h3>
                          {ev.description && (
                            <p className="text-xs text-text-muted line-clamp-2">{ev.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-text-muted font-mono">
                            {ev.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={11} />
                                {ev.location}
                              </span>
                            )}
                            {ev.attendees.length > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Users size={11} />
                                {ev.attendees.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>

                        <Badge tone="neutral">{ev.source.toUpperCase()}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Upcoming Events Sidebar */}
        <aside className="hidden xl:flex w-80 border-l border-border bg-surface flex-col shrink-0">
          <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Upcoming Schedule
            </span>
            <Badge tone="indigo">{upcomingEvents.length}</Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {upcomingEvents.length === 0 ? (
              <div className="py-10 text-center text-xs text-text-muted">
                No upcoming events found.
              </div>
            ) : (
              upcomingEvents.map((ev) => {
                const meta = CATEGORY_META[ev.category] || CATEGORY_META.meeting;
                const d = new Date(ev.start_time);
                return (
                  <button
                    key={`upcoming-${ev.id}`}
                    type="button"
                    onClick={() => {
                      setConfirmDelete(false);
                      setSelectedEvent(ev);
                    }}
                    className="w-full text-left p-3 rounded-lg bg-canvas border border-border hover:border-indigo-500/40 transition-colors space-y-1.5 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono ${meta.pill}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-mono text-text-muted tabular-nums">
                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-text-primary line-clamp-2">
                      {ev.title}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                      <span>{formatTime(ev.start_time, ev.all_day)}</span>
                      {ev.location && <span className="truncate max-w-[110px]">{ev.location}</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Category Legend */}
          <div className="p-3.5 border-t border-border bg-subtle/40 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              Categories
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(CATEGORY_META).map(([key, meta]) => (
                <div key={key} className="flex items-center space-x-1.5 text-[11px] text-text-muted">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                  <span className="truncate">{meta.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Create / Edit Event Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit Calendar Event' : 'Create Calendar Event'}
        subtitle="Saved directly to your organization workspace"
        icon={CalendarDays}
      >
        <form onSubmit={handleSaveEvent} className="space-y-4 text-xs">
          {formError && <ErrorBanner message={formError} />}

          <div className="space-y-1.5">
            <label className="font-medium text-text-primary">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g., Architecture Review Sync"
              className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-indigo-500"
              >
                {EDITABLE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_META[cat].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Location / Link</label>
              <input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="Room or meeting link"
                className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Start Time</label>
              <input
                type="datetime-local"
                required
                value={formStart}
                onChange={(e) => setFormStart(e.target.value)}
                className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">End Time</label>
              <input
                type="datetime-local"
                required
                value={formEnd}
                onChange={(e) => setFormEnd(e.target.value)}
                className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <label className="inline-flex items-center space-x-2 text-xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={formAllDay}
              onChange={(e) => setFormAllDay(e.target.checked)}
              className="accent-indigo-500"
            />
            <span>All-day event</span>
          </label>

          {team.length > 0 && (
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Attendees</label>
              <div className="flex flex-wrap gap-1.5">
                {team.map((m) => {
                  const selected = formAttendees.includes(m.name);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleAttendee(m.name)}
                      className={`px-2 py-1 rounded border text-[11px] transition-colors cursor-pointer ${
                        selected
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-canvas text-text-muted border-border hover:text-text-primary'
                      }`}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-medium text-text-primary">Description</label>
            <textarea
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Agenda or notes..."
              className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-indigo-500 resize-y"
            />
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-end space-x-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              {editingId ? 'Save Changes' : 'Create Event'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Event Details Dialog */}
      <Modal
        open={!!selectedEvent}
        onClose={() => {
          setSelectedEvent(null);
          setConfirmDelete(false);
        }}
        title={selectedEvent?.title || 'Event Details'}
        icon={
          selectedEvent?.source === 'task'
            ? CheckSquare
            : selectedEvent?.source === 'leave'
            ? CalendarCheck2
            : Layers
        }
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono ${
                  (CATEGORY_META[selectedEvent.category] || CATEGORY_META.meeting).pill
                }`}
              >
                {(CATEGORY_META[selectedEvent.category] || CATEGORY_META.meeting).label}
              </span>
              <Badge tone="neutral">
                {selectedEvent.source === 'task'
                  ? 'Linked Task Deadline'
                  : selectedEvent.source === 'leave'
                  ? 'Approved Leave'
                  : 'Scheduled Event'}
              </Badge>
            </div>

            <div className="p-3.5 rounded-lg bg-subtle/60 border border-border space-y-2 font-mono text-[11px]">
              <div className="flex items-center space-x-2 text-text-primary">
                <Clock size={13} className="text-indigo-500 shrink-0" />
                <span>
                  {new Date(selectedEvent.start_time).toLocaleString()} →{' '}
                  {new Date(selectedEvent.end_time).toLocaleString()}
                </span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center space-x-2 text-text-muted">
                  <MapPin size={13} className="shrink-0" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.attendees.length > 0 && (
                <div className="flex items-center space-x-2 text-text-muted">
                  <Users size={13} className="shrink-0" />
                  <span>{selectedEvent.attendees.join(', ')}</span>
                </div>
              )}
            </div>

            {selectedEvent.description && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                  Details
                </div>
                <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
                  {selectedEvent.description}
                </p>
              </div>
            )}

            <div className="text-[11px] font-mono text-text-muted">
              Owner / Organizer: {selectedEvent.creator_name || 'System'}
            </div>

            {selectedEvent.source === 'event' && selectedEvent.editable && (
              <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                {!confirmDelete ? (
                  <>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => openEditModal(selectedEvent)}
                    >
                      <Edit3 size={12} />
                      <span>Edit Event</span>
                    </Button>
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25">
                    <span className="text-rose-600 dark:text-rose-400 font-medium">
                      Delete this event permanently?
                    </span>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={isDeleting}
                        onClick={handleDeleteEvent}
                      >
                        Confirm Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
