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
      <div style={{ padding: 20, color: 'var(--text-ghost)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1 }}>
        Select an inspection to view checklist
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
      <div className="cl-scroll">
        {checklist.map(group => (
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
                    <button className="act act-p" title="Pass" onClick={(e) => { e.stopPropagation(); handlePass(item.id); }}>
                      <svg width="12" height="12" viewBox="0 0 12 12"><polyline points="1.5,6 4.5,9 10.5,2.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
                    </button>
                    <button className="act act-f" title="Fail" onClick={(e) => { e.stopPropagation(); handleFail(item.id, item.text); }}>
                      <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.8"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.8"/></svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        <div className="sub-bar">
          <button className="btn-ghost" onClick={() => toast('Inspection flagged for review', 't-warn', '⚑')}>FLAG</button>
          <button className="btn-ghost" onClick={() => toast('Draft saved', 't-info', '✓')}>SAVE</button>
          <button className="btn-lime" style={{ flex: 2 }} onClick={handleSubmit}>SUBMIT REPORT</button>
        </div>
      </div>
    </div>
  );
}
