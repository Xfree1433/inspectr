const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getStats: () => request<import('../types').Stats>('/api/stats'),
  getInspectors: () => request<import('../types').Inspector[]>('/api/inspectors'),
  createInspector: (data: { name: string; initials?: string }) =>
    request<import('../types').Inspector>('/api/inspectors', { method: 'POST', body: JSON.stringify(data) }),
  updateInspector: (id: string, data: { name: string; initials?: string }) =>
    request<{ ok: boolean }>(`/api/inspectors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteInspector: (id: string) =>
    request<{ ok: boolean }>(`/api/inspectors/${id}`, { method: 'DELETE' }),

  getSites: (q?: string) => request<import('../types').Site[]>(`/api/sites${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createSite: (data: { name: string }) =>
    request<import('../types').Site>('/api/sites', { method: 'POST', body: JSON.stringify(data) }),
  updateSite: (id: string, data: { name: string }) =>
    request<{ ok: boolean }>(`/api/sites/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSite: (id: string) =>
    request<{ ok: boolean }>(`/api/sites/${id}`, { method: 'DELETE' }),

  getCompanies: () => request<import('../types').Company[]>('/api/companies'),
  createCompany: (data: { name: string; contact?: string; phone?: string }) =>
    request<import('../types').Company>('/api/companies', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (id: string, data: { name: string; contact?: string; phone?: string }) =>
    request<{ ok: boolean }>(`/api/companies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCompany: (id: string) =>
    request<{ ok: boolean }>(`/api/companies/${id}`, { method: 'DELETE' }),

  getTemplates: () => request<import('../types').Template[]>('/api/templates'),

  getInspections: (status?: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return request<import('../types').Inspection[]>(`/api/inspections${qs ? `?${qs}` : ''}`);
  },
  searchInspections: (q: string) => request<import('../types').Inspection[]>(`/api/search?q=${encodeURIComponent(q)}`),
  createInspection: (data: { site: string; type: string; inspectorId: string; notes?: string; templateId?: string; companyId?: string }) =>
    request<{ id: string }>('/api/inspections', { method: 'POST', body: JSON.stringify(data) }),
  deleteInspection: (id: string) =>
    request<{ ok: boolean }>(`/api/inspections/${id}`, { method: 'DELETE' }),

  getChecklist: (inspectionId: string) => request<import('../types').CheckGroup[]>(`/api/inspections/${inspectionId}/checklist`),
  updateCheckItem: (id: string, data: { status?: string; failNote?: string }) =>
    request<{ ok: boolean }>(`/api/check-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  createFailure: (data: Partial<import('../types').FailureDetail> & { inspectionId: string }) =>
    request<{ id: string }>('/api/failures', { method: 'POST', body: JSON.stringify(data) }),

  getFailures: (inspectionId: string) =>
    request<import('../types').FailureView[]>(`/api/inspections/${inspectionId}/failures`),
  updateFailure: (id: string, data: { remediationStatus: string }) =>
    request<{ ok: boolean }>(`/api/failures/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getFeed: () => request<import('../types').FeedEvent[]>('/api/feed'),

  getReport: (inspectionId: string) => request<any>(`/api/inspections/${inspectionId}/report`),
  submitReport: (inspectionId: string) => request<{ status: string }>(`/api/inspections/${inspectionId}/submit`, { method: 'POST' }),
};
