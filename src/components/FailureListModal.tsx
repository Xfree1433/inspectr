import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import type { FailureView, RemediationStatus } from '../types';

interface Props {
  open: boolean;
  inspectionId: string;
  onClose: () => void;
}

const sevLabel: Record<string, string> = { low: 'LOW', med: 'MEDIUM', high: 'HIGH' };
const sevClass: Record<string, string> = { low: 'bn', med: 'bw', high: 'bf' };

const remSteps: { value: RemediationStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'verified', label: 'Verified' },
  { value: 'closed', label: 'Closed' },
];

const remClass: Record<RemediationStatus, string> = {
  'open': 'bf',
  'in-progress': 'bw',
  'verified': 'bp',
  'closed': 'bn',
};

export function FailureListModal({ open, inspectionId, onClose }: Props) {
  const { toast } = useApp();
  const [failures, setFailures] = useState<FailureView[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (open && inspectionId) {
      api.getFailures(inspectionId).then(setFailures).catch(() => {});
    }
  }, [open, inspectionId]);

  const handleStatusChange = (id: string, status: RemediationStatus) => {
    api.updateFailure(id, { remediationStatus: status }).then(() => {
      setFailures(prev => prev.map(f => f.id === id ? { ...f, remediationStatus: status } : f));
      toast(`Status updated to ${status}`, 't-info', '~');
    }).catch(() => toast('Failed to update status', 't-fail', '!'));
  };

  if (!open) return null;

  const openCount = failures.filter(f => f.remediationStatus !== 'closed').length;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">
            Logged Failures ({failures.length})
            {openCount > 0 && <span className="badge bf" style={{ marginLeft: 8, fontSize: 10 }}>{openCount} OPEN</span>}
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.8"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.8"/></svg>
          </button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          {failures.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No Failures Logged</div>
              <div className="empty-state-text">No failures have been recorded for this inspection yet.</div>
            </div>
          ) : (
            failures.map(f => (
              <div key={f.id} className={`failure-item${f.remediationStatus === 'closed' ? ' rem-closed' : ''}`}>
                <button
                  type="button"
                  className="failure-item-header"
                  onClick={() => setExpanded(expanded === f.id ? null : f.id)}
                >
                  <div style={{ flex: 1 }}>
                    <div className="failure-item-title">{f.title}</div>
                    <div className="failure-item-meta">
                      <span className={`badge ${remClass[f.remediationStatus]}`} style={{ fontSize: 10 }}>{f.remediationStatus.toUpperCase()}</span>
                      {f.assigneeName && <span>{f.assigneeName}</span>}
                      {f.dueDate && <span>Due: {f.dueDate}</span>}
                    </div>
                  </div>
                  <span className={`badge ${sevClass[f.severity] || 'bn'}`}>{sevLabel[f.severity] || f.severity}</span>
                  <svg className={`failure-chevron${expanded === f.id ? ' open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {expanded === f.id && (
                  <div className="failure-item-body">
                    {f.description && <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>{f.description}</p>}
                    {f.referenceStandard && (
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
                        Ref: {f.referenceStandard}
                      </div>
                    )}
                    {f.photos.length > 0 && (
                      <div className="failure-photos">
                        {f.photos.map((src, i) => (
                          <img key={i} src={src} alt={`Evidence ${i + 1}`} className="failure-photo" />
                        ))}
                      </div>
                    )}
                    <div className="rem-status-row">
                      {remSteps.map((step, i) => {
                        const currentIdx = remSteps.findIndex(s => s.value === f.remediationStatus);
                        const isActive = i <= currentIdx;
                        return (
                          <button
                            key={step.value}
                            className={`rem-step${isActive ? ' active' : ''}${step.value === f.remediationStatus ? ' current' : ''}`}
                            onClick={() => handleStatusChange(f.id, step.value)}
                          >
                            {step.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
