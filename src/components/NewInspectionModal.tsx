import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import type { Template, Site } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NewInspectionModal({ open, onClose }: Props) {
  const { inspectors, toast, refreshAll } = useApp();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('structural');
  const [siteQuery, setSiteQuery] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [showSites, setShowSites] = useState(false);
  const [selectedSite, setSelectedSite] = useState('');
  const [inspectorId, setInspectorId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      api.getTemplates().then(setTemplates).catch(() => {});
      const now = new Date();
      setDate(now.toISOString().split('T')[0]);
      setTime(now.toTimeString().slice(0, 5));
      if (!inspectorId && inspectors.length > 0) setInspectorId(inspectors[0].id);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (siteQuery.length > 0) {
      api.getSites(siteQuery).then(s => { setSites(s); setShowSites(true); }).catch(() => {});
    } else {
      setShowSites(false);
    }
  }, [siteQuery]);

  const handleCreate = async () => {
    const tmpl = templates.find(t => t.id === selectedTemplate);
    await api.createInspection({
      site: selectedSite || siteQuery || '—',
      type: (tmpl?.name || 'General').toUpperCase(),
      inspectorId,
      notes,
      templateId: selectedTemplate,
    });
    toast(`Inspection created: ${(selectedSite || siteQuery).substring(0, 28)}`, 't-pass', '✓');
    refreshAll();
    onClose();
    setSiteQuery('');
    setSelectedSite('');
    setNotes('');
  };

  if (!open) return null;

  return (
    <div className={`modal-overlay${open ? ' open' : ''}`} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">New Inspection</div>
          <button className="modal-close" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.8"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.8"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="section-hint modal-hint">
            Set up a new field inspection. Choose a template, select the site, assign an inspector, and schedule the date.
          </div>
          <div className="field-group">
            <div className="field-label">Inspection Template</div>
            <div className="field-hint field-hint-top">Determines the checklist items that will be generated for this inspection.</div>
            <div className="template-grid">
              {templates.map(t => (
                <button key={t.id} className={`tmpl-card${selectedTemplate === t.id ? ' active' : ''}`} onClick={() => setSelectedTemplate(t.id)}>
                  <div className="tmpl-icon">{t.icon}</div>
                  <div className="tmpl-name">{t.name}</div>
                  <div className="tmpl-count">{t.count} items</div>
                </button>
              ))}
            </div>
          </div>
          <div className="field-group">
            <div className="field-label">Site</div>
            <div className="site-search">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.5"/></svg>
              <input
                type="text"
                placeholder="Search site name or ID..."
                value={siteQuery}
                onChange={e => { setSiteQuery(e.target.value); setSelectedSite(''); }}
                onFocus={() => { if (siteQuery) setShowSites(true); }}
              />
            </div>
            {showSites && sites.length > 0 && (
              <div className="site-results" style={{ display: 'block' }}>
                {sites.map(s => (
                  <div key={s.id} className="site-opt" onClick={() => { setSelectedSite(s.name); setSiteQuery(s.name); setShowSites(false); }}>
                    {s.name}
                    <div className="site-opt-sub">Site ID: {s.id}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="field-group">
            <div className="field-label">Inspector</div>
            <div className="assignee-row">
              {inspectors.map(ins => (
                <button key={ins.id} className={`assignee-pill${inspectorId === ins.id ? ' active' : ''}`} onClick={() => setInspectorId(ins.id)}>
                  <div className="av">{ins.initials}</div>{ins.name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field-group">
              <div className="field-label">Date</div>
              <input type="date" className="field-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="field-group">
              <div className="field-label">Time</div>
              <input type="time" className="field-input" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          <div className="field-group">
            <div className="field-label">Pre-Inspection Notes</div>
            <textarea className="field-input" rows={2} placeholder="Any relevant context or access requirements..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-lime" onClick={handleCreate} style={{ marginLeft: 'auto' }}>Create Inspection</button>
        </div>
      </div>
    </div>
  );
}
