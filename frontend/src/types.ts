export type Role = 'Admin' | 'Manager' | 'HR' | 'Employee';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  org_id: number;
  org_name: string;
  department?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface TaskStatusCount {
  status: string;
  count: number;
}

export interface TeamWorkloadMember {
  user_id: number;
  full_name: string;
  role: Role;
  department?: string;
  est_hours: number;
}

export interface DashboardSummary {
  kpis: {
    active_projects: number;
    overdue_tasks: number;
    completed_tasks: number;
    pending_approvals: number;
  };
  active_projects: number;
  overdue_tasks: number;
  completed_tasks: number;
  pending_approvals: number;
  task_status_breakdown: TaskStatusCount[];
  team_workload: TeamWorkloadMember[];
}

export interface AuditEvent {
  id: number;
  org_id: number;
  user_id?: number;
  user_name?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: string;
  timestamp: string;
}

export interface DocumentItem {
  id: number;
  org_id: number;
  title: string;
  filename: string;
  file_size: number;
  category: string;
  chunk_count: number;
  created_at: string;
  uploaded_by?: number;
  uploader_name?: string;
}

export interface Citation {
  id: string;
  filename: string;
  page: number;
  excerpt: string;
}

export interface KnowledgeResponse {
  answer: string;
  citations: Citation[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: string;
}

export interface TaskItem {
  id: number;
  org_id: number;
  project_id?: number | null;
  project_name?: string | null;
  assignee_id?: number | null;
  assignee_name?: string | null;
  assignee_role?: Role | null;
  title: string;
  description?: string | null;
  status: 'Todo' | 'In Progress' | 'In Review' | 'Done' | string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent' | string;
  estimated_hours: number;
  due_date?: string | null;
  created_at: string;
}

export interface DraftTask {
  title: string;
  assignee: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent' | string;
  due_date: string | null;
  est_hours: number;
}


