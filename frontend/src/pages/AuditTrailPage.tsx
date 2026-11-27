import React from 'react';
import { ShieldCheck, Clock } from 'lucide-react';
import { AuditTrailFeed } from '../components/AuditTrailFeed';
import { PageHeader, Badge } from '../components/ui/Primitives';

export const AuditTrailPage: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas text-text-primary transition-colors">
      <PageHeader
        title="Tenant Audit Trail"
        subtitle="Immutable record of logins, task updates, leave approvals, and document operations"
        icon={ShieldCheck}
        badge={<Badge tone="emerald">Live Stream</Badge>}
      />

      <main className="flex-1 p-5 sm:p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div>
              <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                Immutable Audit Log
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Every authentication, task mutation, leave decision, and policy change is logged per tenant.
              </p>
            </div>
            <div className="flex items-center space-x-1 text-xs text-text-muted font-mono">
              <Clock size={13} strokeWidth={1.75} />
              <span>Realtime</span>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden bg-surface h-[650px]">
            <AuditTrailFeed className="border-l-0" showTitle={false} />
          </div>
        </div>
      </main>
    </div>
  );
};
