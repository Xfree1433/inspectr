import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ConfirmDialog } from './ConfirmDialog';
import { api } from '../api/client';
import type { Inspection } from '../types';

function scoreColor(score: number, status: string): string {
  if (status === 'pending') return 'var(--warn)';
  if (score >= 80) return 'var(--lime)';
  if (score >= 60) return 'var(--warn)';
  return 'var(--fail)';
}

interface Props {
  inspection: Inspection;
  selected: boolean;
  index: number;
  onClick: () => void;
}

export function InspectionCard({ inspection: r, selected, index, onClick }: Props) {
  const { toast, loadInspections, loadStats, loadFeed, filter } = useApp();
  const [showDelete, setShowDelete] = useState(false);
  const c = scoreColor(r.score, r.status);
  const bc = r.status === 'pass' ? 'bp' : r.status === 'fail' ? 'bf' : 'bn';

  const handleDelete = async () => {
    setShowDelete(false);
    try {
      await api.deleteInspection(r.id);
      toast('Inspection deleted', 't-info', '🗑');
      loadInspections(filter);
      loadStats();
      loadFeed();
    } catch {
      toast('Failed to delete inspection', 't-fail', '!');
    }
  };

  return (
    <>
      <div
        className={`icard${selected ? ' sel' : ''}`}
        style={{ animationDelay: `${index * 0.04}s` }}
        onClick={onClick}
      >
        <div className="ic-top">
          <div>
            <div className="ic-id">{r.id}</div>
            <div className="ic-site">{r.site}</div>
            <div className="ic-type">{r.type}{r.companyName ? ` · ${r.companyName}` : ''}</div>
          </div>
          <div className="ic-meta">
            <div className="ic-who">
              <div className="av">{r.inspectorInitials}</div>
              {r.inspectorName}
            </div>
            <div className="ic-time">{r.time}</div>
          </div>
        </div>
        <div className="ic-bot">
          <div className="sw">
            <div className="st">
              <div className="sf" style={{ width: `${r.score}%`, background: c }} />
            </div>
            <div className="sn" style={{ color: c }}>{r.score}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`badge ${bc}`}>{r.status.toUpperCase()}</span>
            <button
              className="ic-delete"
              title="Delete inspection"
              onClick={e => { e.stopPropagation(); setShowDelete(true); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={showDelete}
        title="Delete Inspection?"
        message={`Permanently delete ${r.id} (${r.site})? This cannot be undone.`}
        confirmLabel="Delete"
        confirmClass="btn-danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </>
  );
}
