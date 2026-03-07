import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import type { Company, Site, Inspector, Template, TemplateDetail } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'companies' | 'sites' | 'inspectors' | 'templates';

interface EditGroup {
  name: string;
  items: string[];
}

export function SettingsModal({ open, onClose }: Props) {
  const { toast, loadInspectors } = useApp();
  const [tab, setTab] = useState<Tab>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  // Template editor state
  const [tmplEditId, setTmplEditId] = useState<string | null>(null);
  const [tmplName, setTmplName] = useState('');
  const [tmplIcon, setTmplIcon] = useState('');
  const [tmplGroups, setTmplGroups] = useState<EditGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const [c, s, i, t] = await Promise.all([api.getCompanies(), api.getSites(), api.getInspectors(), api.getTemplates()]);
    setCompanies(c);
    setSites(s);
    setInspectors(i);
    setTemplates(t);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const startAdd = () => {
    if (tab === 'templates') {
      setTmplEditId('new');
      setTmplName('');
      setTmplIcon('📋');
      setTmplGroups([{ name: 'Group 1', items: [''] }]);
      return;
    }
    setEditId('new');
    setForm(tab === 'companies' ? { name: '', contact: '', phone: '' } : tab === 'inspectors' ? { name: '', initials: '', email: '', phone: '', companyId: '' } : { name: '', contactName: '', contactPhone: '', address: '', lat: '', lng: '' });
  };

  const startEdit = (item: any) => {
    setEditId(item.id);
    if (tab === 'companies') setForm({ name: item.name, contact: item.contact || '', phone: item.phone || '' });
    else if (tab === 'inspectors') setForm({ name: item.name, initials: item.initials || '', email: (item as Inspector).email || '', phone: (item as Inspector).phone || '', companyId: (item as Inspector).companyId || '' });
    else if (tab === 'sites') setForm({ name: item.name, contactName: (item as Site).contactName || '', contactPhone: (item as Site).contactPhone || '', address: (item as Site).address || '', lat: (item as Site).lat != null ? String((item as Site).lat) : '', lng: (item as Site).lng != null ? String((item as Site).lng) : '' });
    else setForm({ name: item.name });
  };

  const startEditTemplate = async (tmpl: Template) => {
    setLoading(true);
    try {
      const detail = await api.getTemplate(tmpl.id);
      setTmplEditId(tmpl.id);
      setTmplName(detail.name);
      setTmplIcon(detail.icon);
      setTmplGroups(detail.groups.map(g => ({
        name: g.name,
        items: g.items.map(i => i.text),
      })));
    } catch { toast('Failed to load template', 't-fail', '!'); }
    setLoading(false);
  };

  const cancelEdit = () => { setEditId(null); setForm({}); };
  const cancelTmplEdit = () => { setTmplEditId(null); setTmplGroups([]); };

  const buildSiteData = () => ({
    name: form.name, contactName: form.contactName, contactPhone: form.contactPhone,
    address: form.address,
    lat: form.lat ? parseFloat(form.lat) : null,
    lng: form.lng ? parseFloat(form.lng) : null,
  });

  const save = async () => {
    if (!form.name?.trim()) { toast('Name is required', 't-fail', '!'); return; }
    try {
      if (editId === 'new') {
        if (tab === 'companies') await api.createCompany(form as any);
        else if (tab === 'inspectors') await api.createInspector(form as any);
        else if (tab === 'sites') await api.createSite(buildSiteData());
        toast(`${tab.slice(0, -1).replace(/^./, c => c.toUpperCase())} added`, 't-pass', '+');
      } else {
        if (tab === 'companies') await api.updateCompany(editId!, form as any);
        else if (tab === 'inspectors') await api.updateInspector(editId!, form as any);
        else if (tab === 'sites') await api.updateSite(editId!, buildSiteData());
        toast('Updated', 't-pass', '✓');
      }
      cancelEdit();
      load();
      if (tab === 'inspectors') loadInspectors();
    } catch { toast('Failed to save', 't-fail', '!'); }
  };

  const saveTmpl = async () => {
    if (!tmplName.trim()) { toast('Template name is required', 't-fail', '!'); return; }
    const cleanGroups = tmplGroups
      .map(g => ({ name: g.name.trim(), items: g.items.filter(i => i.trim()).map(i => ({ text: i.trim() })) }))
      .filter(g => g.name && g.items.length > 0);
    if (cleanGroups.length === 0) { toast('Add at least one group with items', 't-fail', '!'); return; }
    try {
      if (tmplEditId === 'new') {
        await api.createTemplate({ name: tmplName.trim(), icon: tmplIcon || '📋', groups: cleanGroups });
        toast('Template created', 't-pass', '+');
      } else {
        await api.updateTemplate(tmplEditId!, { name: tmplName.trim(), icon: tmplIcon, groups: cleanGroups });
        toast('Template updated', 't-pass', '✓');
      }
      cancelTmplEdit();
      load();
    } catch { toast('Failed to save template', 't-fail', '!'); }
  };

  const handleDelete = async (id: string) => {
    try {
      if (tab === 'companies') await api.deleteCompany(id);
      else if (tab === 'inspectors') await api.deleteInspector(id);
      else if (tab === 'templates') await api.deleteTemplate(id);
      else await api.deleteSite(id);
      toast('Deleted', 't-info', '~');
      load();
      if (tab === 'inspectors') loadInspectors();
    } catch { toast('Failed to delete', 't-fail', '!'); }
  };

  // Geocode address via Nominatim
  const [geocoding, setGeocoding] = useState(false);
  const geocodeAddress = async () => {
    const addr = form.address?.trim();
    if (!addr) return;
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addr)}`, {
        headers: { 'User-Agent': 'INSPECTR-FieldOps/1.0' },
      });
      const data = await res.json();
      if (data.length > 0) {
        setForm({ ...form, lat: data[0].lat, lng: data[0].lon });
        toast('Location found', 't-pass', '✓');
      } else {
        toast('Address not found — try a more specific address or enter coordinates manually', 't-fail', '!');
      }
    } catch {
      toast('Lookup failed — check your connection', 't-fail', '!');
    }
    setGeocoding(false);
  };

  // Template group/item helpers
  const addGroup = () => setTmplGroups([...tmplGroups, { name: '', items: [''] }]);
  const removeGroup = (gi: number) => setTmplGroups(tmplGroups.filter((_, i) => i !== gi));
  const updateGroupName = (gi: number, name: string) => {
    const g = [...tmplGroups]; g[gi] = { ...g[gi], name }; setTmplGroups(g);
  };
  const addItem = (gi: number) => {
    const g = [...tmplGroups]; g[gi] = { ...g[gi], items: [...g[gi].items, ''] }; setTmplGroups(g);
  };
  const removeItem = (gi: number, ii: number) => {
    const g = [...tmplGroups]; g[gi] = { ...g[gi], items: g[gi].items.filter((_, i) => i !== ii) }; setTmplGroups(g);
  };
  const updateItem = (gi: number, ii: number, text: string) => {
    const g = [...tmplGroups]; const items = [...g[gi].items]; items[ii] = text; g[gi] = { ...g[gi], items }; setTmplGroups(g);
  };

  if (!open) return null;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'companies', label: 'Companies', count: companies.length },
    { id: 'sites', label: 'Sites', count: sites.length },
    { id: 'inspectors', label: 'Inspectors', count: inspectors.length },
    { id: 'templates', label: 'Templates', count: templates.length },
  ];

  const isTemplateTab = tab === 'templates';
  const items = tab === 'companies' ? companies : tab === 'sites' ? sites : tab === 'inspectors' ? inspectors : templates;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
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
              onClick={() => { setTab(t.id); cancelEdit(); cancelTmplEdit(); }}
            >
              {t.label} <span className="settings-tab-count">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="modal-body" style={{ padding: 0, minHeight: 300, overflowY: 'auto', maxHeight: 'calc(90vh - 130px)' }}>
          {/* Template editor view */}
          {isTemplateTab && tmplEditId ? (
            <div className="tmpl-editor">
              <div className="tmpl-editor-header">
                <div className="field-group" style={{ padding: '12px 16px 0' }}>
                  <div className="field-label">{tmplEditId === 'new' ? 'New Template' : 'Edit Template'}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="fm-input" placeholder="Icon emoji" value={tmplIcon} onChange={e => setTmplIcon(e.target.value)} style={{ width: 60, textAlign: 'center', fontSize: 18, padding: '6px 4px' }} />
                    <input className="fm-input" placeholder="Template name *" value={tmplName} onChange={e => setTmplName(e.target.value)} style={{ flex: 1 }} autoFocus />
                  </div>
                </div>
              </div>

              {tmplGroups.map((group, gi) => (
                <div key={gi} className="tmpl-group-editor">
                  <div className="tmpl-group-hdr">
                    <input className="fm-input" placeholder="Group name *" value={group.name} onChange={e => updateGroupName(gi, e.target.value)} style={{ flex: 1, fontWeight: 600 }} />
                    {tmplGroups.length > 1 && (
                      <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 10px', color: 'var(--fail)' }} onClick={() => removeGroup(gi)}>Remove</button>
                    )}
                  </div>
                  <div className="tmpl-items-list">
                    {group.items.map((item, ii) => (
                      <div key={ii} className="tmpl-item-row">
                        <span className="tmpl-item-num">{ii + 1}.</span>
                        <input className="fm-input" placeholder="Check item text..." value={item} onChange={e => updateItem(gi, ii, e.target.value)} style={{ flex: 1 }} />
                        <button className="tmpl-item-remove" onClick={() => removeItem(gi, ii)} title="Remove item">
                          <svg width="10" height="10" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.8"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.8"/></svg>
                        </button>
                      </div>
                    ))}
                    <button className="btn-ghost tmpl-add-item" onClick={() => addItem(gi)}>+ Add Item</button>
                  </div>
                </div>
              ))}

              <div style={{ padding: '8px 16px 12px' }}>
                <button className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px' }} onClick={addGroup}>+ Add Group</button>
              </div>

              <div className="tmpl-editor-foot">
                <button className="btn-ghost" onClick={cancelTmplEdit}>Cancel</button>
                <button className="btn-lime" style={{ marginLeft: 'auto' }} onClick={saveTmpl}>
                  {tmplEditId === 'new' ? 'Create Template' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="settings-toolbar">
                <button className="btn-lime" style={{ padding: '8px 16px', fontSize: 12 }} onClick={startAdd}>
                  + Add {isTemplateTab ? 'Template' : tab.slice(0, -1) === 'companie' ? 'Company' : tab.slice(0, -1).replace(/^./, c => c.toUpperCase())}
                </button>
              </div>

              {!isTemplateTab && editId === 'new' && (
                <div className="settings-edit-row">
                  {renderForm(tab, form, setForm, companies, geocodeAddress, geocoding)}
                  <div className="settings-edit-actions">
                    <button className="btn-lime" style={{ fontSize: 12, padding: '6px 14px' }} onClick={save}>Save</button>
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              )}

              {items.length === 0 && !editId && !tmplEditId ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <div className="empty-state-title">No {tab} yet</div>
                  <div className="empty-state-text">Tap the button above to add your first one.</div>
                </div>
              ) : (
                items.map((item: any) => (
                  <div key={item.id} className="settings-item">
                    {!isTemplateTab && editId === item.id ? (
                      <div className="settings-edit-row">
                        {renderForm(tab, form, setForm, companies, geocodeAddress, geocoding)}
                        <div className="settings-edit-actions">
                          <button className="btn-lime" style={{ fontSize: 12, padding: '6px 14px' }} onClick={save}>Save</button>
                          <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="settings-item-row">
                        <div className="settings-item-info">
                          {tab === 'inspectors' && <div className="av" style={{ fontSize: 11, width: 32, height: 32 }}>{(item as Inspector).initials}</div>}
                          {isTemplateTab && <div style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{(item as Template).icon}</div>}
                          <div>
                            <div className="settings-item-name">{item.name}</div>
                            {tab === 'companies' && (item as Company).contact && (
                              <div className="settings-item-sub">{(item as Company).contact}{(item as Company).phone ? ` · ${(item as Company).phone}` : ''}</div>
                            )}
                            {tab === 'sites' && (
                              <div className="settings-item-sub">
                                {[(item as Site).address, (item as Site).contactName].filter(Boolean).join(' · ') || ((item as Site).lat != null ? `${(item as Site).lat}, ${(item as Site).lng}` : 'No address')}
                              </div>
                            )}
                            {tab === 'inspectors' && (
                              <div className="settings-item-sub">
                                {[(item as Inspector).companyName, (item as Inspector).email, (item as Inspector).phone].filter(Boolean).join(' · ') || 'No details'}
                              </div>
                            )}
                            {isTemplateTab && (
                              <div className="settings-item-sub">{(item as Template).count} checklist items</div>
                            )}
                          </div>
                        </div>
                        <div className="settings-item-actions">
                          <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => isTemplateTab ? startEditTemplate(item as Template) : startEdit(item)}>Edit</button>
                          <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 10px', color: 'var(--fail)' }} onClick={() => handleDelete(item.id)}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}

function renderForm(tab: Tab, form: Record<string, string>, setForm: (f: Record<string, string>) => void, companies: Company[] = [], onGeocode?: () => void, geocoding?: boolean) {
  const set = (key: string, val: string) => setForm({ ...form, [key]: val });
  const hasCoords = form.lat && form.lng && !isNaN(Number(form.lat)) && !isNaN(Number(form.lng));
  return (
    <div className="settings-form">
      <input className="fm-input" placeholder="Name *" value={form.name || ''} onChange={e => set('name', e.target.value)} autoFocus />
      {tab === 'companies' && (
        <>
          <input className="fm-input" placeholder="Contact person" value={form.contact || ''} onChange={e => set('contact', e.target.value)} />
          <input className="fm-input" placeholder="Phone" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
        </>
      )}
      {tab === 'sites' && (
        <>
          <input className="fm-input" placeholder="Site contact name" value={form.contactName || ''} onChange={e => set('contactName', e.target.value)} />
          <input className="fm-input" placeholder="Site contact phone" type="tel" value={form.contactPhone || ''} onChange={e => set('contactPhone', e.target.value)} />
          <div className="site-address-row">
            <input className="fm-input" placeholder="Physical address" value={form.address || ''} onChange={e => set('address', e.target.value)} style={{ flex: 1 }} />
            {form.address?.trim() && (
              <button type="button" className="btn-ghost site-lookup-btn" onClick={onGeocode} disabled={geocoding}>
                {geocoding ? '...' : 'Lookup'}
              </button>
            )}
          </div>
          <div className="site-coords-row">
            <input className="fm-input" placeholder="Latitude" type="number" step="any" value={form.lat || ''} onChange={e => set('lat', e.target.value)} />
            <input className="fm-input" placeholder="Longitude" type="number" step="any" value={form.lng || ''} onChange={e => set('lng', e.target.value)} />
          </div>
          <div className="site-hint">Enter an address and tap Lookup, or enter coordinates for remote locations</div>
          {hasCoords && (
            <div className="site-map-preview">
              <iframe
                title="Site location"
                width="100%"
                height="180"
                style={{ border: 0, borderRadius: 6 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(form.lng) - 0.01},${Number(form.lat) - 0.006},${Number(form.lng) + 0.01},${Number(form.lat) + 0.006}&layer=mapnik&marker=${form.lat},${form.lng}`}
              />
              <a
                className="site-map-link"
                href={`https://www.openstreetmap.org/?mlat=${form.lat}&mlon=${form.lng}#map=15/${form.lat}/${form.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Maps
              </a>
            </div>
          )}
        </>
      )}
      {tab === 'inspectors' && (
        <>
          <input className="fm-input" placeholder="Initials (auto-generated if blank)" value={form.initials || ''} onChange={e => set('initials', e.target.value)} style={{ maxWidth: 180 }} />
          <input className="fm-input" placeholder="Email" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
          <input className="fm-input" placeholder="Cell / Phone" type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
          <select className="fm-input" title="Company" value={form.companyId || ''} onChange={e => set('companyId', e.target.value)}>
            <option value="">— No company —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </>
      )}
    </div>
  );
}
