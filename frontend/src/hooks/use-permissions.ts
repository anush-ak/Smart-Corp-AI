import { useAuth, ROLE_LABELS } from '@/contexts/auth-context'
import type { Permission } from '@/types'

/**
 * usePermissions — a thin, readable wrapper over AuthContext capability checks.
 *
 * Reminder surfaced throughout the product: hiding a control is a usability
 * decision, not a security boundary. The Django API and the retrieval filters
 * remain the authority.
 */
export function usePermissions() {
  const { can, permissions, user, knowledgeScope, agentScope, roles } = useAuth()

  const roleLabel = user ? ROLE_LABELS[user.role] : 'Guest'
  const roleDefinition = roles.find((definition) => definition.role === user?.role)

  return {
    can: (permission: Permission) => can(permission),
    canAny: (...checks: Permission[]) => checks.some((check) => can(check)),
    canAll: (...checks: Permission[]) => checks.every((check) => can(check)),
    permissions,
    role: user?.role ?? null,
    roleLabel,
    roleDefinition,
    knowledgeScope,
    agentScope,
    /** Explains, in one sentence, what the current role may retrieve. */
    scopeSummary: roleDefinition?.knowledgeScopeDescription ?? 'No knowledge scope assigned.',
  }
}
