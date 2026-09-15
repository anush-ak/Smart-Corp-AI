import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authService } from '@/services'
import { readToken, writeToken } from '@/services/api-client'
import type { Organization, Permission, Role, RoleDefinition, User } from '@/types'

/**
 * AuthContext — identity, organisation and capability checks.
 *
 * SECURITY NOTE: the frontend never treats its own permission checks as
 * enforcement. `can()` only decides what is *shown*. The Django API, the
 * database row filters and the RAG retrieval layer remain the authority, and
 * the UI states this explicitly wherever access is discussed.
 */

interface AuthContextValue {
  user: User | null
  organization: Organization | null
  roles: RoleDefinition[]
  permissions: Permission[]
  isAuthenticated: boolean
  initialising: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  switchUser: (userId: string) => Promise<void>
  can: (permission: Permission) => boolean
  /** Knowledge bases the signed-in user may retrieve from (mirrors API filtering). */
  knowledgeScope: string[]
  agentScope: string[]
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [initialising, setInitialising] = useState(true)

  // Restore an existing session on boot.
  useEffect(() => {
    let cancelled = false
    const token = readToken()
    if (!token) {
      setInitialising(false)
      return
    }
    authService
      .session()
      .then((session) => {
        if (cancelled) return
        setUser(session.user)
        setOrganization(session.organization)
        setRoles(session.roles)
      })
      .catch(() => {
        writeToken(null)
      })
      .finally(() => {
        if (!cancelled) setInitialising(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Apply a session returned by the API — the single place identity is set. */
  const applySession = useCallback((session: Awaited<ReturnType<typeof authService.login>>) => {
    if (session.token) writeToken(session.token)
    setUser(session.user)
    setOrganization(session.organization)
    setRoles(session.roles)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      applySession(await authService.login(email, password))
    },
    [applySession],
  )

  const logout = useCallback(() => {
    // Revoke server-side, then clear locally regardless of the response.
    authService.logout().catch(() => undefined)
    writeToken(null)
    setUser(null)
    setOrganization(null)
    setRoles([])
  }, [])

  const switchUser = useCallback(
    async (userId: string) => {
      applySession(await authService.switchRole(userId))
    },
    [applySession],
  )

  // Capabilities come from the role definitions the API returned with the
  // session — never from a value hard-coded in the interface.
  const permissions = useMemo<Permission[]>(() => {
    if (!user) return []
    return roles.find((definition) => definition.role === user.role)?.permissions ?? []
  }, [user, roles])

  const can = useCallback((permission: Permission) => permissions.includes(permission), [permissions])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      organization,
      roles,
      permissions,
      isAuthenticated: Boolean(user),
      initialising,
      login,
      logout,
      switchUser,
      can,
      knowledgeScope: user?.knowledgeScope ?? [],
      agentScope: user?.agentScope ?? [],
    }),
    [user, organization, roles, permissions, initialising, login, logout, switchUser, can],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

/** Role helper used by copy that explains scope in human language. */
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  hr: 'HR',
  finance: 'Finance',
  support: 'Support',
  employee: 'Employee',
}
