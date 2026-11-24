import React from 'react';
import { ShieldCheck, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuditTrailFeed } from '../components/AuditTrailFeed';

export const AuditTrailPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#09090B]">
      <header className="h-14 border-b border-white/[0.08] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5">
          <ShieldCheck size={16} className="text-indigo-400" strokeWidth={1.75} />
          <h1 className="text-sm font-semibold text-zinc-100">Tenant Audit Trail</h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-zinc-400 border border-white/[0.06]">
            Tenant Security
          </span>
        </div>
        <div className="text-xs text-zinc-400 font-mono">
          Tenant: <span className="text-zinc-200">{user?.org_name}</span>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div>
              <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Immutable Audit Log
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Every login, task change, and policy modification is permanently recorded.
              </p>
            </div>
            <div className="flex items-center space-x-1 text-xs text-zinc-500 font-mono">
              <Clock size={13} strokeWidth={1.75} />
              <span>Realtime</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-[#0C0C0E] h-[650px]">
            <AuditTrailFeed className="border-l-0" showTitle={false} />
          </div>
        </div>
      </main>
    </div>
  );
};
