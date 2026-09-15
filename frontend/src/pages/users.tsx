import { KeyRound, Lock, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, PageBody, PageHeader, Tabs } from '@/components/ui/primitives'
import { DataTable } from '@/components/ui/data-table'
import { Checkbox } from '@/components/ui/input-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState, NoResultsState } from '@/components/ui/states'
import { Drawer, Modal } from '@/components/ui/overlays'
import { TableToolbar } from '@/components/ui/table-toolbar'
import { Tooltip } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'
import { useAgents, useKnowledgeBases, useRoleDefinitions, useUsers } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import { useDebouncedValue } from '@/hooks/use-async'
import { ROLE_LABELS } from '@/contexts/auth-context'
import { userService } from '@/services'
import type { Permission, Role, User } from '@/types'
import { cn, formatRelativeTime, titleCase } from '@/utils/format'

/* -------------------------------------------------------------------------- */
/* Permission matrix                                                          */
/* -------------------------------------------------------------------------- */

const PERMISSION_GROUPS: { group: string; permissions: { key: Permission; label: string; note: string }[] }[] = [
  {
    group: 'Workspace',
    permissions: [
      { key: 'overview:view', label: 'View overview', note: 'See the command centre and priority queue.' },
      { key: 'assistant:use', label: 'Use AI assistant', note: 'Ask questions; answers are scoped to permitted knowledge.' },
      { key: 'knowledge:view', label: 'View knowledge', note: 'Browse documents within the role’s knowledge scope.' },
      { key: 'knowledge:manage', label: 'Manage knowledge', note: 'Upload, publish and set access on documents.' },
    ],
  },
  {
    group: 'Intelligence',
    permissions: [
      { key: 'agents:view', label: 'View agents', note: 'See agents, routing decisions and execution traces.' },
      { key: 'agents:manage', label: 'Manage agents', note: 'Pause or resume agents and adjust their permissions.' },
      { key: 'decisions:view', label: 'View decisions', note: 'Read AI recommendations and their evidence.' },
      { key: 'decisions:approve', label: 'Approve decisions', note: 'Release or reject the recommended action.' },
      { key: 'evaluation:view', label: 'View evaluation', note: 'Read measured quality and failure analysis.' },
      { key: 'evaluation:run', label: 'Run evaluation', note: 'Start a run against the golden set.' },
      { key: 'analytics:view', label: 'View analytics', note: 'Adoption, usage and performance reporting.' },
      { key: 'meetings:view', label: 'Meeting intelligence', note: 'Transcripts, summaries and extracted actions.' },
    ],
  },
  {
    group: 'Governance',
    permissions: [
      { key: 'approvals:view', label: 'View approvals', note: 'See the approval queue for the role’s departments.' },
      { key: 'approvals:act', label: 'Act on approvals', note: 'Approve or reject requests in scope.' },
      { key: 'users:view', label: 'View users', note: 'See users, roles and access scope.' },
      { key: 'users:manage', label: 'Manage users', note: 'Change roles, knowledge and agent access.' },
      { key: 'audit:view', label: 'View audit logs', note: 'Read and export the activity trail.' },
      { key: 'security:view', label: 'View security', note: 'Access control status and security events.' },
      { key: 'settings:manage', label: 'Manage settings', note: 'Workspace, AI behaviour and data handling.' },
    ],
  },
]

