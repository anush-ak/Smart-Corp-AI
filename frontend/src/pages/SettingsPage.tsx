import React from 'react';
import { Settings, User, Shield, Sun, Moon, Building2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL, WS_BASE_URL } from '../config';
import { PageHeader, Badge, Button } from '../components/ui/Primitives';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  const permissions = [
    {
      capability: 'Executive Dashboard & Analytics',
      allowed: true,
    },
    {
      capability: 'Company Brain Knowledge Q&A',
      allowed: true,
    },
    {
      capability: 'Smart Calendar & Personal Events',
      allowed: true,
    },
    {
      capability: 'AI Email & Message Writer',
      allowed: true,
    },
    {
      capability: 'Leave Application & Balance Tracking',
      allowed: true,
    },
    {
      capability: 'Meeting Notes Extraction & Batch Publish',
      allowed: user.role === 'Admin' || user.role === 'Manager',
    },
    {
      capability: 'Knowledge PDF Upload & Indexing',
      allowed: user.role === 'Admin' || user.role === 'HR',
    },
    {
      capability: 'Leave Approvals & Rejections',
      allowed: user.role === 'Admin' || user.role === 'Manager' || user.role === 'HR',
    },
    {
      capability: 'Tenant Audit Trail Inspection',
      allowed: user.role === 'Admin' || user.role === 'Manager',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas text-text-primary transition-colors">
      <PageHeader
        title="Profile & Settings"
        subtitle="Account identity, appearance preferences, and tenant access scope"
        icon={Settings}
      />

      <div className="flex-1 overflow-y-auto p-5 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Profile Card */}
          <section className="p-5 rounded-xl bg-surface border border-border space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <User size={15} className="text-indigo-500" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                  User Identity
                </h2>
              </div>
              <Badge tone="indigo">{user.role}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-canvas border border-border">
                <div className="text-[10px] font-mono uppercase text-text-muted">Full Name</div>
                <div className="text-sm font-medium text-text-primary mt-1">{user.name}</div>
              </div>
              <div className="p-3 rounded-lg bg-canvas border border-border">
                <div className="text-[10px] font-mono uppercase text-text-muted">Email Address</div>
                <div className="text-sm font-mono text-text-primary mt-1">{user.email}</div>
              </div>
              <div className="p-3 rounded-lg bg-canvas border border-border">
                <div className="text-[10px] font-mono uppercase text-text-muted">Organization</div>
                <div className="text-sm font-medium text-text-primary mt-1 flex items-center gap-1.5">
                  <Building2 size={13} className="text-indigo-500" />
                  <span>{user.org_name}</span>
                  <span className="text-xs font-mono text-text-muted">(Org #{user.org_id})</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-canvas border border-border">
                <div className="text-[10px] font-mono uppercase text-text-muted">Department</div>
                <div className="text-sm font-medium text-text-primary mt-1">
                  {user.department || 'Operations'}
                </div>
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section className="p-5 rounded-xl bg-surface border border-border space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                Interface Appearance
              </h2>
              <Badge tone="neutral">{theme.toUpperCase()}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between ${
                  theme === 'dark'
                    ? 'bg-elevated border-indigo-500'
                    : 'bg-canvas border-border hover:bg-subtle'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Moon size={16} className="text-indigo-400" />
                  <div>
                    <div className="text-xs font-semibold text-text-primary">Dark Mode</div>
                    <div className="text-[11px] text-text-muted">High-contrast obsidian workspace</div>
                  </div>
                </div>
                {theme === 'dark' && <CheckCircle2 size={15} className="text-indigo-500" />}
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between ${
                  theme === 'light'
                    ? 'bg-elevated border-indigo-500'
                    : 'bg-canvas border-border hover:bg-subtle'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Sun size={16} className="text-amber-500" />
                  <div>
                    <div className="text-xs font-semibold text-text-primary">Light Mode</div>
                    <div className="text-[11px] text-text-muted">Clean daylight editorial surface</div>
                  </div>
                </div>
                {theme === 'light' && <CheckCircle2 size={15} className="text-indigo-500" />}
              </button>
            </div>
          </section>

          {/* Role Capabilities */}
          <section className="p-5 rounded-xl bg-surface border border-border space-y-4">
            <div className="flex items-center space-x-2 border-b border-border pb-3">
              <Shield size={15} className="text-emerald-500" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                Role-Based Access Scope
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {permissions.map((perm) => (
                <div
                  key={perm.capability}
                  className="p-3 rounded-lg bg-canvas border border-border flex items-center justify-between gap-2"
                >
                  <span className="text-text-primary">{perm.capability}</span>
                  <Badge tone={perm.allowed ? 'emerald' : 'neutral'}>
                    {perm.allowed ? 'Enabled' : 'Restricted'}
                  </Badge>
                </div>
              ))}
            </div>
          </section>

          {/* Environment & Session */}
          <section className="p-5 rounded-xl bg-surface border border-border flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 text-[11px] font-mono text-text-muted">
              <div>API Endpoint: {API_BASE_URL}</div>
              <div>WebSocket Room: {WS_BASE_URL}/ws/{user.org_id}</div>
            </div>
            <Button variant="danger" size="sm" onClick={logout}>
              Sign out of Workspace
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
};
