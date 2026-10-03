// ==========================================================
// SteriTrack: Frontend API Client
// ==========================================================

const API_BASE = '/api';
let csrfToken = '';

export class ApiError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (csrfToken && options.method && !['GET','HEAD'].includes(options.method.toUpperCase())) headers['X-CSRF-Token'] = csrfToken;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('Cannot reach the application API. Check the deployment and network connection.');
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json().catch(() => ({})) : {};
  if (typeof data.csrfToken === 'string') csrfToken = data.csrfToken;

  if (!response.ok) {
    if (response.status === 401) csrfToken = '';
    const message = data.error || (!isJson && response.status === 404
      ? 'The API is missing from this deployment. Connect the persistent backend and redeploy.'
      : !isJson && response.status >= 500
      ? 'The API server is unavailable. Check the deployment logs.'
      : 'The request could not be completed.');
    throw new ApiError(message, response.status, data.code);
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials: { username: string; password?: string }) =>
    request<{ success: boolean; csrfToken: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  getMe: () => request<{ success: boolean; csrfToken: string; user: any }>('/auth/me'),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  // Health
  getHealth: () => request<any>('/health'),

  // Dashboard & Alerts
  getDashboard: () => request<{ success: boolean; data: any }>('/dashboard'),
  getAlerts: () => request<{ success: boolean; data: any[] }>('/alerts'),

  // Kits
  getKits: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ success: boolean; data: any[]; total: number }>(`/kits${query ? '?' + query : ''}`);
  },
  getKitById: (id: string | number) => request<{ success: boolean; data: any }>(`/kits/${id}`),
  getKitTrace: (id: string | number) => request<{ success: boolean; data: any }>(`/kits/${id}/trace`),
  createKit: (kitData: any) =>
    request<{ success: boolean; data: any }>('/kits', {
      method: 'POST',
      body: JSON.stringify(kitData),
    }),

  // Workflow Queues & State Machine
  getProcessingQueues: () => request<{ success: boolean; data: any }>('/processing/queues'),
  transitionKit: (kitId: number, targetStatus: string, options: any = {}) =>
    request<{ success: boolean; kit: any; message: string }>(`/processing/${kitId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ targetStatus, ...options }),
    }),
  returnKit: (kitId: number, notes?: string) =>
    request<{ success: boolean; kit: any; message: string }>(`/processing/${kitId}/return`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  // Batches
  getBatches: () => request<{ success: boolean; data: any[] }>('/batches'),
  getBatchById: (id: number) => request<{ success: boolean; data: any }>(`/batches/${id}`),
  createBatch: (batchData: any) =>
    request<{ success: boolean; data: any }>('/batches', {
      method: 'POST',
      body: JSON.stringify(batchData),
    }),
  completeBatch: (id: number, options: { physicalPassed?: boolean; chemicalPassed?: boolean; notes?: string }) =>
    request<{ success: boolean; data: any }>(`/batches/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),
  failBatch: (id: number, reason: string) =>
    request<{ success: boolean; data: any }>(`/batches/${id}/fail`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Quality Control
  getPendingQcBatches: () => request<{ success: boolean; data: any[] }>('/qc/pending'),
  submitQcReview: (batchId: number, reviewData: any) =>
    request<{ success: boolean; data: any }>(`/qc/${batchId}/review`, {
      method: 'POST',
      body: JSON.stringify(reviewData),
    }),

  // Quarantine & Reprocessing
  getQuarantineRecords: () => request<{ success: boolean; data: any[] }>('/quarantine'),
  startReprocessing: (kitId: number, justification: string) =>
    request<{ success: boolean; data: any }>(`/quarantine/${kitId}/reprocess`, {
      method: 'POST',
      body: JSON.stringify({ justification }),
    }),

  // Requests
  getRequests: () => request<{ success: boolean; data: any[] }>('/requests'),
  createRequest: (reqData: any) =>
    request<{ success: boolean; data: any }>('/requests', {
      method: 'POST',
      body: JSON.stringify(reqData),
    }),
  updateRequestPriority: (id: number, newPriority: string, justification: string) =>
    request<{ success: boolean; data: any }>(`/requests/${id}/priority`, {
      method: 'PUT',
      body: JSON.stringify({ newPriority, justification }),
    }),
  getRequestPriorityHistory: (id: number) =>
    request<{ success: boolean; data: any[] }>(`/requests/${id}/priority-history`),

  // Dispatch & Receipt
  getEligibleKits: (kitTypeId?: number) =>
    request<{ success: boolean; data: any[] }>(`/dispatch/eligible${kitTypeId ? `?kitTypeId=${kitTypeId}` : ''}`),
  getDispatchHistory: () => request<{ success: boolean; data: any[] }>('/dispatch/history'),
  dispatchKit: (data: { requestId: number; kitIds: number[]; transportCaseId?: string; notes?: string }) =>
    request<{ success: boolean; data: any }>('/dispatch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  confirmReceipt: (data: { dispatchId: number; packagingIntact?: boolean; indicatorColorVerified?: boolean; conditionNotes?: string }) =>
    request<{ success: boolean; data: any }>('/receipts/confirm', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Inventory
  getInventorySummary: () => request<{ success: boolean; data: any[] }>('/inventory/summary'),

  // Audit
  getAuditLogs: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ success: boolean; data: any[]; total: number }>(`/audit${query ? '?' + query : ''}`);
  },

  // Reports
  getReport: (reportType: string) => request<{ success: boolean; data: any[] }>(`/reports/${reportType}`),

  // Catalogs
  getDepartments: () => request<{ success: boolean; data: any[] }>('/departments'),
  getKitTypes: () => request<{ success: boolean; data: any[] }>('/kit-types'),
  getUsers: () => request<{ success: boolean; data: any[] }>('/users'),
  createUser: (data: {username:string;email:string;fullName:string;role:string;departmentId:number;password:string}) => request<{success:boolean;user:any}>('/users',{method:'POST',body:JSON.stringify(data)}),
  changePassword: (currentPassword:string,newPassword:string) => request<{success:boolean;message:string}>('/users/me/password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})}),
  toggleUserActive: (id: number) => request<{ success: boolean; user: any }>(`/users/${id}/toggle-active`, { method: 'PUT' }),
};
