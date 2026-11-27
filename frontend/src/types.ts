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

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: Role;
  department: string;
  est_hours: number;
  open_tasks: number;
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

export interface DocumentPage {
  page: number;
  content: string;
}

export interface RelatedDocument {
  id: number;
  title: string;
  filename: string;
  category: string;
}

export interface DocumentDetail extends DocumentItem {
  has_pdf_file: boolean;
  pages: DocumentPage[];
  related_documents: RelatedDocument[];
}

export interface KnowledgeSearchResult {
  query: string;
  documents: Array<{
    id: number;
    title: string;
    filename: string;
    category: string;
    chunk_count: number;
    file_size: number;
    created_at: string;
  }>;
  chunks: Array<{
    id: string;
    filename: string;
    page: number;
    excerpt: string;
    relevance: number;
  }>;
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
  related_documents?: RelatedDocument[];
  has_evidence?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  related_documents?: RelatedDocument[];
  has_evidence?: boolean;
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

export type EmailMessageType =
  | 'Professional email'
  | 'Internal company message'
  | 'Meeting follow-up'
  | 'Leave request'
  | 'Project update'
  | 'Announcement';

export type EmailTone =
  | 'Formal'
  | 'Friendly'
  | 'Concise'
  | 'Persuasive'
  | 'Professional';

export type EmailAction = 'generate' | 'rewrite' | 'shorten' | 'improve' | 'regenerate';

export interface EmailWriterRequest {
  description: string;
  message_type: EmailMessageType;
  tone: EmailTone;
  recipient?: string;
  subject?: string;
  important_points?: string;
  action: EmailAction;
  current_draft?: string;
}

export interface EmailWriterResponse {
  subject: string;
  body: string;
  message_type: string;
  tone: string;
  action: string;
}

export type CalendarCategory = 'meeting' | 'deadline' | 'review' | 'company' | 'focus' | 'leave';

export interface CalendarEventItem {
  id: string;
  source: 'event' | 'task' | 'leave';
  source_id: number;
  org_id: number;
  title: string;
  description?: string | null;
  category: CalendarCategory;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location?: string | null;
  attendees: string[];
  created_by?: number | null;
  creator_name?: string | null;
  editable: boolean;
  task_status?: string;
  task_priority?: string;
}

export type LeaveType = 'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Unpaid Leave';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface LeaveBalance {
  id: number;
  user_id: number;
  user_name?: string;
  department?: string;
  role?: Role;
  leave_type: string;
  year: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
}

export interface LeaveRequestItem {
  id: number;
  org_id: number;
  user_id: number;
  employee_name: string;
  employee_email?: string | null;
  employee_role?: Role | null;
  department: string;
  leave_type: LeaveType | string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: LeaveStatus;
  reviewed_by?: number | null;
  reviewer_name?: string | null;
  review_note?: string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
}

export interface LeaveSummary {
  year: number;
  my_counts: {
    pending: number;
    approved: number;
    rejected: number;
  };
  org_counts: {
    pending: number;
    approved: number;
    rejected: number;
  };
  balances: LeaveBalance[];
}
