import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LucideIcon,
  LayoutDashboard,
  BrainCircuit,
  FileSpreadsheet,
  CheckSquare,
  CalendarDays,
  MailCheck,
  CalendarCheck2,
  Users,
  ShieldCheck,
  Settings,
  LogOut,
  Building2,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLayout } from './ui/LayoutContext';
import { Role } from '../types';

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  allowedRoles: Role[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      {
        name: 'Dashboard',
        path: '/',
        icon: LayoutDashboard,
        allowedRoles: ['Admin', 'Manager', 'HR', 'Employee'],
      },
      {
        name: 'Task Board',
        path: '/tasks',
        icon: CheckSquare,
        allowedRoles: ['Admin', 'Manager', 'HR', 'Employee'],
      },
      {
        name: 'Smart Calendar',
        path: '/calendar',
        icon: CalendarDays,
        allowedRoles: ['Admin', 'Manager', 'HR', 'Employee'],
      },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      {
        name: 'Company Brain',
        path: '/knowledge',
        icon: BrainCircuit,
        allowedRoles: ['Admin', 'Manager', 'HR', 'Employee'],
      },
      {
        name: 'Meeting Converter',
        path: '/meetings',
        icon: FileSpreadsheet,
        allowedRoles: ['Admin', 'Manager'],
      },
      {
        name: 'AI Email Writer',
        path: '/email-writer',
        icon: MailCheck,
        allowedRoles: ['Admin', 'Manager', 'HR', 'Employee'],
      },
    ],
  },
  {
    title: 'People',
    items: [
      {
        name: 'Leave Management',
        path: '/leaves',
        icon: CalendarCheck2,
        allowedRoles: ['Admin', 'Manager', 'HR', 'Employee'],
      },
      {
        name: 'Team Management',
        path: '/team',
        icon: Users,
        allowedRoles: ['Admin', 'Manager', 'HR', 'Employee'],
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        name: 'Audit Trail',
        path: '/audit',
        icon: ShieldCheck,
        allowedRoles: ['Admin', 'Manager'],
      },
      {
        name: 'Settings',
        path: '/settings',
        icon: Settings,
        allowedRoles: ['Admin', 'Manager', 'HR', 'Employee'],
      },
    ],
  },
];

const ROLE_STYLES: Record<Role, string> = {
  Admin: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
  Manager: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
  HR: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  Employee: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
};

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { mobileSidebarOpen, closeMobileSidebar } = useLayout();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    closeMobileSidebar();
    logout();
    navigate('/login');
  };

  const roleStyle = ROLE_STYLES[user.role] || ROLE_STYLES.Employee;
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sidebarContent = (
    <aside className="w-64 h-full flex flex-col bg-sidebar border-r border-border select-none shrink-0 transition-colors">
      {/* Brand Header */}
      <div className="h-14 px-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-indigo-600 text-white flex items-center justify-center font-semibold text-xs tracking-tight shrink-0">
            SC
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-sm text-text-primary tracking-tight">SmartCorp</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-subtle text-text-muted border border-border">
                OS
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[11px] text-text-muted truncate">
              <Building2 size={10} className="shrink-0" strokeWidth={1.75} />
              <span className="truncate">{user.org_name}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={closeMobileSidebar}
          className="lg:hidden p-1 rounded text-text-muted hover:text-text-primary hover:bg-subtle cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>

      {/* Categorized Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) =>
            item.allowedRoles.includes(user.role)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              <div className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-text-muted/80">
                {section.title}
              </div>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={closeMobileSidebar}
                    className={({ isActive }) =>
                      `group relative flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-elevated text-text-primary border border-border'
                          : 'text-text-muted hover:text-text-primary hover:bg-subtle border border-transparent'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-indigo-500" />
                        )}
                        <Icon
                          size={15}
                          strokeWidth={1.75}
                          className={
                            isActive
                              ? 'text-indigo-500 shrink-0'
                              : 'text-text-muted group-hover:text-text-primary shrink-0 transition-colors'
                          }
                        />
                        <span className="truncate">{item.name}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div className="px-3 py-2.5 border-t border-border">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium text-text-muted hover:text-text-primary hover:bg-subtle border border-border transition-colors cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          <div className="flex items-center space-x-2">
            {theme === 'dark' ? (
              <Sun size={14} strokeWidth={1.75} className="text-amber-400" />
            ) : (
              <Moon size={14} strokeWidth={1.75} className="text-indigo-600" />
            )}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface text-text-muted border border-border">
            {theme}
          </span>
        </button>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-border bg-subtle/40">
        <div className="p-2.5 rounded-lg bg-surface border border-border space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                closeMobileSidebar();
                navigate('/profile');
              }}
              className="flex items-center space-x-2 min-w-0 flex-1 text-left group cursor-pointer"
              title="View profile & workspace preferences"
            >
              <div className="w-7 h-7 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[11px] font-mono font-semibold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-text-primary group-hover:text-indigo-500 transition-colors truncate">
                  {user.name}
                </div>
                <div className="text-[10px] font-mono text-text-muted truncate">{user.email}</div>
              </div>
            </button>
            <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border shrink-0 ${roleStyle}`}>
              {user.role}
            </span>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
            <span className="text-text-muted truncate">{user.department || 'Operations'}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center space-x-1 text-text-muted hover:text-rose-500 transition-colors cursor-pointer"
              title="Sign out of workspace"
            >
              <LogOut size={12} strokeWidth={1.75} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Static Sidebar */}
      <div className="hidden lg:block h-screen shrink-0">{sidebarContent}</div>

      {/* Mobile / Tablet Slide-over Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={closeMobileSidebar}
          />
          <div className="relative z-50 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
