import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LucideIcon,
  LayoutDashboard,
  BookOpen,
  FileSpreadsheet,
  CheckSquare,
  ShieldCheck,
  LogOut,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  allowedRoles: Role[];
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    allowedRoles: ['Admin', 'Manager', 'HR', 'Employee'],
  },
  {
    name: 'Knowledge Base',
    path: '/knowledge',
    icon: BookOpen,
    allowedRoles: ['Admin', 'Manager', 'HR', 'Employee'],
  },
  {
    name: 'Meeting Converter',
    path: '/meetings',
    icon: FileSpreadsheet,
    allowedRoles: ['Admin', 'Manager'],
  },
  {
    name: 'Task Board',
    path: '/tasks',
    icon: CheckSquare,
    allowedRoles: ['Admin', 'Manager', 'HR', 'Employee'],
  },
  {
    name: 'Audit Trail',
    path: '/audit',
    icon: ShieldCheck,
    allowedRoles: ['Admin', 'Manager'],
  },
];

const ROLE_STYLES: Record<Role, { bg: string; text: string; border: string }> = {
  Admin: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
  },
  Manager: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/20',
  },
  HR: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  Employee: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
};

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNavItems = NAV_ITEMS.filter((item) =>
    item.allowedRoles.includes(user.role)
  );

  const roleStyle = ROLE_STYLES[user.role] || ROLE_STYLES.Employee;

  return (
    <aside className="w-64 h-screen flex flex-col bg-[#111114] border-r border-white/[0.08] select-none">
      {/* Workspace / Brand Header */}
      <div className="p-4 border-b border-white/[0.08]">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-md bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-semibold text-sm">
            SC
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-sm text-zinc-100 tracking-tight">SmartCorp</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 border border-white/[0.06]">
                v1.0
              </span>
            </div>
            <div className="flex items-center space-x-1 text-xs text-zinc-400 truncate mt-0.5">
              <Building2 size={12} className="text-zinc-500 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{user.org_name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Operations
        </div>
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#18181B] text-zinc-100 border border-white/[0.08] shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center space-x-2.5">
                    <Icon
                      size={16}
                      strokeWidth={1.75}
                      className={isActive ? 'text-indigo-400' : 'text-zinc-400'}
                    />
                    <span>{item.name}</span>
                  </div>
                  {isActive && <ChevronRight size={14} className="text-zinc-500" strokeWidth={1.75} />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User & Role Footer */}
      <div className="p-3 border-t border-white/[0.08] bg-[#0E0E11]">
        <div className="p-2.5 rounded-lg bg-[#141418] border border-white/[0.06]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-zinc-200 truncate">{user.name}</div>
              <div className="text-[11px] font-mono text-zinc-500 truncate">{user.email}</div>
            </div>
            <span
              className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded ${roleStyle.bg} ${roleStyle.text} border ${roleStyle.border}`}
            >
              {user.role}
            </span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-[11px] text-zinc-500 truncate">
              {user.department || 'Operations'}
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center space-x-1 text-[11px] text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Sign out of workspace"
            >
              <LogOut size={13} strokeWidth={1.75} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
