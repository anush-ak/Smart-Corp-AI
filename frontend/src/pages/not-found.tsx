import { Compass, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PageBody } from '@/components/ui/primitives'
import { EmptyState } from '@/components/ui/states'

/** 404 — always offers a way back into the product rather than a dead end. */
export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <PageBody>
      <div className="sc-card mt-6">
        <EmptyState
          icon={Compass}
          title="This page does not exist"
          description="The link may be out of date, or the resource sits outside your permitted scope. Use the command palette to search the platform instead."
          primaryAction={{ label: 'Go to Overview', onClick: () => navigate('/overview') }}
          secondaryAction={{
            label: 'Open command palette',
            onClick: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true })),
          }}
        />
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line px-4 py-3">
          <span className="flex items-center gap-1.5 text-caption text-ink-400">
            <Search className="size-3.5" aria-hidden />
            Try searching for a document, agent or decision
          </span>
          <Button variant="ghost" size="xs" onClick={() => navigate('/knowledge')}>
            Knowledge
          </Button>
          <Button variant="ghost" size="xs" onClick={() => navigate('/decisions')}>
            Decisions
          </Button>
          <Button variant="ghost" size="xs" onClick={() => navigate('/audit-logs')}>
            Audit logs
          </Button>
        </div>
      </div>
    </PageBody>
  )
}
