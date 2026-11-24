import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, Building2, UserCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

interface DemoAccount {
  org: string;
  name: string;
  role: Role;
  email: string;
  password: string;
  department: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  // Acme Corp
  {
    org: 'Acme Corp',
    name: 'Sarah Chen',
    role: 'Admin',
    email: 'admin@acmecorp.com',
    password: 'password123',
    department: 'Executive',
  },
  {
    org: 'Acme Corp',
    name: 'Alex Rivera',
    role: 'Manager',
    email: 'manager@acmecorp.com',
    password: 'password123',
    department: 'Product',
  },
  {
    org: 'Acme Corp',
    name: 'Elena Rostova',
    role: 'HR',
    email: 'hr@acmecorp.com',
    password: 'password123',
    department: 'People Ops',
  },
  {
    org: 'Acme Corp',
    name: 'David Kim',
    role: 'Employee',
    email: 'employee@acmecorp.com',
    password: 'password123',
    department: 'Engineering',
  },
  // Globex Labs
  {
    org: 'Globex Labs',
    name: 'Marcus Vance',
    role: 'Admin',
    email: 'admin@globex.com',
    password: 'password123',
    department: 'Executive',
  },
  {
    org: 'Globex Labs',
    name: 'Jessica Lee',
    role: 'Manager',
    email: 'manager@globex.com',
    password: 'password123',
    department: 'R&D',
  },
  {
    org: 'Globex Labs',
    name: 'Sonia Patel',
    role: 'HR',
    email: 'hr@globex.com',
    password: 'password123',
    department: 'Operations',
  },
  {
    org: 'Globex Labs',
    name: 'Liam Johnson',
    role: 'Employee',
    email: 'employee@globex.com',
    password: 'password123',
    department: 'Platform',
  },
];

const ROLE_BADGES: Record<Role, string> = {
  Admin: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  Manager: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  HR: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Employee: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@acmecorp.com');
  const [password, setPassword] = useState('password123');
  const [selectedOrg, setSelectedOrg] = useState<'Acme Corp' | 'Globex Labs'>('Acme Corp');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSelect = async (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login(account.email, account.password);
      navigate('/');
    } catch (err: any) {
      setErrorMessage(err.message || 'Quick login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDemoAccounts = DEMO_ACCOUNTS.filter((acc) => acc.org === selectedOrg);

  return (
    <div className="min-h-screen w-full bg-[#09090B] flex flex-col justify-center items-center p-4 selection:bg-indigo-500/20 selection:text-indigo-200">
      <div className="w-full max-w-[420px] space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#111114] border border-white/[0.08] shadow-sm mb-1">
            <span className="font-semibold text-sm text-indigo-400">SC</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">SmartCorp AI</h1>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Autonomous multi-tenant enterprise operations copilot
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <span className="text-xs font-medium text-zinc-200">Sign in to workspace</span>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">HS256 JWT</span>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start space-x-2 text-rose-400 text-xs">
              <AlertCircle size={15} className="shrink-0 mt-0.5" strokeWidth={1.75} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Email Address</label>
              <div className="relative">
                <Mail
                  size={14}
                  strokeWidth={1.75}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3 py-2 bg-[#09090B] border border-white/[0.08] rounded-md text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Password</label>
              <div className="relative">
                <Lock
                  size={14}
                  strokeWidth={1.75}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3 py-2 bg-[#09090B] border border-white/[0.08] rounded-md text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
                  <span>Connecting to workspace...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={14} strokeWidth={1.75} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts Selector */}
          <div className="pt-4 border-t border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs text-zinc-300 font-medium">
                <UserCheck size={14} className="text-indigo-400" strokeWidth={1.75} />
                <span>Quick Demo Accounts</span>
              </div>
              {/* Tenant switcher */}
              <div className="inline-flex rounded-md p-0.5 bg-[#09090B] border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setSelectedOrg('Acme Corp')}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${
                    selectedOrg === 'Acme Corp'
                      ? 'bg-[#18181B] text-zinc-100 border border-white/[0.08]'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Acme Corp
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrg('Globex Labs')}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${
                    selectedOrg === 'Globex Labs'
                      ? 'bg-[#18181B] text-zinc-100 border border-white/[0.08]'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Globex Labs
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {filteredDemoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleQuickSelect(account)}
                  disabled={isSubmitting}
                  className="group p-2.5 text-left rounded-lg bg-[#141418] hover:bg-[#18181E] border border-white/[0.06] hover:border-white/[0.12] transition-colors cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-medium text-zinc-200 group-hover:text-indigo-300 transition-colors truncate">
                      {account.name}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                        ROLE_BADGES[account.role]
                      }`}
                    >
                      {account.role}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500 truncate group-hover:text-zinc-400">
                    {account.department}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security Invariant Note */}
        <div className="text-center text-[11px] text-zinc-500 flex items-center justify-center space-x-1.5">
          <Building2 size={12} strokeWidth={1.75} />
          <span>Multi-tenant isolation enforced via verified JWT claims</span>
        </div>
      </div>
    </div>
  );
};
