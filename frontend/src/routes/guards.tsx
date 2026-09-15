import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { PageBody } from '@/components/ui/primitives'
import { AccessDeniedState, LoadingState } from '@/components/ui/states'
import { useAuth } from '@/contexts/auth-context'
import { usePermissions } from '@/hooks/use-permissions'
import type { Permission } from '@/types'

/**
 * Route guards.
 *
 * These exist so a user never lands on a screen they cannot act on. They are
 * explicitly *not* the security boundary: the same permission is re-checked by
 * Django REST Framework on the request, and knowledge is filtered by scope in
 * the vector query before ranking. The UI says as much where it matters.
 */

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, initialising } = useAuth()
  const location = useLocation()

  if (initialising) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <div className="w-full max-w-md">
          <LoadingState label="Restoring your session" rows={3} />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

export function RequirePermission({
  permission,
  fallbackPermission,
  children,
}: {
  permission: Permission
  /** Allows a route to serve two audiences, e.g. Settings for admins and staff. */
  fallbackPermission?: Permission
  children: ReactNode
}) {
  const { can, roleLabel } = usePermissions()

  if (!can(permission) && !(fallbackPermission && can(fallbackPermission))) {
    return (
      <PageBody>
        <AccessDeniedState area="This area" role={roleLabel} />
      </PageBody>
    )
  }

  return <>{children}</>
}
