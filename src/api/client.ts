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
  getSites: (q?: string) => request<import('../types').Site[]>(`/api/sites${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getTemplates: () => request<import('../types').Template[]>('/api/templates'),

  getInspections: (status?: string) => request<import('../types').Inspection[]>(`/api/inspections${status && status !== 'all' ? `?status=${status}` : ''}`),
  searchInspections: (q: string) => request<import('../types').Inspection[]>(`/api/search?q=${encodeURIComponent(q)}`),
  createInspection: (data: { site: string; type: string; inspectorId: string; notes?: string; templateId?: string }) =>
    request<{ id: string }>('/api/inspections', { method: 'POST', body: JSON.stringify(data) }),

  getChecklist: (inspectionId: string) => request<import('../types').CheckGroup[]>(`/api/inspections/${inspectionId}/checklist`),
  updateCheckItem: (id: string, data: { status?: string; failNote?: string }) =>
    request<{ ok: boolean }>(`/api/check-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  createFailure: (data: Partial<import('../types').FailureDetail> & { inspectionId: string }) =>
    request<{ id: string }>('/api/failures', { method: 'POST', body: JSON.stringify(data) }),

  getFeed: () => request<import('../types').FeedEvent[]>('/api/feed'),

  getReport: (inspectionId: string) => request<any>(`/api/inspections/${inspectionId}/report`),
  submitReport: (inspectionId: string) => request<{ status: string }>(`/api/inspections/${inspectionId}/submit`, { method: 'POST' }),
};
