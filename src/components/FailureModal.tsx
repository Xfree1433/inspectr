import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import type { Severity } from '../types';

interface Props {
  open: boolean;
  title: string;
  checkItemId: string;
  onClose: () => void;
}

export function FailureModal({ open, title, checkItemId, onClose }: Props) {
  const { inspectors, activeInspection, toast, loadChecklist } = useApp();
  const [severity, setSeverity] = useState<Severity>('high');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState('sr');
  const [dueDate, setDueDate] = useState('');
  const [refStandard, setRefStandard] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { if (ev.target?.result) setPhotos(prev => [...prev, ev.target!.result as string]); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!activeInspection) return;
    await api.createFailure({
      inspectionId: activeInspection.id,
      checkItemId,
      title,
      severity,
      description,
      photos,
      assigneeId,
      dueDate,
      referenceStandard: refStandard,
    });
    toast('Failure saved & assigned', 't-pass', '✓');
    loadChecklist(activeInspection.id);
    onClose();
  };

  const handleLog = async () => {
    if (!activeInspection) return;
    await api.createFailure({ inspectionId: activeInspection.id, checkItemId, title, severity, description });
    toast('Failure logged', 't-fail', '⚠');
    loadChecklist(activeInspection.id);
    onClose();
  };

  if (!open) return null;

  return (
    <div className={`modal-overlay${open ? ' open' : ''}`} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: 'var(--fail)', letterSpacing: 1, marginBottom: 3 }}>FAILURE FLAGGED</div>
            <div className="modal-title">{title}</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.8"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.8"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="section-hint modal-hint">
            Document this failure with severity, description, and photo evidence. Assign remediation to a team member with a deadline.
          </div>
          <div className="field-group">
            <div className="field-label">Severity Level</div>
            <div className="fail-severity-row">
              {(['low', 'med', 'high'] as Severity[]).map(s => (
                <button key={s} className={`sev-btn${severity === s ? ` active-${s}` : ''}`} onClick={() => setSeverity(s)}>
                  {s === 'med' ? 'Medium' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div className="field-hint">Low: cosmetic/minor. Medium: functional impact. High: safety risk or code violation.</div>
          </div>
          <div className="field-group">
            <div className="field-label">Failure Description</div>
            <textarea className="field-input" rows={3} placeholder="Describe the defect in detail..." value={description} onChange={e => setDescription(e.target.value)} />
            <div className="field-hint">Include location, extent of damage, and any measurements if applicable.</div>
          </div>
          <div className="field-group">
            <div className="field-label">Photo Evidence</div>
            <div className="photo-grid">
              {photos.map((src, i) => (
                <div key={i} className="photo-thumb">
                  <img src={src} alt="" />
                  <button className="del-photo" onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              <div className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                ADD PHOTO
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhoto} />
          </div>
          <div className="field-group">
            <div className="field-label">Assign Remediation</div>
            <div className="assignee-row">
              {inspectors.map(ins => (
                <button key={ins.id} className={`assignee-pill${assigneeId === ins.id ? ' active' : ''}`} onClick={() => setAssigneeId(ins.id)}>
                  <div className="av">{ins.initials}</div>{ins.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field-group">
            <div className="field-label">Remediation Due</div>
            <input type="date" className="field-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="field-group">
            <div className="field-label">Reference Standard</div>
            <input className="field-input" type="text" value={refStandard} onChange={e => setRefStandard(e.target.value)} placeholder="Code / standard reference..." />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={handleLog}>Log Failure</button>
          <button className="btn-lime" onClick={handleSave} style={{ marginLeft: 'auto' }}>Save & Assign</button>
        </div>
      </div>
    </div>
  );
}
