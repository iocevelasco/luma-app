import { apiClient } from '@/lib/api-client';
import type {
  Activity,
  ActivityWithContext,
  AssistantMessage,
  AttendanceRecord,
  AuthResponse,
  Budget,
  BudgetImportPreview,
  BudgetStatus,
  ClientDashboard,
  Contingency,
  DashboardSummary,
  Forecast,
  LoginCredentials,
  Material,
  Notification,
  Project,
  ProjectMember,
  ProjectSummary,
  RegisterCredentials,
  Worker,
} from '@luma/shared';

/**
 * Una función por endpoint, agrupadas por dominio.
 *
 * Los hooks de React Query llaman a esto y nunca a `fetch` directo: el día que
 * cambie una ruta, cambia acá y en ningún componente.
 */

export const authApi = {
  login: (credentials: LoginCredentials) =>
    apiClient.post<AuthResponse>('/api/auth/login', credentials, { skipAuth: true }),
  register: (credentials: RegisterCredentials) =>
    apiClient.post<AuthResponse>('/api/auth/register', credentials, { skipAuth: true }),
  me: () => apiClient.get<AuthResponse['user']>('/api/auth/me'),
  logout: () => apiClient.post<{ message: string }>('/api/auth/logout'),
  switchProject: (projectId: string) =>
    apiClient.post<AuthResponse>('/api/auth/switch-project', { project_id: projectId }),
  forgotPassword: (email: string) =>
    apiClient.post<{ message: string }>('/api/auth/forgot-password', { email }, { skipAuth: true }),
  resetPassword: (token: string, password: string) =>
    apiClient.post<{ message: string }>(
      '/api/auth/reset-password',
      { token, password },
      { skipAuth: true },
    ),
  activate: (token: string, password: string) =>
    apiClient.post<AuthResponse>('/api/auth/activate', { token, password }, { skipAuth: true }),
  verifyEmail: (token: string) =>
    apiClient.post<{ message: string }>('/api/auth/verify-email', { token }, { skipAuth: true }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post<{ message: string }>('/api/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),
};

export const projectsApi = {
  list: () => apiClient.get<ProjectSummary[]>('/api/projects'),
  create: (input: Record<string, unknown>) => apiClient.post<Project>('/api/projects', input),
  current: () => apiClient.get<Project & { my_role: string }>('/api/projects/current'),
  update: (input: Record<string, unknown>) =>
    apiClient.patch<Project>('/api/projects/current', input),
  members: () => apiClient.get<ProjectMember[]>('/api/projects/current/members'),
  invite: (input: { email: string; name?: string; role: string }) =>
    apiClient.post<{ id: string; invited: boolean }>('/api/projects/current/members', input),
  updateMemberRole: (memberId: string, role: string) =>
    apiClient.patch<{ id: string }>(`/api/projects/current/members/${memberId}`, { role }),
  removeMember: (memberId: string) =>
    apiClient.delete<{ message: string }>(`/api/projects/current/members/${memberId}`),
};

export const dashboardApi = {
  get: (week?: string) =>
    apiClient.get<DashboardSummary>(`/api/dashboard${week ? `?week=${week}` : ''}`),
  forecast: () => apiClient.get<Forecast>('/api/dashboard/forecast'),
  client: () => apiClient.get<ClientDashboard>('/api/client/dashboard'),
};

export const activitiesApi = {
  list: (params?: { week?: string; status?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiClient.get<ActivityWithContext[]>(`/api/activities${query ? `?${query}` : ''}`);
  },
  create: (input: Record<string, unknown>) => apiClient.post<Activity>('/api/activities', input),
  update: (id: string, input: Record<string, unknown>) =>
    apiClient.patch<Activity>(`/api/activities/${id}`, input),
  updateStatus: (id: string, input: { status: string; blocked_reason?: string; photo_url?: string }) =>
    apiClient.patch<Activity>(`/api/activities/${id}/status`, input),
  remove: (id: string) => apiClient.delete<{ message: string }>(`/api/activities/${id}`),
};

export const materialsApi = {
  list: (status?: string) =>
    apiClient.get<Array<Material & { activity?: string }>>(
      `/api/materials${status ? `?status=${status}` : ''}`,
    ),
  shoppingList: () =>
    apiClient.get<Array<{ name: string; unit: string; quantity: number; estimated_cost: number; requests: number }>>(
      '/api/materials/shopping-list',
    ),
  create: (input: Record<string, unknown>) => apiClient.post<Material>('/api/materials', input),
  update: (id: string, input: Record<string, unknown>) =>
    apiClient.patch<Material>(`/api/materials/${id}`, input),
  remove: (id: string) => apiClient.delete<{ message: string }>(`/api/materials/${id}`),
};

export interface AttendanceDay {
  date: string;
  expected: number;
  present: number;
  deficit: number;
  records: Array<{
    id: string;
    worker_id: string;
    worker_name?: string;
    worker_trade?: string;
    present: boolean;
    activity_id: string | null;
    activity_name?: string;
    notes?: string;
  }>;
  unrecorded: Array<{ id: string; name: string; trade?: string }>;
}

export const personnelApi = {
  workers: () => apiClient.get<Worker[]>('/api/personnel/workers'),
  createWorker: (input: Record<string, unknown>) =>
    apiClient.post<Worker>('/api/personnel/workers', input),
  updateWorker: (id: string, input: Record<string, unknown>) =>
    apiClient.patch<Worker>(`/api/personnel/workers/${id}`, input),
  attendance: (date: string) =>
    apiClient.get<AttendanceDay>(`/api/personnel/attendance?date=${date}`),
  recordAttendance: (input: {
    date: string;
    entries: Array<{ worker_id: string; present: boolean; activity_id?: string | null }>;
  }) => apiClient.post<{ date: string; recorded: number }>('/api/personnel/attendance', input),
};

export const budgetApi = {
  status: () => apiClient.get<BudgetStatus>('/api/budget/status'),
  current: () => apiClient.get<Budget | null>('/api/budget/current'),
  versions: () =>
    apiClient.get<Array<{ id: string; version: number; is_baseline: boolean; total: number; file_name?: string; createdAt: string }>>(
      '/api/budget/versions',
    ),
  preview: (file: File, options?: { currency?: string; mapping?: Record<string, string> }) => {
    const form = new FormData();
    form.append('file', file);
    if (options?.currency) form.append('currency', options.currency);
    if (options?.mapping) form.append('mapping', JSON.stringify(options.mapping));
    return apiClient.post<
      BudgetImportPreview & { headers: string[]; sheets: string[]; file_name: string; needs_mapping?: boolean }
    >('/api/budget/import/preview', form);
  },
  confirm: (input: { currency: string; file_name?: string; chapters: unknown[] }) =>
    apiClient.post<{ id: string; version: number; total: number }>(
      '/api/budget/import/confirm',
      input,
    ),
};

export const contingenciesApi = {
  list: (status?: string) =>
    apiClient.get<Contingency[]>(`/api/contingencies${status ? `?status=${status}` : ''}`),
  get: (id: string) => apiClient.get<Contingency>(`/api/contingencies/${id}`),
  create: (input: Record<string, unknown>, submit = true) =>
    apiClient.post<Contingency>(`/api/contingencies?submit=${submit}`, input),
  update: (id: string, input: Record<string, unknown>) =>
    apiClient.patch<Contingency>(`/api/contingencies/${id}`, input),
  submit: (id: string) => apiClient.post<Contingency>(`/api/contingencies/${id}/submit`),
  approveInternal: (id: string, input: { impact_cost?: number; impact_days?: number; comment?: string }) =>
    apiClient.post<Contingency>(`/api/contingencies/${id}/approve-internal`, input),
  sendToClient: (id: string) =>
    apiClient.post<Contingency>(`/api/contingencies/${id}/send-to-client`),
  clientDecision: (
    id: string,
    input: { decision: 'approved' | 'rejected' | 'alternative'; comment?: string; chosen_option?: number },
  ) => apiClient.post<Contingency>(`/api/contingencies/${id}/client-decision`, input),
};

export const notificationsApi = {
  list: () => apiClient.get<Notification[]>('/api/notifications'),
  markRead: (id: string) => apiClient.post<{ message: string }>(`/api/notifications/${id}/read`),
  markAllRead: () => apiClient.post<{ message: string }>('/api/notifications/read-all'),
};

export const assistantApi = {
  status: () => apiClient.get<{ enabled: boolean }>('/api/assistant/status'),
  ask: (message: string, conversationId?: string) =>
    apiClient.post<{ conversationId: string; message: AssistantMessage }>('/api/assistant/ask', {
      message,
      conversation_id: conversationId,
    }),
  conversations: () =>
    apiClient.get<Array<{ id: string; title: string; updatedAt: string }>>(
      '/api/assistant/conversations',
    ),
  conversation: (id: string) =>
    apiClient.get<{ id: string; title: string; messages: AssistantMessage[] }>(
      `/api/assistant/conversations/${id}`,
    ),
};
