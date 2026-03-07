import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import type { Company, Site, Inspector } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'companies' | 'sites' | 'inspectors';

export function SettingsModal({ open, onClose }: Props) {
  const { toast, loadInspectors } = useApp();
  const [tab, setTab] = useState<Tab>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [c, s, i] = await Promise.all([api.getCompanies(), api.getSites(), api.getInspectors()]);
    setCompanies(c);
    setSites(s);
    setInspectors(i);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const startAdd = () => {
    setEditId('new');
    setForm(tab === 'companies' ? { name: '', contact: '', phone: '' } : tab === 'inspectors' ? { name: '', initials: '' } : { name: '' });
  };

  const startEdit = (item: any) => {
    setEditId(item.id);
    if (tab === 'companies') setForm({ name: item.name, contact: item.contact || '', phone: item.phone || '' });
    else if (tab === 'inspectors') setForm({ name: item.name, initials: item.initials || '' });
    else setForm({ name: item.name });
  };

  const cancelEdit = () => { setEditId(null); setForm({}); };

  const save = async () => {
    if (!form.name?.trim()) { toast('Name is required', 't-fail', '!'); return; }
    try {
      if (editId === 'new') {
        if (tab === 'companies') await api.createCompany(form as any);
        else if (tab === 'inspectors') await api.createInspector(form as any);
        else await api.createSite(form as any);
        toast(`${tab.slice(0, -1).replace(/^./, c => c.toUpperCase())} added`, 't-pass', '+');
      } else {
        if (tab === 'companies') await api.updateCompany(editId!, form as any);
        else if (tab === 'inspectors') await api.updateInspector(editId!, form as any);
        else await api.updateSite(editId!, form as any);
        toast('Updated', 't-pass', '✓');
      }
      cancelEdit();
      load();
      if (tab === 'inspectors') loadInspectors();
    } catch { toast('Failed to save', 't-fail', '!'); }
  };

  const handleDelete = async (id: string) => {
    try {
      if (tab === 'companies') await api.deleteCompany(id);
      else if (tab === 'inspectors') await api.deleteInspector(id);
      else await api.deleteSite(id);
      toast('Deleted', 't-info', '~');
      load();
      if (tab === 'inspectors') loadInspectors();
    } catch { toast('Failed to delete', 't-fail', '!'); }
  };

  if (!open) return null;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'companies', label: 'Companies', count: companies.length },
    { id: 'sites', label: 'Sites', count: sites.length },
    { id: 'inspectors', label: 'Inspectors', count: inspectors.length },
  ];

  const items = tab === 'companies' ? companies : tab === 'sites' ? sites : inspectors;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">Settings</div>
          <button className="modal-close" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.8"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.8"/></svg>
          </button>
        </div>
        <div className="settings-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`settings-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => { setTab(t.id); cancelEdit(); }}
            >
              {t.label} <span className="settings-tab-count">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="modal-body" style={{ padding: 0, minHeight: 300 }}>
          <div className="settings-toolbar">
            <button className="btn-lime" style={{ padding: '8px 16px', fontSize: 12 }} onClick={startAdd}>
              + Add {tab.slice(0, -1) === 'companie' ? 'Company' : tab.slice(0, -1).replace(/^./, c => c.toUpperCase())}
            </button>
          </div>

          {editId === 'new' && (
            <div className="settings-edit-row">
              {renderForm(tab, form, setForm)}
              <div className="settings-edit-actions">
                <button className="btn-lime" style={{ fontSize: 12, padding: '6px 14px' }} onClick={save}>Save</button>
                <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={cancelEdit}>Cancel</button>
              </div>
            </div>
          )}

          {items.length === 0 && !editId ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-state-title">No {tab} yet</div>
              <div className="empty-state-text">Tap the button above to add your first one.</div>
            </div>
          ) : (
            items.map((item: any) => (
              <div key={item.id} className="settings-item">
                {editId === item.id ? (
                  <div className="settings-edit-row">
                    {renderForm(tab, form, setForm)}
                    <div className="settings-edit-actions">
                      <button className="btn-lime" style={{ fontSize: 12, padding: '6px 14px' }} onClick={save}>Save</button>
                      <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="settings-item-row">
                    <div className="settings-item-info">
                      {tab === 'inspectors' && <div className="av" style={{ fontSize: 11, width: 32, height: 32 }}>{(item as Inspector).initials}</div>}
                      <div>
                        <div className="settings-item-name">{item.name}</div>
                        {tab === 'companies' && (item as Company).contact && (
                          <div className="settings-item-sub">{(item as Company).contact}{(item as Company).phone ? ` · ${(item as Company).phone}` : ''}</div>
                        )}
                      </div>
                    </div>
                    <div className="settings-item-actions">
                      <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => startEdit(item)}>Edit</button>
                      <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 10px', color: 'var(--fail)' }} onClick={() => handleDelete(item.id)}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function renderForm(tab: Tab, form: Record<string, string>, setForm: (f: Record<string, string>) => void) {
  const set = (key: string, val: string) => setForm({ ...form, [key]: val });
  return (
    <div className="settings-form">
      <input className="fm-input" placeholder="Name *" value={form.name || ''} onChange={e => set('name', e.target.value)} autoFocus />
      {tab === 'companies' && (
        <>
          <input className="fm-input" placeholder="Contact person" value={form.contact || ''} onChange={e => set('contact', e.target.value)} />
          <input className="fm-input" placeholder="Phone" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
        </>
      )}
      {tab === 'inspectors' && (
        <input className="fm-input" placeholder="Initials (auto-generated if blank)" value={form.initials || ''} onChange={e => set('initials', e.target.value)} style={{ maxWidth: 180 }} />
      )}
    </div>
  );
}