export function UsersPage() {
  const { can } = usePermissions()
  const { toast } = useToast()
  const users = useUsers()
  const roles = useRoleDefinitions()
  const agents = useAgents()
  const knowledgeBases = useKnowledgeBases()

  const [tab, setTab] = useState<'users' | 'roles' | 'access'>('users')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 180)
  const [roleFilter, setRoleFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [selected, setSelected] = useState<User | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [scopeDraft, setScopeDraft] = useState<{ role: Role; knowledge: string[]; agents: string[] } | null>(null)

  const rows = users.data ?? []

  const filtered = useMemo(
    () =>
      rows.filter((user) => {
        if (roleFilter && user.role !== roleFilter) return false
        if (departmentFilter && user.department !== departmentFilter) return false
        if (debouncedQuery) {
          const haystack = `${user.name} ${user.email} ${user.jobTitle}`.toLowerCase()
          if (!haystack.includes(debouncedQuery.toLowerCase())) return false
        }
        return true
      }),
    [rows, roleFilter, departmentFilter, debouncedQuery],
  )

  const openScopeDrawer = (user: User) => {
    setSelected(user)
    setScopeDraft({ role: user.role, knowledge: user.knowledgeScope, agents: user.agentScope })
  }

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Who can reach which knowledge, which agents and which decisions. Access decided here governs what the AI can retrieve — it is enforced by the API and the retrieval layer, not by hiding controls."
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5 text-ink-400" aria-hidden />
              {rows.length} users
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-ink-400" aria-hidden />
              {(roles.data ?? []).length} roles
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="size-3.5 text-ink-400" aria-hidden />
              Retrieval filtered before ranking
            </span>
          </>
        }
        actions={
          can('users:manage') ? (
            <Button variant="primary" iconLeft={<UserPlus aria-hidden />} onClick={() => setInviteOpen(true)}>
              Invite user
            </Button>
          ) : undefined
        }
        tabs={
          <Tabs
            ariaLabel="Access management views"
            value={tab}
            onChange={(value) => setTab(value as typeof tab)}
            items={[
              { id: 'users', label: 'Users', count: rows.length },
              { id: 'roles', label: 'Roles & permissions', count: roles.data?.length ?? 0 },
              { id: 'access', label: 'Knowledge access' },
            ]}
          />
        }
      />

      <PageBody className="space-y-5">
        {users.error ? (
          <ErrorState title="Users could not be loaded" cause={users.error.message} onRetry={users.reload} />
        ) : tab === 'users' ? (
          <>
            <TableToolbar
              query={query}
              onQueryChange={setQuery}
              searchPlaceholder="Search name, email or job title…"
              filters={[
                {
                  id: 'role',
                  label: 'Role',
                  value: roleFilter,
                  onChange: setRoleFilter,
                  options: [{ value: '', label: 'All roles' }, ...(roles.data ?? []).map((role) => ({ value: role.role, label: role.label }))],
                },
                {
                  id: 'department',
                  label: 'Department',
                  value: departmentFilter,
                  onChange: setDepartmentFilter,
                  hideBelow: 'md',
                  options: [
                    { value: '', label: 'All departments' },
                    ...['HR', 'Finance', 'Support', 'Engineering', 'Operations'].map((value) => ({ value, label: value })),
                  ],
                },
              ]}
              showReset={Boolean(query || roleFilter || departmentFilter)}
              onReset={() => {
                setQuery('')
                setRoleFilter('')
                setDepartmentFilter('')
              }}
            />

            {users.initialLoading ? (
              <Card>
                <LoadingState rows={5} />
              </Card>
            ) : filtered.length === 0 ? (
              <Card>
                {rows.length === 0 ? (
                  <EmptyState icon={Users} title="No users yet" description="Invite colleagues and assign a role to define what the AI may retrieve for them." />
                ) : (
                  <NoResultsState
                    query={debouncedQuery}
                    onClear={() => {
                      setQuery('')
                      setRoleFilter('')
                      setDepartmentFilter('')
                    }}
                  />
                )}
              </Card>
            ) : (
              <DataTable
                rows={filtered}
                getRowId={(user) => user.id}
                onRowClick={(user) => (can('users:manage') ? openScopeDrawer(user) : undefined)}
                pageSize={10}
                caption="Users with role, department, status and access scope"
                columns={[
                  {
                    id: 'name',
                    header: 'User',
                    primary: true,
                    sortValue: (user) => user.name,
                    cell: (user) => (
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} color={user.avatarColor} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-body-sm font-medium text-ink-900">{user.name}</p>
                          <p className="truncate text-caption text-ink-400">{user.email}</p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'role',
                    header: 'Role',
                    sortValue: (user) => user.role,
                    cell: (user) => (
                      <StatusBadge tone={user.role === 'admin' ? 'brand' : 'neutral'} size="sm">
                        {ROLE_LABELS[user.role]}
                      </StatusBadge>
                    ),
                  },
                  {
                    id: 'department',
                    header: 'Department',
                    hideBelow: 'md',
                    sortValue: (user) => user.department,
                    cell: (user) => <span className="text-body-sm text-ink-700">{user.department}</span>,
                  },
                  {
                    id: 'status',
                    header: 'Status',
                    cell: (user) => (
                      <StatusBadge tone={user.status === 'active' ? 'success' : user.status === 'invited' ? 'info' : 'neutral'} size="sm">
                        {titleCase(user.status)}
                      </StatusBadge>
                    ),
                  },
                  {
                    id: 'lastActive',
                    header: 'Last active',
                    align: 'right',
                    sortValue: (user) => user.lastActiveAt,
                    cell: (user) => <span className="text-caption text-ink-400">{formatRelativeTime(user.lastActiveAt)}</span>,
                  },
                  {
                    id: 'access',
                    header: 'Access',
                    hideBelow: 'lg',
                    cell: (user) => (
                      <Tooltip label={`Knowledge: ${user.knowledgeScope.join(', ') || 'none'} · Agents: ${user.agentScope.join(', ') || 'none'}`}>
                        <span className="text-caption text-ink-500">
                          {user.knowledgeScope.length} KB{user.agentScope.length > 0 ? ` · ${user.agentScope.length} agents` : ''}
                        </span>
                      </Tooltip>
                    ),
                  },
                ]}
              />
            )}
          </>
        ) : tab === 'roles' ? (
          roles.initialLoading ? (
            <Card>
              <LoadingState rows={4} />
            </Card>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {(roles.data ?? []).map((role) => (
                  <Card key={role.role} className="flex flex-col">
                    <CardHeader
                      title={role.label}
                      description={role.summary}
                      actions={
                        <StatusBadge tone={role.role === 'admin' ? 'brand' : 'neutral'} size="sm">
                          {rows.filter((user) => user.role === role.role).length} users
                        </StatusBadge>
                      }
                    />
                    <CardBody className="flex-1 space-y-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-ink-400">Retrieval scope</p>
                        <p className="mt-1 text-body-sm leading-relaxed text-ink-600">{role.knowledgeScopeDescription}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-ink-400">
                          Permissions · {role.permissions.length}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {role.permissions.slice(0, 8).map((permission) => (
                            <StatusBadge key={permission} tone="outline" size="sm">
                              {permission}
                            </StatusBadge>
                          ))}
                          {role.permissions.length > 8 && (
                            <StatusBadge tone="neutral" size="sm">
                              +{role.permissions.length - 8}
                            </StatusBadge>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>

              {/* Permission matrix ------------------------------------- */}
              <Card>
                <CardHeader
                  title="Permission matrix"
                  description="What each role may do. Enforced by the Django API on every request — the interface only reflects it."
                  icon={<KeyRound aria-hidden />}
                />
                <CardBody padded={false}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-line bg-surface-muted/70">
                          <th scope="col" className="sticky left-0 bg-surface-muted/70 px-4 py-2.5 text-caption font-semibold uppercase tracking-wide text-ink-500">
                            Permission
                          </th>
                          {(roles.data ?? []).map((role) => (
                            <th key={role.role} scope="col" className="px-3 py-2.5 text-center text-caption font-semibold uppercase tracking-wide text-ink-500">
                              {role.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PERMISSION_GROUPS.map((group) => (
                          <>
                            <tr key={group.group} className="border-b border-line-subtle bg-surface-muted/40">
                              <td colSpan={(roles.data?.length ?? 0) + 1} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                                {group.group}
                              </td>
                            </tr>
                            {group.permissions.map((permission) => (
                              <tr key={permission.key} className="border-b border-line-subtle last:border-b-0">
                                <td className="sticky left-0 bg-surface px-4 py-2.5">
                                  <p className="text-body-sm text-ink-800">{permission.label}</p>
                                  <p className="text-caption text-ink-400">{permission.note}</p>
                                </td>
                                {(roles.data ?? []).map((role) => (
                                  <td key={role.role} className="px-3 py-2.5 text-center">
                                    {role.permissions.includes(permission.key) ? (
                                      <span className="inline-grid size-5 place-items-center rounded-full bg-success-50 text-success-700" aria-label="Granted">
                                        <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                          <path d="m2.5 6.2 2.3 2.3 4.7-5" />
                                        </svg>
                                      </span>
                                    ) : (
                                      <span className="inline-grid size-5 place-items-center rounded-full bg-surface-sunken text-ink-300" aria-label="Not granted">
                                        <span className="h-px w-2 bg-current" />
                                      </span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </div>
          )
        ) : (
          /* Knowledge access view -------------------------------------- */
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Which knowledge each role can retrieve"
                description="This mapping is applied inside the vector query before similarity ranking. It is the primary control that keeps restricted content out of answers."
                icon={<Lock aria-hidden />}
              />
              <CardBody padded={false}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-line bg-surface-muted/70">
                        <th scope="col" className="px-4 py-2.5 text-caption font-semibold uppercase tracking-wide text-ink-500">
                          Knowledge base
                        </th>
                        {(roles.data ?? []).map((role) => (
                          <th key={role.role} scope="col" className="px-3 py-2.5 text-center text-caption font-semibold uppercase tracking-wide text-ink-500">
                            {role.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(knowledgeBases.data ?? []).map((base) => (
                        <tr key={base.id} className="border-b border-line-subtle last:border-b-0">
                          <td className="px-4 py-3">
                            <p className="text-body-sm font-medium text-ink-800">{base.name}</p>
                            <p className="text-caption text-ink-400">
                              {base.department} · {base.accessLevel === 'organization' ? 'org-wide' : base.accessLevel}
                            </p>
                          </td>
                          {(roles.data ?? []).map((role) => {
                            const hasAccess =
                              role.role === 'admin' ||
                              (base.accessLevel === 'organization' && role.role !== 'employee') ||
                              (base.accessLevel === 'organization' && role.role === 'employee') ||
                              (base.department.toLowerCase() === role.role) ||
                              (base.department === 'Engineering' && role.role === 'employee')
                            const restricted = base.accessLevel === 'restricted' && role.role !== 'admin'
                            const granted = hasAccess && !restricted
                            return (
                              <td key={role.role} className="px-3 py-3 text-center">
                                {granted ? (
                                  <span className="text-caption font-medium text-success-700">Retrievable</span>
                                ) : restricted ? (
                                  <span className="text-caption text-warning-700">Filtered out</span>
                                ) : (
                                  <span className="text-caption text-ink-300">No access</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>

            <Card className="border-info-200 bg-info-50/40">
              <div className="flex items-start gap-3 p-4">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info-600" aria-hidden />
                <div>
                  <p className="text-body-sm font-semibold text-info-800">Frontend hiding is not security</p>
                  <p className="mt-1 text-body-sm leading-relaxed text-info-800/85">
                    SmartCorp applies access control at three layers: the Django API authorises every request, the database
                    query filters rows by organisation and department, and the RAG retrieval filters candidate passages by
                    access level before similarity ranking. The interface adapts to your role for clarity — it is never the
                    control itself.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <StatusBadge tone="info" size="sm">
                      API authorisation
                    </StatusBadge>
                    <StatusBadge tone="info" size="sm">
                      Query-level row filtering
                    </StatusBadge>
                    <StatusBadge tone="info" size="sm">
                      Pre-ranking retrieval filter
                    </StatusBadge>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </PageBody>

      {/* Scope drawer ------------------------------------------------- */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Access for ${selected.name}` : 'Access'}
        description={selected?.jobTitle}
        width="max-w-[560px]"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!can('users:manage') || !scopeDraft}
              onClick={async () => {
                if (!selected || !scopeDraft) return
                await userService.updateScope({
                  userId: selected.id,
                  role: scopeDraft.role,
                  knowledgeScope: scopeDraft.knowledge,
                  agentScope: scopeDraft.agents,
                })
                users.reload()
                setSelected(null)
                toast({
                  title: 'Access updated',
                  description: `${selected.name} now retrieves ${scopeDraft.knowledge.length} knowledge bases with ${scopeDraft.agents.length} agents. The change is recorded in the audit log.`,
                  tone: 'success',
                })
              }}
            >
              Save access
            </Button>
          </>
        }
      >
        {selected && scopeDraft && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-md border border-line bg-surface-muted/50 p-3">
              <Avatar name={selected.name} color={selected.avatarColor} size="lg" />
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-ink-900">{selected.name}</p>
                <p className="truncate text-caption text-ink-400">{selected.email}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <StatusBadge tone="brand" size="sm">
                    {ROLE_LABELS[selected.role]}
                  </StatusBadge>
                  <StatusBadge tone="neutral" size="sm">
                    {selected.department}
                  </StatusBadge>
                  <StatusBadge tone={selected.status === 'active' ? 'success' : 'info'} size="sm">
                    {titleCase(selected.status)}
                  </StatusBadge>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Role</p>
              <div className="flex flex-wrap gap-1.5">
                {(roles.data ?? []).map((role) => (
                  <button
                    key={role.role}
                    type="button"
                    onClick={() => setScopeDraft({ ...scopeDraft, role: role.role })}
                    className={cn(
                      'rounded-md border px-2.5 py-1.5 text-left text-body-sm transition-colors',
                      scopeDraft.role === role.role
                        ? 'border-brand-300 bg-brand-50 text-brand-800'
                        : 'border-line bg-surface text-ink-600 hover:border-line-strong',
                    )}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-caption leading-relaxed text-ink-400">
                {(roles.data ?? []).find((role) => role.role === scopeDraft.role)?.knowledgeScopeDescription}
              </p>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                Knowledge base access · {scopeDraft.knowledge.length} of {knowledgeBases.data?.length ?? 0}
              </p>
              <ul className="space-y-1.5">
                {(knowledgeBases.data ?? []).map((base) => (
                  <li key={base.id} className="rounded-md border border-line px-3 py-2">
                    <Checkbox
                      checked={scopeDraft.knowledge.includes(base.id)}
                      onChange={(checked) =>
                        setScopeDraft({
                          ...scopeDraft,
                          knowledge: checked
                            ? [...scopeDraft.knowledge, base.id]
                            : scopeDraft.knowledge.filter((id) => id !== base.id),
                        })
                      }
                      label={base.name}
                      description={`${base.department} · ${base.documentCount} documents · ${
                        base.accessLevel === 'organization' ? 'org-wide' : base.accessLevel
                      }`}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                Agent access · {scopeDraft.agents.length}
              </p>
              <ul className="space-y-1.5">
                {(agents.data ?? []).map((agent) => (
                  <li key={agent.id} className="rounded-md border border-line px-3 py-2">
                    <Checkbox
                      checked={scopeDraft.agents.includes(agent.id)}
                      onChange={(checked) =>
                        setScopeDraft({
                          ...scopeDraft,
                          agents: checked ? [...scopeDraft.agents, agent.id] : scopeDraft.agents.filter((id) => id !== agent.id),
                        })
                      }
                      label={agent.name}
                      description={agent.purpose}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <p className="rounded-md border border-line-subtle bg-surface-muted px-3 py-2.5 text-caption leading-relaxed text-ink-500">
              Scope changes take effect immediately for new questions. Existing answers are not rewritten, and the change is
              recorded with your name, the previous scope and the new scope.
            </p>
          </div>
        )}
      </Drawer>

      {/* Invite modal ------------------------------------------------- */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a user"
        description="They receive an invitation, and access is defined by the role you assign."
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setInviteOpen(false)
                toast({
                  title: 'Invitation sent',
                  description: 'The invite is valid for 7 days. Access takes effect once they sign in through SSO.',
                  tone: 'success',
                })
              }}
            >
              Send invitation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="invite-name" className="mb-1.5 block text-body-sm font-medium text-ink-700">
                Full name
              </label>
              <input
                id="invite-name"
                placeholder="e.g. Priya Raghunathan"
                className="h-9 w-full rounded-md border border-line bg-surface px-3 text-body text-ink-900 shadow-xs placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
              />
            </div>
            <div>
              <label htmlFor="invite-email" className="mb-1.5 block text-body-sm font-medium text-ink-700">
                Work email
              </label>
              <input
                id="invite-email"
                type="email"
                placeholder="name@northwind.example"
                className="h-9 w-full rounded-md border border-line bg-surface px-3 text-body text-ink-900 shadow-xs placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-body-sm font-medium text-ink-700">Role</p>
            <div className="flex flex-wrap gap-1.5">
              {(roles.data ?? []).map((role) => (
                <span key={role.role} className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-body-sm text-ink-600">
                  {role.label}
                </span>
              ))}
            </div>
            <p className="mt-2 text-caption leading-relaxed text-ink-400">
              The role determines which knowledge the AI may retrieve for this person and which decisions they can approve.
            </p>
          </div>
        </div>
      </Modal>
    </>
  )
}
