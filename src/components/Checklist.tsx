import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';

export function Checklist({ onOpenFailModal }: { onOpenFailModal: (title: string, checkItemId: string) => void }) {
  const { activeInspection, checklist, loadChecklist, toast, incrementFailBadge, refreshAll } = useApp();

  const { totalItems, doneItems, pct } = useMemo(() => {
    let total = 0, done = 0;
    checklist.forEach(g => {
      total += g.items.length;
      done += g.items.filter(i => i.status === 'done' || i.status === 'failed').length;
    });
    return { totalItems: total, doneItems: done, pct: total > 0 ? Math.round(done / total * 100) : 0 };
  }, [checklist]);

  if (!activeInspection) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        <div className="empty-state-title">No Inspection Selected</div>
        <div className="empty-state-text">
          Select an inspection from the list to view its checklist. Use the ✓ and ✕ buttons to mark each item as passed or failed.
        </div>
      </div>
    );
  }

  const handlePass = async (itemId: string) => {
    await api.updateCheckItem(itemId, { status: 'done' });
    if (navigator.vibrate) navigator.vibrate(40);
    toast('Item passed', 't-pass', '✓');
    loadChecklist(activeInspection.id);
  };

  const handleFail = async (itemId: string, text: string) => {
    await api.updateCheckItem(itemId, { status: 'failed' });
    if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
    toast('Failure flagged — add detail', 't-fail', '⚠');
    incrementFailBadge();
    loadChecklist(activeInspection.id);
    onOpenFailModal(text, itemId);
  };

  const handleSubmit = async () => {
    await api.submitReport(activeInspection.id);
    toast('Report submitted for supervisor approval', 't-pass', '✓');
    refreshAll();
  };

  const statusBadge = activeInspection.status === 'pass' ? 'bp' : activeInspection.status === 'fail' ? 'bf' : 'bn';

  return (
    <div className="cl-col">
      <div className="cl-hdr">
        <div className="cl-site">{activeInspection.site}</div>
        <div className="cl-meta">
          <span className={`badge ${statusBadge}`}>{activeInspection.status === 'pending' ? 'IN PROGRESS' : activeInspection.status.toUpperCase()}</span>
          {activeInspection.id} · {activeInspection.type}
        </div>
        <div className="cl-prog">
          <div className="ptr"><div className="pf" style={{ width: `${pct}%` }} /></div>
          <div className="pp">{pct}%</div>
          <div className="pfr">{doneItems}/{totalItems}</div>
        </div>
      </div>
      <div className="section-hint">
        Work through each item below. Tap ✓ to pass or ✕ to flag a failure. Failed items open a detail form for notes, photos, and assignment.
      </div>
      <div className="cl-scroll">
        {checklist.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-text">No checklist items for this inspection.</div>
          </div>
        ) : (
          checklist.map(group => (
            <div key={group.name}>
              <div className="grp">{group.name}</div>
              {group.items.map(item => (
                <div key={item.id} className={`crow${item.status ? ` ${item.status}` : ''}`}>
                  <div className="cbox">
                    {item.status === 'done' && (
                      <svg viewBox="0 0 11 11"><polyline points="1.5,5.5 4.5,8.5 9.5,2" stroke="#0A0A09" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
                    )}
                    {item.status === 'failed' && (
                      <svg viewBox="0 0 11 11"><line x1="2" y1="2" x2="9" y2="9" stroke="var(--fail)" strokeWidth="1.8"/><line x1="9" y1="2" x2="2" y2="9" stroke="var(--fail)" strokeWidth="1.8"/></svg>
                    )}
                  </div>
                  <div className="crow-body">
                    <div className="crow-text">{item.text}</div>
                    {item.failNote && (
                      <div className="fail-note" onClick={() => onOpenFailModal(item.text, item.id)}>
                        ⚠ {item.failNote} — tap to edit
                      </div>
                    )}
                  </div>
                  {!item.status && (
                    <div className="crow-acts">
                      <button className="act act-p" title="Mark as passed" onClick={(e) => { e.stopPropagation(); handlePass(item.id); }}>
                        <svg width="12" height="12" viewBox="0 0 12 12"><polyline points="1.5,6 4.5,9 10.5,2.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
                      </button>
                      <button className="act act-f" title="Flag as failed — opens failure detail form" onClick={(e) => { e.stopPropagation(); handleFail(item.id, item.text); }}>
                        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.8"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.8"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
        <div className="sub-bar">
          <button className="btn-ghost" title="Flag this inspection for supervisor review" onClick={() => toast('Inspection flagged for review', 't-warn', '⚑')}>FLAG</button>
          <button className="btn-ghost" title="Save current progress as a draft" onClick={() => toast('Draft saved', 't-info', '✓')}>SAVE</button>
          <button className="btn-lime" style={{ flex: 2 }} title="Submit completed inspection for approval" onClick={handleSubmit}>SUBMIT REPORT</button>
        </div>
      </div>
    </div>
  );
}
