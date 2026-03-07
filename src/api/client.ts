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
  createInspector: (data: { name: string; initials?: string; email?: string; phone?: string; companyId?: string }) =>
    request<import('../types').Inspector>('/api/inspectors', { method: 'POST', body: JSON.stringify(data) }),
  updateInspector: (id: string, data: { name: string; initials?: string; email?: string; phone?: string; companyId?: string }) =>
    request<{ ok: boolean }>(`/api/inspectors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteInspector: (id: string) =>
    request<{ ok: boolean }>(`/api/inspectors/${id}`, { method: 'DELETE' }),

  getSites: (q?: string) => request<import('../types').Site[]>(`/api/sites${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createSite: (data: { name: string; contactName?: string; contactPhone?: string; address?: string; lat?: number | null; lng?: number | null }) =>
    request<import('../types').Site>('/api/sites', { method: 'POST', body: JSON.stringify(data) }),
  updateSite: (id: string, data: { name: string; contactName?: string; contactPhone?: string; address?: string; lat?: number | null; lng?: number | null }) =>
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
  getTemplate: (id: string) => request<import('../types').TemplateDetail>(`/api/templates/${id}`),
  createTemplate: (data: { name: string; icon?: string; groups?: { name: string; items: { text: string }[] }[] }) =>
    request<import('../types').Template>('/api/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: { name?: string; icon?: string; groups?: { name: string; items: { text: string }[] }[] }) =>
    request<{ ok: boolean }>(`/api/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTemplate: (id: string) =>
    request<{ ok: boolean }>(`/api/templates/${id}`, { method: 'DELETE' }),

  getInspections: (status?: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return request<import('../types').Inspection[]>(`/api/inspections${qs ? `?${qs}` : ''}`);
  },
  search: (q: string) => request<{ inspections: import('../types').Inspection[]; documents: import('../types').Document[] }>(`/api/search?q=${encodeURIComponent(q)}`),
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

  // Check item photos
  addCheckItemPhoto: (checkItemId: string, dataUrl: string) =>
    request<{ id: string }>(`/api/check-items/${checkItemId}/photos`, { method: 'POST', body: JSON.stringify({ dataUrl }) }),
  deleteCheckItemPhoto: (photoId: string) =>
    request<{ ok: boolean }>(`/api/check-item-photos/${photoId}`, { method: 'DELETE' }),

  // Template item photos
  addTemplateItemPhoto: (templateItemId: number, dataUrl: string) =>
    request<{ id: string }>(`/api/template-items/${templateItemId}/photos`, { method: 'POST', body: JSON.stringify({ dataUrl }) }),
  deleteTemplateItemPhoto: (photoId: string) =>
    request<{ ok: boolean }>(`/api/template-item-photos/${photoId}`, { method: 'DELETE' }),

  // Documents
  getDocuments: (companyId?: string, siteId?: string) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', companyId);
    if (siteId) params.set('siteId', siteId);
    const qs = params.toString();
    return request<import('../types').Document[]>(`/api/documents${qs ? `?${qs}` : ''}`);
  },
  createDocument: (data: { name: string; fileType: string; dataUrl: string; companyId?: string; siteId?: string }) =>
    request<{ id: string; name: string }>('/api/documents', { method: 'POST', body: JSON.stringify(data) }),
  updateDocument: (id: string, data: { name: string; companyId?: string; siteId?: string }) =>
    request<{ ok: boolean }>(`/api/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  downloadDocument: (id: string) =>
    request<{ dataUrl: string; name: string; fileType: string }>(`/api/documents/${id}/download`),
  deleteDocument: (id: string) =>
    request<{ ok: boolean }>(`/api/documents/${id}`, { method: 'DELETE' }),

  getReport: (inspectionId: string) => request<import('../types').ReportGroup[]>(`/api/inspections/${inspectionId}/report`),
  submitReport: (inspectionId: string) => request<{ status: string }>(`/api/inspections/${inspectionId}/submit`, { method: 'POST' }),
};
