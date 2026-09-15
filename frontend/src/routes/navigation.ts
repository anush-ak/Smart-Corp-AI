import {
  Activity,
  BadgeCheck,
  BookOpen,
  Bot,
  ClipboardCheck,
  FileText,
  Gavel,
  LayoutDashboard,
  type LucideIcon,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import type { Permission } from '@/types'

/**
 * Navigation registry — the single definition of the product's information
 * architecture. Sidebar, command palette, breadcrumbs and route guards all read
 * from here, which is what keeps SmartCorp feeling like one system rather than
 * a set of disconnected mini-apps.
 */

export interface NavItem {
  id: string
  label: string
  path: string
  icon: LucideIcon
  /** Capability required to see and open the item. */
  permission: Permission
  /** Short description used by the command palette and empty states. */
  summary: string
  /** Optional one-line context shown beside the page title in the top bar. */
  purpose: string
  aliases?: string[]
}

export interface NavGroup {
  id: string
  label: string
  /** Groups marked as primary render above the divider in the sidebar. */
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        path: '/overview',
        icon: LayoutDashboard,
        permission: 'overview:view',
        summary: 'What needs your attention today',
        purpose: 'Organisation-wide intelligence command centre',
        aliases: ['home', 'dashboard', 'command center'],
      },
      {
        id: 'assistant',
        label: 'AI Assistant',
        path: '/assistant',
        icon: Sparkles,
        permission: 'assistant:use',
        summary: 'Ask questions against approved knowledge',
        purpose: 'Permission-aware answers with citations',
        aliases: ['chat', 'ask', 'rag', 'search'],
      },
      {
        id: 'knowledge',
        label: 'Knowledge',
        path: '/knowledge',
        icon: BookOpen,
        permission: 'knowledge:view',
        summary: 'Documents your AI can understand and use',
        purpose: 'Knowledge operations and processing pipeline',
        aliases: ['documents', 'files', 'upload', 'kb'],
      },
      {
        id: 'agents',
        label: 'Agents',
        path: '/agents',
        icon: Bot,
        permission: 'agents:view',
        summary: 'Specialised agents and their execution history',
        purpose: 'Agent control centre and execution inspector',
        aliases: ['hr agent', 'finance agent', 'support agent', 'router'],
      },
      {
        id: 'decisions',
        label: 'Decisions',
        path: '/decisions',
        icon: Gavel,
        permission: 'decisions:view',
        summary: 'AI recommendations that require review',
        purpose: 'Evidence-backed recommendations awaiting a human decision',
        aliases: ['recommendation', 'review'],
      },
      {
        id: 'approvals',
        label: 'Approvals',
        path: '/approvals',
        icon: ClipboardCheck,
        permission: 'approvals:view',
        summary: 'Requests waiting on you',
        purpose: 'Human-in-the-loop approval queue',
        aliases: ['inbox', 'pending', 'approve'],
      },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      {
        id: 'evaluation',
        label: 'Evaluation',
        path: '/evaluation',
        icon: BadgeCheck,
        permission: 'evaluation:view',
        summary: 'Retrieval quality, faithfulness and failure analysis',
        purpose: 'AI reliability and regression testing',
        aliases: ['quality', 'hallucination', 'faithfulness', 'metrics'],
      },
      {
        id: 'analytics',
        label: 'Analytics',
        path: '/analytics',
        icon: Activity,
        permission: 'analytics:view',
        summary: 'Adoption, agent usage and response performance',
        purpose: 'Enterprise adoption and intelligence performance',
        aliases: ['usage', 'charts', 'reports'],
      },
      {
        id: 'meetings',
        label: 'Meetings',
        path: '/meetings',
        icon: MessagesSquare,
        permission: 'meetings:view',
        summary: 'Transcripts turned into decisions and tasks',
        purpose: 'Meeting intelligence pipeline',
        aliases: ['transcript', 'minutes', 'action items'],
      },
    ],
  },
  {
    id: 'governance',
    label: 'Governance',
    items: [
      {
        id: 'users',
        label: 'Users & Roles',
        path: '/users',
        icon: Users,
        permission: 'users:view',
        summary: 'Who can access which knowledge and agents',
        purpose: 'Access management and retrieval scope',
        aliases: ['people', 'permissions', 'rbac', 'roles'],
      },
      {
        id: 'audit',
        label: 'Audit Logs',
        path: '/audit-logs',
        icon: ScrollText,
        permission: 'audit:view',
        summary: 'Every AI and human action, in order',
        purpose: 'Complete, exportable activity trail',
        aliases: ['history', 'events', 'trail', 'logs'],
      },
      {
        id: 'security',
        label: 'Security',
        path: '/security',
        icon: ShieldCheck,
        permission: 'security:view',
        summary: 'Access control, restrictions and authentication',
        purpose: 'Permission enforcement and control status',
        aliases: ['restricted', 'sso', 'mfa', 'compliance'],
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        path: '/settings',
        icon: Settings,
        permission: 'overview:view',
        summary: 'Workspace, AI behaviour and data handling',
        purpose: 'Platform configuration',
        aliases: ['configuration', 'preferences', 'workspace'],
      },
    ],
  },
]

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.filter((item) => pathname.startsWith(item.path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0]
}

/** Secondary routes that appear in breadcrumbs but not in the sidebar. */
export const SUB_ROUTE_LABELS: { pattern: RegExp; label: string; parent: string }[] = [
  { pattern: /^\/knowledge\/[^/]+$/, label: 'Document details', parent: '/knowledge' },
  { pattern: /^\/agents\/[^/]+$/, label: 'Agent detail', parent: '/agents' },
  { pattern: /^\/agents\/runs\/[^/]+$/, label: 'Execution inspector', parent: '/agents' },
  { pattern: /^\/decisions\/[^/]+$/, label: 'Decision detail', parent: '/decisions' },
  { pattern: /^\/approvals\/[^/]+$/, label: 'Approval detail', parent: '/approvals' },
  { pattern: /^\/meetings\/[^/]+$/, label: 'Meeting intelligence', parent: '/meetings' },
  { pattern: /^\/evaluation\/runs\/[^/]+$/, label: 'Evaluation run', parent: '/evaluation' },
  { pattern: /^\/assistant\/[^/]+$/, label: 'Conversation', parent: '/assistant' },
]

export const FILE_TYPE_ICON: Record<string, typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileText,
  pptx: FileText,
  md: FileText,
  txt: FileText,
  csv: FileText,
}
